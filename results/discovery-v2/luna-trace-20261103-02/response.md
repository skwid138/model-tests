<results>
<files>
- ${TRIAL_ROOT}/fixtures/discovery-v2/src/index.mjs - exports the public entry and invokes the parser before routing (lines 1–5).
- ${TRIAL_ROOT}/fixtures/discovery-v2/src/input/parse-request.mjs - parses the request and normalizes strict mode (lines 1–15).
- ${TRIAL_ROOT}/fixtures/discovery-v2/src/routing/route-request.mjs - calls the active resolver and selects the route and budget (lines 1–12).
- ${TRIAL_ROOT}/fixtures/discovery-v2/src/policy/resolve-policy.mjs - validates the override and chooses the default when it is invalid (lines 1–9).
- ${TRIAL_ROOT}/fixtures/discovery-v2/src/policy/defaults.mjs - defines the strict-mode default limit (lines 1–4).
- ${TRIAL_ROOT}/fixtures/discovery-v2/src/admin/preview-policy.mjs - contains another direct call site of the active resolver (lines 1–4).
- ${TRIAL_ROOT}/fixtures/discovery-v2/src/legacy/resolve-policy.mjs - contains the same-named implementation outside the active call path (lines 1–5).
- ${TRIAL_ROOT}/fixtures/discovery-v2/src/batch/inspect-batch.mjs - calls the public entry, not the policy resolver directly (lines 1–5).
</files>

<answer>
`inspectRequest` first invokes `parseRequest`; parsing and route selection are in separate modules. For the strict request, the resolver uses the strict default of 2, and the router selects `guarded`. The active resolver is called directly by `routeRequest` and `previewPolicy`; the legacy resolver is a separate implementation.

Citations: the entry call is at `${TRIAL_ROOT}/fixtures/discovery-v2/src/index.mjs:4-5`; parsing and mode normalization are at `${TRIAL_ROOT}/fixtures/discovery-v2/src/input/parse-request.mjs:1-15`. The resolver call, route selection, and returned budget are at `${TRIAL_ROOT}/fixtures/discovery-v2/src/routing/route-request.mjs:3-11`; the resolver’s default lookup is at `${TRIAL_ROOT}/fixtures/discovery-v2/src/policy/resolve-policy.mjs:3-9`, and the strict default value is at `${TRIAL_ROOT}/fixtures/discovery-v2/src/policy/defaults.mjs:1-4`. Direct call sites are at `${TRIAL_ROOT}/fixtures/discovery-v2/src/routing/route-request.mjs:1-4` and `${TRIAL_ROOT}/fixtures/discovery-v2/src/admin/preview-policy.mjs:1-4`. The separate legacy implementation is at `${TRIAL_ROOT}/fixtures/discovery-v2/src/legacy/resolve-policy.mjs:1-5`.

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
</results>
