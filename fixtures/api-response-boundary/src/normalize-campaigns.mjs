function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeCampaigns(rows) {
  if (!Array.isArray(rows)) return [];

  return rows.flatMap((row) => {
    if (!isRecord(row) || typeof row.id !== 'string' || row.id.trim() === '') {
      return [];
    }

    const id = row.id.trim();
    const name = typeof row.name === 'string' && row.name.trim() !== ''
      ? row.name.trim()
      : id;
    const rawSpendCents = isRecord(row.metrics) ? row.metrics.spendCents : 0;
    const spendCents = Number.isInteger(rawSpendCents) &&
      rawSpendCents >= 0 &&
      rawSpendCents <= 1_000_000_000
      ? rawSpendCents
      : 0;

    return [{ id, name, spendCents }];
  });
}
