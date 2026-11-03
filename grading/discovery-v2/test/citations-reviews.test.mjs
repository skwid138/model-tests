import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';

const verifier = await import('../verifier.mjs');
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const evidence = { path: 'fixtures/discovery-v2/src/index.mjs', startLine: 4, endLine: 5 };

function gradeCitation(citation) {
  return verifier.gradeSubmission({
    schemaVersion: 2,
    caseId: 'trace',
    taskVersion: 2,
    sourceVersion: 2,
    sourceFilesSha256: { [evidence.path]: 'unused-in-unit-test' },
    questions: [{
      id: 'T1',
      tier: 'easy',
      facts: [{ id: 'entry', path: ['T1', 'entry'], expected: 'ok', evidence: [evidence] }],
    }],
  }, {
    schemaVersion: 2,
    caseId: 'trace',
    taskVersion: 2,
    sourceVersion: 2,
    typedFragment: { status: 'valid', facts: { T1: { entry: 'ok' } } },
    answers: { T1: { prose: '', citations: [citation], additionalClaims: [] } },
    evidenceReviews: [],
    claimReviews: [],
    resultsText: '<results><files></files><answer></answer><next_steps></next_steps></results>',
  }, { trialRoot: repoRoot }).items[0].facts[0].citation;
}

test('broad in-bounds citations stay valid while traversal, unlisted paths, and bad line bounds are separate location failures', () => {
  const broad = gradeCitation({ factId: 'entry', ...evidence, startLine: 1, endLine: 6 });
  assert.equal(broad.status, 'valid');
  assert.deepEqual(broad.citations[0], {
    status: 'valid',
    path: evidence.path,
    startLine: 1,
    endLine: 6,
  });
  assert.equal(broad.canonicalSpanCoverage[0].overlaps, true);
  const traversal = gradeCitation({ factId: 'entry', path: '../README.md', startLine: 1, endLine: 2 }).citations[0];
  assert.equal(traversal.status, 'invalid_path');
  assert.deepEqual([traversal.startLine, traversal.endLine], [1, 2]);
  const outsideRoot = gradeCitation({ factId: 'entry', path: '/not-under-trial/file.mjs', startLine: 3, endLine: 4 }).citations[0];
  assert.equal(outsideRoot.status, 'outside_root');
  assert.deepEqual([outsideRoot.startLine, outsideRoot.endLine], [3, 4]);
  assert.equal(gradeCitation({ factId: 'entry', path: 'file:///etc/passwd', startLine: 1, endLine: 2 }).citations[0].status, 'invalid_path');
  assert.equal(gradeCitation({ factId: 'entry', path: 'README.md', startLine: 1, endLine: 2 }).citations[0].status, 'outside_allowlist');
  assert.equal(gradeCitation({ factId: 'entry', ...evidence, startLine: 1, endLine: 7 }).citations[0].status, 'out_of_bounds');
});

