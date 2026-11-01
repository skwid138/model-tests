export function normalizeLabel(value) {
  if (typeof value !== 'string') {
    return null;
  }
  
  const normalized = value.trim().toLowerCase();
  
  if (normalized === '') {
    return null;
  }
  
  return normalized;
};