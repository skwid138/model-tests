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
