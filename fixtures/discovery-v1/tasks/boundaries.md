# Task: reason about request boundaries

- **Case ID:** `boundary`
- **Task version:** 1

## Snapshot and worker boundary

This is a finite static source snapshot. It contains no deployment files, runtime configuration, service state, or live environment facts. The complete source allowlist for this case is:

- `fixtures/discovery-v1/src/index.mjs`
- `fixtures/discovery-v1/src/input/parse-request.mjs`
- `fixtures/discovery-v1/src/routing/route-request.mjs`
- `fixtures/discovery-v1/src/policy/resolve-policy.mjs`
- `fixtures/discovery-v1/src/policy/defaults.mjs`
- `fixtures/discovery-v1/src/batch/inspect-batch.mjs`
- `fixtures/discovery-v1/src/admin/preview-policy.mjs`
- `fixtures/discovery-v1/src/legacy/resolve-policy.mjs`

Use only read-only Read/Grep/Glob discovery against this task and the listed source files. Search only explicit paths. Do not use shell, execute tests or runtime code, access the network, write files, inspect answer keys/graders, or delegate. The worktree is not a security sandbox; these are worker instructions, not a claim of technical permission enforcement.

Follow the actual Legolas output flow: include its concise required `<analysis>` intent summary first, then its native `<results><files>…</files><answer>…</answer><next_steps>…</next_steps></results>` envelope. Do not suppress or replace this flow with a JSON-only whole message. Put practical answers to all three question IDs inside `answer`, with citations using full absolute file paths under the trial worktree root and line ranges. The coordinator—not the worker response contract—archives only the sanitized `<results>` portion and excludes `<analysis>` and any raw reasoning from public reports.

## Questions

### B1 — Easy: ordinary input

Predict the complete returned value of `inspectRequest({ query: "Amber Finch" })` with no override. Include every returned field and its value.

### B2 — Medium: absent and invalid values

Predict the complete returned value for each input below, with no override:

1. `{}`
2. `{ query: "   \n ", mode: "strict" }`
3. `{ query: 42, mode: "mystery" }`

Keep the three cases distinct and include every returned field for each.

### B3 — Hard: cross-module edge and deployment limit

Predict the complete returned value of `inspectRequest({ query: " \t ", mode: "strict" }, { limitOverride: 0 })`. Separately state the current live deployment's `limitOverride`. If the provided static snapshot does not determine it, explicitly answer `UNKNOWN` and explain the limitation; do not substitute the source-level default for a deployment fact.
