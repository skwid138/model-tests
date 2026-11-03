import { DEFAULT_LIMITS } from './defaults.mjs';

export function resolvePolicy(mode, { limitOverride } = {}) {
  const normalizedMode = mode === 'strict' ? 'strict' : 'standard';
  const maxTerms = Number.isSafeInteger(limitOverride) && limitOverride >= 0
    ? limitOverride
    : DEFAULT_LIMITS[normalizedMode];

  return { mode: normalizedMode, maxTerms };
}
