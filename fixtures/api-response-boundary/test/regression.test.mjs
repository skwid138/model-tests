import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeCampaignResponse } from '../src/summarize-response.mjs';

test('regression: ensures id and name are trimmed', () => {
  const response = {
    ok: true,
    body: {
      items: [
        { id: '  id1  ', name: '  name1  ', metrics: { spendCents: 100 } },
        { id: 'id2', metrics: { spendCents: 200 } }, // name should be 'id2' (trimmed)
      ],
    },
  };

  const result = summarizeCampaignResponse(response);
  assert.strictEqual(result.campaigns[0].id, 'id1');
  assert.strictEqual(result.campaigns[0].name, 'name1');
  assert.strictEqual(result.campaigns[1].id, 'id2');
  assert.strictEqual(result.campaigns[1].name, 'id2');
});

test('regression: ensures spendCents follows integer and boundary rules', () => {
  const response = {
    ok: true,
    body: {
      items: [
        { id: 'float', metrics: { spendCents: 100.5 } }, // Should be 0 (not an integer)
        { id: 'too-high', metrics: { spendCents: 1000000001 } }, // Should be 0
        { id: 'neg', metrics: { spendCents: -1 } }, // Should be 0
      ],
    },
  };

  const result = summarizeCampaignResponse(response);
  assert.strictEqual(result.campaigns[0].spendCents, 0);
  assert.strictEqual(result.campaigns[1].spendCents, 0);
  assert.strictEqual(result.campaigns[2].spendCents, 0);
  assert.strictEqual(result.totalSpendCents, 0);
});
