import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

import { captureToDirectory, MonitorError, parseCliArgs } from './benchmark-monitor-core.mjs';

const HELP = `Usage: tools/benchmark-monitor --host SSH_ALIAS --duration-seconds 1..180 --output-root EXISTING_DIR

Capture-only resource samples from one SSH host. The remote payload is fixed;
the monitor does not upload files, start/stop services, or retry SSH.

Example: tools/benchmark-monitor --host peesea --duration-seconds 10 --output-root ./captures
`;

export async function main(args = process.argv.slice(2), {
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  let options;
  try {
    options = parseCliArgs(args);
  } catch (error) {
    stderr.write(`${error instanceof MonitorError ? error.message : 'Invalid arguments'}\n`);
    return 2;
  }
  if (options.help) {
    stdout.write(HELP);
    return 0;
  }

  const controller = new AbortController();
  const abort = () => controller.abort();
  process.once('SIGINT', abort);
  process.once('SIGTERM', abort);
  try {
    const result = await captureToDirectory({ ...options, signal: controller.signal });
    stdout.write(`Capture ${result.manifest.status}: ${result.manifest.receivedSampleCount}/${result.manifest.expectedSampleCount} samples; capture id ${result.manifest.captureId} under the supplied output root\n`);
    return result.manifest.status === 'complete' ? 0 : 1;
  } catch (error) {
    stderr.write(`${error instanceof MonitorError ? error.message : 'Capture failed'}\n`);
    return 1;
  } finally {
    process.removeListener('SIGINT', abort);
    process.removeListener('SIGTERM', abort);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await main();
}
