export function parseRequest(input) {
  const record = input !== null && typeof input === 'object' && !Array.isArray(input)
    ? input
    : {};
  const query = typeof record.query === 'string'
    ? record.query.trim().toLowerCase()
    : '';
  const requestedMode = typeof record.mode === 'string'
    ? record.mode.trim().toLowerCase()
    : '';

  return {
    tokens: query === '' ? [] : query.split(/\s+/),
    mode: requestedMode === 'strict' ? 'strict' : 'standard',
  };
}
