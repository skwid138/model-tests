import { spawn as spawnProcess } from 'node:child_process';
import { basename, join } from 'node:path';
import { mkdtemp, realpath, stat, writeFile, readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const ERROR_CODES = new Set([
  'memory_query_failed',
  'gpu_query_failed',
  'gpu_ambiguous',
  'server_query_failed',
  'server_absent',
  'server_ambiguous',
  'server_process_metrics_missing',
]);

export class MonitorError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'MonitorError';
    this.code = code;
  }
}

export function buildSshArgs(host) {
  if (
    typeof host !== 'string'
    || !/^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,62}[A-Za-z0-9])?$/.test(host)
  ) {
    throw new MonitorError('invalid_arguments', 'Host must be a validated SSH alias');
  }

  return [
    '-o', 'BatchMode=yes',
    '-o', 'StrictHostKeyChecking=yes',
    '-o', 'ConnectTimeout=5',
    host,
    'powershell.exe', '-NoProfile', '-NonInteractive', '-Command', '-',
  ];
}

function exactKeys(value, expected) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...expected].sort().join('\0');
}

function validMetric(value, { integer = false, positive = false } = {}) {
  return value === null || (
    typeof value === 'number'
    && Number.isFinite(value)
    && value >= (positive ? 1 : 0)
    && (!integer || Number.isSafeInteger(value))
  );
}

export function decodeSampleLine(line) {
  let sample;
  try {
    sample = JSON.parse(line);
  } catch {
    throw new MonitorError('malformed_sample', 'Sample is not valid JSON');
  }

  if (!exactKeys(sample, ['version', 'timestampUtc', 'memory', 'gpu', 'server', 'errors'])) {
    throw new MonitorError('malformed_sample', 'Sample fields do not match wire version 1');
  }
  if (
    sample.version !== 1
    || typeof sample.timestampUtc !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(sample.timestampUtc)
    || !Number.isFinite(Date.parse(sample.timestampUtc))
  ) {
    throw new MonitorError('malformed_sample', 'Sample version or UTC timestamp is invalid');
  }

  const memoryFields = ['availableMiB', 'committedBytes', 'commitLimitBytes'];
  if (!exactKeys(sample.memory, memoryFields)) {
    throw new MonitorError('malformed_sample', 'Memory fields do not match the allowlist');
  }
  if (
    !validMetric(sample.memory.availableMiB, { integer: true })
    || !validMetric(sample.memory.committedBytes, { integer: true })
    || !validMetric(sample.memory.commitLimitBytes, { integer: true })
  ) {
    throw new MonitorError('malformed_sample', 'Memory metrics must be nonnegative integers or null');
  }

  const gpuFields = ['usedMiB', 'freeMiB', 'totalMiB', 'utilizationPct'];
  if (!exactKeys(sample.gpu, gpuFields)) {
    throw new MonitorError('malformed_sample', 'GPU fields do not match the allowlist');
  }
  if (
    !validMetric(sample.gpu.usedMiB)
    || !validMetric(sample.gpu.freeMiB)
    || !validMetric(sample.gpu.totalMiB)
    || !validMetric(sample.gpu.utilizationPct)
    || (sample.gpu.utilizationPct !== null && sample.gpu.utilizationPct > 100)
  ) {
    throw new MonitorError('malformed_sample', 'GPU metrics must be in range or null');
  }

  if (sample.server !== null) {
    if (!exactKeys(sample.server, ['pid', 'workingSetBytes', 'privateWorkingSetBytes', 'privateBytes'])) {
      throw new MonitorError('malformed_sample', 'Server fields do not match the allowlist');
    }
    if (
      !validMetric(sample.server.pid, { integer: true, positive: true })
      || !Number.isSafeInteger(sample.server.pid)
      || sample.server.pid <= 0
      || !validMetric(sample.server.workingSetBytes, { integer: true })
      || !validMetric(sample.server.privateWorkingSetBytes, { integer: true })
      || !validMetric(sample.server.privateBytes, { integer: true })
    ) {
      throw new MonitorError('malformed_sample', 'Server metrics must be nonnegative integers or null');
    }
  }

  if (
    !Array.isArray(sample.errors)
    || sample.errors.some((code) => typeof code !== 'string' || !ERROR_CODES.has(code))
  ) {
    throw new MonitorError('malformed_sample', 'Sample contains an unrecognized error code');
  }

  return sample;
}

const MAX_CAPTURE_BYTES = 256 * 1024;
const SAMPLE_INTERVAL_SECONDS = 1;

function requestedDuration(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 180) {
    throw new MonitorError('invalid_arguments', 'Duration must be an integer from 1 through 180 seconds');
  }
  return value;
}

