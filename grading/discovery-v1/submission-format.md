# Coordinator submission normalization (v1)

This contract is coordinator-only. Do not provide `submission.schema.json`, `submission.example.json`, this guide, answer keys, or the verifier to the measured worker. The worker receives only its selected task prompt and listed source files.

## Mapping Legolas output

Keep the worker's native intent-summary-plus-results output intact for the coordinator's temporary processing. The normalized submission stores only answer facts, cited locations, additional answer claims, and separately collected evidence-review decisions; it is not a raw transcript store. Do not use the `<analysis>` section as answer evidence. Do not expose it in public reports.

Create one entry under `answers` for each question actually answered. Use the fixed fact-slot IDs below in `facts`:

| Case / question | Required fact slots |
|---|---|
| TRACE / T1 | `public_entry`, `immediate_delegate` |
| TRACE / T2 | `strict_execution_path`, `strict_route_and_budget` |
| TRACE / T3 | `direct_active_callers`, `unused_lookalike`, `override_effect` |
| BOUNDARY / B1 | `ordinary_result` |
| BOUNDARY / B2 | `missing_input_result`, `blank_strict_result`, `invalid_fields_result` |
| BOUNDARY / B3 | `zero_budget_edge_result`, `deployment_override` |

Transcribe the answer's stated values into the corresponding fact slot without correcting, completing, interpreting, or making them match the gold. Keep list order when the question asks for an ordered path. Preserve explicit `UNKNOWN` as an unknown value and its actual stated limitation; do not infer an abstention from silence. For B3, use `reasonCode: "deployment_not_in_static_source_snapshot"` only when the answer explicitly says the live deployment value cannot be determined because the provided finite source snapshot has no deployment/runtime configuration. If it does not, or wording is ambiguous between slots or cannot be represented faithfully, stop grading that item and request user adjudication; do not turn it into a missing answer or invent a normalization. An omitted or unreported slot in an otherwise unambiguous answer stays absent and grades as `missing`.

For `citations`, associate a cited path/line range with a fact only when the worker clearly associates it with that fact. Preserve the citation as given; do not attach a convenient citation after the fact. Paths may be absolute trial-root paths or source-relative paths. `verify.mjs` normalizes them against the explicitly supplied trial root, rejects traversal/outside-root paths, verifies line bounds, and the grader compares location to frozen evidence spans. A location match is not an entailment decision. Missing, invalid, or ambiguous citations stay missing/invalid/unresolved rather than being repaired.

Split any extra answer assertions outside required fact slots into `additionalClaims`, one independently stated claim per entry, with its exact text and cited locations. Do not discard extra claims or convert them into a required fact. Do not duplicate the same claim in both `facts` and `additionalClaims`.

Reviewers do not edit the worker submission. Add two independent `evidenceReviews` records for each reviewed fact, each linked by both `questionId` and `factId`. Reviewer A and B make the frozen checklist decisions: (1) cited spans entail the claim, and (2) all relevant branches are covered. The verifier derives individual `SUPPORTED`/`UNSUPPORTED` decisions from those booleans. Disagreement or missing/invalid review input yields `UNRESOLVED`; preserve both reviewer checklists in the grading output and manifest. Use `validateEvidenceReviewRecord` on each per-fact record before manifest archiving. User adjudication is required for unresolved items, using the frozen rubric, with no post-hoc criteria.

The protocol-status argument to `verify.mjs` is a coordinator-recorded label, not evidence that a tool trace was observed. Default it to `UNKNOWN` unless the independent trace and coverage gate has been evaluated. Validate trial manifests with the protocol-integrity helpers before archiving; semantic correctness does not promote protocol status.

## Example

`submission.example.json` contains placeholders only, not a correct answer or gold value. For a real normalized submission, include `schemaVersion: 1`, the case ID, only faithful transcriptions, citations, and review records. Include `additionalClaims: []` for a question with no extra claims and `evidenceReviews: []` until reviews have actually been recorded.

`submission.schema.json` is the format contract. `verify.mjs` checks critical boundary fields and frozen source/task hashes; it is not a complete JSON Schema engine. The coordinator remains responsible for ensuring the normalized document conforms to the schema before grading.
