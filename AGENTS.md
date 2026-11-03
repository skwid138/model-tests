# Benchmark Execution Instructions

These instructions govern future model benchmark runs in this repository. They do not define maintainer preparation work.

## Run isolation

- Start from a frozen baseline commit and use a new Git worktree and branch for every trial. Set the worktree root as the foreground model's working directory.
- The parent must delegate exactly one foreground child with an explicit override to the exact selected model for each case, and forward the complete `TASK.md` and all safeguards in this file verbatim. Do not delegate to other agents, use cloud fallback, or run models in the background.
- The worktree is not a security sandbox. Do not assume that global permissions have been verified or restricted.
- Do not pull, fetch, reset, install dependencies, run scripts or services, change model settings, or make network or configuration changes.
- Do not commit, stage, or modify Git metadata.

## Allowed benchmark changes

Each approved task has its own exact worker path allowlist in its complete `TASK.md` and the task-specific instructions below. The worker must leave tests, tasks, documentation, instructions, graders, and Git metadata unchanged unless the task explicitly permits a test file.

### `label-summary`

For the label-summary task, the model may **create only** `fixtures/label-summary/src/normalize-label.mjs` and **edit only** `fixtures/label-summary/src/group-labels.mjs`. It must leave the tests, `TASK.md`, documentation, instructions, and Git metadata unchanged.

### `api-response-boundary`

For the API-response-boundary task, the model may **create only** `fixtures/api-response-boundary/test/regression.test.mjs` and **edit only** `fixtures/api-response-boundary/src/read-response.mjs`, `fixtures/api-response-boundary/src/normalize-campaigns.mjs`, and `fixtures/api-response-boundary/src/summarize-response.mjs`. The visible tests, task, docs, instructions, coordinator grader, and Git metadata are frozen. Do not read, search for, or inspect `grading/api-response-boundary.test.mjs`; it is not a hidden test or security boundary, and observed access invalidates the case.

Read-only discovery of ordinary task instructions is allowed. Do not read secrets, configuration files, service state, logs, or databases. A task prompt is not a permission guard: stop if an action would violate these boundaries or a higher-priority instruction. Do not try another tool or route to bypass a conflict.

## Test and stop rules

Use the exact task command from the worktree root:

```sh
node --test fixtures/label-summary/test/group-labels.test.mjs
```

Expected assertion failures are normal before implementation and during ordinary code/test iterations, within the run's separately stated retry or time budget. If no budget is stated, do not invent one. A malformed tool call, unexpected execution error, or forbidden action is a stop condition: stop immediately and do not retry.

Do not run broad test suites. At the end, report the exact command and results, the files changed, and any unresolved limitations. Do not claim a clean run if any assertion or instruction-compliance check failed.

### `api-response-boundary`

From the worktree root, run these exact commands once each, in order:

```sh
node --test fixtures/api-response-boundary/test/visible.test.mjs
node --test fixtures/api-response-boundary/test/visible.test.mjs fixtures/api-response-boundary/test/regression.test.mjs
node --test fixtures/api-response-boundary/test/visible.test.mjs fixtures/api-response-boundary/test/regression.test.mjs
```

The baseline is exactly 2 visible tests passing. The RED must keep visible tests passing and fail one or more behavioral assertions in the new regression test before any source edit. The final run must pass all tests. Do not run other commands, retry, or edit after the final run. Stop on a loader, syntax, or other unexpected execution error, malformed tool call, permission denial, forbidden action, or higher-priority instruction conflict; do not use another route to bypass a stop condition. Report exact commands and counts, changed files, and limitations. The coordinator runs the grader separately, after reviewing submitted source for state-changing imports. A worktree is not a security sandbox; do not claim technical enforcement of path or grader restrictions.

## Discovery v1 worker protocol

This section applies only to future `fixtures/discovery-v1/` measured runs. It does not change the existing `label-summary` or `api-response-boundary` paths, allowlists, or test commands above.

- Use one fresh worktree at a new frozen fixture baseline for each trial. The trial root is the worktree root; forward the complete selected task prompt (`fixtures/discovery-v1/tasks/trace.md` or `fixtures/discovery-v1/tasks/boundaries.md`) plus exactly the source paths listed in that task. These are the complete discovery task files; no separate `TASK.md` exists for this case. The coordinator answer keys, verifier, grader tests, other fixture files, and reports are outside worker material.
- The parent delegates exactly one foreground child to the existing Legolas role with an explicit override to the exact selected model for each trial. Run exactly two trials total per profile: one fresh child session for TRACE and one for BOUNDARY, each with all three questions visible at once and fresh history; use the same frozen source snapshot. Do not delegate further, run in the background, change global agent configuration, or substitute another role.
- Workers may use only read-only Read/Grep/Glob discovery against the provided task and listed source snapshot, with explicit-path searches. No shell, tests, runtime execution, network, writes, answer-key/grader access, or delegation. The Legolas role's actual tool permissions must be checked before future measurement; these task rules are instructions, not a technical permission boundary or sandbox.
- Preserve Legolas's actual output flow: its concise required `<analysis>` intent summary followed by the native `<results><files>…</files><answer>…</answer><next_steps>…</next_steps></results>` result envelope. Put concise question-ID answers and full absolute citations under the trial root inside `answer`; do not force JSON-only whole-message output or suppress the required intent summary. The coordinator archives only sanitized `<results>` and excludes `<analysis>` and any raw reasoning from public reports. Normalize citations against the explicit trial root during coordinator grading/archiving.
- Record a verifiable source and coverage for the complete child tool-call sequence only if the capture mechanism actually exposes it. If the sequence or coverage is unavailable (including current final-output-only parent tooling), protocol status is `UNKNOWN`, never `PASS`; a perfect semantic result is not full qualification. Before/after hashes and clean-Git checks do not prove absence of a forbidden attempt.
- Operator gates: 180 seconds from submission including delegation; at least 4096 MiB RAM and 512 MiB free VRAM; operator stops on telemetry loss, the resource floor, or cutoff. A helper does not establish that it can cancel an agent. Record telemetry provenance and limitations; do not claim remote teardown without verification.
- The capture-only monitor is not a model runner. A 5–10 second live telemetry smoke test is a separate task requiring separate explicit approval. Do not run it during fixture preparation or measured model trials unless that later approval is recorded.

