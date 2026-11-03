import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { inspectRequest } from '../../../fixtures/discovery-v1/src/index.mjs';
import { inspectBatch } from '../../../fixtures/discovery-v1/src/batch/inspect-batch.mjs';
import { previewPolicy } from '../../../fixtures/discovery-v1/src/admin/preview-policy.mjs';
import { verify } from '../verify.mjs';

const repositoryRoot = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const sourceFiles = [
  'fixtures/discovery-v1/src/index.mjs',
  'fixtures/discovery-v1/src/input/parse-request.mjs',
  'fixtures/discovery-v1/src/routing/route-request.mjs',
  'fixtures/discovery-v1/src/policy/resolve-policy.mjs',
  'fixtures/discovery-v1/src/policy/defaults.mjs',
  'fixtures/discovery-v1/src/batch/inspect-batch.mjs',
  'fixtures/discovery-v1/src/admin/preview-policy.mjs',
  'fixtures/discovery-v1/src/legacy/resolve-policy.mjs',
];

test('TRACE and BOUNDARY public examples match the synthetic implementation', () => {
  assert.deepEqual(inspectRequest({ query: 'Amber Finch', mode: 'strict' }), {
    mode: 'strict',
    route: 'guarded',
    tokens: ['amber', 'finch'],
    budget: 2,
    accepted: true,
  });
  assert.deepEqual(inspectRequest({ query: 'Amber Finch' }), {
    mode: 'standard',
    route: 'open',
    tokens: ['amber', 'finch'],
    budget: 4,
    accepted: true,
  });
  assert.deepEqual(inspectRequest({}), {
    mode: 'standard',
    route: 'open',
    tokens: [],
    budget: 4,
    accepted: true,
  });
  assert.deepEqual(inspectRequest({ query: '   \n ', mode: 'strict' }), {
    mode: 'strict',
    route: 'guarded',
    tokens: [],
    budget: 2,
    accepted: true,
  });
  assert.deepEqual(inspectRequest({ query: 42, mode: 'mystery' }), {
    mode: 'standard',
    route: 'open',
    tokens: [],
    budget: 4,
    accepted: true,
  });
  assert.deepEqual(inspectRequest(
    { query: ' \t ', mode: 'strict' },
    { limitOverride: 0 },
  ), {
    mode: 'strict',
    route: 'guarded',
    tokens: [],
    budget: 0,
    accepted: true,
  });
});

test('the hard-case caller inventory is exhaustive within the frozen source list', async () => {
  const contents = await Promise.all(sourceFiles.map(async (path) => [
    path,
    await readFile(resolve(repositoryRoot, path), 'utf8'),
  ]));
  const directCallers = contents
    .filter(([, source]) => /import\s*\{\s*resolvePolicy\s*\}/.test(source))
    .map(([path]) => path)
    .sort();

  assert.deepEqual(directCallers, [
    'fixtures/discovery-v1/src/admin/preview-policy.mjs',
    'fixtures/discovery-v1/src/routing/route-request.mjs',
  ]);
  const bodyOf = (source, functionName) => {
    const declaration = new RegExp(
      `export function ${functionName}\\([^\\n]*\\)\\s*\\{([\\s\\S]*?)^\\}`,
      'm',
    );
    const body = source.match(declaration)?.[1];
    assert.ok(body, `found bounded function body for ${functionName}`);
    return body;
  };
  assert.match(
    bodyOf(contents.find(([path]) => path.endsWith('/routing/route-request.mjs'))[1], 'routeRequest'),
    /\bresolvePolicy\s*\(\s*request\.mode\s*,\s*overrides\s*\)/,
  );
  assert.match(
    bodyOf(contents.find(([path]) => path.endsWith('/admin/preview-policy.mjs'))[1], 'previewPolicy'),
    /\bresolvePolicy\s*\(\s*mode\s*,\s*\{\s*limitOverride\s*\}\s*\)/,
  );
  assert.match(contents.find(([path]) => path.endsWith('/legacy/resolve-policy.mjs'))[1], /export function resolvePolicy/);
  assert.deepEqual(previewPolicy('strict', 5), { mode: 'strict', maxTerms: 5 });
  assert.deepEqual(inspectBatch([{ query: 'one two three', mode: 'strict' }], { limitOverride: 3 }), [
    {
      mode: 'strict',
      route: 'guarded',
      tokens: ['one', 'two', 'three'],
      budget: 3,
      accepted: true,
    },
  ]);
});

