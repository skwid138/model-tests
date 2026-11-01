import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeCampaignResponse } from '../src/summarize-response.mjs';

// Regression test: ensure spendCents validation works correctly
test('regression: invalid spendCents values are treated as 0', () => {
  const response = {
    ok: true,
    body: {
      items: [
        { id: 'valid', name: 'Valid', metrics: { spendCents: 100 } },
        { id: 'negative', name: 'Negative', metrics: { spendCents: -50 } },
        { id: 'string', name: 'String', metrics: { spendCents: '200' } },
        { id: 'float', name: 'Float', metrics: { spendCents: 150.5 } },
        { id: 'missing', name: 'Missing', metrics: {} },
        { id: 'null', name: 'Null', metrics: { spendCents: null } },
      ],
    },
  };

  const result = summarizeCampaignResponse(response);
  
  // Only the valid campaign should contribute to the total
  assert.strictEqual(result.campaigns.length, 6);
  assert.deepEqual(result.campaigns[0], { id: 'valid', name: 'Valid', spendCents: 100 });
  assert.deepEqual(result.campaigns[1], { id: 'negative', name: 'Negative', spendCents: 0 });
  assert.deepEqual(result.campaigns[2], { id: 'string', name: 'String', spendCents: 0 });
  assert.deepEqual(result.campaigns[3], { id: 'float', name: 'Float', spendCents: 0 });
  assert.deepEqual(result.campaigns[4], { id: 'missing', name: 'Missing', spendCents: 0 });
  assert.deepEqual(result.campaigns[5], { id: 'null', name: 'Null', spendCents: 0 });
  assert.strictEqual(result.totalSpendCents, 100);
});