# Trial results: Laguna API screen

**Outcome: Failed semantic screen (3/4 independent grader groups passed).** The submission accepted an invalid response envelope whose `body` was an array containing `items`. The independent grader rejected that behavior. A repeat is not eligible under the screen rule requiring both a 4/4 grader result and full protocol compliance. Worker timing and full protocol compliance cannot be independently established from the available record.

## Trial setup and artifacts

- Selected model: `peesea/laguna-xs-2.1-apex`, resolved from the model catalog. The coordinator confirmed Node.js `v24.15.0` and that the foreground worker used the trial worktree as its working directory.
- Worker: one foreground `aragorn-benchmark` child with an explicit override to the selected model. The complete task and benchmark safeguards were provided verbatim.
- Trial branch: `runs/laguna-api-20261102-01`. Frozen baseline and trial-start `HEAD`: `4f64e932b05ab70ea71d84509d3425623c14c62c`.
- The operator's readiness limit was 180 seconds from submission, including delegation, with floors of 4,096 MiB free RAM and 512 MiB free VRAM. Exact dispatch/finish timestamps and a full tool trace are unavailable. Worker elapsed time and time-gate compliance are therefore unknown. Snapshot spacing below is not worker elapsed time.
- Worker-changed benchmark files: `fixtures/api-response-boundary/src/normalize-campaigns.mjs` and `fixtures/api-response-boundary/test/regression.test.mjs`. The tracked source diff is 12 lines (7 insertions, 5 deletions); it trims IDs and names and accepts spend only when it is an integer from 0 through 1,000,000,000. The new regression file has 68 lines and four public cases. No source or test repair was made for this report.
- Read-only `git hash-object --no-f` identifiers for the submitted artifacts:

  | File | Blob ID |
  |---|---|
  | `fixtures/api-response-boundary/src/read-response.mjs` | `6da1f2c68c6d84a6b8f5d37959812aa3a57f5c9d` |
  | `fixtures/api-response-boundary/src/normalize-campaigns.mjs` | `737c4f694350f1e22e4380a0658be5308cf22ba5` |
  | `fixtures/api-response-boundary/src/summarize-response.mjs` | `1810d7134da0e39ec35ebb55a6166906fae50196` |
  | `fixtures/api-response-boundary/test/regression.test.mjs` | `a71cc2d5fc9ecf94d7831d6387290f67c8bbe326` |

  These IDs were obtained without writing Git objects and are checked again after this report is written. The submitted source diff's spend-condition lines contain trailing whitespace; it is preserved as submitted.

## Worker-reported tests and independent grader

The worker reported this exact baseline, RED, and final command sequence. No raw worker tool transcript was available to independently verify command execution, ordering, or counts.

| Stage | Reported command | Reported result |
|---|---|---|
| Baseline | `node --test fixtures/api-response-boundary/test/visible.test.mjs` | 2 visible tests passed |
| RED | `node --test fixtures/api-response-boundary/test/visible.test.mjs fixtures/api-response-boundary/test/regression.test.mjs` | 2 visible tests passed; 4 regression behavior cases failed |
| Final | `node --test fixtures/api-response-boundary/test/visible.test.mjs fixtures/api-response-boundary/test/regression.test.mjs` | 6 tests passed |

The coordinator ran the grader once, after source review:

```sh
node grading/api-response-boundary.test.mjs <trial-root>
```

It exited 1 with **3/4 groups passed and 1/4 failed** (reported grader duration: `4.75975 ms`, not worker elapsed time). The failing group covered invalid/empty response envelopes, including an array-valued `body` with an `items` property. Passing groups covered normalization order and duplicates, bounded nonnegative integer spend without coercion, and immutability/fresh results. There was no second grader run.

The post-implementation audit returned **REVISE**: it confirmed the array-body contract violation and noted an endpoint-coverage gap in the regression tests (nonblocking). Import-chain review cleared state-changing imports. Audit findings do not establish worker protocol compliance; that remains unknown. No tests or source were changed after the grader.

## Runtime configuration and comparability

Preflight at `2026-11-02T23:28:20.0885729Z` reported artifact `Laguna-XS-2.1-APEX-I-Compact.gguf`, source `mudler/Laguna-XS-2.1-APEX-GGUF`. This is a mixed-precision APEX I-Compact GGUF by mudler/LocalAI. The chosen sampler references Poolside base-model guidance, which was not independently validated for this APEX model. The active backend folder was `2.67.0`; the exact active build is unknown.

