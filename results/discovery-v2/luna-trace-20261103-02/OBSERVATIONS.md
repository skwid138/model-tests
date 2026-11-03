# Discovery v2 TRACE archival observations

## Trial identity and protocol

- Protocol: `discovery-v2-trace-confirmation-1` (one supplemental TRACE-only attempt). The attempt is consumed; there was no retry or response repair.
- Frozen baseline: `39468eafe69f653ce691776c3d1f55dbe2c5b658`, branch `runs/luna-discovery-v2-trace-20261103-02`.
- The original two screening trials remain separate and immutable; this supplemental result does not replace or pool with them.
- The task, eight listed source modules, and scorer bytes are reported unchanged from snapshot `d8f9a1e8303eb879b7d5f4c4bac7c85316151936`. The authorization text in `AGENTS.md` changed, so the complete handoff is not byte-identical. Do not describe this as an identical-prompt replication or make a reliability claim.
- The parent observed one fresh foreground Legolas dispatch with explicit model override `github-copilot/gpt-6-luna#medium`. The observed SHA-256 of the Legolas role file is `09c026ccd312bb5acafb85c37e24b9b5fb50eedd8f49288148ee3dc9dba406e2`; this identifies that role file only, not the complete effective prompt or provider artifact.
- Explicit run/record approval, renewed cloud-telemetry-not-applicable approval, and operator readiness for the 180-second limit were recorded as declared approvals. Cloud telemetry is therefore `not_applicable_explicitly_approved`; this is not evidence that local hardware floors passed.
- The coordinator observed zero redispatches. Child tool-call trace, count, coverage, and internal retries are unknown. No trace artifact or complete coverage reference is available. Worker before/after Git-clean checks do not prove that no forbidden tool call was attempted.

## Timing and operator gates

- Outer UTC brackets: `2026-11-03T21:03:41.217Z` to `2026-11-03T21:04:47.348Z`.
- Outer monotonic brackets: `540206467147166` to `540272596045208` ns, a difference of `66.128898042` seconds. These are outer brackets only, not exact submission-to-completion elapsed time and not proof of the 180-second gate.
- RAM, free VRAM, exact submission time, exact elapsed time, internal retries, and operator-gate evidence are unknown; they are represented as `null` with `unknown` provenance in `manifest.json`, not as zeroes.
- No stop reason was observed; the formal stop reason remains unknown. No user stop was recorded. No local or cloud telemetry artifact establishes the hardware or elapsed-time gates.
- Operator-gate status: `UNKNOWN`. Instruction status: `UNKNOWN`. Protocol status: `UNKNOWN`; no known violation was identified, but there is no complete child trace, complete coverage, or observed-provenance preflight evidence sufficient for `PASS`.

## Frozen fixture identity

The coordinator hashed the task, all eight listed source files, and the answer-key file; its contents were not manually inspected. The approved frozen verifier consumed the answer key for grading. The hashes recorded in `manifest.json` match the v2 trace fixture identity in the coordinator example. Hashes do not constitute a trace-completeness attestation.

## Faithful normalization

`response.md` contains the complete supplied public `<results>` fragment, excluding any analysis, with only the exact trial-root prefix replaced by `${TRIAL_ROOT}`. The same complete envelope is retained as `resultsText` in `submission.json`. The fixed `normalize.mjs` CLI was run once to create the initial normalized skeleton; the typed JSON was retained as extracted, and prose/citations/claims were then transcribed without answer-key inference. The eight-entry `<files>` list is preserved in full.

### Typed fact mapping

- `T1.entry`: `fixtures/discovery-v2/src/index.mjs`, symbol `inspectRequest`.
- `T1.firstCall`: `fixtures/discovery-v2/src/input/parse-request.mjs`, symbol `parseRequest`.
- `T2.executionPath`, in order: `fixtures/discovery-v2/src/index.mjs`; `fixtures/discovery-v2/src/input/parse-request.mjs`; `fixtures/discovery-v2/src/routing/route-request.mjs`; `fixtures/discovery-v2/src/policy/resolve-policy.mjs`; `fixtures/discovery-v2/src/policy/defaults.mjs`.
- `T2.decision`: route `guarded`, budget `2`.
- `T3.directCallSites`: `routeRequest` in `fixtures/discovery-v2/src/routing/route-request.mjs`; `previewPolicy` in `fixtures/discovery-v2/src/admin/preview-policy.mjs`.
- `T3.lookalike`: symbol `resolvePolicy` in `fixtures/discovery-v2/src/legacy/resolve-policy.mjs`, `onActiveCallPath: false`.
- `T3.override.valid`: integer and safe-integer constraints, inclusive lower bound `0`, replacing `effective_budget`. `T3.override.invalid`: fallback to `mode_default`.

### Citation mapping

- T1 entry: `index.mjs:4-5`; first call: `index.mjs:4-5` and `input/parse-request.mjs:1-15` (the additional index citation is the user-approved coordinator association described below).
- T2 execution path: `index.mjs:4-5`, `input/parse-request.mjs:1-15`, `routing/route-request.mjs:3-11`, `policy/resolve-policy.mjs:3-9`, and `policy/defaults.mjs:1-4`. T2 decision: `routing/route-request.mjs:3-11`, `policy/resolve-policy.mjs:3-9`, and `policy/defaults.mjs:1-4`.
- T3 direct call sites: `routing/route-request.mjs:1-4` and `admin/preview-policy.mjs:1-4`; lookalike: `legacy/resolve-policy.mjs:1-5`; override: `policy/resolve-policy.mjs:3-9`.
- The additional-claim citations are listed with each claim in `submission.json` and retain the worker's stated line ranges.

