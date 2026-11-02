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
    const trimmedName = typeof row.name === 'string' ? row.name.trim() : '';
    const name = trimmedName !== '' ? trimmedName : id;
    const rawSpendCents = isRecord(row.metrics) ? row.metrics.spendCents : 0;
    const spendCents = typeof rawSpendCents === 'number' 
      && Number.isInteger(rawSpendCents) 
      && rawSpendCents >= 0 
      && rawSpendCents <= 1000000000
      ? rawSpendCents
      : 0;

    return [{ id, name, spendCents }];
  });
}
