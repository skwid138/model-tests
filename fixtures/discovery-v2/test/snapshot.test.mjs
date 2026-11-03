import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const sourcePaths = [
  'src/admin/preview-policy.mjs',
  'src/batch/inspect-batch.mjs',
  'src/index.mjs',
  'src/input/parse-request.mjs',
  'src/legacy/resolve-policy.mjs',
  'src/policy/defaults.mjs',
  'src/policy/resolve-policy.mjs',
  'src/routing/route-request.mjs',
];

test('discovery-v2 source snapshot is byte-identical to the frozen v1 snapshot', () => {
  for (const path of sourcePaths) {
    const v1Path = resolve(repoRoot, 'fixtures/discovery-v1', path);
    const v2Path = resolve(repoRoot, 'fixtures/discovery-v2', path);
    assert.ok(existsSync(v2Path), `v2 source snapshot must contain ${path}`);
    assert.deepEqual(readFileSync(v2Path), readFileSync(v1Path), `${path} must be copied byte-for-byte`);
  }
});
