import { resolvePolicy } from '../policy/resolve-policy.mjs';

export function previewPolicy(mode, limitOverride) {
  return resolvePolicy(mode, { limitOverride });
}
