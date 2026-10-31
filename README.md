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
