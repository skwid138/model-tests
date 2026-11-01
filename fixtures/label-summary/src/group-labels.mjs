import { normalizeLabel } from './normalize-label.mjs';

export function summarizeLabels(values) {
  const labelCounts = new Map();
  
  for (const value of values) {
    const normalized = normalizeLabel(value);
    if (normalized !== null) {
      const count = labelCounts.get(normalized) || 0;
      labelCounts.set(normalized, count + 1);
    }
  }
  
  const result = [];
  for (const [label, count] of labelCounts) {
    result.push({ label, count });
  }
  
  result.sort((a, b) => {
    if (a.count !== b.count) {
      return b.count - a.count;
    }
    return a.label.localeCompare(b.label);
  });
  
  return result;
}
