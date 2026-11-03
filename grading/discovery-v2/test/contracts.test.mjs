import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import test from 'node:test';

import { validateTrialManifest } from '../manifest.mjs';
import { validateNormalizedSubmission, verifyFrozenSnapshot } from '../verifier.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

async function json(path) {
  return JSON.parse(await readFile(resolve(repoRoot, path), 'utf8'));
}

test('coordinator schemas and examples are valid JSON and the examples pass focused value validators', async () => {
  const submissionSchema = await json('grading/discovery-v2/submission.schema.json');
  const manifestSchema = await json('grading/discovery-v2/trial-manifest.schema.json');
  assert.equal(submissionSchema.$id, 'urn:model-tests:discovery-v2:normalized-submission:v2');
  assert.equal(manifestSchema.$id, 'urn:model-tests:discovery-v2:trial-manifest:v2');

  const submission = await json('grading/discovery-v2/submission.example.json');
  const manifest = await json('grading/discovery-v2/trial-manifest.example.json');
  const traceKey = await json('grading/discovery-v2/answer-keys/trace.json');
  assert.equal(validateNormalizedSubmission(traceKey, submission).valid, true);
  assert.equal(validateNormalizedSubmission(traceKey, {
    ...submission,
    resultsText: '<results><answer>not a complete envelope</answer></results>',
  }).valid, false);
  const missingQuestion = { ...submission, answers: { ...submission.answers } };
  delete missingQuestion.answers.T1;
  assert.equal(validateNormalizedSubmission(traceKey, missingQuestion).valid, false);
  assert.equal(validateTrialManifest(manifest).valid, true);
  const missingHashMetadata = { ...manifest };
  delete missingHashMetadata.fixtureHashes;
  assert.equal(validateTrialManifest(missingHashMetadata).valid, false);
  const missingSourceHash = { ...manifest, fixtureHashes: { ...manifest.fixtureHashes, sourceFilesSha256: { ...manifest.fixtureHashes.sourceFilesSha256 } } };
  delete missingSourceHash.fixtureHashes.sourceFilesSha256['fixtures/discovery-v2/src/index.mjs'];
  assert.equal(validateTrialManifest(missingSourceHash).valid, false);
  const missingReviewRecords = { ...manifest };
  delete missingReviewRecords.evidenceReviews;
  assert.equal(validateTrialManifest(missingReviewRecords).valid, false);
});

test('frozen snapshot validation checks v2 source hashes, task hashes, source allowlist, and evidence bounds', async () => {
  for (const caseId of ['trace', 'boundary']) {
    const keyPath = `grading/discovery-v2/answer-keys/${caseId}.json`;
    const key = await json(keyPath);
    const snapshot = verifyFrozenSnapshot(key, repoRoot);
    assert.equal(snapshot.valid, true);
    assert.deepEqual(snapshot.errors, []);
    assert.equal(snapshot.hashes.taskPath, key.taskPath);
    assert.equal(snapshot.hashes.taskSha256, key.taskSha256);
    assert.deepEqual(snapshot.hashes.sourceFilesSha256, key.sourceFilesSha256);
    assert.equal(snapshot.hashes.answerKeyPath, keyPath);
    assert.match(snapshot.hashes.answerFileSha256, /^[a-f0-9]{64}$/);
  }
});

test('frozen snapshot validation rejects an allowlisted source symlink escaping the explicit trial root', async () => {
  const key = await json('grading/discovery-v2/answer-keys/trace.json');
  const tempDir = mkdtempSync(resolve(dirname(fileURLToPath(import.meta.url)), '.tmp-snapshot-symlink-'));
  try {
    const trialRoot = join(tempDir, 'trial');
    mkdirSync(trialRoot);
    const escapePath = 'fixtures/discovery-v2/src/index.mjs';
    for (const path of Object.keys(key.sourceFilesSha256)) {
      const destination = resolve(trialRoot, path);
      mkdirSync(dirname(destination), { recursive: true });
      if (path === escapePath) symlinkSync(resolve(repoRoot, path), destination);
      else writeFileSync(destination, readFileSync(resolve(repoRoot, path)));
    }
    const taskDestination = resolve(trialRoot, key.taskPath);
    mkdirSync(dirname(taskDestination), { recursive: true });
    writeFileSync(taskDestination, readFileSync(resolve(repoRoot, key.taskPath)));
    assert.ok(verifyFrozenSnapshot(key, trialRoot).errors.includes(`source_outside_root:${escapePath}`));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
