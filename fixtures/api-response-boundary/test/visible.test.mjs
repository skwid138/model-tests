import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeCampaignResponse } from '../src/summarize-response.mjs';

test('summarizes campaigns from a successful response', () => {
  const response = {
    ok: true,
    body: {
      items: [
        { id: 'summer', name: 'Summer Launch', metrics: { spendCents: 1250 } },
        { id: 'brand', metrics: { spendCents: 300 } },
      ],
    },
  };

  assert.deepEqual(summarizeCampaignResponse(response), {
    campaigns: [
      { id: 'summer', name: 'Summer Launch', spendCents: 1250 },
      { id: 'brand', name: 'brand', spendCents: 300 },
    ],
    totalSpendCents: 1550,
  });
});

test('returns an empty summary for an unsuccessful response', () => {
  assert.deepEqual(
    summarizeCampaignResponse({
      ok: false,
      body: { items: [{ id: 'ignored', metrics: { spendCents: 500 } }] },
    }),
    { campaigns: [], totalSpendCents: 0 },
  );
});
