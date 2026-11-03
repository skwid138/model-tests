# Discovery v2 TRACE results

## Snapshot and protocol

This is the supplemental `discovery-v2-trace-confirmation-1` TRACE attempt at baseline `39468eafe69f653ce691776c3d1f55dbe2c5b658`. The original two screening trials remain unchanged and separate. The task, source, and scorer bytes are reported unchanged from `d8f9a1e8303eb879b7d5f4c4bac7c85316151936`, but the authorization text in `AGENTS.md` changed; the full handoff is not byte-identical. This result is not an identical-prompt replication, a reliability claim, or a full protocol qualification.

## Initial verifier capture

The initial frozen coordinator verifier capture was invoked from the parent checkout and exited successfully; its exact stdout is preserved in `grade.json`. After Saruman's post-audit APPROVE (zero Must/Should findings; no file changes needed), the parent independently ran the frozen verifier against the final manifest and diffed its exact stdout against `grade.json`. The diff exited 0 with no output. There have been two verifier invocations total: the initial capture and the independent parent replay. The replay is not a new model trial, and the original `grade.json` capture remains unchanged.

The parent independently checked the captured JSON: format `valid`, protocol `UNKNOWN`, 7/7 correct, and zero missing, invalid, incorrect, abstentions, unsupported claims, or unresolved claims.

- Format: `valid`; typed-shape issues: none.
- Typed facts: **7/7 correct**, with 0 missing, invalid, incorrect, or abstained facts. The CLI marked the citations valid.
- Evidence reviews: **2 SUPPORTED** (`T1.entry`, `T3.override`), **1 UNSUPPORTED** (`T3.lookalike`), and **4 UNRESOLVED** (`T1.firstCall`, `T2.executionPath`, `T2.decision`, `T3.directCallSites`). The four disagreements remain unresolved as directed by user adjudication; no reviewer was overwritten, averaged, or replaced.
- Additional claims: **5 SUPPORTED**; 0 unsupported and 0 unresolved claims.
- Protocol: **UNKNOWN**. Child tool trace/coverage, instruction evidence, and measured operator gates remain insufficient; the typed score does not imply protocol qualification.

## Citation correction and review limits

The user accepted the worker's existing `index.mjs:4-5` citation as an additional `T1.firstCall` citation, while retaining its `entry` association and `parse-request.mjs:1-15` citation. No worker response, `resultsText`, typed fact, prose, or cited line range was changed. The A/B files and their checklists predate this mechanical association; their byte-identical hashes are recorded in `OBSERVATIONS.md`. They are not post-correction reviews. User adjudication explicitly retains all four evidence disagreements as UNRESOLVED pending further decision; the grader's checklist-derived outcomes are reported without claiming fresh independent consensus.

Both reviewers' literal `${TRIAL_ROOT}` comments are preserved verbatim in their review files. The prefix is coordinator-approved normalization, not a worker format failure. The original reviewer comments do not alter the valid format result.