async function fixedPayload(durationSeconds) {
  const templatePath = new URL('./benchmark-monitor-payload.ps1', import.meta.url);
  const template = await readFile(templatePath, 'utf8');
  const token = '__DURATION_SECONDS__';
  if (template.split(token).length !== 2) {
    throw new MonitorError('payload_invalid', 'Fixed PowerShell payload has an invalid duration placeholder');
  }
  return template.replace(token, String(durationSeconds));
}

function defaultSpawnSsh(args) {
  return spawnProcess('ssh', args, { stdio: ['pipe', 'pipe', 'ignore'] });
}

function summarizeCapture({
  code,
  chunks,
  termination,
  startedAtUtc,
  startedAtMonotonic,
  expectedSampleCount,
}) {
  const reasonCodes = [];
  const errors = [];
  const samples = [];
  const addUnique = (array, value) => {
    if (!array.includes(value)) array.push(value);
  };

  if (termination) {
    addUnique(reasonCodes, termination.reason);
    addUnique(errors, termination.error);
  }
  if (code !== 0 && !termination) {
    addUnique(reasonCodes, 'transport_failed');
    addUnique(errors, 'ssh_exit_nonzero');
  }

  let output;
  try {
    output = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
  } catch {
    addUnique(reasonCodes, 'malformed_sample');
    addUnique(errors, 'invalid_utf8');
    output = '';
  }

  const lines = output === '' ? [] : output.split('\n');
  if (lines.at(-1) === '') lines.pop();
  try {
    for (const line of lines) {
      if (line.length === 0) throw new MonitorError('malformed_sample', 'Empty NDJSON line');
      samples.push(decodeSampleLine(line));
    }
  } catch (error) {
    addUnique(reasonCodes, 'malformed_sample');
    addUnique(errors, error instanceof MonitorError ? error.code : 'malformed_sample');
  }

  if (samples.length === 0 && reasonCodes.length === 0) {
    addUnique(reasonCodes, 'malformed_sample');
    addUnique(errors, 'empty_capture');
  }
  if (samples.length !== expectedSampleCount && reasonCodes.length === 0) {
    addUnique(reasonCodes, 'transport_failed');
    addUnique(errors, 'sample_count_mismatch');
  }
  for (const sample of samples) {
    for (const codeValue of sample.errors) addUnique(errors, codeValue);
  }
  if (errors.some((error) => ERROR_CODES.has(error))) {
    for (const error of errors) {
      if (ERROR_CODES.has(error)) addUnique(reasonCodes, error);
    }
  }

  const elapsedMs = Math.max(0, performance.now() - startedAtMonotonic);
  const failed = reasonCodes.length > 0 || errors.length > 0;
  return {
    schemaVersion: 1,
    status: samples.length === 0 ? 'failed' : failed ? 'partial' : 'complete',
    reasonCodes,
    expectedSampleCount,
    receivedSampleCount: samples.length,
    startedAtUtc,
    finishedAtUtc: new Date().toISOString(),
    timestampProvenance: 'local_system_clock',
    durationMs: Math.round(elapsedMs),
    durationProvenance: 'observed_local_monotonic',
    requestedDurationProvenance: 'operator_requested',
    sampleIntervalSeconds: SAMPLE_INTERVAL_SECONDS,
    errors,
    samples,
  };
}

