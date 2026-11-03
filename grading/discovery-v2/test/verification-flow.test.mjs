import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

const verifyModule = await import('../verify.mjs').catch(() => ({}));
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

async function json(path) {
  return JSON.parse(await readFile(resolve(repoRoot, path), 'utf8'));
}

test('verification flow combines source hashes, typed facts, citations, reviews, and protocol without merging their scores', async () => {
  assert.equal(typeof verifyModule.verifyTrial, 'function', 'v2 coordinator verification flow is available');
  const answerKey = await json('grading/discovery-v2/answer-keys/boundary.json');
  const manifest = await json('grading/discovery-v2/trial-manifest.example.json');
  manifest.caseId = 'boundary';
  const answerKeyPath = 'grading/discovery-v2/answer-keys/boundary.json';
  manifest.fixtureHashes = {
    taskPath: answerKey.taskPath,
    taskSha256: answerKey.taskSha256,
    sourceFilesSha256: answerKey.sourceFilesSha256,
    answerKeyPath,
    answerFileSha256: createHash('sha256').update(await readFile(resolve(repoRoot, answerKeyPath))).digest('hex'),
  };
  const submission = {
    schemaVersion: 2,
    caseId: 'boundary',
    taskVersion: 2,
    sourceVersion: 2,
    resultsText: '<results><files></files><answer>retained</answer><next_steps></next_steps></results>',
    typedFragment: {
      status: 'valid',
      facts: {
        B1: { result: { mode: 'standard', route: 'open', tokens: ['amber', 'finch'], budget: 4, accepted: true } },
        B2: {
          missingInput: { mode: 'standard', route: 'open', tokens: [], budget: 4, accepted: true },
          blankStrict: { mode: 'strict', route: 'guarded', tokens: [], budget: 2, accepted: true },
          invalidFields: { mode: 'standard', route: 'open', tokens: [], budget: 4, accepted: true },
        },
        B3: {
          zeroOverrideResult: { mode: 'strict', route: 'guarded', tokens: [], budget: 0, accepted: true },
          deploymentLimit: { status: 'unknown', value: null, snapshotLimitation: true },
        },
      },
    },
    answers: {
      B1: {
        prose: '',
        citations: [],
        additionalClaims: [{ id: 'B1-C01', text: 'The complete supplied source snapshot does not support this extra claim.', citations: [] }],
      },
      B2: { prose: '', citations: [], additionalClaims: [] },
      B3: { prose: '', citations: [], additionalClaims: [] },
    },
    evidenceReviews: [{
      questionId: 'B1',
      factId: 'ordinaryResult',
      reviewerA: { citationsEntailClaim: true, branchCoverageComplete: true },
      reviewerB: { citationsEntailClaim: true, branchCoverageComplete: true },
    }],
    claimReviews: [{
      questionId: 'B1',
      claimId: 'B1-C01',
      reviewerA: { claimAtomic: true, sourceScopeComplete: true, reviewCompleted: true, evidenceDisposition: 'unsupported_established' },
      reviewerB: { claimAtomic: true, sourceScopeComplete: true, reviewCompleted: true, evidenceDisposition: 'unsupported_established' },
    }],
  };
  manifest.evidenceReviews = submission.evidenceReviews;
  manifest.claimReviews = submission.claimReviews;
  const result = verifyModule.verifyTrial({ trialRoot: repoRoot, caseId: 'boundary', answerKey, submission, manifest });
  assert.equal(result.protocolStatus, 'UNKNOWN');
  assert.equal(result.formatStatus, 'valid');
  assert.equal(result.totals.correct, 5);
  assert.equal(result.totals.abstentions, 1);
  assert.equal(result.totals.denominator, 6);
  assert.equal(result.additionalClaims[0].review.status, 'UNSUPPORTED');
  assert.equal(result.items[0].facts[0].evidenceReview.status, 'SUPPORTED');

  assert.throws(() => verifyModule.verifyTrial({
    trialRoot: repoRoot,
    caseId: 'boundary',
    answerKey,
    submission,
    manifest: { ...manifest, fixtureHashes: { ...manifest.fixtureHashes, taskSha256: '0'.repeat(64) } },
  }), /fixture hashes do not match/);
  assert.throws(() => verifyModule.verifyTrial({
    trialRoot: repoRoot,
    caseId: 'boundary',
    answerKey,
    submission,
    manifest: {
      ...manifest,
      fixtureHashes: {
        ...manifest.fixtureHashes,
        sourceFilesSha256: { ...manifest.fixtureHashes.sourceFilesSha256, [Object.keys(answerKey.sourceFilesSha256)[0]]: '0'.repeat(64) },
      },
    },
  }), /fixture hashes do not match/);
  assert.throws(() => verifyModule.verifyTrial({
    trialRoot: repoRoot,
    caseId: 'boundary',
    answerKey,
    submission,
    manifest: { ...manifest, fixtureHashes: { ...manifest.fixtureHashes, answerFileSha256: '0'.repeat(64) } },
  }), /fixture hashes do not match/);
  assert.throws(() => verifyModule.verifyTrial({
    trialRoot: repoRoot,
    caseId: 'boundary',
    answerKey,
    submission,
    manifest: { ...manifest, evidenceReviews: [{ questionId: 'B1', factId: 'ordinaryResult' }] },
  }), /review records do not match/);
  assert.throws(() => verifyModule.verifyTrial({
    trialRoot: repoRoot,
    caseId: 'boundary',
    answerKey,
    submission,
    manifest: { ...manifest, claimReviews: [{ questionId: 'B1', claimId: 'B1-C01' }] },
  }), /review records do not match/);
});

test('verification CLI rejects a missing question transcription instead of defaulting it to empty claims', async () => {
  const tempDir = mkdtempSync(resolve(dirname(fileURLToPath(import.meta.url)), '.tmp-cli-verify-'));
  try {
    const submission = await json('grading/discovery-v2/submission.example.json');
    delete submission.answers.T2;
    const manifest = await json('grading/discovery-v2/trial-manifest.example.json');
    const submissionPath = resolve(tempDir, 'submission.json');
    const manifestPath = resolve(tempDir, 'manifest.json');
    writeFileSync(submissionPath, JSON.stringify(submission));
    writeFileSync(manifestPath, JSON.stringify(manifest));
    const cliPath = resolve(repoRoot, 'grading/discovery-v2/verify.mjs');
    const child = spawnSync(process.execPath, [cliPath, repoRoot, 'trace', submissionPath, manifestPath], { encoding: 'utf8' });
    assert.equal(child.status, 1);
    assert.match(child.stderr, /answer_missing:T2/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
