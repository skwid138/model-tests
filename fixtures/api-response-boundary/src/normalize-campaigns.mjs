function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeCampaigns(rows) {
  if (!Array.isArray(rows)) return [];

  return rows.flatMap((row) => {
    // Reject non-object rows or missing string id
    if (!isRecord(row) || typeof row.id !== 'string') return [];

    const rawId = row.id;
    const id = typeof rawId === 'string' ? rawId.trim() : '';
    if (id === '') return [];

    const rawName = row.name;
    const name = typeof rawName === 'string' && rawName.trim() !== ''
      ? rawName.trim()
      : id;

    const rawSpendCents = isRecord(row.metrics) ? row.metrics.spendCents : 0;
    const spendCents =
      typeof rawSpendCents === 'number' && Number.isInteger(rawSpendCents)
        && rawSpendCents >= 0 && rawSpendCents <= 1_000_000_000
        ? rawSpendCents
        : 0;

    return [{ id, name, spendCents }];
  });
}
