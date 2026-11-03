import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import test from 'node:test';

import {
  buildSshArgs,
  captureToDirectory,
  collectRemoteSamples,
  decodeSampleLine,
  deriveServerDeltas,
} from '../benchmark-monitor-core.mjs';

const validSample = {
  version: 1,
  timestampUtc: '2026-11-02T12:00:00.000Z',
  memory: { availableMiB: 4096, committedBytes: 1200000000, commitLimitBytes: 16000000000 },
  gpu: { usedMiB: 1024, freeMiB: 7168, totalMiB: 8192, utilizationPct: 12 },
  server: { pid: 4321, workingSetBytes: 1200000000, privateWorkingSetBytes: 900000000, privateBytes: 1500000000 },
  errors: [],
};

function makeChild({ output = '', exitCode = 0, closeOnKill = true } = {}) {
  const child = new EventEmitter();
  const kills = [];
  let script = '';
  child.stdout = new PassThrough();
  child.stdin = new Writable({
    write(chunk, _encoding, callback) {
      script += chunk.toString('utf8');
      callback();
    },
  });
  child.kill = (signal) => {
    kills.push(signal);
    if (closeOnKill) {
      queueMicrotask(() => {
        child.stdout.end();
        child.emit('close', null, signal);
      });
    }
    return true;
  };
  child.stdin.once('finish', () => {
    if (output !== '') child.stdout.write(output);
    if (exitCode !== null) {
      child.stdout.end();
      child.emit('close', exitCode, null);
    }
  });
  return {
    child,
    kills,
    get script() { return script; },
  };
}

function makeEpipeChild({ exitBeforeEpipe = false } = {}) {
  const child = new EventEmitter();
  const stdin = new EventEmitter();
  const kills = [];
  let closed = false;
  let errorListenersAtLateError = 0;
  child.stdout = new PassThrough();
  child.stdin = stdin;
  stdin.end = () => {
    if (exitBeforeEpipe) {
      queueMicrotask(() => {
        closed = true;
        child.stdout.end();
        child.emit('close', 255, null);
        setImmediate(() => {
          errorListenersAtLateError = stdin.listenerCount('error');
          stdin.emit('error', Object.assign(new Error('broken pipe'), { code: 'EPIPE' }));
          stdin.emit('close');
        });
      });
    } else {
      queueMicrotask(() => {
        stdin.emit('error', Object.assign(new Error('broken pipe'), { code: 'EPIPE' }));
      });
    }
  };
  child.kill = (signal) => {
    kills.push(signal);
    if (!closed) {
      queueMicrotask(() => {
        closed = true;
        child.stdout.end();
        child.emit('close', null, signal);
      });
    }
    return !closed;
  };

  return {
    child,
    stdin,
    kills,
    get errorListenersAtLateError() { return errorListenersAtLateError; },
  };
}

test('decodes one versioned sample while preserving measured values', () => {
  assert.deepEqual(decodeSampleLine(JSON.stringify(validSample)), validSample);
});

test('preserves explicit unknown metrics as null and legitimate zero as zero', () => {
  const sample = structuredClone(validSample);
  sample.memory.availableMiB = null;
  sample.gpu.utilizationPct = 0;
  sample.server = null;
  sample.errors = ['server_absent'];

  assert.deepEqual(decodeSampleLine(JSON.stringify(sample)), sample);
});

test('preserves reported GPU totals without inferring reserved memory', () => {
  const sample = structuredClone(validSample);
  sample.gpu.usedMiB = 100;
  sample.gpu.freeMiB = 200;
  sample.gpu.totalMiB = 1000;

  assert.deepEqual(decodeSampleLine(JSON.stringify(sample)).gpu, sample.gpu);
});

test('rejects malformed, out-of-range, and non-allowlisted sample data', () => {
  assert.throws(() => decodeSampleLine('{'), { code: 'malformed_sample' });
  assert.throws(() => decodeSampleLine(JSON.stringify({ ...validSample, privatePath: '/private' })), {
    code: 'malformed_sample',
  });
  assert.throws(() => decodeSampleLine(JSON.stringify({
    ...validSample,
    gpu: { ...validSample.gpu, utilizationPct: 101 },
  })), { code: 'malformed_sample' });
  assert.throws(() => decodeSampleLine(JSON.stringify({
    ...validSample,
    memory: { ...validSample.memory, availableMiB: -1 },
  })), { code: 'malformed_sample' });
});

