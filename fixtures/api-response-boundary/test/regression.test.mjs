import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeCampaignResponse } from '../src/summarize-response.mjs';

// Regression test: ensure spendCents is validated to be within 0-1,000,000,000 range
test('rejects spendCents outside valid range', () => {
  const response = {
    ok: true,
    body: {
      items: [
        { id: 'valid', name: 'Valid', metrics: { spendCents: 1000 } },
        { id: 'too-high', name: 'Too High', metrics: { spendCents: 1000000001 } },
        { id: 'negative', name: 'Negative', metrics: { spendCents: -100 } },
      ],
    },
  };

  const result = summarizeCampaignResponse(response);
  
  // Should only include the valid campaign
  assert.strictEqual(result.campaigns.length, 1);
  assert.deepEqual(result.campaigns[0], { id: 'valid', name: 'Valid', spendCents: 1000 });
  assert.strictEqual(result.totalSpendCents, 1000);
});

// Regression test: ensure non-integer spendCents is rejected
test('rejects non-integer spendCents', () => {
  const response = {
    ok: true,
    body: {
      items: [
        { id: 'valid', name: 'Valid', metrics: { spendCents: 500 } },
        { id: 'float', name: 'Float', metrics: { spendCents: 500.5 } },
      ],
    },
  };

  const result = summarizeCampaignResponse(response);
  
  // Should only include the valid campaign
  assert.strictEqual(result.campaigns.length, 1);
  assert.deepEqual(result.campaigns[0], { id: 'valid', name: 'Valid', spendCents: 500 });
  assert.strictEqual(result.totalSpendCents, 500);
});

// Regression test: ensure missing metrics.spendCents defaults to 0
test('defaults missing spendCents to 0', () => {
  const response = {
    ok: true,
    body: {
      items: [
        { id: 'with-spend', name: 'With Spend', metrics: { spendCents: 200 } },
        { id: 'no-spend', name: 'No Spend', metrics: {} },
      ],
    },
  };

  const result = summarizeCampaignResponse(response);
  
  assert.strictEqual(result.campaigns.length, 2);
  assert.deepEqual(result.campaigns[0], { id: 'with-spend', name: 'With Spend', spendCents: 200 });
  assert.deepEqual(result.campaigns[1], { id: 'no-spend', name: 'No Spend', spendCents: 0 });
  assert.strictEqual(result.totalSpendCents, 200);
});