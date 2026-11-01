import { normalizeLabel } from './normalize-label.mjs';

export function summarizeLabels(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  
  // Count occurrences of each normalized label
  const counts = new Map();
  
  for (const value of values) {
    const normalized = normalizeLabel(value);
    if (normalized !== null) {
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }
  }
  
  // Convert to array and sort
  const result = [];
  for (const [label, count] of counts.entries()) {
    result.push({ label, count });
  }
  
  // Sort by descending count, then ascending label
  result.sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return a.label.localeCompare(b.label);
  });
  
  return result;
};
