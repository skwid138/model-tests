import { inspectRequest } from '../index.mjs';

export function inspectBatch(rows, overrides) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => inspectRequest(row, overrides));
}
