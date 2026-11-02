import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeCampaignResponse } from '../src/summarize-response.mjs';

test('regression: IDs are trimmed', () => {
  const response = {
    ok: true,
    body: {
      items: [
        { id: '  spaced-id  ', name: 'Spaced Campaign', metrics: { spendCents: 100 } },
      ],
    },
  };

  const result = summarizeCampaignResponse(response);
  
  // The ID should be trimmed to 'spaced-id', not '  spaced-id  '
  assert.equal(result.campaigns[0].id, 'spaced-id', 'ID should be trimmed');
});

test('regression: spend values above 1,000,000,000 are rejected', () => {
  const response = {
    ok: true,
    body: {
      items: [
        { id: 'big-spend', name: 'Big Spend Campaign', metrics: { spendCents: 1500000000 } },
      ],
    },
  };

  const result = summarizeCampaignResponse(response);
  
  // Spend above 1,000,000,000 should be treated as invalid (0)
  assert.equal(result.campaigns[0].spendCents, 0, 'Spend above upper bound should be 0');
  assert.equal(result.totalSpendCents, 0, 'Total should be 0 when spend is rejected');
});

test('regression: non-integer spend values are rejected', () => {
  const response = {
    ok: true,
    body: {
      items: [
        { id: 'float-spend', name: 'Float Campaign', metrics: { spendCents: 100.5 } },
      ],
    },
  };

  const result = summarizeCampaignResponse(response);
  
  // Non-integer spend should be treated as invalid (0)
  assert.equal(result.campaigns[0].spendCents, 0, 'Non-integer spend should be 0');
});

test('regression: campaign names are trimmed', () => {
  const response = {
    ok: true,
    body: {
      items: [
        { id: 'trimmed-name', name: '  Trimmed Name  ', metrics: { spendCents: 100 } },
      ],
    },
  };

  const result = summarizeCampaignResponse(response);
  
  // The name should be trimmed
  assert.equal(result.campaigns[0].name, 'Trimmed Name', 'Name should be trimmed');
});