test('frozen gold facts match independent expected values and the finite static source graph', async () => {
  const traceKey = JSON.parse(await readFile(resolve(
    repositoryRoot,
    'grading/discovery-v1/answer-keys/trace.json',
  ), 'utf8'));
  const boundaryKey = JSON.parse(await readFile(resolve(
    repositoryRoot,
    'grading/discovery-v1/answer-keys/boundary.json',
  ), 'utf8'));
  const path = (suffix) => `fixtures/discovery-v1/src/${suffix}`;
  const traceExpected = {
    T1: {
      public_entry: [{ file: path('index.mjs'), symbol: 'inspectRequest' }],
      immediate_delegate: [{ module: path('input/parse-request.mjs'), symbol: 'parseRequest' }],
    },
    T2: {
      strict_execution_path: [[
        path('index.mjs'),
        path('input/parse-request.mjs'),
        path('routing/route-request.mjs'),
        path('policy/resolve-policy.mjs'),
        path('policy/defaults.mjs'),
      ]],
      strict_route_and_budget: [{ route: 'guarded', budget: 2 }],
    },
    T3: {
      direct_active_callers: [
        [
          { file: path('admin/preview-policy.mjs'), function: 'previewPolicy' },
          { file: path('routing/route-request.mjs'), function: 'routeRequest' },
        ],
        [
          { file: path('routing/route-request.mjs'), function: 'routeRequest' },
          { file: path('admin/preview-policy.mjs'), function: 'previewPolicy' },
        ],
      ],
      unused_lookalike: [{
        module: path('legacy/resolve-policy.mjs'),
        symbol: 'resolvePolicy',
        active_static_call_path: false,
      }],
      override_effect: [{
        valid_override: 'A nonnegative safe integer replaces the mode default exactly.',
        invalid_override: 'An invalid override falls back to the selected mode default.',
      }],
    },
  };
  const boundaryExpected = {
    B1: {
      ordinary_result: [{
        mode: 'standard', route: 'open', tokens: ['amber', 'finch'], budget: 4, accepted: true,
      }],
    },
    B2: {
      missing_input_result: [{
        mode: 'standard', route: 'open', tokens: [], budget: 4, accepted: true,
      }],
      blank_strict_result: [{
        mode: 'strict', route: 'guarded', tokens: [], budget: 2, accepted: true,
      }],
      invalid_fields_result: [{
        mode: 'standard', route: 'open', tokens: [], budget: 4, accepted: true,
      }],
    },
    B3: {
      zero_budget_edge_result: [{
        mode: 'strict', route: 'guarded', tokens: [], budget: 0, accepted: true,
      }],
      deployment_override: [{
        status: 'unknown',
        reasonCode: 'deployment_not_in_static_source_snapshot',
      }],
    },
  };

  for (const [key, expected] of [[traceKey, traceExpected], [boundaryKey, boundaryExpected]]) {
    for (const question of key.questions) {
      for (const fact of question.requiredFacts) {
        assert.deepEqual(fact.accepted, expected[question.id][fact.id], `${question.id}.${fact.id}`);
      }
    }
  }

  assert.deepEqual(inspectRequest({ query: 'Amber Finch' }), boundaryExpected.B1.ordinary_result[0]);
  assert.deepEqual(inspectRequest({}), boundaryExpected.B2.missing_input_result[0]);
  assert.deepEqual(
    inspectRequest({ query: '   \n ', mode: 'strict' }),
    boundaryExpected.B2.blank_strict_result[0],
  );
  assert.deepEqual(
    inspectRequest({ query: 42, mode: 'mystery' }),
    boundaryExpected.B2.invalid_fields_result[0],
  );
  assert.deepEqual(
    inspectRequest({ query: ' \t ', mode: 'strict' }, { limitOverride: 0 }),
    boundaryExpected.B3.zero_budget_edge_result[0],
  );

  const source = Object.fromEntries(await Promise.all(sourceFiles.map(async (relativePath) => [
    relativePath,
    await readFile(resolve(repositoryRoot, relativePath), 'utf8'),
  ])));
  assert.match(source[path('index.mjs')], /export function inspectRequest/);
  assert.match(source[path('index.mjs')], /import \{ parseRequest \} from '\.\/input\/parse-request\.mjs'/);
  assert.match(source[path('input/parse-request.mjs')], /requestedMode === 'strict' \? 'strict' : 'standard'/);
  assert.match(source[path('routing/route-request.mjs')], /policy\.mode === 'strict' \? 'guarded' : 'open'/);
  assert.match(source[path('policy/defaults.mjs')], /strict: 2/);
  assert.match(source[path('policy/resolve-policy.mjs')], /Number\.isSafeInteger\(limitOverride\) && limitOverride >= 0/);
  assert.match(source[path('legacy/resolve-policy.mjs')], /export function resolvePolicy/);
});

test('gold facts have citations inside existing source or task line ranges', async () => {
  for (const caseId of ['trace', 'boundary']) {
    const keyPath = resolve(repositoryRoot, `grading/discovery-v1/answer-keys/${caseId}.json`);
    const key = JSON.parse(await readFile(keyPath, 'utf8'));
    assert.equal(key.caseId, caseId);
    assert.deepEqual(key.questions.map(({ tier }) => tier), ['easy', 'medium', 'hard']);
    for (const question of key.questions) {
      assert.ok(question.requiredFacts.length > 0);
      for (const fact of question.requiredFacts) {
        assert.ok(fact.accepted.length > 0);
        assert.ok(fact.evidence.length > 0);
        for (const span of fact.evidence) {
          const text = await readFile(resolve(repositoryRoot, span.path), 'utf8');
          const lineCount = text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
          assert.ok(span.startLine >= 1 && span.endLine >= span.startLine);
          assert.ok(span.endLine <= lineCount, `${span.path}:${span.endLine} is outside the file`);
        }
      }
    }
  }
});

