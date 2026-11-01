# Trial results: Luna API control

**Outcome: Passed the visible/regression suite and independent grader for this fixture.** This is one control, not a model reliability estimate or a pure architecture comparison.

## Conditions and artifacts

- Selected model: `gpt-6-luna`, variant `high`.
- Frozen baseline and trial-start branch HEAD: `4f64e932b05ab70ea71d84509d3425623c14c62c`, branch `runs/luna-api-20261031-01`.
- Changed files: `fixtures/api-response-boundary/src/normalize-campaigns.mjs` (Git blob `2d0eeb3c58a00a267fbdaebd17663414e030dc30`), `fixtures/api-response-boundary/src/read-response.mjs` (Git blob `fbac2d54a74caa090546c133470d04757709e8c2`), and `fixtures/api-response-boundary/test/regression.test.mjs` (Git blob `5e43346a9d7a4be49da94e23a2ef03f0e6e0d33c`).
- The agent prompt had previously approved body-paragraph changes for an explicit selected-model override and local-only hardware gates; frontmatter/default/permissions were unchanged. Prompts, deployment, inference configuration, and tool mix differed from the local trials.
- Cloud hardware resources were unavailable/not applicable, not zero.

## Tests and review

The three exact commands ran once each in order:

| Stage | Command | Passed | Failed |
|---|---|---:|---:|
| Baseline | `node --test fixtures/api-response-boundary/test/visible.test.mjs` | 2 | 0 |
| RED | `node --test fixtures/api-response-boundary/test/visible.test.mjs fixtures/api-response-boundary/test/regression.test.mjs` | 2 | 1 expected behavior assertion |
| Final | `node --test fixtures/api-response-boundary/test/visible.test.mjs fixtures/api-response-boundary/test/regression.test.mjs` | 3 | 0 |

Nine tool calls were recorded: four reads, three shell calls, and two patches. The source review approved the implementation. The coordinator grader scored **4/4 groups**; each group contains multiple public assertions.

The changes implemented trimming and fallback names, bounded integer spend, and rejection of array-valued bodies. The worker regression test covered several boundaries, duplicates, filtering, immutability, and fresh results, but did not explicitly test fractional-spend rejection. The independent grader did exercise fractional spend; the test-coverage limitation does not negate the observed correct implementation.

## Timing and comparison limits

Child interval was `2026-11-01T02:52:40.649Z` → `02:53:15.379Z` (34.730 seconds); the coordinator bracket was `02:52:06Z` → `02:53:20Z` (about 74 seconds). These include different overhead and are not decode-speed comparisons. This control used a different provider/deployment and a different approved agent body from the local trials. It shows the fixture distinguished a complete implementation from partial fixes, not that every local model fails or that Luna has a measured reliability rate.