### Additional claims retained for independent review

- `T1-C01`: “parsing and route selection are in separate modules.”
- `T1-C02`: “parses the request”.
- `T1-C03`: “normalizes strict mode”.
- `T3-C01`: “the legacy resolver is a separate implementation.”
- `T3-C02`: “calls the public entry, not the policy resolver directly.” This retains the additional eighth-file-list statement about `batch/inspect-batch.mjs`.

Additional claim wording remains faithful to the worker output. Independent reviewer A/B records and justifications are archived in `review-A.json` and `review-B.json`; both reviewers reported reviewing the complete eight-file source allowlist without answer keys or other review findings. The checklists are merged without overwriting either reviewer.

## Independent evidence review (pending user adjudication)

- Agreed SUPPORTED facts: 2 (`T1.entry`, `T3.override`).
- Agreed UNSUPPORTED fact: 1 (`T3.lookalike`).
- UNRESOLVED facts due to reviewer checklist disagreement: 4 (`T1.firstCall`, `T2.executionPath`, `T2.decision`, `T3.directCallSites`). These remain pending user adjudication under the rubric; neither checklist was selected, averaged, or overwritten.
- Agreed SUPPORTED additional claims: 5 (`T1-C01`, `T1-C02`, `T1-C03`, `T3-C01`, `T3-C02`).
- The raw individual checklists and exact justifications remain in the two reviewer files. `submission.json` and `manifest.json` contain both reviewer checklists for all 7 facts and 5 claims; they add no aggregate status fields.
- Both reviewers noted literal `${TRIAL_ROOT}` citation prefixes. This token is the coordinator-approved exact-prefix normalization performed by `normalize.mjs`, as required by the coordinator format. The worker's original public output used explicit trial-root paths; the normalized token is not a worker format failure. Reviewer comments are retained unchanged in their files; no prefix was expanded or repaired.
- Protocol, instruction, and operator-gate status remain `UNKNOWN`. The review outcomes do not change the unavailable child trace or unknown operator evidence. The initial frozen verifier capture and typed score are recorded in `grade.json` and summarized in `RESULTS.md`; the four evidence disagreements remain unresolved pending user adjudication.

## User-adjudicated citation association and review provenance

- The user explicitly accepted the existing worker citation `fixtures/discovery-v2/src/index.mjs:4-5` as additional support for `T1.firstCall`, alongside its existing `parse-request.mjs:1-15` association. The entry association remains. No citation range, prose, typed fact, or `resultsText` was changed; no other citation was reassigned or expanded.
- This citation association is a coordinator correction, not a fresh independent review. The A/B checklists predate it and are retained exactly; the four checklist disagreements remain UNRESOLVED pending user adjudication. The A/B records do not represent post-correction reassessments.
- Reviewer file SHA-256 before and after this correction: `review-A.json` `6a66f48d535f696b4872a13aaaddea1e04789c9d5a673784b48f2b50d95513df`; `review-B.json` `5541df42ac86c2be8b4bcfad7c6256a38c50fbfcced8bf726b362ebfaf1feb31`. The files remain byte-for-byte unchanged.

## Verifier capture and grade provenance

- Saruman's parent post-audit result was APPROVE with zero Must/Should findings; no file changes were needed.
- The initial frozen parent verifier invocation used the then-current submission and manifest and exited successfully; its exact stdout remains archived unchanged in `grade.json`.
- After the audit, the parent independently ran the frozen verifier using the final manifest and diffed its stdout against `grade.json`; `diff` exited 0 with no output. There are two verifier invocations total (initial capture plus parent replay), not two model trials.
- The parent's independent `jq` check confirmed format `valid`, protocol `UNKNOWN`, totals `correct: 7`, `denominator: 7`, and zero missing, invalid, incorrect, abstentions, unsupported claims, or unresolved claims.
- The initial capture preceded adding `grade.json` and `RESULTS.md` to the manifest artifact references. The parent replay used the final manifest. The byte-for-byte match confirms the recorded grade; no additional invocation was made for this documentation-only closeout.
- Grade result: format `valid`; typed facts 7/7 correct; 2 evidence reviews SUPPORTED, 1 UNSUPPORTED, 4 UNRESOLVED; all five additional claims SUPPORTED; protocol `UNKNOWN`. Full outcomes and review limits are summarized in `RESULTS.md` and the unmodified CLI output in `grade.json`.

## Archive verification

- Expected artifacts: `response.md`, `submission.json`, `manifest.json`, `review-A.json`, `review-B.json`, `grade.json`, `RESULTS.md`, and this file.
- The normalized submission preserves all three question entries and the valid extracted typed fragment. Citation paths are trial-root-relative in the coordinator document; no machine-local paths or raw analysis are published.
- The frozen verifier used the answer key internally; no answer-key contents were manually inspected or copied into artifacts. No model, tests, SSH, network, or source edits were used. No Git mutation was performed.
