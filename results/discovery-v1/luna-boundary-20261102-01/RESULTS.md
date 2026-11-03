# Discovery v1 — Luna BOUNDARY result record

## Outcome

This is a provisional archival record, not a scored or qualified result. The complete child tool-call trace and coverage evidence are unavailable, so protocol status is **UNKNOWN**. No A/B evidence reviews were recorded and no final semantic score was assigned.

## Trial record

- **Case:** BOUNDARY, three questions in one fresh foreground Legolas session.
- **Selected profile:** `github-copilot/gpt-6-luna#medium`, resolved and explicitly dispatched once.
- **Baseline:** `f69c5d695163ab14d2112f0fe691dc7e74dc3cb6`.
- **Branch:** `runs/luna-discovery-boundary-20261102-01`.
- **Trial-root name:** `model-tests-luna-discovery-boundary-20261102-01`.
- **Coordinator-observed outer interval:** `2026-11-03T04:23:54Z`–`2026-11-03T04:24:41Z` (47 seconds). This coarse interval is not a precise submission/start time, elapsed-time measurement, or deadline check.
- **Coordinator redispatches:** 0 observed. Worker-internal retries and tool-call count: unknown.
- **Resource telemetry:** Cloud hardware, RAM, and VRAM are unknown; cloud telemetry was explicitly N/A and no SSH was used.
- **Worker/source changes:** No child or source writes were observed. The trial Git tree was clean before and after; those checks do not prove that no forbidden attempt occurred.

## Archived response and limits

[`response.md`](response.md) preserves the captured `<results>` fragment only. The trial-root prefix was removed from citations; no semantic correction, citation trimming, or scoring was performed. The captured artifact contained an `<analysis>` section, which was excluded from this public archive in keeping with the results-only archival rule.

The recorded answers discuss normal output and missing, blank, invalid, zero-override, and deployment-unknown cases. They remain ungraded: citation location alone does not establish that evidence entails every claim. In particular, no independent A/B entailment or branch-coverage review exists.

The v1 grading approach had known limitations relevant to this control: a deep English-match requirement, broad citation/full-gold containment expectations, and automatic treatment of additional claims as unsupported. These runs are not retrospectively rescored under v1, and those limitations motivate a separate v2 grading plan.

No v1 grading CLI or scorer was run, no final score exists, and no formal v1 manifest was created. Historical role-baseline hash metadata was not recorded; it is not inferred here. The selected profile is a control observation only, not a reliability estimate or qualification.
