# Trial results: Devstral API-01

**Outcome: Contract failure.** The worker followed the three-stage test protocol and finished its final visible/regression tests, but the result did not satisfy the public contract and the independent grader scored 1/4 groups.

## Conditions and artifacts

- Selected model: `mistralai/devstral-small-2-2512`, no variant. The operator reported Devstral Small 2 24B Q4_K_M on a Windows RTX 4090; actual loaded file/context and GUI/API overflow behavior were not independently verified.
- OpenCode declared context 65,536 and output 8,192, with tools and text input/output. This entry had no sampler-body settings. These are configuration declarations, not proof of request/runtime behavior.
- Frozen baseline and trial-start branch HEAD: `4f64e932b05ab70ea71d84509d3425623c14c62c`, branch `runs/devstral-api-20261031-01`.
- Changed files: `fixtures/api-response-boundary/src/normalize-campaigns.mjs` (Git blob `a76ea3e1fe8c4b12d591b3911afe18ae69dfaedc`) and `fixtures/api-response-boundary/test/regression.test.mjs` (Git blob `4fee4b751f237f259128e20bdd27f6d67b47a1be`).

## Test evidence

Exactly these three commands were recorded once each, in order:

| Stage | Command | Passed | Failed |
|---|---|---:|---:|
| Baseline | `node --test fixtures/api-response-boundary/test/visible.test.mjs` | 2 | 0 |
| RED | `node --test fixtures/api-response-boundary/test/visible.test.mjs fixtures/api-response-boundary/test/regression.test.mjs` | 2 | 1 expected behavior assertion |
| Final | `node --test fixtures/api-response-boundary/test/visible.test.mjs fixtures/api-response-boundary/test/regression.test.mjs` | 3 | 0 |

Eleven tool calls were recorded: six reads, three shell calls, one write, and one edit. Two reads after the final test made no source edits and ran no extra shell commands.

The public regression test meaningfully caught fractional spend. The source added integer validation but still accepted spend above 1,000,000,000, retained whitespace in IDs/names/fallbacks, and accepted array-valued bodies with `items`. The final report overstated upper-bound enforcement and full correctness.

## Independent review and measurements

The coordinator ran the grader once after import review. It scored **1/4 groups**; each group contains multiple assertions. This is not a 1/4 exhaustive semantic-case score.

Child interval was `2026-10-31T21:22:13.394Z` → `21:22:55.174Z` (41.780 seconds). The coordinator bracket was `21:21:31Z` → `21:23:07Z` (about 96 seconds), including orchestration overhead. User-supplied RAM capture reported a 9,728 MiB minimum during cooldown and a 9,733 MiB minimum among supplied samples overlapping the child; the capture began 9.940 seconds after child creation. GPU samples reported constant 19,962 MiB used / 4,181 MiB free, with utilization reaching 100%. Samples are discrete and do not establish continuous safety or attribute host/device memory to the model.

This was one updated-policy Devstral case. The API effect of the GUI overflow policy remains unverified; this result does not establish that truncation caused the failure.
