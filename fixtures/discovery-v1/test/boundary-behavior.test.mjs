import assert from 'node:assert/strict';
import test from 'node:test';

import { inspectRequest } from '../src/index.mjs';

test('missing, blank, and invalid request fields normalize to empty standard queries', () => {
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
});

test('a whitespace-only strict query stays accepted at an explicit zero budget', () => {
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
