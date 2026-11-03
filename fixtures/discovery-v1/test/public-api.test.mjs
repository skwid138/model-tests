import assert from 'node:assert/strict';
import test from 'node:test';

import { inspectRequest } from '../src/index.mjs';
import { inspectBatch } from '../src/batch/inspect-batch.mjs';
import { previewPolicy } from '../src/admin/preview-policy.mjs';

test('public entry returns the standard route for ordinary input', () => {
  assert.deepEqual(inspectRequest({ query: 'Amber Finch' }), {
    mode: 'standard',
    route: 'open',
    tokens: ['amber', 'finch'],
    budget: 4,
    accepted: true,
  });
});

test('batch inspection reuses the public request entry for each row', () => {
  assert.deepEqual(inspectBatch([
    { query: 'Amber Finch' },
    { query: 'Cedar', mode: 'strict' },
  ]), [
    {
      mode: 'standard',
      route: 'open',
      tokens: ['amber', 'finch'],
      budget: 4,
      accepted: true,
    },
    {
      mode: 'strict',
      route: 'guarded',
      tokens: ['cedar'],
      budget: 2,
      accepted: true,
    },
  ]);
});

test('a valid limit override replaces the mode default', () => {
  assert.deepEqual(inspectRequest(
    { query: 'one two three', mode: 'strict' },
    { limitOverride: 3 },
  ), {
    mode: 'strict',
    route: 'guarded',
    tokens: ['one', 'two', 'three'],
    budget: 3,
    accepted: true,
  });
});

test('an invalid negative override falls back to the strict mode default', () => {
  assert.deepEqual(inspectRequest(
    { query: 'one two three', mode: 'strict' },
    { limitOverride: -1 },
  ), {
    mode: 'strict',
    route: 'guarded',
    tokens: ['one', 'two', 'three'],
    budget: 2,
    accepted: false,
  });
});

test('admin policy preview uses the same policy resolver and override', () => {
  assert.deepEqual(previewPolicy('strict', 5), { mode: 'strict', maxTerms: 5 });
});
