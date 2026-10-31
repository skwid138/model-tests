import { normalizeCampaigns } from './normalize-campaigns.mjs';
import { readCampaignRows } from './read-response.mjs';

export function summarizeCampaignResponse(response) {
  const campaigns = normalizeCampaigns(readCampaignRows(response));
  const totalSpendCents = campaigns.reduce(
    (total, campaign) => total + campaign.spendCents,
    0,
  );

  return { campaigns, totalSpendCents };
}