test('citation resolution rejects an allowlisted symlink that escapes the explicit trial root', () => {
  const tempDir = mkdtempSync(resolve(dirname(fileURLToPath(import.meta.url)), '.tmp-citation-symlink-'));
  try {
    const trialRoot = join(tempDir, 'trial');
    mkdirSync(trialRoot);
    const outsidePath = join(tempDir, 'outside.mjs');
    writeFileSync(outsidePath, 'export const outside = true;\n');
    symlinkSync(outsidePath, join(trialRoot, 'allowed.mjs'));
    const citation = verifier.gradeSubmission({
      schemaVersion: 2,
      caseId: 'trace',
      sourceFilesSha256: { 'allowed.mjs': 'unused-in-unit-test' },
      questions: [{ id: 'T1', tier: 'easy', facts: [{
        id: 'entry', path: ['T1', 'entry'], expected: 'ok',
        evidence: [{ path: 'allowed.mjs', startLine: 1, endLine: 1 }],
      }] }],
    }, {
      schemaVersion: 2,
      caseId: 'trace',
      taskVersion: 2,
      sourceVersion: 2,
      typedFragment: { status: 'valid', facts: { T1: { entry: 'ok' } } },
      resultsText: '<results><files></files><answer></answer><next_steps></next_steps></results>',
      answers: { T1: { prose: '', citations: [{ factId: 'entry', path: 'allowed.mjs', startLine: 1, endLine: 1 }], additionalClaims: [] } },
      evidenceReviews: [],
      claimReviews: [],
    }, { trialRoot });
    assert.equal(citation.items[0].facts[0].citation.citations[0].status, 'outside_root');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('fact evidence reviews require two matching checklists and preserve unresolved disagreement', () => {
  const supported = verifier.combineEvidenceReviews([
    { reviewerLabel: 'A', citationsEntailClaim: true, branchCoverageComplete: true },
    { reviewerLabel: 'B', citationsEntailClaim: true, branchCoverageComplete: true },
  ]);
  const unsupported = verifier.combineEvidenceReviews([
    { reviewerLabel: 'A', citationsEntailClaim: false, branchCoverageComplete: true },
    { reviewerLabel: 'B', citationsEntailClaim: false, branchCoverageComplete: true },
  ]);
  const disagreement = verifier.combineEvidenceReviews([
    { reviewerLabel: 'A', citationsEntailClaim: true, branchCoverageComplete: true },
    { reviewerLabel: 'B', citationsEntailClaim: false, branchCoverageComplete: true },
  ]);
  assert.equal(supported.status, 'SUPPORTED');
  assert.equal(unsupported.status, 'UNSUPPORTED');
  assert.equal(disagreement.status, 'UNRESOLVED');
  assert.equal(verifier.combineEvidenceReviews([]).status, 'UNRESOLVED');

  const record = { questionId: 'T1', factId: 'entry', ...supported };
  assert.equal(verifier.validateEvidenceReviewRecord(record).valid, true);
  assert.equal(verifier.validateEvidenceReviewRecord({ ...record, status: 'UNSUPPORTED' }).valid, false);
});

test('additional claims are supported or unsupported only by matching independent checklist decisions', () => {
  const supportChecklist = { claimAtomic: true, sourceScopeComplete: true, reviewCompleted: true, evidenceDisposition: 'supported' };
  const contradictChecklist = { claimAtomic: true, sourceScopeComplete: true, reviewCompleted: true, evidenceDisposition: 'contradicted' };
  assert.equal(verifier.combineClaimReviews(supportChecklist, supportChecklist).status, 'SUPPORTED');
  assert.equal(verifier.combineClaimReviews(contradictChecklist, contradictChecklist).status, 'UNSUPPORTED');
  assert.equal(verifier.combineClaimReviews(supportChecklist, contradictChecklist).status, 'UNRESOLVED');
  assert.equal(verifier.combineClaimReviews(undefined, undefined).status, 'UNRESOLVED');
});

test('completed independent reviewers can establish unsupported claims without claiming contradiction', () => {
  const unsupported = {
    claimAtomic: true,
    sourceScopeComplete: true,
    reviewCompleted: true,
    evidenceDisposition: 'unsupported_established',
  };
  const notReviewed = {
    claimAtomic: true,
    sourceScopeComplete: false,
    reviewCompleted: false,
    evidenceDisposition: 'not_reviewed',
  };
  assert.equal(verifier.combineClaimReviews(unsupported, unsupported).status, 'UNSUPPORTED');
  assert.equal(verifier.combineClaimReviews(unsupported, notReviewed).status, 'UNRESOLVED');
  assert.equal(verifier.combineClaimReviews(
    { ...unsupported, evidenceDisposition: 'supported' },
    unsupported,
  ).status, 'UNRESOLVED');
  assert.equal(verifier.combineClaimReviews(
    unsupported,
    { ...unsupported, evidenceDisposition: 'contradicted' },
  ).status, 'UNRESOLVED');
});

test('grading retains each additional claim and counts only review-established unsupported claims', () => {
  const supportChecklist = { claimAtomic: true, sourceScopeComplete: true, reviewCompleted: true, evidenceDisposition: 'supported' };
  const contradictChecklist = { claimAtomic: true, sourceScopeComplete: true, reviewCompleted: true, evidenceDisposition: 'contradicted' };
  const unsupportedChecklist = { claimAtomic: true, sourceScopeComplete: true, reviewCompleted: true, evidenceDisposition: 'unsupported_established' };
  const claims = [
    { id: 'T1-C01', text: 'Claim supported by the cited span.', citations: [{ ...evidence, startLine: 1, endLine: 6 }] },
    { id: 'T1-C02', text: 'Claim directly contradicted by evidence.', citations: [] },
    { id: 'T1-C03', text: 'Reviewers disagree.', citations: [] },
    { id: 'T1-C04', text: 'No review was recorded.', citations: [] },
    { id: 'T1-C05', text: 'Finite supplied sources do not support this claim.', citations: [] },
  ];
  const result = verifier.gradeSubmission({
    schemaVersion: 2,
    caseId: 'trace',
    questions: [{ id: 'T1', tier: 'easy', facts: [{ id: 'entry', path: ['T1', 'entry'], expected: 'ok', evidence: [evidence] }] }],
    sourceFilesSha256: { [evidence.path]: 'unused-in-unit-test' },
  }, {
    schemaVersion: 2,
    caseId: 'trace',
    taskVersion: 2,
    sourceVersion: 2,
    typedFragment: { status: 'valid', facts: { T1: { entry: 'ok' } } },
    resultsText: '<results><files></files><answer>retained</answer><next_steps></next_steps></results>',
    answers: { T1: { prose: 'All claims stay verbatim.', citations: [], additionalClaims: claims } },
    evidenceReviews: [],
    claimReviews: [
      { questionId: 'T1', claimId: 'T1-C01', reviewerA: supportChecklist, reviewerB: supportChecklist },
      { questionId: 'T1', claimId: 'T1-C02', reviewerA: contradictChecklist, reviewerB: contradictChecklist },
      { questionId: 'T1', claimId: 'T1-C03', reviewerA: supportChecklist, reviewerB: contradictChecklist },
      { questionId: 'T1', claimId: 'T1-C05', reviewerA: unsupportedChecklist, reviewerB: unsupportedChecklist },
    ],
  }, { trialRoot: repoRoot });

  assert.equal(result.totals.unsupportedClaims, 2);
  assert.equal(result.totals.unresolvedClaims, 2);
  assert.deepEqual(result.additionalClaims.map(({ text, review }) => [text, review.status]), [
    ['Claim supported by the cited span.', 'SUPPORTED'],
    ['Claim directly contradicted by evidence.', 'UNSUPPORTED'],
    ['Reviewers disagree.', 'UNRESOLVED'],
    ['No review was recorded.', 'UNRESOLVED'],
    ['Finite supplied sources do not support this claim.', 'UNSUPPORTED'],
  ]);
  assert.deepEqual(result.additionalClaims[0].citations[0], {
    status: 'valid', path: evidence.path, startLine: 1, endLine: 6,
  });
});
