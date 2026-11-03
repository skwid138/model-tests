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

## Discovery benchmark v2 (future runs)

Discovery v2 is a separate, typed-answer experiment. Its eight source modules under `fixtures/discovery-v2/src/` are byte-identical copies of the v1 source snapshot; task, source, answer-key, and grading versions use v2 paths and version fields. The two worker prompts are `fixtures/discovery-v2/tasks/trace.md` and `fixtures/discovery-v2/tasks/boundaries.md`. Each shows all three progressive questions in one session. Do not mix v1 records with v2 results or change v1 artifacts.

The worker receives only one selected v2 task and its listed source files. Coordinator-only answer keys, schemas, examples, normalizer, rubric, verifier, and tests are under `grading/discovery-v2/`; never provide them to the worker. Before a future run, get separate run approval, use a frozen baseline and fresh worktrees, verify the real Legolas role instructions/tool permissions and exact model override, then run an initial screening cohort of exactly two fresh foreground Legolas sessions per profile: one TRACE and one BOUNDARY. The separate `discovery-v2-trace-confirmation-1` protocol below governs the only supplemental attempt authorized by this amendment. No v2 model run is authorized by maintainer implementation work.

Run the focused, dependency-free v2 checks from the repository root:

```sh
node --test fixtures/discovery-v2/test/snapshot.test.mjs fixtures/discovery-v2/test/source-grounding.test.mjs
node --test grading/discovery-v2/test/extraction.test.mjs grading/discovery-v2/test/normalization.test.mjs grading/discovery-v2/test/grading.test.mjs grading/discovery-v2/test/citations-reviews.test.mjs grading/discovery-v2/test/manifest.test.mjs grading/discovery-v2/test/contracts.test.mjs grading/discovery-v2/test/verification-flow.test.mjs
```

Coordinator workflow:

```sh
node grading/discovery-v2/normalize.mjs <trial-root> <trace|boundary> <worker-response-file>
node grading/discovery-v2/verify.mjs <trial-root> <trace|boundary> <submission.json> <manifest.json>
```

`normalize.mjs` prints a coordinator-editable skeleton to stdout. It keeps the exact public `<results>` envelope, excludes `<analysis>`, and only replaces the explicitly supplied trial-root prefix with `${TRIAL_ROOT}`. The coordinator must faithfully transcribe prose, associate citations, retain every additional claim, and record independent reviews. Missing or ambiguous normalization pauses for user adjudication. The JSON Schema documents are normative format references; the dependency-free CLI runs focused boundary and consistency validators, not a general JSON Schema engine.

Typed fact outcomes, citation location, canonical-span overlap, and A/B evidence review are separate fields. Broad in-bounds citations remain valid; canonical-span overlap is descriptive and never semantic credit. Additional claims remain verbatim with cited ranges. They count unsupported only when both independent reviewers agree on the same completed disposition: lack of support within the complete finite source scope, or direct contradiction. Incomplete scope and disagreeing dispositions stay unresolved. The protocol is `FAIL` for an observed instruction or operator-gate violation, `PASS` only with instruction PASS, operator-gate PASS supported by observed preflight hardware and observed elapsed time within the limit, an available complete trace, nonempty coverage references, and known trace-source provenance, and otherwise `UNKNOWN`. A gate status of PASS requires relative evidence references; missing gate measurements remain UNKNOWN. The CLI cross-checks manifest task/source/key hashes against the trial-root copies and requires its A/B review records to match submission reviews. Unknown role/provider artifact hashes remain unknown and do not prove identity. The validator checks recorded consistency, not trace authenticity, evidence authenticity, or the full manifest schema.

Unknown measurements use `null` with provenance `unknown`; do not fill unknown timing, retries, model settings, hardware, or historical role hashes with zero or guesses. Artifact references are relative to the trial root. Before publishing, manually inspect every field name and value for credentials, bearer tokens, private keys, endpoint URLs/user-info, session identifiers, and machine-local paths. Pattern checks are incomplete and do not redact output. If a sensitive value appears, pause publication and resolve it with a human; do not silently rewrite the response. Operator limits remain 180 seconds from submission including delegation, at least 4096 MiB preflight RAM and 512 MiB preflight free VRAM, and stop on telemetry loss, a resource floor, or cutoff. Record the gate outcome, stop reason, and relative evidence refs; a measured floor/time violation is `FAIL`, an unknown gate is `UNKNOWN`, and a compliant stop can leave protocol `UNKNOWN` if the complete trace is unavailable. Cloud telemetry may be marked not applicable only with explicit approval. The capture-only monitor is not a model runner; no remote teardown or cancellation guarantee is claimed.

### `discovery-v2-trace-confirmation-1`

This amendment permits exactly one supplemental TRACE-only attempt total: one fresh foreground session on a new frozen baseline, using the existing Legolas role with exact model override `github-copilot/gpt-6-luna#medium`, all three TRACE questions, the unchanged TRACE task, and its eight listed source paths. No additional BOUNDARY attempt is required or permitted by this authorization. Submission/dispatch consumes the attempt, including provider failure. No retry, fallback, further delegation, background run, response repair, or parser repair is permitted. The original screening pair and outcomes remain immutable and separate; do not replace, pool, or reclassify them. All other v2 worker and coordinator safeguards remain in force.

This is not run approval. Before setup or a model run, obtain separate explicit user approval, including renewed approval for cloud telemetry to be marked not applicable, and confirm operator readiness for the 180-second limit from submission including delegation. Local floors remain 4096 MiB RAM and 512 MiB free VRAM; cloud not-applicable status is not an observed hardware PASS. Stop on telemetry loss, a resource floor, or cutoff, and hard-stop after the single attempt regardless of outcome. Local screening requires its own separate plan and approval. Stop and replan if a genuine grading defect is found; do not alter the frozen experiment.

Use a new committed documentation baseline after audit and user commit permission, and record the full commit as the baseline before any attempt. The handoff includes complete amended `AGENTS.md`, unchanged TRACE task, and exactly its eight listed source paths, with no keys. Task, source, and scorer bytes remain unchanged, but the full handoff is not byte-identical because the authorization in `AGENTS.md` changed; do not claim identical-prompt replication or reliability. Record protocol identifier `discovery-v2-trace-confirmation-1` and the instruction delta in future observations/results and existing manifest artifact references; do not add manifest fields or edit schemas.

Archive valid responses faithfully under the trial root, normalizing only an explicit root prefix. Preserve invalid-format output unscored without repair or retry; pause for user adjudication on missing or ambiguous normalization. A known instruction or operator-gate violation is `FAIL`; absent complete child-trace/evidence is `UNKNOWN` and unqualified. Valid output follows the existing v2 workflow: retain all questions, prose, citations, and extra claims; perform independent gold-blind A/B evidence review, frozen grading, and manual full-schema comparison. Do not disclose prior responses, answers, or response-format failures to the worker. Documentation changes do not authorize a model run.
