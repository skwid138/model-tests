# Task: trace the discovery snapshot (v2)

- **Case ID:** `trace`
- **Task version:** 2
- **Source snapshot version:** 2

## Snapshot and worker boundary

This is a finite static source snapshot. It contains no deployment files, runtime configuration, service state, or live environment facts. The complete source allowlist for this case is:

- `fixtures/discovery-v2/src/index.mjs`
- `fixtures/discovery-v2/src/input/parse-request.mjs`
- `fixtures/discovery-v2/src/routing/route-request.mjs`
- `fixtures/discovery-v2/src/policy/resolve-policy.mjs`
- `fixtures/discovery-v2/src/policy/defaults.mjs`
- `fixtures/discovery-v2/src/batch/inspect-batch.mjs`
- `fixtures/discovery-v2/src/admin/preview-policy.mjs`
- `fixtures/discovery-v2/src/legacy/resolve-policy.mjs`

Use only read-only Read/Grep/Glob discovery against this task and the eight listed source files. Search only explicit paths. Do not use shell, execute tests or runtime code, access the network, write files, inspect answer keys/graders, or delegate. The worktree is not a security sandbox; these are worker instructions, not a claim of technical permission enforcement.

Follow the actual Legolas output flow: include its concise required `<analysis>` intent summary first, then its native `<results><files>…</files><answer>…</answer><next_steps>…</next_steps></results>` envelope. Do not suppress or replace this flow with a JSON-only whole message. Inside `<answer>`, include explanatory prose as useful and exactly one fenced JSON block whose opening line is exactly ```` ```discovery-facts ```` and whose closing line is exactly ```` ``` ````. The block must be inside this envelope's `<answer>` element, not in `<analysis>`, `<files>`, or `<next_steps>`. Do not put it inside another code fence. An attempted labelled opener with whitespace between the backticks and label, extra info text, or a different case is malformed, not a missing block. Its body must be one JSON object. Use JSON strings, booleans, finite numbers, arrays, and objects only; do not use comments, trailing commas, or duplicate property names. No other `discovery-facts` block is permitted anywhere in the response. A missing block, malformed/unclosed block, duplicate block, or duplicate JSON key is a format error; the coordinator will not repair or choose among blocks. The coordinator retains the public `<results>` output, excluding `<analysis>` and normalizing only citations rooted at the trial directory.

Answer all three questions in the single block. Paths in facts are repository-relative paths from the list above. Put citations in your prose using full absolute paths under the trial worktree root and inclusive, one-based line ranges. The coordinator records citations separately without changing line ranges. If a required fact is omitted, its typed field is treated as missing; do not substitute prose for omitted typed data.

## Typed answer shape

The JSON root is an object with keys `T1`, `T2`, and `T3`. Each value is an object. Use exactly these fields and nested shapes; the names define slots, not expected values:

- `T1.entry`: `{ "file": string, "symbol": string }`
- `T1.firstCall`: `{ "file": string, "symbol": string }`
- `T2.executionPath`: an ordered array of repository-relative source-path strings, in invocation order
- `T2.decision`: `{ "route": string, "budget": integer }`
- `T3.directCallSites`: an array of `{ "file": string, "containingFunction": string }` objects; include each direct call site once
- `T3.lookalike`: `{ "file": string, "symbol": string, "onActiveCallPath": boolean }`
- `T3.override.valid.constraint`: `{ "isInteger": boolean, "isSafeInteger": boolean, "lowerBound": number, "lowerBoundInclusive": boolean }`
- `T3.override.valid.effect`: `{ "action": enum, "target": enum }`
- `T3.override.invalid.effect`: `{ "action": enum, "target": enum }`

For both effect slots, use these shared canonical vocabularies: `action` is one of `replace`, `fallback`, `clamp`, `add`, `multiply`, or `preserve`; `target` is one of `effective_budget`, `mode_default`, `configured_limit`, `request_limit`, `fixed_limit`, or `existing_value`. The constraint/effect slots describe the override rule structurally; do not replace them with English paragraphs. The same vocabularies apply to valid and invalid overrides. Do not add a second answer block.

## Questions (all visible in this one session)

### T1 — Easy: public entry

Identify the exported public entry symbol and its source file. Name the first function invoked while evaluating that entry for an input request, before route selection.

### T2 — Medium: conditional path

For `inspectRequest({ query: "Amber Finch", mode: "strict" })` with no override, give the ordered source-module path from the public entry through the strict-mode policy default, the selected route, and the default term budget. Distinguish the execution path from merely related modules.

### T3 — Hard: callers and override

Within the complete source allowlist above, list every direct call site of the active `resolvePolicy` export, naming each file and containing function. Identify the same-named implementation that is not on that active static call path. Describe the valid override constraint and its effect on the effective term budget, and the effect of an invalid override, using the typed constraint/action slots.
