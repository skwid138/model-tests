import assert from 'node:assert/strict';
import test from 'node:test';

import { combineEvidenceReviews, gradeSubmission } from '../verifier.mjs';

const answerKey = {
  schemaVersion: 1,
  caseId: 'trace',
  questions: [{
    id: 'T1',
    tier: 'easy',
    requiredFacts: [{
      id: 'entry',
      accepted: [{ path: 'src/index.mjs', symbol: 'inspectRequest' }],
      evidence: [{ path: 'src/index.mjs', startLine: 1, endLine: 8 }],
    }],
  }],
};

test('a correct fact with a source-root citation receives credit', () => {
  const result = gradeSubmission(answerKey, {
    caseId: 'trace',
    answers: {
      T1: {
        facts: { entry: { path: 'src/index.mjs', symbol: 'inspectRequest' } },
        citations: [{
          factId: 'entry',
          path: '/trial/source/src/index.mjs',
          startLine: 3,
          endLine: 5,
        }],
      },
    },
  }, { sourceRoot: '/trial/source' });

  assert.deepEqual(result, {
    schemaVersion: 1,
    caseId: 'trace',
    protocolStatus: 'UNKNOWN',
    totals: { correct: 1, denominator: 1, unsupported: 0 },
    byTier: { easy: { correct: 1, denominator: 1 } },
    items: [{
      questionId: 'T1',
      tier: 'easy',
      correct: 1,
      denominator: 1,
      facts: [{
        id: 'entry',
        outcome: 'correct',
        citation: 'valid_location',
        evidenceReview: {
          questionId: 'T1',
          factId: 'entry',
          rubricVersion: 1,
          status: 'UNRESOLVED',
          requiresAdjudication: true,
          reasonCodes: ['review_missing'],
          reviewerA: {
            reviewerLabel: 'A',
            citationsEntailClaim: null,
            branchCoverageComplete: null,
            decision: 'UNRESOLVED',
          },
          reviewerB: {
            reviewerLabel: 'B',
            citationsEntailClaim: null,
            branchCoverageComplete: null,
            decision: 'UNRESOLVED',
          },
        },
      }],
      unsupportedClaims: 0,
    }],
  });
});

test('multi-file evidence requires a citation to every required source span', () => {
  const keyWithTwoSpans = structuredClone(answerKey);
  keyWithTwoSpans.questions[0].requiredFacts[0].evidence.push({
    path: 'src/policy/defaults.mjs',
    startLine: 1,
    endLine: 4,
  });
  const result = gradeSubmission(keyWithTwoSpans, {
    caseId: 'trace',
    answers: {
      T1: {
        facts: { entry: { path: 'src/index.mjs', symbol: 'inspectRequest' } },
        citations: [{
          factId: 'entry',
          path: 'src/index.mjs',
          startLine: 3,
          endLine: 5,
        }],
      },
    },
  }, { sourceRoot: '/trial/source' });

  assert.equal(result.items[0].facts[0].citation, 'incomplete');
  assert.equal(result.items[0].facts[0].outcome, 'correct');
});

test('missing answers and incorrect answers remain different scoring outcomes', () => {
  const missing = gradeSubmission(answerKey, {
    caseId: 'trace',
    answers: { T1: { facts: {}, citations: [] } },
  }, { sourceRoot: '/trial/source' });
  assert.equal(missing.items[0].facts[0].outcome, 'missing');
  assert.equal(missing.items[0].facts[0].citation, 'missing');

  const incorrect = gradeSubmission(answerKey, {
    caseId: 'trace',
    answers: {
      T1: {
        facts: { entry: { path: 'src/legacy.mjs', symbol: 'inspectRequest' } },
        citations: [{ factId: 'entry', path: 'src/legacy.mjs', startLine: 1, endLine: 2 }],
      },
    },
  }, { sourceRoot: '/trial/source' });
  assert.equal(incorrect.items[0].facts[0].outcome, 'incorrect');
  assert.equal(incorrect.items[0].facts[0].citation, 'misleading');
});

test('path traversal and unsupported extra facts are reported without credit', () => {
  const result = gradeSubmission(answerKey, {
    caseId: 'trace',
    answers: {
      T1: {
        facts: {
          entry: { path: 'src/index.mjs', symbol: 'inspectRequest' },
          privateFact: 'not in the frozen key',
        },
        citations: [{ factId: 'entry', path: '../secret.txt', startLine: 1, endLine: 1 }],
      },
    },
  }, { sourceRoot: '/trial/source' });

  assert.equal(result.items[0].facts[0].outcome, 'correct');
  assert.equal(result.items[0].facts[0].citation, 'invalid_path');
  assert.equal(result.items[0].unsupportedClaims, 1);
  assert.equal(result.totals.unsupported, 1);
});

