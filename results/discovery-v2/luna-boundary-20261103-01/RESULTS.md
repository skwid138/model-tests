# Results — Luna Discovery v2 boundary

## Frozen verifier result

- `formatStatus`: `valid`; `protocolStatus`: `UNKNOWN`.
- Typed facts: 5 correct, 1 abstention, 0 incorrect (`5/6` correct; denominator 6). No typed facts were missing or invalid. The sole abstention is the explicit unknown deployment-limit response requested by the task; it is not an incorrect prediction. All five answerable predictions are correct, with zero incorrect.
- Evidence reviews: `ordinaryResult`, `missingInput`, `blankStrict`, `invalidFields`, and `zeroOverrideResult` are `SUPPORTED` by both reviewers. `deploymentLimit` is `UNSUPPORTED` by both: the submitted `boundaries.md:7-8` citation is valid in location but covers only a heading and blank line, not the snapshot limitation. This evidence outcome is separate from the typed abstention and does not change it.
- Additional claim `B1-C01` is `SUPPORTED` by both reviewers. The verifier reports 0 unsupported and 0 unresolved additional claims.
- Protocol remains `UNKNOWN` because the complete child tool-call trace and required timing/hardware gate measurements are unavailable. Cloud telemetry non-applicability was explicitly approved. This does not imply worker misuse or change the citation-evidence outcome.

`grade.json` preserves the exact stdout of the initial frozen verifier invocation. A subsequent independent parent verification also exited 0 and reported the same results. `grade.json` remains unchanged. The independent reviews are in `review-A.json` and `review-B.json`.