test('builds a fixed SSH command and rejects host aliases that could inject arguments', () => {
  assert.deepEqual(buildSshArgs('peesea'), [
    '-o', 'BatchMode=yes',
    '-o', 'StrictHostKeyChecking=yes',
    '-o', 'ConnectTimeout=5',
    'peesea',
    'powershell.exe', '-NoProfile', '-NonInteractive', '-Command', '-',
  ]);
  assert.throws(() => buildSshArgs('peesea; whoami'), { code: 'invalid_arguments' });
});

test('capture sends a blank-line-terminated fixed payload and returns valid sample metadata', async () => {
  const fake = makeChild({ output: `${JSON.stringify(validSample)}\n` });
  const capture = await collectRemoteSamples({
    host: 'peesea',
    durationSeconds: 1,
    spawnSsh: (args) => {
      assert.deepEqual(args, buildSshArgs('peesea'));
      return fake.child;
    },
  });

  assert.equal(capture.status, 'complete');
  assert.equal(capture.expectedSampleCount, 1);
  assert.equal(capture.receivedSampleCount, 1);
  assert.equal(capture.samples[0].server.pid, 4321);
  assert.match(fake.script, /^\$durationSeconds = 1$/m);
  assert.match(fake.script, /\r?\n\r?\n$/);
  assert.match(fake.script, /Win32_PerfFormattedData_PerfOS_Memory/);
  assert.match(fake.script, /CommittedBytes/);
  assert.match(fake.script, /CommitLimit/);
  assert.match(fake.script, /Win32_PerfFormattedData_PerfProc_Process/);
  assert.match(fake.script, /IDProcess/);
  assert.match(fake.script, /WorkingSetPrivate/);
  assert.match(fake.script, /PrivateBytes/);
  assert.match(fake.script, /--query-gpu=memory\.used,memory\.free,memory\.total,utilization\.gpu/);
  assert.doesNotMatch(fake.script, /CommandLine|ExecutablePath|Start-Process|Stop-Process|Invoke-RestMethod/);
  assert.doesNotMatch(fake.script, /__DURATION_SECONDS__/);
  assert.deepEqual(fake.kills, []);
});

test('malformed lines and invalid UTF-8 never become partial JSON metrics', async () => {
  for (const output of ['{not-json\n', Buffer.from([0xc3, 0x28])]) {
    const fake = makeChild({ output });
    const capture = await collectRemoteSamples({
      host: 'peesea',
      durationSeconds: 1,
      spawnSsh: () => fake.child,
    });

    assert.equal(capture.status, 'failed');
    assert.deepEqual(capture.reasonCodes, ['malformed_sample']);
    assert.equal(capture.receivedSampleCount, 0);
  }
});

test('query failures remain explicit null metrics in a partial capture', async () => {
  const sample = structuredClone(validSample);
  sample.memory.availableMiB = null;
  sample.gpu.usedMiB = null;
  sample.server = null;
  sample.errors = ['memory_query_failed', 'gpu_query_failed', 'server_absent'];
  const fake = makeChild({ output: `${JSON.stringify(sample)}\n` });
  const capture = await collectRemoteSamples({
    host: 'peesea',
    durationSeconds: 1,
    spawnSsh: () => fake.child,
  });

  assert.equal(capture.status, 'partial');
  assert.deepEqual(capture.reasonCodes, ['memory_query_failed', 'gpu_query_failed', 'server_absent']);
  assert.deepEqual(capture.samples[0].errors, sample.errors);
  assert.equal(capture.samples[0].memory.availableMiB, null);
  assert.equal(capture.samples[0].gpu.usedMiB, null);
});

test('capture output remains bounded and terminates only its SSH child', async () => {
  const fake = makeChild({ output: Buffer.alloc(300 * 1024, 0x20), exitCode: null });
  const capture = await collectRemoteSamples({
    host: 'peesea',
    durationSeconds: 1,
    spawnSsh: () => fake.child,
  });

  assert.equal(capture.status, 'failed');
  assert.deepEqual(capture.reasonCodes, ['transport_failed']);
  assert.ok(capture.errors.includes('output_limit'));
  assert.deepEqual(fake.kills, ['SIGTERM']);
});

