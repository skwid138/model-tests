# Discovery v2 submission normalization

This document, its schemas, examples, answer keys, review rubric, and grader are coordinator-only. Give the worker only its selected `fixtures/discovery-v2/tasks/*.md` file and that task's eight source files. This is a new v2 contract; never reinterpret or rescore v1 records with it.

## Worker output contract

Keep Legolas's concise `<analysis>` intent summary followed by the native `<results><files>…</files><answer>…</answer><next_steps>…</next_steps></results>` flow. The analysis section is not public answer material and is never copied into the normalized submission. The answer may contain prose, but must contain exactly one JSON fenced block inside the intended `results.answer`:

````text
```discovery-facts
{ ... one JSON object ... }
```
````

The opening fence must be a whole line exactly equal to ```` ```discovery-facts ```` and its closing fence a whole line exactly equal to ```` ``` ````. Whitespace between the opening backticks and label, extra info text, or a label with different case is malformed, not missing. The parser tracks standard backtick and tilde fences using their matching fence character and a closing run at least as long as the opening run; the labelled facts block is still exactly three backticks and cannot be nested inside either kind of fence. The response may start with one `<analysis>` section; the exact top-level `<results><files>…</files><answer>…</answer><next_steps>…</next_steps></results>` envelope must follow it, with no wrapper around the results envelope or extra non-whitespace outside this flow. The parser rejects results nested inside analysis or another wrapper. It does not harvest a labelled block from `<analysis>`, `<files>`, `<next_steps>`, or another envelope. Other unlabeled fences are not answer sources. A marker embedded on a prose line, a malformed labelled opener, an unclosed block, multiple labelled blocks, invalid JSON, or any duplicate JSON object key (including nested and escaped-equivalent names) is `invalid`. No labelled block in a valid results envelope is `missing`. The coordinator does not repair JSON, apply last-key-wins, pick a preferred block, infer values from prose, or fall back to the answer key.

The selected task defines the complete typed shape. Fact IDs and expected values stay in the coordinator key. Missing fact paths remain missing. Present values with invalid types or object shapes are invalid; well-typed unequal values are incorrect. TRACE/BOUNDARY required facts are structurally scored, including integer zero. The B3 deployment fact is an explicit typed abstention only when it states unknown, null value, and the snapshot-limitation flag; free prose cannot substitute for those fields.

Use these stable coordinator fact IDs when linking citations and reviews:

| Case / question | Fact IDs |
|---|---|
| TRACE / T1 | `entry`, `firstCall` |
| TRACE / T2 | `executionPath`, `decision` |
| TRACE / T3 | `directCallSites`, `lookalike`, `override` |
| BOUNDARY / B1 | `ordinaryResult` |
| BOUNDARY / B2 | `missingInput`, `blankStrict`, `invalidFields` |
| BOUNDARY / B3 | `zeroOverrideResult`, `deploymentLimit` |

## Normalize a response

From the repository root, run:

```sh
node grading/discovery-v2/normalize.mjs <trial-root> <trace|boundary> <worker-response-file>
```

The command prints a JSON skeleton to stdout and does not write or archive files. It retains the full public `<results>` envelope in `resultsText`, excludes `<analysis>`, and replaces only the exact explicit trial-root prefix with the literal `${TRIAL_ROOT}`. The typed fragment is recorded as `valid`, `missing`, or `invalid`; no typed answer fields are synthesized. The skeleton includes an entry for every case question with empty prose/citation/claim slots for coordinator completion. Keep all entries, even when a typed fact was absent; deleting an entire question entry makes normalization incomplete and stops grading.

Complete the normalized document without changing the worker's meaning:

1. Keep `resultsText` as emitted except for the exact root substitution above. Do not copy analysis or raw reasoning.
2. For each question, faithfully transcribe all explanatory prose into `answers.<questionId>.prose`. Do not rewrite or omit extra assertions to improve a score.
3. Transcribe the typed JSON object exactly into `typedFragment`. If extraction returned `missing` or `invalid`, retain that status and reason. Never repair, complete, or infer it.
4. Associate each citation only with the fact or additional claim it clearly supports. Keep the cited start and end lines exactly as given. Normalize a citation rooted at the trial directory to a path relative to that root; absolute paths under the explicit root may also be supplied to the verifier, but must not be published in artifacts. A path or citation that is ambiguous stays unresolved and pauses normalization for user adjudication.
5. Split extra assertions into atomic `additionalClaims` entries. Assign stable IDs such as `T1-C01`, retain exact claim text and every stated citation, and do not duplicate required typed facts as extra claims. Do not silently drop unsupported-looking or unreviewed content.
6. Add independent reviewer records only after each review is completed. Missing reviews remain missing and grade `UNRESOLVED`; do not manufacture a reviewer decision.