test('normalized additional claims are preserved as unsupported rather than silently discarded', () => {
  const result = gradeSubmission(answerKey, {
    caseId: 'trace',
    answers: {
      T1: {
        facts: { entry: { path: 'src/index.mjs', symbol: 'inspectRequest' } },
        citations: [{ factId: 'entry', path: 'src/index.mjs', startLine: 4, endLine: 5 }],
        additionalClaims: [{
          text: 'An unkeyed extra claim copied from the answer.',
          citations: [{ path: 'src/index.mjs', startLine: 4, endLine: 5 }],
        }],
      },
    },
  }, { sourceRoot: '/trial/source' });

  assert.equal(result.items[0].unsupportedClaims, 1);
  assert.equal(result.totals.unsupported, 1);
});

test('UNKNOWN does not earn credit for a fact not explicitly marked unanswerable', () => {
  const keyWithUnknown = structuredClone(answerKey);
  keyWithUnknown.questions[0].requiredFacts[0].accepted = [{
    status: 'unknown',
    reason: 'not present in the static snapshot',
  }];
  const result = gradeSubmission(keyWithUnknown, {
    caseId: 'trace',
    answers: {
      T1: {
        facts: {
          entry: { status: 'unknown', reason: 'not present in the static snapshot' },
        },
        citations: [{ factId: 'entry', path: 'src/index.mjs', startLine: 4, endLine: 5 }],
      },
    },
  }, { sourceRoot: '/trial/source' });

  assert.equal(result.items[0].facts[0].outcome, 'abstention');
  assert.equal(result.items[0].unsupportedClaims, 0);
});

test('UNKNOWN earns credit only when the frozen fact key designates abstention', () => {
  const keyWithUnknown = structuredClone(answerKey);
  keyWithUnknown.questions[0].requiredFacts[0].allowUnknown = true;
  keyWithUnknown.questions[0].requiredFacts[0].accepted = [{
    status: 'unknown',
    reason: 'not present in the static snapshot',
  }];
  const result = gradeSubmission(keyWithUnknown, {
    caseId: 'trace',
    answers: {
      T1: {
        facts: {
          entry: { status: 'unknown', reason: 'not present in the static snapshot' },
        },
        citations: [{ factId: 'entry', path: 'src/index.mjs', startLine: 4, endLine: 5 }],
      },
    },
  }, { sourceRoot: '/trial/source', protocolStatus: 'PASS' });

  assert.equal(result.items[0].facts[0].outcome, 'correct');
  assert.equal(result.protocolStatus, 'PASS');
  assert.equal(result.totals.denominator, 1);
});

test('a guess for an explicitly unanswerable fact is scored as unsupported', () => {
  const keyWithUnknown = structuredClone(answerKey);
  keyWithUnknown.questions[0].requiredFacts[0].allowUnknown = true;
  keyWithUnknown.questions[0].requiredFacts[0].accepted = [{
    status: 'unknown',
    reason: 'not present in the static snapshot',
  }];
  const result = gradeSubmission(keyWithUnknown, {
    caseId: 'trace',
    answers: {
      T1: {
        facts: { entry: { deploymentLimit: 12 } },
        citations: [{ factId: 'entry', path: 'src/index.mjs', startLine: 4, endLine: 5 }],
      },
    },
  }, { sourceRoot: '/trial/source' });

  assert.equal(result.items[0].facts[0].outcome, 'unsupported');
  assert.equal(result.items[0].unsupportedClaims, 1);
  assert.equal(result.totals.unsupported, 1);
});

test('independent evidence-review disagreement stays unresolved for user adjudication', () => {
  const result = combineEvidenceReviews([
    { reviewerLabel: 'A', citationsEntailClaim: true, branchCoverageComplete: true },
    { reviewerLabel: 'B', citationsEntailClaim: false, branchCoverageComplete: true },
  ]);

  assert.equal(result.status, 'UNRESOLVED');
  assert.equal(result.requiresAdjudication, true);
  assert.equal(result.reasonCodes[0], 'reviewer_disagreement');
  assert.equal(result.reviewerA.decision, 'SUPPORTED');
  assert.equal(result.reviewerB.decision, 'UNSUPPORTED');
});

test('matching independent evidence reviews record a binary rubric result', () => {
  const result = combineEvidenceReviews([
    { reviewerLabel: 'A', citationsEntailClaim: true, branchCoverageComplete: true },
    { reviewerLabel: 'B', citationsEntailClaim: true, branchCoverageComplete: true },
  ]);

  assert.equal(result.status, 'SUPPORTED');
  assert.equal(result.requiresAdjudication, false);
  assert.equal(result.reviewerA.reviewerLabel, 'A');
  assert.equal(result.reviewerB.reviewerLabel, 'B');
  assert.deepEqual([result.reviewerA.decision, result.reviewerB.decision], ['SUPPORTED', 'SUPPORTED']);
});

