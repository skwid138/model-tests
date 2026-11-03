import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { normalizeWorkerOutput } from '../normalize.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

test('normalization preserves public results and typed facts while excluding analysis and normalizing only the explicit root', () => {
  const response = `<analysis>concise intent</analysis>
<results>
<files>source note</files>
<answer>
The entry is shown below. Cite ${repoRoot}/fixtures/discovery-v2/src/index.mjs:4-5.
\`\`\`discovery-facts
{"T1":{"entry":{"file":"fixtures/discovery-v2/src/index.mjs","symbol":"inspectRequest"}}}
\`\`\`
Additional prose remains.</answer>
<next_steps>done</next_steps>
</results>`;
  const normalized = normalizeWorkerOutput(response, { caseId: 'trace', trialRoot: repoRoot });
  assert.equal(normalized.typedFragment.status, 'valid');
  assert.deepEqual(normalized.typedFragment.facts.T1.entry, {
    file: 'fixtures/discovery-v2/src/index.mjs',
    symbol: 'inspectRequest',
  });
  assert.equal(normalized.resultsText.includes('<analysis>'), false);
  assert.equal(normalized.resultsText.includes('concise intent'), false);
  assert.ok(normalized.resultsText.includes('${TRIAL_ROOT}/fixtures/discovery-v2/src/index.mjs:4-5'));
  assert.ok(normalized.resultsText.includes('Additional prose remains.'));
  assert.deepEqual(Object.keys(normalized.answers), ['T1', 'T2', 'T3']);
});

test('normalization retains missing or invalid typed-fragment status without prose fallback', () => {
  const response = '<results><files></files><answer>Only prose.</answer><next_steps></next_steps></results>';
  const normalized = normalizeWorkerOutput(response, { caseId: 'boundary', trialRoot: repoRoot });
  assert.equal(normalized.typedFragment.status, 'missing');
  assert.equal(normalized.resultsText.includes('Only prose.'), true);
  assert.throws(() => normalizeWorkerOutput(
    '<results><files></files><answer></answer></results>',
    { caseId: 'boundary', trialRoot: repoRoot },
  ), /invalid results envelope/);
});

test('normalization rejects a fake public results envelope nested in analysis', () => {
  const response = '<analysis>\n<results><files></files><answer>decoy</answer><next_steps></next_steps></results>\n</analysis>';
  assert.throws(() => normalizeWorkerOutput(response, { caseId: 'trace', trialRoot: repoRoot }), /invalid results envelope/);
});

test('normalizer CLI refuses to publish a results decoy nested inside analysis', () => {
  const tempDir = mkdtempSync(resolve(dirname(fileURLToPath(import.meta.url)), '.tmp-normalize-cli-'));
  try {
    const responsePath = join(tempDir, 'worker-response.md');
    const response = '<analysis>\n<results><files></files><answer>decoy</answer><next_steps></next_steps></results>\n</analysis>';
    writeFileSync(responsePath, response);
    const cliPath = resolve(repoRoot, 'grading/discovery-v2/normalize.mjs');
    const child = spawnSync(process.execPath, [cliPath, repoRoot, 'trace', responsePath], { encoding: 'utf8' });
    assert.equal(child.status, 1);
    assert.match(child.stderr, /invalid results envelope/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