The full trial manifest is versioned by `grading/discovery-v1/trial-manifest.schema.json`. Unknown values are represented explicitly with null value and `unknown` provenance, not zero. Store relative artifact references only; exclude credentials, endpoints, session IDs, raw transcripts/reasoning, and machine-local absolute paths. Keep semantic fact grades and protocol status separate; citation location is not semantic entailment, and conflicting evidence reviews remain unresolved pending user adjudication. `grading/discovery-v1/submission-format.md`, its schema, and its placeholder example are coordinator-only; normalize by faithful transcription, never repair or infer a worker answer, and pause for user adjudication on ambiguity. `PASS` requires an available complete trace, nonempty coverage references, known trace-source provenance, and instruction status `PASS`; a known violation is `FAIL`, while insufficient evidence is `UNKNOWN`. `validateEvidenceReviewRecord` checks that each manifest review record's reviewer A/B labels, checklist values, derived decisions, and final status agree with the fact-linked combiner. The semantic-grader CLI's protocol-status argument is a coordinator label, not evidence that a trace was observed.

## Discovery v2 worker protocol

This section applies only to future `fixtures/discovery-v2/` measured runs. It is not authorization to run a model and does not change the v1 protocol or its artifacts. The approved v2 implementation adds two coordinator-owned tasks, not a new permission boundary.

- Start from a frozen baseline and use a fresh worktree for each trial. The trial root is the worktree root. The parent must make exactly two fresh foreground Legolas dispatches per profile: one for `fixtures/discovery-v2/tasks/trace.md` and one for `fixtures/discovery-v2/tasks/boundaries.md`. Each session sees all three progressive questions in its selected task and the same eight source files from that task. Do not combine v1 and v2 results, delegate further, run in the background, change global agent/model/permission settings, or substitute another role.
- Before any run, obtain separate explicit run approval. Verify the actual Legolas role instructions and tool permissions, and resolve the exact model catalog ID and explicit override. These worker instructions are not a technical sandbox.
- Workers may use only read-only Read/Grep/Glob discovery against the selected v2 task and its eight explicitly listed source modules. Searches must name those paths. Do not use shell, execute tests or runtime code, access other fixtures, grading files, answer keys, schemas, examples, reports, tools, services, network, or Git mutation; do not write files or delegate. The eight v2 sources are frozen byte-identical copies, not a request to implement or repair the source behavior.
- Preserve Legolas's concise required `<analysis>` intent summary followed by the native `<results><files>…</files><answer>…</answer><next_steps>…</next_steps></results>` flow. Do not replace it with a JSON-only whole message. Inside `answer`, include exactly one fenced JSON block with the exact info label `discovery-facts`, alongside any prose. The labelled block must be inside the intended `results.answer`, not analysis or another envelope; use valid JSON without duplicate keys. Follow the selected task's exact typed field shapes. Put source-relative paths in typed facts and full absolute trial-root paths with inclusive one-based line ranges in citations. Do not include a second labelled block.
- The coordinator retains the public `<results>` envelope faithfully, excludes `<analysis>` and raw reasoning, and only normalizes an explicit trial-root prefix. Do not rewrite prose, drop claims, narrow citations, repair malformed JSON, select a best duplicate block, infer missing facts, or fill fields from the answer key. Missing or ambiguous normalization pauses for user adjudication. Coordinator schemas, examples, rubric, verifier, and answer keys are never worker material.
- Protocol is `FAIL` for an observed instruction or operator-gate violation. Otherwise it is `UNKNOWN` unless instruction and operator-gate status are both `PASS`, the complete child tool-call trace is available, coverage is complete with nonempty references, and trace-source provenance is known. A final response, hashes, or clean Git status do not prove trace completeness, instruction compliance, or absence of forbidden attempts. Do not claim trace authentication or agent cancellation unless independently verified.
- Operator gates are 180 seconds from submission including delegation, at least 4096 MiB preflight RAM, and at least 512 MiB preflight free VRAM. Stop on telemetry loss, a resource floor, or cutoff. Record observed-provenance gate values, status, stop reason, elapsed time, and relative evidence refs. Declared values do not qualify a gate for PASS. A known operator-gate violation is protocol `FAIL`; an unknown gate is `UNKNOWN`, and a compliant early stop can still leave protocol `UNKNOWN` if the complete trace is unavailable. Cloud telemetry may be marked not applicable only with separate explicit approval. The capture-only monitor is not a model runner; do not change it or claim remote teardown guarantees. A live monitor smoke test remains a separately approved task.
- Keep artifact references relative to the trial root. Exclude credentials, endpoint URLs/user-info, session identifiers, raw analysis/reasoning, and machine-local absolute paths. Pattern checks are incomplete; manually inspect every value before publication. Unknown measurements use `null` with provenance `unknown`, never fabricated zeroes, timings, or historical role hashes.