test('one evidence review is missing rather than treated as an invalid or passing pair', () => {
  const result = combineEvidenceReviews([
    { reviewerLabel: 'A', citationsEntailClaim: true, branchCoverageComplete: true },
  ]);

  assert.equal(result.status, 'UNRESOLVED');
  assert.deepEqual(result.reasonCodes, ['review_missing']);
  assert.equal(result.reviewerA.decision, 'SUPPORTED');
  assert.equal(result.reviewerB.decision, 'UNRESOLVED');
});

test('evidence reviews are linked to each scored question and fact; missing reviews stay unresolved', () => {
  const result = gradeSubmission(answerKey, {
    caseId: 'trace',
    answers: {
      T1: {
        facts: { entry: { path: 'src/index.mjs', symbol: 'inspectRequest' } },
        citations: [{ factId: 'entry', path: 'src/index.mjs', startLine: 4, endLine: 5 }],
      },
    },
  }, { sourceRoot: '/trial/source' });

  assert.deepEqual(result.items[0].facts[0].evidenceReview, {
    questionId: 'T1',
    factId: 'entry',
    rubricVersion: 1,
    status: 'UNRESOLVED',
    requiresAdjudication: true,
    reasonCodes: ['review_missing'],
    reviewerA: {
      reviewerLabel: 'A',
      citationsEntailClaim: null,
      branchCoverageComplete: null,
      decision: 'UNRESOLVED',
    },
    reviewerB: {
      reviewerLabel: 'B',
      citationsEntailClaim: null,
      branchCoverageComplete: null,
      decision: 'UNRESOLVED',
    },
  });
});

test('per-fact review records preserve both checklists and cannot auto-resolve disagreement', () => {
  const result = gradeSubmission(answerKey, {
    caseId: 'trace',
    answers: {
      T1: {
        facts: { entry: { path: 'src/index.mjs', symbol: 'inspectRequest' } },
        citations: [{ factId: 'entry', path: 'src/index.mjs', startLine: 4, endLine: 5 }],
      },
    },
    evidenceReviews: [
      { questionId: 'T1', factId: 'entry', reviewerLabel: 'A', citationsEntailClaim: true, branchCoverageComplete: true },
      { questionId: 'T1', factId: 'entry', reviewerLabel: 'B', citationsEntailClaim: false, branchCoverageComplete: true },
    ],
  }, { sourceRoot: '/trial/source' });

  const review = result.items[0].facts[0].evidenceReview;
  assert.equal(review.status, 'UNRESOLVED');
  assert.equal(review.reviewerA.citationsEntailClaim, true);
  assert.equal(review.reviewerA.decision, 'SUPPORTED');
  assert.equal(review.reviewerB.citationsEntailClaim, false);
  assert.equal(review.reviewerB.decision, 'UNSUPPORTED');
});

test('grader never trusts a contradictory coordinator-supplied review decision', () => {
  const result = gradeSubmission(answerKey, {
    caseId: 'trace',
    answers: { T1: { facts: {}, citations: [] } },
    evidenceReviews: [
      {
        questionId: 'T1',
        factId: 'entry',
        reviewerLabel: 'A',
        citationsEntailClaim: true,
        branchCoverageComplete: true,
        decision: 'UNSUPPORTED',
      },
      {
        questionId: 'T1',
        factId: 'entry',
        reviewerLabel: 'B',
        citationsEntailClaim: true,
        branchCoverageComplete: true,
      },
    ],
  }, { sourceRoot: '/trial/source' });

  const review = result.items[0].facts[0].evidenceReview;
  assert.equal(review.status, 'UNRESOLVED');
  assert.equal(review.reasonCodes[0], 'review_input_invalid');
  assert.equal(review.reviewerA.decision, 'UNRESOLVED');
});

test('contradictory review records remain unresolved and preserve checklist input', () => {
  const result = combineEvidenceReviews([
    {
      reviewerLabel: 'A',
      citationsEntailClaim: true,
      branchCoverageComplete: true,
      decision: 'UNSUPPORTED',
    },
    { reviewerLabel: 'B', citationsEntailClaim: true, branchCoverageComplete: true },
  ]);

  assert.equal(result.status, 'UNRESOLVED');
  assert.deepEqual(result.reasonCodes, ['review_input_invalid']);
  assert.equal(result.reviewerA.citationsEntailClaim, true);
  assert.equal(result.reviewerA.branchCoverageComplete, true);
  assert.equal(result.reviewerA.decision, 'UNRESOLVED');
});
