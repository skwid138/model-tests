import { parseRequest } from './input/parse-request.mjs';
import { routeRequest } from './routing/route-request.mjs';

export function inspectRequest(input, overrides = {}) {
  return routeRequest(parseRequest(input), overrides);
}