test('stall timeout terminates only the owned SSH child and reports a failed capture', async () => {
  const fake = makeChild({ output: '', exitCode: null });
  const capture = await collectRemoteSamples({
    host: 'peesea',
    durationSeconds: 1,
    spawnSsh: () => fake.child,
    watchdogMs: 100,
    stallMs: 10,
  });

  assert.equal(capture.status, 'failed');
  assert.deepEqual(capture.reasonCodes, ['capture_timeout']);
  assert.ok(capture.errors.includes('stall_timeout'));
  assert.deepEqual(fake.kills, ['SIGTERM']);
});

test('watchdog bounds cleanup even if the SSH adapter does not report child close', async () => {
  const fake = makeChild({ output: '', exitCode: null, closeOnKill: false });
  const capture = await collectRemoteSamples({
    host: 'peesea',
    durationSeconds: 1,
    spawnSsh: () => fake.child,
    watchdogMs: 5,
    stallMs: 100,
    killGraceMs: 5,
  });

  assert.equal(capture.status, 'failed');
  assert.deepEqual(capture.reasonCodes, ['capture_timeout']);
  assert.deepEqual(fake.kills, ['SIGTERM', 'SIGKILL']);
});

test('an aborted capture is marked interrupted and closes its owned child', async () => {
  const fake = makeChild({ output: '', exitCode: null });
  const controller = new AbortController();
  const capturePromise = collectRemoteSamples({
    host: 'peesea',
    durationSeconds: 1,
    spawnSsh: () => fake.child,
    signal: controller.signal,
    watchdogMs: 100,
    stallMs: 100,
  });
  controller.abort();
  const capture = await capturePromise;

  assert.equal(capture.status, 'failed');
  assert.deepEqual(capture.reasonCodes, ['interrupted']);
  assert.deepEqual(fake.kills, ['SIGTERM']);
});

test('SSH failures are explicit and do not trigger retries', async () => {
  const fake = makeChild({ output: '', exitCode: 255 });
  let spawnCount = 0;
  const capture = await collectRemoteSamples({
    host: 'peesea',
    durationSeconds: 1,
    spawnSsh: () => {
      spawnCount += 1;
      return fake.child;
    },
  });

  assert.equal(capture.status, 'failed');
  assert.deepEqual(capture.reasonCodes, ['transport_failed']);
  assert.equal(fake.kills.length, 0);
  assert.equal(spawnCount, 1);
});

test('server deltas are invalidated across missing samples or PID transitions', () => {
  const nextSample = structuredClone(validSample);
  nextSample.server.pid = 9876;
  const noServerSample = { ...structuredClone(validSample), server: null };

  assert.deepEqual(deriveServerDeltas([validSample, nextSample, noServerSample]), [
    { index: 1, status: 'invalid', reason: 'pid_transition', values: null },
    { index: 2, status: 'invalid', reason: 'server_missing', values: null },
  ]);
});

