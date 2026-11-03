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

## Additional initial screens (separate from the original archive)

The seven entries above remain the original archive and retain their original counts and descriptions. The Gemma, Laguna, and GLM API screens remain separate from that archive. The Gemma report is preserved at commit `6c880fb14c3ddf742cc700772f99ee677052d2eb` on branch `runs/gemma-api-20261102-01`; retrieve it with `git show runs/gemma-api-20261102-01:RESULTS.md`. The Laguna report is preserved at commit `0933459acd174713a418c74ddbc8dc7a8783b1e9` on branch `runs/laguna-api-20261102-01`; retrieve it with `git show runs/laguna-api-20261102-01:RESULTS.md`. The GLM report is preserved at commit `94546826c8244e38ddb0635441705c70284a4f33` on branch `runs/glm-api-20261102-01`; retrieve it with `git show runs/glm-api-20261102-01:RESULTS.md`.

| Case | Selected model | Trial report | Outcome |
|---|---|---|---|
| Gemma API screen | `peesea/google/gemma-4-26b-a4b-qat` | Local commit `6c880fb14c3ddf742cc700772f99ee677052d2eb` on `runs/gemma-api-20261102-01`; use `git show runs/gemma-api-20261102-01:RESULTS.md` | Failed semantic screen: the worker submission incorrectly accepted array-valued response bodies with `items`, and the independent grader rejected that behavior (3/4 groups passed). Protocol compliance is not independently certifiable from the available worker record. No repeat is eligible under the 4/4-plus-full-compliance rule. |
| Laguna API screen | `peesea/laguna-xs-2.1-apex` | Commit `0933459acd174713a418c74ddbc8dc7a8783b1e9` on `runs/laguna-api-20261102-01`; use `git show runs/laguna-api-20261102-01:RESULTS.md` | Failed semantic screen: the independent grader scored 3/4 groups and rejected an array-valued response `body` containing `items`. Worker timing and full protocol compliance are unknown. No repeat is eligible under the 4/4-plus-full-compliance rule. |
| GLM API screen | `peesea/zai-org/glm-4.7-flash` (OpenCode override independently resolved and dispatched; API-served ID unverified) | Commit `94546826c8244e38ddb0635441705c70284a4f33` on `runs/glm-api-20261102-01`; use `git show runs/glm-api-20261102-01:RESULTS.md` | Rejected for worker-reported protocol violations and statically verified contract defects; no grader run or score. Worker-reported protocol history and test counts/order are not independently certified. No repeat is eligible under the 4/4-plus-full-compliance rule. |
