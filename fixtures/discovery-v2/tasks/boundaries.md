# Task: reason about request boundaries (v2)

- **Case ID:** `boundary`
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

Answer all three questions in the single block. Use the complete returned object for each runtime prediction, including every field. Cite with full absolute paths under the trial worktree root and inclusive, one-based line ranges. The coordinator records citations separately without changing line ranges. If a required fact is omitted, its typed field is treated as missing; do not substitute prose for omitted typed data.

## Typed answer shape

The JSON root is an object with keys `B1`, `B2`, and `B3`. A result object has exactly these fields and types: `mode` (string), `route` (string), `tokens` (array of strings), `budget` (integer), and `accepted` (boolean).

- `B1.result`: one result object
- `B2.missingInput`: one result object for the first input
- `B2.blankStrict`: one result object for the second input
- `B2.invalidFields`: one result object for the third input
- `B3.zeroOverrideResult`: one result object
- `B3.deploymentLimit`: `{ "status": "known" | "unknown", "value": number | null, "snapshotLimitation": boolean }`

For a deployment value that cannot be established from the supplied static snapshot, represent that conclusion with `status: "unknown"`, `value: null`, and `snapshotLimitation: true`. This typed limitation flag records why a deployment claim is not answerable; explanatory prose may add context but cannot replace the flag. Do not infer a live setting from a source-level default.

## Questions (all visible in this one session)

### B1 — Easy: ordinary input

Predict the complete returned value of `inspectRequest({ query: "Amber Finch" })` with no override. Include every returned field and its value.

### B2 — Medium: absent and invalid values

Predict the complete returned value for each input below, with no override:

1. `{}`
2. `{ query: "   \n ", mode: "strict" }`
3. `{ query: 42, mode: "mystery" }`

Keep the three cases distinct and include every returned field for each.

### B3 — Hard: cross-module edge and deployment limit

Predict the complete returned value of `inspectRequest({ query: " \t ", mode: "strict" }, { limitOverride: 0 })`. Separately state the current live deployment's `limitOverride`. If the provided static snapshot does not determine it, use the typed unknown representation and explicitly record the snapshot limitation.