test('only equal known positive safe PIDs can produce process deltas', () => {
  for (const pid of [null, undefined, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const previous = structuredClone(validSample);
    const current = structuredClone(validSample);
    previous.server.pid = pid;
    current.server.pid = pid;
    assert.deepEqual(deriveServerDeltas([previous, current]), [{
      index: 1,
      status: 'invalid',
      reason: pid == null ? 'pid_missing' : 'pid_invalid',
      values: null,
    }]);
  }

  const missingWirePid = structuredClone(validSample);
  missingWirePid.server.pid = null;
  assert.throws(() => decodeSampleLine(JSON.stringify(missingWirePid)), { code: 'malformed_sample' });

  const samePid = structuredClone(validSample);
  const nextSamePid = structuredClone(validSample);
  nextSamePid.server.workingSetBytes += 10;
  assert.deepEqual(deriveServerDeltas([samePid, nextSamePid])[0], {
    index: 1,
    status: 'valid',
    pid: 4321,
    values: {
      workingSetBytes: 10,
      privateWorkingSetBytes: 0,
      privateBytes: 0,
    },
  });
});

test('unknown process measurements stay null in same-PID deltas', () => {
  const previous = structuredClone(validSample);
  const current = structuredClone(validSample);
  previous.server.privateBytes = null;
  current.server.privateBytes = null;

  assert.deepEqual(deriveServerDeltas([previous, current]), [{
    index: 1,
    status: 'partial',
    reason: 'metric_missing',
    pid: 4321,
    values: {
      workingSetBytes: 0,
      privateWorkingSetBytes: 0,
      privateBytes: null,
    },
  }]);
});

test('shell entry supports help and rejects invalid arguments before SSH', () => {
  const entry = fileURLToPath(new URL('../benchmark-monitor', import.meta.url));
  const help = spawnSync(entry, ['--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /capture-only resource samples/i);

  const invalid = spawnSync(entry, [
    '--host', 'peesea;whoami',
    '--duration-seconds', '10',
    '--output-root', '.',
  ], { encoding: 'utf8' });
  assert.equal(invalid.status, 2);
  assert.match(invalid.stderr, /validated SSH alias/);
});

test('capture writes only bounded relative artifacts and omits the host alias', async (t) => {
  const testDirectory = fileURLToPath(new URL('.', import.meta.url));
  const outputRoot = await mkdtemp(join(testDirectory, '.capture-root-'));
  t.after(() => rm(outputRoot, { recursive: true, force: true }));
  const fake = makeChild({ output: `${JSON.stringify(validSample)}\n` });
  const result = await captureToDirectory({
    host: 'peesea',
    durationSeconds: 1,
    outputRoot,
    spawnSsh: () => fake.child,
  });
  const manifestText = await readFile(join(result.directory, 'manifest.json'), 'utf8');
  const sampleText = await readFile(join(result.directory, 'samples.ndjson'), 'utf8');
  const manifest = JSON.parse(manifestText);

  assert.equal(manifest.status, 'complete');
  assert.equal(manifest.durationProvenance, 'observed_local_monotonic');
  assert.equal(manifest.requestedDurationProvenance, 'operator_requested');
  assert.deepEqual(manifest.artifacts, { samples: 'samples.ndjson' });
  assert.deepEqual(manifest.serverDeltas, []);
  assert.doesNotMatch(manifestText, /peesea|\/Users\/|\/private\//);
  assert.equal(sampleText, `${JSON.stringify(validSample)}\n`);
});

test('asynchronous SSH stdin EPIPE produces a failed capture manifest', async (t) => {
  const testDirectory = fileURLToPath(new URL('.', import.meta.url));
  const outputRoot = await mkdtemp(join(testDirectory, '.stdin-epipe-'));
  t.after(() => rm(outputRoot, { recursive: true, force: true }));
  const fake = makeEpipeChild();
  let observedError = false;
  fake.stdin.on('error', () => {
    observedError = true;
    queueMicrotask(() => {
      fake.child.stdout.end();
      fake.child.emit('close', 255, null);
      fake.stdin.emit('close');
    });
  });

  const result = await captureToDirectory({
    host: 'peesea',
    durationSeconds: 1,
    outputRoot,
    spawnSsh: () => fake.child,
  });
  const manifest = JSON.parse(await readFile(join(result.directory, 'manifest.json'), 'utf8'));

  assert.equal(observedError, true);
  assert.equal(manifest.status, 'failed');
  assert.deepEqual(manifest.reasonCodes, ['transport_failed']);
  assert.ok(manifest.errors.includes('stdin_write_failed'));
  assert.deepEqual(fake.kills, ['SIGTERM']);
});

test('early SSH close and late stdin EPIPE preserve failure metadata without a listener leak', async (t) => {
  const testDirectory = fileURLToPath(new URL('.', import.meta.url));
  const outputRoot = await mkdtemp(join(testDirectory, '.stdin-early-exit-'));
  t.after(() => rm(outputRoot, { recursive: true, force: true }));
  const fake = makeEpipeChild({ exitBeforeEpipe: true });
  let observedError = false;
  fake.stdin.on('error', () => { observedError = true; });

  const result = await captureToDirectory({
    host: 'peesea',
    durationSeconds: 1,
    outputRoot,
    spawnSsh: () => fake.child,
  });
  const manifest = JSON.parse(await readFile(join(result.directory, 'manifest.json'), 'utf8'));

  assert.equal(observedError, true);
  assert.equal(fake.errorListenersAtLateError, 2);
  assert.equal(fake.stdin.listenerCount('error'), 1);
  assert.equal(manifest.status, 'failed');
  assert.deepEqual(manifest.reasonCodes, ['transport_failed']);
  assert.ok(manifest.errors.includes('stdin_not_flushed'));
  assert.deepEqual(fake.kills, []);
});
