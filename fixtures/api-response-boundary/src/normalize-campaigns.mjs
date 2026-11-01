function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeCampaigns(rows) {
  if (!Array.isArray(rows)) return [];

  return rows.flatMap((row) => {
    if (!isRecord(row) || typeof row.id !== 'string' || row.id.trim() === '') {
      return [];
    }

    const id = row.id;
    const name = typeof row.name === 'string' && row.name.trim() !== ''
      ? row.name
      : id;
    const rawSpendCents = isRecord(row.metrics) ? row.metrics.spendCents : undefined;
    const isValidSpend = typeof rawSpendCents === 'number' && Number.isInteger(rawSpendCents) && rawSpendCents >= 0 && rawSpendCents <= 1000000000;
    const spendCents = isValidSpend ? rawSpendCents : 0;

    return isValidSpend || rawSpendCents === undefined ? [{ id, name, spendCents }] : [];
  });
}
