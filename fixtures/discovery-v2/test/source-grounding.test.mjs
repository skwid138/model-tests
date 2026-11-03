import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

import { inspectRequest } from '../src/index.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const traceKey = JSON.parse(await readFile(resolve(repoRoot, 'grading/discovery-v2/answer-keys/trace.json'), 'utf8'));
const boundaryKey = JSON.parse(await readFile(resolve(repoRoot, 'grading/discovery-v2/answer-keys/boundary.json'), 'utf8'));

async function source(relativePath) {
  return readFile(resolve(repoRoot, relativePath), 'utf8');
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

test('boundary answer-key facts match independent public-source executions, including zero override', async () => {
  const cases = [
    ['B1', 'ordinaryResult', { query: 'Amber Finch' }, undefined],
    ['B2', 'missingInput', {}, undefined],
    ['B2', 'blankStrict', { query: '   \n ', mode: 'strict' }, undefined],
    ['B2', 'invalidFields', { query: 42, mode: 'mystery' }, undefined],
    ['B3', 'zeroOverrideResult', { query: ' \t ', mode: 'strict' }, { limitOverride: 0 }],
  ];
  const directExpected = [
    { mode: 'standard', route: 'open', tokens: ['amber', 'finch'], budget: 4, accepted: true },
    { mode: 'standard', route: 'open', tokens: [], budget: 4, accepted: true },
    { mode: 'strict', route: 'guarded', tokens: [], budget: 2, accepted: true },
    { mode: 'standard', route: 'open', tokens: [], budget: 4, accepted: true },
    { mode: 'strict', route: 'guarded', tokens: [], budget: 0, accepted: true },
  ];
  for (const [index, [questionId, factId, input, overrides]] of cases.entries()) {
    const actual = inspectRequest(input, overrides);
    assert.deepEqual(actual, directExpected[index]);
    const fact = boundaryKey.questions.find(({ id }) => id === questionId).facts.find(({ id }) => id === factId);
    assert.deepEqual(fact.expected, actual, `${questionId}.${factId} must be grounded in source behavior`);
  }

  const deploymentFact = boundaryKey.questions.find(({ id }) => id === 'B3').facts.find(({ id }) => id === 'deploymentLimit');
  assert.deepEqual(deploymentFact.expected, { status: 'unknown', value: null, snapshotLimitation: true });
  assert.match(await source('fixtures/discovery-v2/tasks/boundaries.md'), /no deployment files, runtime configuration/);
});

test('trace facts match the finite imports and direct-call sites in the frozen source allowlist', async () => {
  const allowed = Object.keys(traceKey.sourceFilesSha256);
  const importedResolver = [];
  const directCallSites = [];
  for (const file of allowed) {
    const text = await source(file);
    if (/from ['"]\.\.\/policy\/resolve-policy\.mjs['"]/.test(text)) importedResolver.push(file);
    let activeFunction = null;
    for (const line of text.split(/\r?\n/)) {
      const declaration = line.match(/^\s*export function (\w+)\(/);
      if (declaration) activeFunction = declaration[1];
      if (/\bresolvePolicy\s*\(/.test(line) && !/export function resolvePolicy\s*\(/.test(line)) {
        directCallSites.push({ file, containingFunction: activeFunction });
      }
    }
  }
  assert.deepEqual(importedResolver.sort(), [
    'fixtures/discovery-v2/src/admin/preview-policy.mjs',
    'fixtures/discovery-v2/src/routing/route-request.mjs',
  ]);
  const expectedCallSites = [
    { file: 'fixtures/discovery-v2/src/admin/preview-policy.mjs', containingFunction: 'previewPolicy' },
    { file: 'fixtures/discovery-v2/src/routing/route-request.mjs', containingFunction: 'routeRequest' },
  ];
  assert.deepEqual(directCallSites, expectedCallSites);
  const fact = traceKey.questions.find(({ id }) => id === 'T3').facts.find(({ id }) => id === 'directCallSites');
  assert.deepEqual(fact.expected, expectedCallSites);
  assert.equal(traceKey.questions.find(({ id }) => id === 'T3').facts.find(({ id }) => id === 'lookalike').expected.onActiveCallPath, false);

  const entry = await source('fixtures/discovery-v2/src/index.mjs');
  assert.match(entry, /export function inspectRequest\(input, overrides = \{\}\)/);
  assert.match(entry, /return routeRequest\(parseRequest\(input\), overrides\)/);
  const traceT1 = traceKey.questions.find(({ id }) => id === 'T1').facts;
  assert.deepEqual(traceT1.find(({ id }) => id === 'entry').expected, {
    file: 'fixtures/discovery-v2/src/index.mjs', symbol: 'inspectRequest',
  });
  assert.deepEqual(traceT1.find(({ id }) => id === 'firstCall').expected, {
    file: 'fixtures/discovery-v2/src/input/parse-request.mjs', symbol: 'parseRequest',
  });

  const path = [
    'fixtures/discovery-v2/src/index.mjs',
    'fixtures/discovery-v2/src/input/parse-request.mjs',
    'fixtures/discovery-v2/src/routing/route-request.mjs',
    'fixtures/discovery-v2/src/policy/resolve-policy.mjs',
    'fixtures/discovery-v2/src/policy/defaults.mjs',
  ];
  const traceT2 = traceKey.questions.find(({ id }) => id === 'T2').facts;
  assert.deepEqual(traceT2.find(({ id }) => id === 'executionPath').expected, path);
  assert.match(entry, /import \{ parseRequest \} from '\.\/input\/parse-request\.mjs'/);
  assert.match(entry, /import \{ routeRequest \} from '\.\/routing\/route-request\.mjs'/);
  assert.match(await source(path[2]), /import \{ resolvePolicy \} from '\.\.\/policy\/resolve-policy\.mjs'/);
  assert.match(await source(path[3]), /import \{ DEFAULT_LIMITS \} from '\.\/defaults\.mjs'/);
  const strictResult = inspectRequest({ query: 'Amber Finch', mode: 'strict' });
  const strictDecision = { route: strictResult.route, budget: strictResult.budget };
  assert.deepEqual(strictDecision, { route: 'guarded', budget: 2 });
  assert.deepEqual(traceT2.find(({ id }) => id === 'decision').expected, strictDecision);

  const resolver = await source(path[3]);
  assert.match(resolver, /Number\.isSafeInteger\(limitOverride\) && limitOverride >= 0/);
  assert.match(resolver, /\? limitOverride\s*:\s*DEFAULT_LIMITS\[normalizedMode\]/);
  assert.match(await source(path[2]), /budget: policy\.maxTerms/);
  assert.match(await source('fixtures/discovery-v2/src/admin/preview-policy.mjs'), /return resolvePolicy\(mode, \{ limitOverride \}\)/);
  const validOverride = inspectRequest({ query: 'one two three', mode: 'strict' }, { limitOverride: 3 });
  const invalidOverride = inspectRequest({ query: 'one two three', mode: 'strict' }, { limitOverride: -1 });
  assert.equal(validOverride.budget, 3);
  assert.equal(invalidOverride.budget, 2);
  assert.equal(inspectRequest({ query: 'one', mode: 'strict' }, { limitOverride: Number.MAX_SAFE_INTEGER }).budget, Number.MAX_SAFE_INTEGER);
  assert.equal(inspectRequest({ query: 'one', mode: 'strict' }, { limitOverride: Number.MAX_SAFE_INTEGER + 1 }).budget, 2);
  assert.deepEqual(traceKey.questions.find(({ id }) => id === 'T3').facts.find(({ id }) => id === 'override').expected, {
    valid: {
      constraint: { isInteger: true, isSafeInteger: true, lowerBound: 0, lowerBoundInclusive: true },
      effect: { action: 'replace', target: 'effective_budget' },
    },
    invalid: { effect: { action: 'fallback', target: 'mode_default' } },
  });
  assert.match(await source('fixtures/discovery-v2/tasks/trace.md'), /action.*replace.*fallback.*clamp.*add.*multiply.*preserve/);
  assert.match(await source('fixtures/discovery-v2/tasks/trace.md'), /target.*effective_budget.*mode_default.*configured_limit.*request_limit.*fixed_limit.*existing_value/);

  const legacy = await source('fixtures/discovery-v2/src/legacy/resolve-policy.mjs');
  assert.match(legacy, /export function resolvePolicy\(mode\)/);
  assert.equal(importedResolver.some((file) => file.includes('/legacy/')), false);
  assert.deepEqual(traceKey.questions.find(({ id }) => id === 'T3').facts.find(({ id }) => id === 'lookalike').expected, {
    file: 'fixtures/discovery-v2/src/legacy/resolve-policy.mjs',
    symbol: 'resolvePolicy',
    onActiveCallPath: false,
  });

  const task = await source('fixtures/discovery-v2/tasks/trace.md');
  assert.equal(traceKey.taskSha256, sha256(task));
});

test('each answer-key source and task hash identifies the v2 paths, not v1 names', async () => {
  for (const key of [traceKey, boundaryKey]) {
    assert.equal(key.taskVersion, 2);
    assert.equal(key.sourceVersion, 2);
    assert.ok(key.taskPath.startsWith('fixtures/discovery-v2/'));
    const task = await source(key.taskPath);
    assert.equal(sha256(task), key.taskSha256);
    for (const [path, expectedHash] of Object.entries(key.sourceFilesSha256)) {
      assert.ok(path.startsWith('fixtures/discovery-v2/src/'));
      assert.equal(sha256(await source(path)), expectedHash, path);
    }
  }
});
