# Discovery v2 independent evidence-review rubric

Reviewers A and B work independently from the worker's public `<results>` answer and the cited frozen v2 source/task files. Do not view the answer key while judging evidence. Preserve both checklists. Typed semantic correctness, citation location, canonical-span coverage, entailment, and branch coverage are separate measurements; none substitutes for another.

## Fact-linked reviews

Create one record per `(questionId, factId)`. Each reviewer records:

- `citationsEntailClaim`: do the cited source/task lines directly support the submitted fact, rather than merely mention related code?
- `branchCoverageComplete`: do the citations cover all relevant branches needed for this fact, rather than only one possible path?

The coordinator validates labels, checklist types, and the derived result with `validateEvidenceReviewRecord`. Two exact matching checklists produce `SUPPORTED` when both fields are true and `UNSUPPORTED` when the reviewers agree that either entailment or relevant branch coverage is false. Missing, invalid, or disagreeing checklists produce `UNRESOLVED`. A typed fact can be correct while its evidence review is unresolved, and a valid citation location does not establish entailment.

## Additional claims

Retain every additional claim as a separate atomic statement with its stable claim ID, exact text, and original cited path/line ranges. Do not merge claims, paraphrase them, discard them, or treat an unreviewed claim as supported or unsupported.

Each reviewer records a four-field checklist:

- `claimAtomic`: the statement expresses one assessable claim.
- `sourceScopeComplete`: the reviewer checked the complete finite source allowlist relevant to deciding whether the claim is supported in this snapshot. This does not establish truth outside the supplied snapshot.
- `reviewCompleted`: the evidence review is complete and unambiguous.
- `evidenceDisposition`: exactly one of `supported`, `unsupported_established`, `contradicted`, or `not_reviewed`.

Derive each reviewer's decision deterministically:

- `SUPPORTED` only when the claim is atomic, the source scope is complete, the review is complete, and disposition is `supported`.
- `UNSUPPORTED` when the claim is atomic, source scope and review are complete, and disposition is either `unsupported_established` (the finite provided sources do not support the claim) or `contradicted` (the cited evidence directly contradicts it). Preserve which of those two outcomes each reviewer selected.
- `UNRESOLVED` when the claim is non-atomic, source scope or review is incomplete/ambiguous, disposition is `not_reviewed`, or the review input is invalid.

Combine A and B only when both independently reach `SUPPORTED`, or both independently select the same completed unsupported disposition. If one selects `unsupported_established` and the other `contradicted`, preserve both and leave the claim `UNRESOLVED` because their evidence conclusions differ. A supported/unsupported disagreement, missing review, incomplete scope, or either unresolved reviewer result also leaves the claim `UNRESOLVED`. The grade counts only review-established `UNSUPPORTED` claims and reports unresolved claims separately. It never treats a claim as unsupported merely because it lacks support when the reviewer has not established that the finite source scope is complete.

## Adjudication

Keep both original reviews and their checklist values unchanged. Any missing, contradictory, or disagreeing review that affects a final decision pauses for explicit user adjudication under this rubric. Do not fabricate a third review, average decisions, overwrite one reviewer, or silently change the criteria after seeing the answer.