export async function collectRemoteSamples({
  host,
  durationSeconds,
  spawnSsh = defaultSpawnSsh,
  signal,
  watchdogMs,
  stallMs = 20_000,
  killGraceMs = 1000,
} = {}) {
  const args = buildSshArgs(host);
  const seconds = requestedDuration(durationSeconds);
  if (typeof spawnSsh !== 'function') {
    throw new MonitorError('invalid_arguments', 'spawnSsh must be an owned SSH adapter');
  }
  const finalWatchdogMs = watchdogMs ?? (seconds * 1000 + 15_000);
  if (
    !Number.isFinite(finalWatchdogMs)
    || finalWatchdogMs <= 0
    || !Number.isFinite(stallMs)
    || stallMs <= 0
    || !Number.isFinite(killGraceMs)
    || killGraceMs <= 0
  ) {
    throw new MonitorError('invalid_arguments', 'Watchdog limits must be positive finite values');
  }

  const payload = await fixedPayload(seconds);
  const startedAtUtc = new Date().toISOString();
  const startedAtMonotonic = performance.now();
  let child;
  try {
    child = spawnSsh(args);
  } catch {
    return summarizeCapture({
      code: null,
      chunks: [],
      termination: { reason: 'transport_failed', error: 'ssh_spawn_failed' },
      startedAtUtc,
      startedAtMonotonic,
      expectedSampleCount: seconds,
    });
  }
  if (
    !child
    || typeof child.kill !== 'function'
    || typeof child.once !== 'function'
    || typeof child.stdout?.on !== 'function'
    || typeof child.stdin?.on !== 'function'
    || typeof child.stdin?.once !== 'function'
    || typeof child.stdin?.end !== 'function'
  ) {
    return summarizeCapture({
      code: null,
      chunks: [],
      termination: { reason: 'transport_failed', error: 'invalid_ssh_adapter' },
      startedAtUtc,
      startedAtMonotonic,
      expectedSampleCount: seconds,
    });
  }

  return new Promise((resolveCapture) => {
    const chunks = [];
    let capturedBytes = 0;
    let termination = null;
    let settled = false;
    let watchdogTimer;
    let stallTimer;
    let killTimer;
    let finalizeTimer;
    let stdinCloseTimer;
    let childClosed = false;
    let childCloseCode = null;
    let stdinFinished = false;
    let stdinClosed = false;

    const cleanup = () => {
      clearTimeout(watchdogTimer);
      clearTimeout(stallTimer);
      clearTimeout(killTimer);
      clearTimeout(finalizeTimer);
      clearTimeout(stdinCloseTimer);
      signal?.removeEventListener('abort', onAbort);
      child.stdout?.removeListener('data', onData);
      child.stdout?.removeListener('error', onStreamError);
      child.removeListener('error', onChildError);
      child.removeListener('close', onClose);
      child.stdin?.removeListener('finish', onStdinFinish);
      if (stdinClosed) {
        child.stdin?.removeListener('error', onStdinError);
        child.stdin?.removeListener('close', onStdinClose);
      }
    };
    const finish = (code) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolveCapture(summarizeCapture({
        code,
        chunks,
        termination,
        startedAtUtc,
        startedAtMonotonic,
        expectedSampleCount: seconds,
      }));
    };
    const terminate = (reason, error) => {
      if (termination || settled) return;
      termination = { reason, error };
      try {
        child.kill('SIGTERM');
      } catch {
        // The adapter may already have closed its owned child.
      }
      killTimer = setTimeout(() => {
        if (!settled) {
          try {
            child.kill('SIGKILL');
          } catch {
            // Escalation is restricted to the owned SSH child.
          }
          finalizeTimer = setTimeout(() => finish(null), killGraceMs);
        }
      }, killGraceMs);
    };
    const resetStallTimer = () => {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => terminate('capture_timeout', 'stall_timeout'), stallMs);
    };
    const onData = (chunk) => {
      capturedBytes += chunk.length;
      if (capturedBytes > MAX_CAPTURE_BYTES) {
        terminate('transport_failed', 'output_limit');
        return;
      }
      chunks.push(Buffer.from(chunk));
      resetStallTimer();
    };
    const onStreamError = () => terminate('transport_failed', 'stdout_read_failed');
    const onChildError = () => {
      termination ??= { reason: 'transport_failed', error: 'ssh_process_error' };
      finish(null);
    };
    const onStdinFinish = () => { stdinFinished = true; };
    const onStdinClose = () => {
      stdinClosed = true;
      child.stdin.removeListener('error', onStdinError);
      if (childClosed) finish(childCloseCode);
    };
    const onStdinError = () => {
      if (settled) return;
      if (childClosed) {
        termination ??= { reason: 'transport_failed', error: 'stdin_write_failed' };
        if (stdinClosed) finish(null);
        return;
      }
      terminate('transport_failed', 'stdin_write_failed');
    };
    const onClose = (code) => {
      childClosed = true;
      childCloseCode = code;
      const inputFlushed = stdinFinished || child.stdin.writableFinished === true;
      if (!inputFlushed && !termination) {
        termination = { reason: 'transport_failed', error: 'stdin_not_flushed' };
      }
      if (stdinClosed) {
        finish(code);
      } else {
        stdinCloseTimer = setTimeout(() => {
          if (!settled) {
            termination ??= { reason: 'transport_failed', error: 'stdin_close_unobserved' };
            finish(childCloseCode);
          }
        }, killGraceMs);
      }
    };
    const onAbort = () => terminate('interrupted', 'interrupted');

    child.stdout?.on('data', onData);
    child.stdout?.once('error', onStreamError);
    child.once('error', onChildError);
    child.once('close', onClose);
    child.stdin.on('error', onStdinError);
    child.stdin.once('finish', onStdinFinish);
    child.stdin.once('close', onStdinClose);
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();

    watchdogTimer = setTimeout(() => terminate('capture_timeout', 'watchdog_timeout'), finalWatchdogMs);
    resetStallTimer();
    try {
      child.stdin.end(payload);
    } catch {
      terminate('transport_failed', 'stdin_write_failed');
    }
  });
}

