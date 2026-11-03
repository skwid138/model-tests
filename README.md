# Model Tests

This repository is a small, reproducible benchmark room for future coding-model tests. It is not a single-purpose tool, and its starter fixtures are intentionally incomplete. Passing a fixture's task tests is the future model task, not a claim that the starter is already implemented.

## Runtime

- Node.js 24 or newer
- Native ECMAScript modules (`.mjs`)
- `node:test` and `node:assert/strict`
- No dependencies

### `label-summary`

Run the visible label-summary fixture from the repository root with:

```sh
node --test fixtures/label-summary/test/group-labels.test.mjs
```

The starter returns an empty result. The test command is expected to report assertion failures until a benchmark run implements the task. Loader or syntax errors are not an expected RED result.

### `api-response-boundary`

Run its visible examples from the repository root with:

```sh
node --test fixtures/api-response-boundary/test/visible.test.mjs
```

The starter handles the ordinary successful and unsuccessful response examples. The task is to implement the public campaign summary contract across its response-reading, normalization, and summary modules; see `fixtures/api-response-boundary/TASK.md` for exact behavior and worker safeguards. The worker may create only the specified regression test and edit only the three task-named source modules.

The coordinator grader is `grading/api-response-boundary.test.mjs`. It is an ordinary versioned file, not a hidden test or security boundary. The coordinator may run it against a trial worktree, after a read-only review of the submitted source for state-changing imports, with:

```sh
node grading/api-response-boundary.test.mjs <trial-root>
```

Do not disclose or provide grader access to the measured worker; observed worker access invalidates the case. A worktree does not technically enforce this restriction.

## Benchmark runs

Freeze a baseline commit before each run. Give every run a fresh Git worktree and branch at that baseline, for example:

```sh
git worktree add -b runs/<run-id> <session-temp>/model-tests-<run-id> <baseline-commit>
```

Use the worktree root as the model's working directory. Do not pull, fetch, reset, or otherwise require network access. A worktree isolates tracked-file changes from the preparation checkout; it is **not a security sandbox**, and it does not verify or restrict global permissions.

The parent must delegate exactly one foreground child with an explicit override to the exact selected model and forward the complete task instructions and all safeguards in `AGENTS.md` verbatim. The model may change only the task's exact allowlisted files; for `label-summary`, this is the two source files named in `AGENTS.md`, while `api-response-boundary` also permits creating its one regression test. Keep all other tests, tasks, documentation, instructions, graders, and Git metadata unchanged. Do not commit benchmark results or changes as part of a run.

For `api-response-boundary`, the worker must run these exact commands from the worktree root, once each and in order: first the visible-test baseline (expected 2 pass), then the combined visible/regression RED (visible tests pass and a regression behavior assertion fails before source edits), then the same combined command once as the final run (all tests expected to pass). The coordinator runs the grader separately. Follow the complete task and `AGENTS.md` for stop rules; do not retry an unexpected error or run additional commands.

Record each trial separately: model and version, hardware, provider and relevant settings, context information and its source, role and prompt version, timing, retries, tool-call status, instruction compliance, and semantic correctness. Keep operational compliance and answer quality as separate measures. Sanitize results and failures; do not include credentials, private endpoints, unrelated local paths, raw transcripts, or source-code/framework dumps. Do not combine tool-call counts from separate trials into a single trial measurement.

There is no root CI configuration or CI status implied by this repository.

## Discovery benchmark v1

The reusable read-only Legolas discovery cases live in `fixtures/discovery-v1/`: `tasks/trace.md` tests public-entry and static-call-path tracing, while `tasks/boundaries.md` tests predicted behavior at input boundaries and a deliberately undetermined deployment fact. Each case exposes three items together at easy, medium, and hard difficulty. The source snapshot is synthetic, finite, and versioned; the separate coordinator-only gold and verifier are under `grading/discovery-v1/`. Do not give workers the answer keys or grader. Run exactly two trials total per profile: one fresh Legolas child session for TRACE and one for BOUNDARY, with all three items visible in each session. Use the same frozen source snapshot and fresh history for both.

Run only the focused, dependency-free v1 checks from the repository root:

```sh
node --test fixtures/discovery-v1/test/public-api.test.mjs fixtures/discovery-v1/test/boundary-behavior.test.mjs
node --test grading/discovery-v1/test/cases.test.mjs grading/discovery-v1/test/verifier.test.mjs grading/discovery-v1/test/manifest.test.mjs grading/discovery-v1/test/submission-format.test.mjs
node --test tools/test/benchmark-monitor.test.mjs
```

The coordinator can grade a normalized structured submission against a trial worktree with:

```sh
node grading/discovery-v1/verify.mjs <trial-root> trace <submission.json> UNKNOWN
```

