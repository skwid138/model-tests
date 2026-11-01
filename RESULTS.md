# Trial results: Devstral label-summary

**Outcome: Contract failure despite a green visible suite.** The result is not a completed task pass because the implementation violates the ASCII-order requirement and the final report omitted required evidence.

## Conditions and artifacts

- Selected model: `mistralai/devstral-small-2-2512`, no variant. The operator reported Devstral Small 2 24B Instruct 2512 Q4_K_M on a Windows RTX 4090. Runtime state was not independently verified.
- Branch: `runs/devstral-20261031-01`; frozen baseline and trial-start branch HEAD: `99de9d5da682db113ceb9c648d2607f1266f5710`.
- Changed files: `fixtures/label-summary/src/group-labels.mjs` (Git blob `c26da9cdb9b2133debbefe86a5d5498a277868af`) and `fixtures/label-summary/src/normalize-label.mjs` (Git blob `9f839b455349b26cbce2380fbdcb5e9142ff524f`).
- Operator-reported settings: context 65,536, Q8 K/V, Flash Attention, concurrency 1, GPU weight offload, and CPU projector. These were not independently verified through runtime inventory.

## Tests and correctness

The prescribed command, run once for baseline and once for final, was:

```sh
node --test fixtures/label-summary/test/group-labels.test.mjs
```

| Stage | Passed | Failed |
|---|---:|---:|
| Baseline | 2 | 6 behavioral assertions |
| Final | 8 | 0 |

Six tool calls were recorded: two reads, two shell calls, one write, and one edit. The green final suite did not cover ASCII edge ordering. A separately authorized one-time public-interface check observed actual labels `["_", "0"]` where required ASCII order is `["0", "_"]`; it reported a mismatch and was not a retry or frozen-suite rerun.

The implementation normalized and counted labels, but used locale-aware comparison instead of the required exact ASCII order. The final response omitted commands, results, changed files, and limitations. No coordinator grader was specified for this fixture.

## Timing and resources

Child interval was `2026-10-31T18:03:33.348Z` → `18:03:53.645Z` (20.297 seconds). The available record does not establish a complete end-to-end deadline interval. User-supplied samples reported minimum available RAM of 12,103 MiB, minimum free VRAM of 4,181 MiB, peak GPU use of 19,962 MiB, and utilization reaching 100%. Discrete host/device samples are not a continuous safety guarantee or memory attribution to the model.

This is one experimental trial, not a model qualification or reliability estimate.