test('coordinator verifier grades both frozen gold cases and trial-root citations', async (t) => {
  const tempDirectory = await mkdtemp(resolve(repositoryRoot, 'grading/discovery-v1/test/.submission-'));
  t.after(() => rm(tempDirectory, { recursive: true, force: true }));
  for (const caseId of ['trace', 'boundary']) {
    const key = JSON.parse(await readFile(resolve(
      repositoryRoot,
      `grading/discovery-v1/answer-keys/${caseId}.json`,
    ), 'utf8'));
    const answers = Object.fromEntries(key.questions.map((question) => [question.id, {
      facts: Object.fromEntries(question.requiredFacts.map((fact) => [fact.id, fact.accepted[0]])),
      citations: question.requiredFacts.flatMap((fact) => fact.evidence.map((span) => ({
        factId: fact.id,
        path: resolve(repositoryRoot, span.path),
        startLine: span.startLine,
        endLine: span.endLine,
      }))),
      additionalClaims: [],
    }]));
    const submissionPath = resolve(tempDirectory, `${caseId}-submission.json`);
    await writeFile(submissionPath, JSON.stringify({
      schemaVersion: 1,
      caseId,
      answers,
      evidenceReviews: [],
    }));

    const result = await verify({ trialRoot: repositoryRoot, caseId, submissionPath });
    assert.equal(result.protocolStatus, 'UNKNOWN');
    assert.equal(result.totals.correct, result.totals.denominator);
    assert.ok(result.items.every((item) => item.facts.every((fact) => (
      fact.outcome === 'correct' && fact.citation === 'valid_location'
    ))));
  }
});

test('coordinator verifier rejects unversioned normalized submissions', async (t) => {
  const tempDirectory = await mkdtemp(resolve(repositoryRoot, 'grading/discovery-v1/test/.invalid-submission-'));
  t.after(() => rm(tempDirectory, { recursive: true, force: true }));
  const submissionPath = resolve(tempDirectory, 'submission.json');
  await writeFile(submissionPath, JSON.stringify({
    caseId: 'trace',
    answers: {},
    evidenceReviews: [],
  }));

  await assert.rejects(verify({
    trialRoot: repositoryRoot,
    caseId: 'trace',
    submissionPath,
  }), /schemaVersion/);
});

test('CLI grading preserves question/fact-linked reviews and leaves missing reviews unresolved', async (t) => {
  const tempDirectory = await mkdtemp(resolve(repositoryRoot, 'grading/discovery-v1/test/.review-submission-'));
  t.after(() => rm(tempDirectory, { recursive: true, force: true }));
  const key = JSON.parse(await readFile(resolve(
    repositoryRoot,
    'grading/discovery-v1/answer-keys/trace.json',
  ), 'utf8'));
  const question = key.questions[0];
  const answers = {
    facts: Object.fromEntries(question.requiredFacts.map((fact) => [fact.id, fact.accepted[0]])),
    citations: question.requiredFacts.flatMap((fact) => fact.evidence.map((span) => ({
      factId: fact.id,
      path: resolve(repositoryRoot, span.path),
      startLine: span.startLine,
      endLine: span.endLine,
    }))),
    additionalClaims: [],
  };
  const submissionPath = resolve(tempDirectory, 'submission.json');
  await writeFile(submissionPath, JSON.stringify({
    schemaVersion: 1,
    caseId: 'trace',
    answers: { T1: answers },
    evidenceReviews: [
      { questionId: 'T1', factId: 'public_entry', reviewerLabel: 'A', citationsEntailClaim: true, branchCoverageComplete: true },
      { questionId: 'T1', factId: 'public_entry', reviewerLabel: 'B', citationsEntailClaim: true, branchCoverageComplete: true },
    ],
  }));

  const result = await verify({ trialRoot: repositoryRoot, caseId: 'trace', submissionPath });
  const [reviewedFact, unreviewedFact] = result.items[0].facts;
  assert.equal(reviewedFact.evidenceReview.questionId, 'T1');
  assert.equal(reviewedFact.evidenceReview.factId, 'public_entry');
  assert.equal(reviewedFact.evidenceReview.status, 'SUPPORTED');
  assert.equal(reviewedFact.evidenceReview.reviewerA.reviewerLabel, 'A');
  assert.equal(reviewedFact.evidenceReview.reviewerB.reviewerLabel, 'B');
  assert.equal(unreviewedFact.evidenceReview.factId, 'immediate_delegate');
  assert.equal(unreviewedFact.evidenceReview.status, 'UNRESOLVED');
});
