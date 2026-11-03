<results>
<files>
- ${TRIAL_ROOT}/fixtures/discovery-v2/src/index.mjs - Exports the public entry and invokes the request parser before routing.
- ${TRIAL_ROOT}/fixtures/discovery-v2/src/input/parse-request.mjs - Parses the input and normalizes strict mode.
- ${TRIAL_ROOT}/fixtures/discovery-v2/src/routing/route-request.mjs - Calls the active policy resolver, chooses the route, and returns the budget.
- ${TRIAL_ROOT}/fixtures/discovery-v2/src/policy/resolve-policy.mjs - Implements the active resolver and validates the limit override.
- ${TRIAL_ROOT}/fixtures/discovery-v2/src/policy/defaults.mjs - Defines the strict-mode default budget.
- ${TRIAL_ROOT}/fixtures/discovery-v2/src/admin/preview-policy.mjs - Contains another direct call site of the active resolver.
- ${TRIAL_ROOT}/fixtures/discovery-v2/src/legacy/resolve-policy.mjs - Defines a same-named resolver outside the active call path.
</files>

<answer>
For the strict request, parsing selects `strict`; routing selects `guarded`, and the default term budget is `2`. A valid nonnegative safe-integer override replaces the effective budget; an invalid override falls back to the mode default. The active resolver is called directly by `routeRequest` and `previewPolicy`; the legacy resolver is not on this path.

Citations: public entry and initial parser call: ${TRIAL_ROOT}/fixtures/discovery-v2/src/index.mjs:4-5. Strict parsing: ${TRIAL_ROOT}/fixtures/discovery-v2/src/input/parse-request.mjs:8-15. Resolver call, route, and returned budget: ${TRIAL_ROOT}/fixtures/discovery-v2/src/routing/route-request.mjs:1-11. Override validation and fallback: ${TRIAL_ROOT}/fixtures/discovery-v2/src/policy/resolve-policy.mjs:3-9. Strict default: ${TRIAL_ROOT}/fixtures/discovery-v2/src/policy/defaults.mjs:1-4. Other direct call and lookalike implementation: ${TRIAL_ROOT}/fixtures/discovery-v2/src/admin/preview-policy.mjs:1-4; ${TRIAL_ROOT}/fixtures/discovery-v2/src/legacy/resolve-policy.mjs:1-6.

```discovery-facts
{
  "T1": {
    "entry": {
      "file": "fixtures/discovery-v2/src/index.mjs",
      "symbol": "inspectRequest"
    },
    "firstCall": {
      "file": "fixtures/discovery-v2/src/input/parse-request.mjs",
      "symbol": "parseRequest"
    }
  },
  "T2": {
    "executionPath": [
      "fixtures/discovery-v2/src/index.mjs",
      "fixtures/discovery-v2/src/input/parse-request.mjs",
      "fixtures/discovery-v2/src/routing/route-request.mjs",
      "fixtures/discovery-v2/src/policy/resolve-policy.mjs",
      "fixtures/discovery-v2/src/policy/defaults.mjs"
    ],
    "decision": {
      "route": "guarded",
      "budget": 2
    }
  },
  "T3": {
    "directCallSites": [
      {
        "file": "fixtures/discovery-v2/src/routing/route-request.mjs",
        "containingFunction": "routeRequest"
      },
      {
        "file": "fixtures/discovery-v2/src/admin/preview-policy.mjs",
        "containingFunction": "previewPolicy"
      }
    ],
    "lookalike": {
      "file": "fixtures/discovery-v2/src/legacy/resolve-policy.mjs",
      "symbol": "resolvePolicy",
      "onActiveCallPath": false
    },
    "override": {
      "valid": {
        "constraint": {
          "isInteger": true,
          "isSafeInteger": true,
          "lowerBound": 0,
          "lowerBoundInclusive": true
        },
        "effect": {
          "action": "replace",
          "target": "effective_budget"
        }
      },
      "invalid": {
        "effect": {
          "action": "fallback",
          "target": "mode_default"
        }
      }
    }
  }
}
```
</answer>

<next_steps>
Ready to proceed.
</next_steps>