Observed runtime arguments included context 65,536, parallelism 4, F16/F16 unified-KV flags. `--no-kv-offload` was absent; that does not prove the effective value of every setting. The API-served profile, sampler, output cap, overflow behavior, and per-request allocation were not verified.

The following are user-approved/configured settings, not a claim that every UI value was independently verified: temperature 1, P 1, K 20, min-P disabled, repetition disabled; F16 KV; context 65,536; parallelism 4; unified KV; offload 40; 9 threads; batch 2,048; ubatch 512; 8 experts; 32 checkpoints; GPU KV enabled; keep-memory, mmap, and flash enabled; reasoning on; unrestricted mode; CPU expert offload 0; speculative decoding off; stop-at-limit on; response cap off; random seed. OpenCode declared an 8,192-token output limit, but the effective API limit is unknown.

The user reported rebooting and freshly loading Laguna; the reboot was not independently verified. This is a different condition from the warm Gemma run, not a controlled comparison. Neither trial supports a reliability estimate or a model-architecture-only comparison. An initial coordinator SSH query failed to parse before metrics were collected; a corrected, user-authorized read-only query succeeded. This preflight issue occurred outside the measured attempt and is not classified as a worker failure.

## Resource observations

Two coordinator snapshots were taken with the model loaded. Both confirmed the same server PID (the numeric PID is omitted); therefore, process-memory deltas compare the same process across snapshots, not different processes. The second snapshot was before the grader. These are separate observations, not continuous monitoring or a complete record of the worker's active interval.

| Metric | Pre: `2026-11-02T23:31:01.2579724Z` | Post: `2026-11-02T23:32:34.8942570Z` |
|---|---:|---:|
| System available memory | 11,712 MiB | 10,082 MiB |
| System committed memory | 27,015,290,880 bytes | 28,791,390,208 bytes |
| Commit limit | 42,850,283,520 bytes | 42,850,283,520 bytes |
| GPU used / free / total | 18,787 / 5,356 / 24,564 MiB | 18,817 / 5,326 / 24,564 MiB |
| GPU utilization | 0% | 0% |
| Server working set | 16,260,722,688 bytes | 17,976,401,920 bytes |
| Server private working set | 395,513,856 bytes | 2,100,752,384 bytes |
| Server private bytes | 20,072,648,704 bytes | 21,836,341,248 bytes |

The snapshots were about 93.636 seconds apart. Across them, available memory fell by 1,630 MiB, committed memory rose by 1,776,099,328 bytes, GPU used memory rose by 30 MiB, server working set rose by 1,715,679,232 bytes, private working set by 1,705,238,528 bytes, and private bytes by 1,763,692,544 bytes. This interval is not worker elapsed time and does not guarantee coverage of the full worker or model-active period. These observations do not establish a peak, a leak, or a cause. Working set can include shared pages and must not be summed as unique physical memory. Private working set is resident private memory; private bytes are private virtual commit, not physical residency.

Separate user-supplied host-local monitor samples (timezone not verified) covered RAM from `2026-11-02 17:30:44.115` to `17:32:18.641`, and GPU from `17:30:44.386` to `17:32:19.884`. RAM was initially 11,793 MiB, with a 10,127 MiB minimum and 11,800 MiB maximum. GPU was initially 18,787 MiB used / 5,356 MiB free; the reported peak was 18,817 MiB used / 5,326 MiB free, with maximum utilization 99%. These samples did not cross the configured floors. Keep these monitor extrema separate from the coordinator snapshots, including the later 10,082 MiB available-memory sample.

In both coordinator snapshots and the supplied GPU samples, reported used plus free memory was 24,143 MiB, 421 MiB below the reported 24,564 MiB total. The discrepancy is unexplained; no reserved-memory amount or cause is inferred.

## Disposition

This Laguna attempt failed the semantic screen. It is not a model qualification or reliability result. The independent grader's failure is established; exact worker command compliance and the 180-second time gate are not. No repeat is eligible under the current 4/4-plus-full-compliance rule. No worker repair, source/test edit, or test rerun was performed during this reporting task.
