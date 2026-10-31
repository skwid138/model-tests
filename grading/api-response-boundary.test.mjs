import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const trialRoot = process.argv[2];
if (!trialRoot) {
  throw new Error('Pass the trial worktree root as the first argument.');
}

const modulePath = resolve(
  trialRoot,
  'fixtures/api-response-boundary/src/summarize-response.mjs',
);
const { summarizeCampaignResponse } = await import(pathToFileURL(modulePath).href);
assert.equal(typeof summarizeCampaignResponse, 'function');

const emptySummary = { campaigns: [], totalSpendCents: 0 };
const arrayBodyWithItems = [];
arrayBodyWithItems.items = [{ id: 'not-an-object-body' }];

test('returns an empty summary for invalid response envelopes', () => {
  const invalidResponses = [
    null,
    [],
    { ok: false, body: { items: [{ id: 'ignored' }] } },
    { ok: true, body: null },
    { ok: true, body: arrayBodyWithItems },
    { ok: true, body: { items: {} } },
  ];

  for (const response of invalidResponses) {
    assert.deepEqual(summarizeCampaignResponse(response), emptySummary);
  }
});

test('normalizes valid rows and preserves their order and duplicates', () => {
  const actual = summarizeCampaignResponse({
    ok: true,
    body: {
      items: [
        { id: ' alpha ', name: ' Alpha campaign ', metrics: { spendCents: 9 } },
        null,
        [],
        { id: 15, name: 'not valid' },
        { id: ' \t ', name: 'blank id' },
        { id: '  ', metrics: { spendCents: 1_000_000_000 } },
        { id: 'beta', name: ' \n ', metrics: { spendCents: 2 } },
        { id: ' beta ', name: 8, metrics: { spendCents: 7 } },
      ],
    },
  });

  assert.deepEqual(actual, {
    campaigns: [
      { id: 'alpha', name: 'Alpha campaign', spendCents: 9 },
      { id: 'beta', name: 'beta', spendCents: 2 },
      { id: 'beta', name: 'beta', spendCents: 7 },
    ],
    totalSpendCents: 18,
  });
});

test('accepts only bounded non-negative integer spend values without coercion', () => {
  const spendValues = [
    ['zero', 0],
    ['maximum', 1_000_000_000],
    ['negative', -1],
    ['too-large', 1_000_000_001],
    ['fractional', 1.5],
    ['numeric-string', '12'],
    ['not-a-number', Number.NaN],
    ['infinite', Number.POSITIVE_INFINITY],
  ];
  const items = spendValues.map(([id, spendCents]) => ({
    id,
    metrics: { spendCents },
  }));
  items.push(
    { id: 'array-metrics', metrics: [{ spendCents: 50 }] },
    { id: 'missing-metrics' },
  );

  const actual = summarizeCampaignResponse({ ok: true, body: { items } });

  assert.deepEqual(
    actual.campaigns.map(({ id, spendCents }) => [id, spendCents]),
    spendValues.map(([id, value]) => [
      id,
      value === 0 || value === 1_000_000_000 ? value : 0,
    ]).concat([
      ['array-metrics', 0],
      ['missing-metrics', 0],
    ]),
  );
  assert.equal(actual.totalSpendCents, 1_000_000_000);
});

test('does not mutate input and returns fresh results on every call', () => {
  const response = {
    ok: true,
    body: {
      items: [
        { id: 'one', name: 'First', metrics: { spendCents: 25 } },
        { id: 'two', metrics: { spendCents: 75 } },
      ],
    },
  };
  const before = JSON.stringify(response);
  const expected = {
    campaigns: [
      { id: 'one', name: 'First', spendCents: 25 },
      { id: 'two', name: 'two', spendCents: 75 },
    ],
    totalSpendCents: 100,
  };

  const first = summarizeCampaignResponse(response);
  const second = summarizeCampaignResponse(response);

  assert.notStrictEqual(first.campaigns, second.campaigns);
  assert.notStrictEqual(first.campaigns[0], second.campaigns[0]);
  first.campaigns[0].name = 'mutated';
  first.campaigns.push({ id: 'extra', name: 'extra', spendCents: 0 });

  assert.deepEqual(second, expected);
  assert.deepEqual(summarizeCampaignResponse(response), expected);
  assert.equal(JSON.stringify(response), before);
});
