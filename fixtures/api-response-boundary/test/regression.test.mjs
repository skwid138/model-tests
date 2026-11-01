import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeCampaignResponse } from '../src/summarize-response.mjs';

test('normalizes valid campaigns, filters invalid rows, and returns fresh results', () => {
  const response = {
    ok: true,
    body: {
      items: [
        { id: '  summer  ', name: ' Summer Launch ', metrics: { spendCents: 1250 } },
        { id: 'brand', name: '   ', metrics: { spendCents: 1_000_000_001 } },
        { id: '   ', name: 'Rejected', metrics: { spendCents: 500 } },
        { id: 'summer', name: 7, metrics: { spendCents: 1_000_000_000 } },
        { id: 'social', metrics: [{ spendCents: 300 }] },
      ],
    },
  };
  const original = structuredClone(response);

  const summary = summarizeCampaignResponse(response);
  assert.deepEqual(summary, {
    campaigns: [
      { id: 'summer', name: 'Summer Launch', spendCents: 1250 },
      { id: 'brand', name: 'brand', spendCents: 0 },
      { id: 'summer', name: 'summer', spendCents: 1_000_000_000 },
      { id: 'social', name: 'social', spendCents: 0 },
    ],
    totalSpendCents: 1_000_001_250,
  });
  assert.deepEqual(response, original);

  const nextSummary = summarizeCampaignResponse(response);
  assert.notEqual(nextSummary.campaigns, summary.campaigns);
  assert.notEqual(nextSummary.campaigns[0], summary.campaigns[0]);

  const arrayBody = [];
  arrayBody.items = [{ id: 'ignored' }];
  assert.deepEqual(
    summarizeCampaignResponse({ ok: true, body: arrayBody }),
    { campaigns: [], totalSpendCents: 0 },
  );
});
