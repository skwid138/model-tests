import { resolvePolicy } from '../policy/resolve-policy.mjs';

export function routeRequest(request, overrides) {
  const policy = resolvePolicy(request.mode, overrides);

  return {
    mode: policy.mode,
    route: policy.mode === 'strict' ? 'guarded' : 'open',
    tokens: request.tokens,
    budget: policy.maxTerms,
    accepted: request.tokens.length <= policy.maxTerms,
  };
}
