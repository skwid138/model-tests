# Model Tests

This repository is a small, reproducible benchmark room for future coding-model tests. It is not a single-purpose tool, and the starter fixture is intentionally incomplete. Passing its tests is the future model task, not a claim that the fixture is already implemented.

## Runtime

- Node.js 24 or newer
- Native ECMAScript modules (`.mjs`)
- `node:test` and `node:assert/strict`
- No dependencies

Run the label-summary fixture from the repository root with:

```sh
node --test fixtures/label-summary/test/group-labels.test.mjs
```

The starter returns an empty result. The test command is expected to report assertion failures until a benchmark run implements the task. Loader or syntax errors are not an expected RED result.

## Benchmark runs

Freeze a baseline commit before each run. Give every run a fresh Git worktree and branch at that baseline, for example:

```sh
git worktree add -b runs/<run-id> <session-temp>/model-tests-<run-id> <baseline-commit>
```

Use the worktree root as the model's working directory. Do not pull, fetch, reset, or otherwise require network access. A worktree isolates tracked-file changes from the preparation checkout; it is **not a security sandbox**, and it does not verify or restrict global permissions.

The parent must delegate exactly one foreground child with an explicit override to the selected model and forward the complete `TASK.md` and all safeguards in `AGENTS.md` verbatim. The model may change only the two source files named by the task. Keep the tests, task, documentation, instructions, and Git metadata unchanged. Do not commit benchmark results or changes as part of a run.

Record each trial separately: model and version, hardware, provider and relevant settings, context information and its source, role and prompt version, timing, retries, tool-call status, instruction compliance, and semantic correctness. Keep operational compliance and answer quality as separate measures. Sanitize results and failures; do not include credentials, private endpoints, unrelated local paths, raw transcripts, or source-code/framework dumps. Do not combine tool-call counts from separate trials into a single trial measurement.

There is no root CI configuration or CI status implied by this repository.
