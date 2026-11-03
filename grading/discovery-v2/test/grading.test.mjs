import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

const verifier = await import('../verifier.mjs').catch(() => ({}));
const traceKey = JSON.parse(await readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../answer-keys/trace.json'), 'utf8'));

test('typed grading distinguishes correct, incorrect, missing, invalid, and zero-valued facts', () => {
  assert.equal(typeof verifier.gradeSubmission, 'function', 'v2 typed grading is available');
  const answerKey = {
    schemaVersion: 2,
    caseId: 'trace',
    taskVersion: 2,
    sourceVersion: 2,
    questions: [{
      id: 'T1',
      tier: 'easy',
      facts: [
        { id: 'zero', path: ['T1', 'zero'], expected: 0, evidence: [] },
        { id: 'wrong', path: ['T1', 'wrong'], expected: 1, evidence: [] },
        { id: 'missing', path: ['T1', 'missing'], expected: true, evidence: [] },
        { id: 'invalid', path: ['T1', 'invalid'], expected: 'value', evidence: [] },
      ],
    }],
  };
  const submission = {
    schemaVersion: 2,
    caseId: 'trace',
    taskVersion: 2,
    sourceVersion: 2,
    typedFragment: {
      status: 'valid',
      facts: { T1: { zero: 0, wrong: 2, invalid: { not: 'a string' } } },
    },
    answers: { T1: { prose: '', citations: [], additionalClaims: [] } },
    evidenceReviews: [],
    claimReviews: [],
    resultsText: '<results><files></files><answer></answer><next_steps></next_steps></results>',
  };

  const result = verifier.gradeSubmission(answerKey, submission, { trialRoot: '/trial' });
  assert.deepEqual(result.items[0].facts.map(({ id, outcome }) => [id, outcome]), [
    ['zero', 'correct'],
    ['wrong', 'incorrect'],
    ['missing', 'missing'],
    ['invalid', 'invalid'],
  ]);
});

test('a typed snapshot-limitation answer is a distinct abstention and malformed format never falls back to prose', () => {
  const answerKey = {
    schemaVersion: 2,
    caseId: 'boundary',
    questions: [{
      id: 'B3',
      tier: 'hard',
      facts: [{
        id: 'deploymentLimit',
        path: ['B3', 'deploymentLimit'],
        expected: { status: 'unknown', value: null, snapshotLimitation: true },
        acceptedOutcome: 'abstention',
        evidence: [],
      }],
    }],
  };
  const base = {
    schemaVersion: 2,
    caseId: 'boundary',
    taskVersion: 2,
    sourceVersion: 2,
    answers: { B3: { prose: 'The deployment value is not available in this snapshot.', citations: [], additionalClaims: [] } },
    evidenceReviews: [],
    claimReviews: [],
    resultsText: '<results><files></files><answer>retained</answer><next_steps></next_steps></results>',
  };
  const unknown = verifier.gradeSubmission(answerKey, {
    ...base,
    typedFragment: { status: 'valid', facts: { B3: { deploymentLimit: { status: 'unknown', value: null, snapshotLimitation: true } } } },
  }, { trialRoot: '/trial' });
  assert.equal(unknown.items[0].facts[0].outcome, 'abstention');
  assert.equal(unknown.totals.abstentions, 1);

  const missing = verifier.gradeSubmission(answerKey, { ...base, typedFragment: { status: 'missing' } }, { trialRoot: '/trial' });
  assert.equal(missing.items[0].facts[0].outcome, 'missing');
  const invalid = verifier.gradeSubmission(answerKey, {
    ...base,
    typedFragment: { status: 'invalid', reason: 'duplicate_json_key' },
  }, { trialRoot: '/trial' });
  assert.equal(invalid.items[0].facts[0].outcome, 'invalid');
});

test('valid JSON with a wrong root or question shape is graded invalid rather than rejected or treated as missing', () => {
  const answerKey = {
    schemaVersion: 2,
    caseId: 'trace',
    questions: [{ id: 'T1', tier: 'easy', facts: [{ id: 'entry', path: ['T1', 'entry'], expected: 'known', evidence: [] }] }],
  };
  const submission = (facts) => ({
    schemaVersion: 2,
    caseId: 'trace',
    taskVersion: 2,
    sourceVersion: 2,
    resultsText: '<results><files></files><answer>prose says known</answer><next_steps></next_steps></results>',
    typedFragment: { status: 'valid', facts },
    answers: { T1: { prose: 'known', citations: [], additionalClaims: [] } },
    evidenceReviews: [],
    claimReviews: [],
  });
  for (const facts of [[], { T1: [] }]) {
    const result = verifier.gradeSubmission(answerKey, submission(facts), { trialRoot: '/trial' });
    assert.equal(result.items[0].facts[0].outcome, 'invalid');
    assert.equal(result.typedShapeIssues.length, 1);
  }
});

test('nested required fields remain missing while wrong types and extra object fields are invalid', () => {
  const answerKey = {
    schemaVersion: 2,
    caseId: 'trace',
    questions: [{ id: 'T1', tier: 'easy', facts: [{
      id: 'entry', path: ['T1', 'entry'], expected: { file: 'path', active: true }, evidence: [],
    }] }],
  };
  const submission = (entry) => ({
    schemaVersion: 2,
    caseId: 'trace',
    taskVersion: 2,
    sourceVersion: 2,
    resultsText: '<results><files></files><answer></answer><next_steps></next_steps></results>',
    typedFragment: { status: 'valid', facts: { T1: { entry } } },
    answers: { T1: { prose: '', citations: [], additionalClaims: [] } },
    evidenceReviews: [],
    claimReviews: [],
  });
  const outcome = (entry) => verifier.gradeSubmission(answerKey, submission(entry), { trialRoot: '/trial' }).items[0].facts[0].outcome;
  assert.equal(outcome({ file: 'path' }), 'missing');
  assert.equal(outcome({ file: 3, active: true }), 'invalid');
  assert.equal(outcome({ file: 'other', active: true }), 'incorrect');
  assert.equal(outcome({ file: 'path', active: true, extra: 1 }), 'invalid');
});

test('TRACE override shape distinguishes missing and invalid safe-integer fields and enforces canonical effects', () => {
  const question = traceKey.questions.find(({ id }) => id === 'T3');
  const fact = question.facts.find(({ id }) => id === 'override');
  const key = {
    schemaVersion: 2,
    caseId: 'trace',
    sourceFilesSha256: traceKey.sourceFilesSha256,
    questions: [{ id: 'T3', tier: 'hard', facts: [fact] }],
  };
  const grade = (override) => verifier.gradeSubmission(key, {
    schemaVersion: 2,
    caseId: 'trace',
    taskVersion: 2,
    sourceVersion: 2,
    resultsText: '<results><files></files><answer></answer><next_steps></next_steps></results>',
    typedFragment: { status: 'valid', facts: { T3: { override } } },
    answers: { T3: { prose: '', citations: [], additionalClaims: [] } },
    evidenceReviews: [],
    claimReviews: [],
  }, { trialRoot: '/trial' }).items[0].facts[0].outcome;
  const correct = structuredClone(fact.expected);
  const missingSafeInteger = structuredClone(correct);
  delete missingSafeInteger.valid.constraint.isSafeInteger;
  const wrongSafeIntegerType = structuredClone(correct);
  wrongSafeIntegerType.valid.constraint.isSafeInteger = 'yes';
  const unsupportedAction = structuredClone(correct);
  unsupportedAction.invalid.effect.action = 'quantize';
  const wrongBound = structuredClone(correct);
  wrongBound.valid.constraint.lowerBound = 1;

  assert.equal(grade(correct), 'correct');
  assert.equal(grade(missingSafeInteger), 'missing');
  assert.equal(grade(wrongSafeIntegerType), 'invalid');
  assert.equal(grade(unsupportedAction), 'invalid');
  assert.equal(grade(wrongBound), 'incorrect');
});