The schema and placeholder example are `submission.schema.json` and `submission.example.json`. They describe the coordinator document, not the worker's task answer. The CLI's `validateNormalizedSubmission` performs focused boundary checks. It is not a general JSON Schema engine; the coordinator must also check the document against the schema and pause on ambiguity.

## Verify and grade

The coordinator CLI takes an explicit trial root, case, normalized submission, and trial manifest:

```sh
node grading/discovery-v2/verify.mjs <trial-root> <trace|boundary> <submission.json> <manifest.json>
```

It loads the v2 key for the case, verifies task/source/answer-key bytes and the task's listed source allowlist against the frozen v2 set, checks evidence spans against file bounds, validates the normalized submission and manifest, requires manifest A/B review records to match submission review records exactly, applies privacy pattern checks, derives protocol status from the manifest, and prints a JSON grade. It does not accept a free-standing protocol-status label. The `verifyFrozenSnapshot`, `validateNormalizedSubmission`, `validateTrialManifest`, `validateManifestProtocol`, and `validateEvidenceReviewRecord` functions are focused validators, not complete schema or trace-authentication systems. Unknown role-baseline/provider artifact hashes remain null with unknown provenance; they do not prove role or provider identity.

The grade reports typed outcomes, citation location, descriptive canonical-span overlap, and evidence-review outcomes separately. A valid in-bounds citation can be broader than a canonical evidence span; its original line range is retained. Canonical overlap gives no semantic credit and a broad range is not automatically misleading. The independent fact review decides entailment and branch coverage. Additional claims remain verbatim with cited locations and A/B decisions. Two independent reviewers must agree on the same completed disposition, either lack of support within the complete finite source scope or direct contradiction, for `UNSUPPORTED`; incomplete scope/review or different dispositions remain `UNRESOLVED` and are counted separately.

## Protocol and privacy

Use the v2 trial manifest schema/example. Unknown measurements are `null` with provenance `unknown`, never fabricated zeroes. A known instruction or operator-gate violation is `FAIL`. Otherwise protocol is `UNKNOWN` unless instruction status is `PASS`, operator-gate status is `PASS` with observed-provenance preflight RAM/free VRAM above their floors and observed elapsed time within 180 seconds, a complete trace is available, coverage is complete with nonempty relative references, and trace-source provenance is known. A compliant stop on telemetry loss, a resource floor, or cutoff may still leave the trace incomplete and protocol `UNKNOWN`. The validator checks recorded consistency and reference safety; it does not authenticate gate evidence or trace contents, prove absence of forbidden tool calls, or validate the complete schema.

Artifact references must be relative to the trial root and must not contain traversal, URI/endpoint, or absolute paths. Before publication, manually check every value and every field name for credential assignments (`api_key`, `access_token`, `password`, `secret`), bearer credentials, private-key headers, URI user-info, endpoint URLs, session identifiers, and machine-local paths such as `/Users/...`, `/home/...`, or `C:\Users\...`. These patterns are incomplete. Automated checks report only field paths and generic pattern categories, never matched values, and never redact or rewrite. If a sensitive value is present, pause publication and get human direction; do not silently alter the worker's public result. Do not store raw analysis/reasoning, credentials, endpoints, session IDs, or machine-local paths in public artifacts.

Future-run gates are separate from implementation: obtain explicit run approval; use the verified Legolas role and exact model override; enforce 180 seconds from submission including delegation, at least 4096 MiB preflight RAM, and at least 512 MiB preflight free VRAM; stop on telemetry loss, floor, or cutoff. Record observed-provenance gate values, status, stop reason, elapsed time, and relative evidence references. Declared values do not qualify a gate for `PASS`; unknown gate measurements remain `UNKNOWN`. Cloud telemetry is not applicable only with separate explicit approval. Do not change the capture-only monitor or claim remote cancellation/teardown guarantees.
