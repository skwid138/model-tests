# Trial results: Gemma API screen

**Outcome: Failed semantic screen (3/4 independent grader groups passed).** The implementation did not satisfy the response-envelope contract. A repeat is not eligible under the screening rule requiring both a 4/4 grader result and full protocol compliance. Protocol compliance cannot be independently certified from the available record.

## Conditions and artifacts

- Foreground worker: `aragorn-benchmark`, with the explicit selected-model override `peesea/google/gemma-4-26b-a4b-qat`.
- Trial branch: `runs/gemma-api-20261102-01`; frozen baseline and trial-start `HEAD`: `4f64e932b05ab70ea71d84509d3425623c14c62c`.
- The coordinator report accompanies the preserved trial artifacts on branch `runs/gemma-api-20261102-01`, in worktree `model-tests-gemma-api-20261102-01`. The frozen baseline and trial-start `HEAD` were `4f64e932b05ab70ea71d84509d3425623c14c62c`; archival commits preserve a failed trial and do not imply an accepted implementation.
- Changed files: `fixtures/api-response-boundary/src/normalize-campaigns.mjs` and `fixtures/api-response-boundary/test/regression.test.mjs`.
- Read-only Git blob IDs (`git hash-object --no-f`):
  - `fixtures/api-response-boundary/src/read-response.mjs`: `6da1f2c68c6d84a6b8f5d37959812aa3a57f5c9d`
  - `fixtures/api-response-boundary/src/normalize-campaigns.mjs`: `eac86dffc5834cc7e5f29674baf1076683e8aa89`
  - `fixtures/api-response-boundary/src/summarize-response.mjs`: `1810d7134da0e39ec35ebb55a6166906fae50196`
  - `fixtures/api-response-boundary/test/regression.test.mjs`: `a26f806c1a38dd71dd328ef18911b85615efd079`
- Source/import review cleared state-changing import safety. The post-implementation audit flagged a semantic gap: the worker's submission incorrectly accepted an array-valued `body` when it had an `items` property, despite the contract requiring a non-array object. No repair or further test run was made after the coordinator grader.

## Tests and independent grader

The following baseline, RED, and final results were reported by the worker. The coordinator had no raw worker tool transcript, so the exact execution sequence and counts are not independently verified.

| Stage | Reported command | Passed | Failed |
|---|---|---:|---:|
| Baseline | `node --test fixtures/api-response-boundary/test/visible.test.mjs` | 2 | 0 |
| RED | `node --test fixtures/api-response-boundary/test/visible.test.mjs fixtures/api-response-boundary/test/regression.test.mjs` | 2 | 2 behavioral assertions |
| Final | `node --test fixtures/api-response-boundary/test/visible.test.mjs fixtures/api-response-boundary/test/regression.test.mjs` | 4 | 0 |

The coordinator ran the grader once from frozen `main`:

```sh
node grading/api-response-boundary.test.mjs <trial-root>
```

It exited 1: **3/4 groups passed, 1/4 failed**. The failing group demonstrated that the worker's submission incorrectly accepted an invalid response envelope whose `body` was an array with an `items` property; the grader rejected that behavior. The passing groups covered normalization order and duplicates, bounded spend, and immutability/fresh results. The grader's reported `6.078208 ms` is its own duration, not worker elapsed time.

No worker call sequence/counts were independently verified. In particular, this report makes no claim that forbidden calls or retries were zero, and it cannot certify either full compliance or an observed protocol violation. The semantic grader failure is established independently of that protocol uncertainty.

## Runtime and monitoring context

