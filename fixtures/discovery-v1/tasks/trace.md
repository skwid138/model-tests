# Task: trace the discovery snapshot

- **Case ID:** `trace`
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

### T1 — Easy: public entry

Identify the exported public entry symbol and its source file. Name the first function invoked while evaluating that entry for an input request, before route selection.

### T2 — Medium: conditional path

For `inspectRequest({ query: "Amber Finch", mode: "strict" })` with no override, give the ordered source-module path from the public entry through the strict-mode policy default, the selected route, and the default term budget. Distinguish the execution path from merely related modules.

### T3 — Hard: callers and override

Within the complete static source allowlist above, list every direct call site of the active `resolvePolicy` export, naming each file and containing function. Identify the same-named implementation that is not on that active static call path. Explain exactly how a valid explicit `limitOverride` affects the effective term budget, and what happens for an invalid override. Do not count wrappers that call another public function rather than `resolvePolicy` directly.
