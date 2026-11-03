<results>
<files>
- ${TRIAL_ROOT}/fixtures/discovery-v2/src/index.mjs - Connects request parsing to routing.
- ${TRIAL_ROOT}/fixtures/discovery-v2/src/input/parse-request.mjs - Normalizes query and mode, and produces tokens.
- ${TRIAL_ROOT}/fixtures/discovery-v2/src/routing/route-request.mjs - Constructs the returned fields from the policy and parsed request.
- ${TRIAL_ROOT}/fixtures/discovery-v2/src/policy/resolve-policy.mjs - Applies a valid nonnegative integer override or uses the mode default.
- ${TRIAL_ROOT}/fixtures/discovery-v2/src/policy/defaults.mjs - Defines standard and strict source-level limits.
- ${TRIAL_ROOT}/fixtures/discovery-v2/src/batch/inspect-batch.mjs - Adjacent batch entry point; not used by these calls.
- ${TRIAL_ROOT}/fixtures/discovery-v2/src/admin/preview-policy.mjs - Adjacent policy preview entry point; not used by these calls.
- ${TRIAL_ROOT}/fixtures/discovery-v2/src/legacy/resolve-policy.mjs - Separate legacy policy implementation; not called by `inspectRequest`.
</files>

<answer>
B1 uses standard mode and tokenizes the normalized query as `["amber","finch"]`. B2 returns standard mode for missing or invalid values; the explicitly strict blank query remains strict. B3’s valid zero override is applied, so the blank query is accepted with budget 0. The static snapshot does not establish a live deployment’s `limitOverride`.

Citations: `inspectRequest` dispatches through the parser and router ([index.mjs:4-5](${TRIAL_ROOT}/fixtures/discovery-v2/src/index.mjs#L4-L5)). Parsing behavior ([parse-request.mjs:5-15](${TRIAL_ROOT}/fixtures/discovery-v2/src/input/parse-request.mjs#L5-L15)); returned fields ([route-request.mjs:3-11](${TRIAL_ROOT}/fixtures/discovery-v2/src/routing/route-request.mjs#L3-L11)); override and default selection ([resolve-policy.mjs:3-9](${TRIAL_ROOT}/fixtures/discovery-v2/src/policy/resolve-policy.mjs#L3-L9)); source defaults ([defaults.mjs:1-4](${TRIAL_ROOT}/fixtures/discovery-v2/src/policy/defaults.mjs#L1-L4)). The supplied task describes a finite static snapshot without deployment files or runtime configuration ([boundaries.md:7-8](${TRIAL_ROOT}/fixtures/discovery-v2/tasks/boundaries.md#L7-L8)).

```discovery-facts
{
  "B1": {
    "result": {
      "mode": "standard",
      "route": "open",
      "tokens": ["amber", "finch"],
      "budget": 4,
      "accepted": true
    }
  },
  "B2": {
    "missingInput": {
      "mode": "standard",
      "route": "open",
      "tokens": [],
      "budget": 4,
      "accepted": true
    },
    "blankStrict": {
      "mode": "strict",
      "route": "guarded",
      "tokens": [],
      "budget": 2,
      "accepted": true
    },
    "invalidFields": {
      "mode": "standard",
      "route": "open",
      "tokens": [],
      "budget": 4,
      "accepted": true
    }
  },
  "B3": {
    "zeroOverrideResult": {
      "mode": "strict",
      "route": "guarded",
      "tokens": [],
      "budget": 0,
      "accepted": true
    },
    "deploymentLimit": {
      "status": "unknown",
      "value": null,
      "snapshotLimitation": true
    }
  }
}
```
</answer>

<next_steps>
Ready to proceed.
</next_steps>
</results>