- Local Node.js: `v24.15.0`. Preflight at `2026-11-02T22:39:07.7859608Z` reported 13,016.4 MiB RAM and GPU memory of 18,739 MiB used / 5,404 MiB free / 24,564 MiB total. The GPU model was user-reported as RTX 4090; the read-only preflight confirmed a GPU device and memory but did not query its name.
- User-supplied monitor samples: RAM ranged from 13,302 MiB to a 7,631 MiB minimum; GPU free memory ranged from 5,404 MiB to a 5,360 MiB minimum, with peak used memory of 18,783 MiB (44 MiB above the initial sample) and utilization reaching 100%. The samples did not cross the configured 4,096 MiB free-RAM or 512 MiB free-VRAM floors. These are discrete observations, not continuous guarantees or model-memory attribution. The supplied sample times are host-local with timezone unverified; they do not establish worker elapsed time. Exact submission/finish timestamps are unavailable, so no claim is made that the 180-second cutoff was met.
- Active GGUF basename: `gemma-4-26B-A4B-it-QAT-Q4_0.gguf`; source: `lmstudio-community/gemma-4-26B-A4B-it-QAT-GGUF`. Backend folder version was `2.67.0`; exact active build is unknown. The API-served model ID, effective sampler, overflow behavior, and effective per-request context allocation were not verified.
- User-confirmed UI settings: context 65,536 (full supported context reported as 262,144), offload 30, threads 9, batch 2,048, ubatch 1,120, parallel 4, unified KV, 32 checkpoints, GPU KV, mmap, keep-memory, flash enabled with runtime auto selection, F16 KV with no KV quantization, 8 experts, CPU expert offload 0, speculative decoding off, reasoning on, unrestricted mode, and random seed. Sampling was reported as temperature 1, P 0.95, K 64, min-P and repetition controls disabled, stop-at-limit on, and response cap off; OpenCode declared an 8,192-token output limit, while effective API behavior is unknown.
- Both `--no-mmproj` and an mmproj-path flag were observed; which behavior was effective is unknown. The reported approximately 1 GB saving was not verified. This run used F16 KV, unlike the user's report that most previous runs used Q8 KV; it is not directly comparable to those runs and is not an exact-reproduction or architecture-only comparison.

## Disposition

The Gemma run is a failed semantic screen, not a model qualification or reliability estimate. No source repair or test rerun was performed as part of this report task. Archival commits preserve a failed trial and do not change its disposition.

## Separate post-run resource snapshot

This read-only SSH snapshot is a separate observation, not an extension of the trial's sampled extrema. At `2026-11-02T22:58:40.8964415Z`, Gemma was still loaded and idle (GPU utilization 0%). No unload or model change was performed.

| System/device metric | Snapshot |
|---|---:|
| System available memory | 7,592 MiB |
| System committed memory | 34,327,158,784 bytes (32,736.9 MiB) |
| Commit limit | 42,850,283,520 bytes (40,865.2 MiB) |
| Commit headroom | 8,523,124,736 bytes (8,128.3 MiB) |
| GPU memory | 18,783 MiB used / 5,360 MiB free / 24,564 MiB total |
| GPU utilization | 0% |

In both the preflight and this snapshot, reported GPU used plus free memory is 24,143 MiB, which is 421 MiB below the reported 24,564 MiB total. Driver-reserved or other accounting is possible, but was not verified. The reported figures are retained as returned; no reserved-memory amount or cause is inferred.

| Process row (no PIDs) | Working set (MiB) | Private working set (MiB) | Private bytes (MiB) |
|---|---:|---:|---:|
| `llama-server.exe` | 20,039.8 | 6,173.1 | 25,026.2 |
| LM Studio process 1 | 304.4 | 217.1 | 347.4 |
| LM Studio process 2 | 36.2 | 1.3 | 10.8 |
| LM Studio process 3 | 121.8 | 40.5 | 135.5 |
| LM Studio process 4 | 51.4 | 2.5 | 13.3 |
| LM Studio process 5 | 64.3 | 14.2 | 55.7 |

Working set includes shared pages and must not be summed as unique physical memory. Private working set is resident private memory; private bytes represent private commit, not physical residency. The large `llama-server.exe` private footprint is an observation while idle, not proof that it explains the whole memory increase. There is no comparable pre-run per-process baseline, so the reported 5.54 GiB delta cannot be attributed from these data and is not evidence of a leak.

An earlier user-supplied post-run sample at `16:53:54` reported 7,631 MiB available and 34,307,710,976 bytes committed. Relative to that sample, this snapshot is about 39 MiB lower in available memory and 18.5 MiB higher in committed memory. The two samples are close, but were taken at different times and do not establish a universal stable plateau. Runtime buffers, cache, checkpoints, or allocator retention remain hypotheses, not verified causes. An unload and a before/after-unload comparison remain outstanding. The user's reported approximately 1 GB projector saving is still unverified.
