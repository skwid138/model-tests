export function resolvePolicy(mode) {
  return {
    mode,
    maxTerms: mode === 'strict' ? 1 : 99,
  };
}