export function deriveServerDeltas(samples) {
  if (!Array.isArray(samples)) throw new TypeError('samples must be an array');
  const deltas = [];
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1].server;
    const current = samples[index].server;
    if (!previous || !current) {
      deltas.push({ index, status: 'invalid', reason: 'server_missing', values: null });
    } else if (
      !Number.isSafeInteger(previous.pid)
      || previous.pid <= 0
      || !Number.isSafeInteger(current.pid)
      || current.pid <= 0
    ) {
      const pidMissing = previous.pid === null
        || previous.pid === undefined
        || current.pid === null
        || current.pid === undefined;
      deltas.push({
        index,
        status: 'invalid',
        reason: pidMissing ? 'pid_missing' : 'pid_invalid',
        values: null,
      });
    } else if (previous.pid !== current.pid) {
      deltas.push({ index, status: 'invalid', reason: 'pid_transition', values: null });
    } else {
      const metricKeys = ['workingSetBytes', 'privateWorkingSetBytes', 'privateBytes'];
      const values = Object.fromEntries(metricKeys.map((key) => [
        key,
        previous[key] === null || current[key] === null
          ? null
          : current[key] - previous[key],
      ]));
      const metricsComplete = Object.values(values).every((value) => value !== null);
      deltas.push({
        index,
        status: metricsComplete ? 'valid' : 'partial',
        ...(metricsComplete ? {} : { reason: 'metric_missing' }),
        pid: current.pid,
        values,
      });
    }
  }
  return deltas;
}

export async function captureToDirectory({
  host,
  durationSeconds,
  outputRoot,
  spawnSsh,
  signal,
} = {}) {
  buildSshArgs(host);
  const seconds = requestedDuration(durationSeconds);
  if (typeof outputRoot !== 'string' || outputRoot.length === 0) {
    throw new MonitorError('invalid_arguments', 'An existing output root is required');
  }
  const resolvedRoot = await realpath(outputRoot);
  if (!(await stat(resolvedRoot)).isDirectory()) {
    throw new MonitorError('invalid_arguments', 'Output root must be a directory');
  }
  const captureDirectory = await mkdtemp(join(resolvedRoot, '.benchmark-monitor-'));
  const capture = await collectRemoteSamples({ host, durationSeconds: seconds, spawnSsh, signal });
  const serverDeltas = deriveServerDeltas(capture.samples);
  const sampleText = capture.samples.length === 0
    ? ''
    : `${capture.samples.map((sample) => JSON.stringify(sample)).join('\n')}\n`;
  const manifest = {
    schemaVersion: 1,
    captureId: basename(captureDirectory),
    status: capture.status,
    reasonCodes: capture.reasonCodes,
    expectedSampleCount: capture.expectedSampleCount,
    receivedSampleCount: capture.receivedSampleCount,
    startedAtUtc: capture.startedAtUtc,
    finishedAtUtc: capture.finishedAtUtc,
    durationMs: capture.durationMs,
    durationProvenance: capture.durationProvenance,
    requestedDurationProvenance: capture.requestedDurationProvenance,
    timestampProvenance: capture.timestampProvenance,
    requestedDurationSeconds: seconds,
    sampleIntervalSeconds: capture.sampleIntervalSeconds,
    errors: capture.errors,
    serverDeltas,
    artifacts: { samples: 'samples.ndjson' },
  };
  await writeFile(join(captureDirectory, 'samples.ndjson'), sampleText, { flag: 'wx', mode: 0o600 });
  await writeFile(join(captureDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, {
    flag: 'wx',
    mode: 0o600,
  });

  return { directory: captureDirectory, manifest };
}

export function parseCliArgs(args) {
  const options = {};
  if (args.length === 1 && args[0] === '--help') return { help: true };
  const flags = new Map([
    ['--host', 'host'],
    ['--duration-seconds', 'durationSeconds'],
    ['--output-root', 'outputRoot'],
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const key = flags.get(args[index]);
    const value = args[index + 1];
    if (!key || value === undefined || value.startsWith('--') || Object.hasOwn(options, key)) {
      throw new MonitorError('invalid_arguments', 'Expected --host, --duration-seconds, and --output-root once each');
    }
    options[key] = value;
    index += 1;
  }
  if (Object.keys(options).length !== flags.size) {
    throw new MonitorError('invalid_arguments', 'Expected --host, --duration-seconds, and --output-root once each');
  }
  buildSshArgs(options.host);
  if (!/^\d+$/.test(options.durationSeconds)) {
    throw new MonitorError('invalid_arguments', 'Duration must be an integer from 1 through 180 seconds');
  }
  options.durationSeconds = requestedDuration(Number(options.durationSeconds));
  if (options.outputRoot.length === 0) {
    throw new MonitorError('invalid_arguments', 'An existing output root is required');
  }
  return { help: false, ...options };
}
