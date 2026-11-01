# Trial results: GPT-OSS API-01

**Outcome: REJECTED, protocol-invalid and contract-incomplete.** No baseline, RED, final test, regression-test creation, or coordinator grader occurred. Preserve the partial source artifact; do not repair, resume, rerun, grade, or clean it up.

## Conditions and artifact

- Selected identifier: `gpt-oss-20b`, no variant; reasoning effort default/unspecified.
- The operator confirmed the intended Unsloth `gpt-oss-20b-F16.gguf`, Devstral unloaded, served identifier `gpt-oss-20b`, and context 65,536. The filename describes a mixed native-MXFP4 artifact, not all-FP16 weights.
- The operator reported confirming the saved preset, GUI **Stop at Limit**, live monitoring, and interruption readiness. API overflow-policy effect, effective GUI-only Min-P, output-cap merge behavior, and exact reasoning-token accounting remain unverified.
- The API configuration declared temperature 1, top-P 1, top-K 0, repeat penalty 1, presence penalty 0, and `max_tokens` 8,192; the model output limit was also 8,192. The duplicate cap merge behavior is unknown. No Min-P value was sent. These settings do not establish GUI inheritance or API enforcement.
- Frozen baseline and trial-start branch HEAD: `4f64e932b05ab70ea71d84509d3425623c14c62c`, branch `runs/gptoss20b-api-20261031-01`.
- Preserved change: `fixtures/api-response-boundary/src/normalize-campaigns.mjs` (Git blob `267e17acae3fa1733d0edfa8a2b4aa7a23720ace`). The regression test is absent; frozen task, instructions, visible tests, and grader were unchanged.

## Execution and stop-rule evidence

Independent exact-session evidence recorded **19 tool calls**: eight reads (seven completed, one error), four edits (two completed, two errors), and seven completed writes to the existing allowed normalization source. This describes source modifications, not seven unauthorized file creations.

There were zero shell executions, test executions, or regression-test creations. The prescribed baseline, RED, and final commands were not run; pass/fail counts are unavailable, not zero.

Prescribed commands, all **not run**:

1. Baseline: `node --test fixtures/api-response-boundary/test/visible.test.mjs`.
2. RED: `node --test fixtures/api-response-boundary/test/visible.test.mjs fixtures/api-response-boundary/test/regression.test.mjs`.
3. Final: `node --test fixtures/api-response-boundary/test/visible.test.mjs fixtures/api-response-boundary/test/regression.test.mjs`.

The first successful source edit preceded baseline testing and valid RED. A subsequent edit error required stopping, but 13 further calls followed, including another edit error and a read error. There were nine successful source write/edit operations; this does not establish nine distinct byte changes. The read-error target was not resolved by the safe projection, so this report does not claim secret access or broader filesystem damage.

The final refusal incorrectly asserted that a valid failing regression could not be created and that edits after valid RED were forbidden. The task allowed source edits after valid RED, and source had already changed before any tests. No intent is inferred. Saruman’s verdict was **REJECT**. The reviewed import chain was side-effect-free, but the stop violation blocked grading.

## Correctness, timing, and resources

The normalizer added ID/name trimming and bounded integer spend validation, retaining valid-ID rows with invalid spend set to zero. The unchanged reader still accepts array-valued bodies with an `items` property, so the public non-array-body contract is incomplete. There is no valid test evidence or independent grader score.

Verified child interval was `2026-11-01T15:01:48.659Z` → `15:04:00.614Z` (131.955 seconds). Parent invocation created-to-completed was `15:01:08.881Z` → `15:04:00.617Z` (171.736 seconds), including delegation; the assistant-message envelope was 175.307 seconds. A later clock sample was delayed and is not the case completion time. Stored resume attempts were zero; observed recovery calls still occurred. Provider-internal retries are unknown.

Highest recorded per-response input was 26,774 tokens; highest reasoning-plus-output total was 4,757 tokens. No response had a length-limit finish marker. There is no observed evidence of token-cap exhaustion; this neither verifies API policies nor identifies a root cause.

User-supplied samples reported minimum available RAM of 12,490 MiB, minimum free VRAM of 9,531 MiB, maximum used VRAM of 14,612 MiB, and peak utilization of 97%. Used GPU memory increased 22 MiB from the sampled idle baseline. No supplied sample crossed a resource floor. Sampling was discrete; system/device memory is not attributable to the model. Both captures show operator termination.

No repair, resumption, rerun, cleanup, or grading followed the rejection.