Use `boundary` for the other case. The coordinator-only `grading/discovery-v1/submission-format.md`, `submission.schema.json`, and placeholder `submission.example.json` define transcription into the CLI's actual shape; they are not worker material and contain no gold answers. The coordinator maps each answer to the documented question/fact slots without repairing or inferring content. Ambiguous normalization pauses grading for user adjudication. `verify.mjs` checks critical submission fields and frozen fixture hashes but is not a full JSON Schema engine. Scoring is fact-based with a fixed denominator per question/tier. Missing, answerable-item abstention, incorrect, unsupported, and misleading-citation outcomes remain distinct. A location match is not proof that evidence entails a claim: two reviewers record the frozen binary checklist for entailment and branch coverage, linked to each question and fact. Missing reviews and disagreements remain `UNRESOLVED` for user adjudication; both checklist decisions are preserved. There is no semantic LLM judge or opaque combined intelligence score. `UNKNOWN` receives abstention credit only for the explicitly unanswerable deployment fact and only when it states the static-snapshot limitation. Protocol status (`PASS`, `FAIL`, or `UNKNOWN`) is separate from semantic accuracy. A known instruction violation is `FAIL`; otherwise, incomplete or unavailable trace/coverage/source provenance is `UNKNOWN`. `PASS` requires an available complete trace, nonempty coverage references, known trace-source provenance, and instruction status `PASS`. `validateManifestProtocol` checks that status rule; `validateEvidenceReviewRecord` checks that question/fact-linked manifest decisions agree with the two-review combiner. These focused validators do not authenticate referenced trace artifacts or validate the entire manifest schema. The verifier's optional `COORDINATOR_RECORDED_PROTOCOL_STATUS` argument is a supplied label, not evidence that a trace was observed; do not use it to bypass the manifest protocol checks. If a complete child tool-call sequence and its coverage cannot be independently verified, protocol status must remain `UNKNOWN`, even if the answer is correct.

Future measured runs require a fresh worktree at a frozen baseline and an exact model override on the existing Legolas role. Legolas's concise required `<analysis>` intent summary followed by its native `<results><files>…</files><answer>…</answer><next_steps>…</next_steps></results>` output flow remains required. Put question IDs and concise structured answer facts inside `answer` and cite with absolute paths under the trial root. The coordinator archives only sanitized `<results>` and excludes `<analysis>` and any raw reasoning from public reports; this archival rule does not suppress required role output. Normalize citations against the explicit root for grading and archiving. Worker path/search limits are instructions, not a technical sandbox. Pre/post hashes and a clean Git tree do not prove that no forbidden attempt occurred. Current parent tooling provides final child results rather than a complete verifiable tool-call sequence; without a separately verified trace, do not claim full protocol qualification.

### Capture-only resource monitor

`tools/benchmark-monitor` is a thin local shell entry backed by Node 24 and a fixed PowerShell 5-compatible payload. It accepts a validated SSH alias, a finite duration from 1–180 seconds, and an existing output root. Example syntax (not run as part of maintainer setup):

```sh
tools/benchmark-monitor --host peesea --duration-seconds 10 --output-root ./captures
```

The alias is an example, not a host query. SSH uses batch mode, strict host-key checking, a 5-second connect timeout, no automatic retries, and finite local watchdog/stall limits. The fixed remote payload only captures point-in-time metrics: Windows `Win32_PerfFormattedData_PerfOS_Memory` available/committed/commit-limit values; `llama-server.exe` PID and its `Win32_PerfFormattedData_PerfProc_Process` working-set/private-working-set/private-byte values; and one `nvidia-smi --query-gpu=memory.used,memory.free,memory.total,utilization.gpu` query. The wire format is UTF-8 NDJSON with version, UTC timestamp, allowlisted memory/GPU/server objects, nullable unknown metrics, and stable error codes (`memory_query_failed`, `gpu_query_failed`, `server_query_failed`, `server_absent`, `server_ambiguous`, `gpu_ambiguous`, `server_process_metrics_missing`). Capture reason codes distinguish `transport_failed`, `capture_timeout`, `malformed_sample`, and `interrupted`. Unknown is `null`, never a substituted zero. Multiple GPUs or server processes are reported as ambiguous. Memory units and process resident/private/commit semantics are distinct; `used + free` is not forced to equal total. Samples and same-PID deltas (current minus prior sample) are not continuous peaks or proof of model causality; deltas are invalid across missing samples or PID changes, and PID reuse remains an open limitation.

The monitor records expected/received sample counts, timestamps, status, reason/error codes, duration provenance, and relative artifact names in a capture manifest separate from the full trial manifest (`grading/discovery-v1/trial-manifest.schema.json`). It does not record host aliases, raw command lines, full paths, logs, keys, or credentials. Capture artifacts are created in a unique directory under the caller's output root. Local cancellation bounds only the owned SSH/helper child; it does not prove that a remote PowerShell payload has stopped. Remote teardown, PID reuse, and provider-cache behavior remain unverified. No model run or live SSH smoke test was performed during implementation; a 5–10 second live smoke test requires separate explicit approval.

For example, this `toolCalls` fragment records unavailable trace data explicitly rather than inventing it:

```json
{
  "count": { "value": null, "provenance": "unknown" },
  "traceStatus": "unavailable",
  "traceSource": { "value": null, "provenance": "unknown" },
  "coverage": "unknown",
  "coverageRefs": []
}
```

Before a future trial, verify the actual Legolas role instructions and exact model catalog ID. Operator gates are 180 seconds from submission (including delegation), at least 4096 MiB RAM, and at least 512 MiB free VRAM. The operator must stop on telemetry loss, a resource floor, or cutoff. Do not claim that a helper cancels the agent. Record model/provider/override artifact/quantization/settings, hardware/context values and provenance, relative trial-root mapping, timing, retries, tool count and trace provenance/coverage, instruction status, semantic grades, evidence review references, and telemetry references. Missing values are unknown, not zero. Text measurement patterns reject common path/URI forms but cannot detect every secret; manually sanitize all values. Do not commit session IDs, raw transcripts/reasoning, credentials, endpoints, or machine-local absolute paths into reports.
