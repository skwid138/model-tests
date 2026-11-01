# Worker benchmark archive

This index covers six executed worker attempts (five local attempts and one cloud control) plus one skipped-case record, documented in seven branch reports. These archival findings are not a model qualification or reliability estimate. One control passed the API fixture’s grader; several local attempts failed protocol or task requirements. Read each branch report for evidence and limitations.

| Case/record | Selected model | Branch report | Outcome |
|---|---|---|---|
| Coder-001 | `qwen3-coder-4090` | [Coder-001 results](https://github.com/skwid138/model-tests/blob/runs/coder-001/RESULTS.md) | Rejected for setup, handoff, stop-rule, and test-budget violations; no clean independent model result. |
| Devstral label | `mistralai/devstral-small-2-2512` | [Devstral label results](https://github.com/skwid138/model-tests/blob/runs/devstral-20261031-01/RESULTS.md) | Visible suite green, but ASCII ordering contract failed and required reporting was omitted. |
| Devstral API-01 | `mistralai/devstral-small-2-2512` | [Devstral API-01 results](https://github.com/skwid138/model-tests/blob/runs/devstral-api-20261031-01/RESULTS.md) | Three final tests passed; independent grader scored 1/4 groups and found contract gaps. |
| Luna API-01 | `gpt-6-luna` (`high`) | [Luna API-01 results](https://github.com/skwid138/model-tests/blob/runs/luna-api-20261031-01/RESULTS.md) | Three final tests passed; source review approved and grader scored 4/4 groups. One control is not a reliability estimate. |
| Devstral API-02 | `mistralai/devstral-small-2-2512` | [Devstral API-02 results](https://github.com/skwid138/model-tests/blob/runs/devstral-api-20261031-02/RESULTS.md) | Rejected after stop-rule violations, extra tests/edits, incorrect regression expectations, and contract gaps; no grader run. |
| Devstral API-03 | `mistralai/devstral-small-2-2512` | [Devstral API-03 results](https://github.com/skwid138/model-tests/blob/runs/devstral-api-20261031-03/RESULTS.md) | Skipped; no worker or tests ran. |
| GPT-OSS API-01 | `gpt-oss-20b` | [GPT-OSS API-01 results](https://github.com/skwid138/model-tests/blob/runs/gptoss20b-api-20261031-01/RESULTS.md) | Rejected after source edits preceded all tests and stop-triggering errors were not honored; no tests or grader ran. |

## Reading the results

- A command’s expected or prescribed result is distinct from what actually ran. Missing tests or counts are recorded as unavailable, not zero.
- Grader scores are groups with multiple assertions, not a count of exhaustive semantic cases.
- The Devstral API-01, API-02, and GPT-OSS API-01 findings remain separate attempts. API-03 was not run. Do not pool these as equivalent repeats.
- The GPT-6 Luna result is one successful control on this fixture, not evidence of a reliability rate or a pure model-architecture comparison.
- Local hardware samples are discrete system/device observations. They are not continuous safety guarantees or memory attribution to a model. Cloud resources marked N/A are unavailable, not zero.
- All source changes remain as trial artifacts. Nothing here claims a production-ready implementation or an accepted local-model qualification.

The reports use relative paths and source hashes for provenance. They omit raw prompts/transcripts, reasoning, credentials, private endpoints, session identifiers, and machine-local paths.
