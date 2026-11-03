<results>
<files>
- fixtures/discovery-v1/src/index.mjs — exports the public `inspectRequest` entry and invokes `parseRequest` before `routeRequest` (lines 1–5).
- fixtures/discovery-v1/src/input/parse-request.mjs — normalizes the query and mode, producing tokens and strict mode (lines 1–15).
- fixtures/discovery-v1/src/routing/route-request.mjs — directly calls the active resolver and selects the route and budget (lines 1–11).
- fixtures/discovery-v1/src/policy/resolve-policy.mjs — normalizes policy mode and applies a valid override or the corresponding default (lines 1–9).
- fixtures/discovery-v1/src/policy/defaults.mjs — defines strict and standard term limits (lines 1–4).
- fixtures/discovery-v1/src/admin/preview-policy.mjs — second direct call site of the active resolver (lines 1–4).
- fixtures/discovery-v1/src/batch/inspect-batch.mjs — calls the public `inspectRequest` wrapper, not `resolvePolicy` directly (lines 1–5).
- fixtures/discovery-v1/src/legacy/resolve-policy.mjs — contains a same-named resolver implementation separate from the active policy module (lines 1–6).
</files>

<answer>
**T1 — Public entry:** `inspectRequest`, exported from `src/index.mjs`. It first invokes `parseRequest(input)`; `routeRequest` is invoked afterward with the parsed request. [index.mjs:4–5]( fixtures/discovery-v1/src/index.mjs#L4-L5)

**T2 — Strict-mode path:** `index.mjs` → `input/parse-request.mjs` → `routing/route-request.mjs` → `policy/resolve-policy.mjs` → `policy/defaults.mjs`. The parser lowercases and splits `"Amber Finch"` into `["amber", "finch"]` and preserves `"strict"` as the mode. With no override, the strict default is **2** terms; the route is **`guarded`**, and the result’s budget is **2**. The two tokens are within that budget. Citations: [entry call order]( fixtures/discovery-v1/src/index.mjs#L4-L5); [parsing]( fixtures/discovery-v1/src/input/parse-request.mjs#L5-L15); [resolver and default lookup]( fixtures/discovery-v1/src/policy/resolve-policy.mjs#L3-L9); [strict default]( fixtures/discovery-v1/src/policy/defaults.mjs#L1-L4); [route and budget check]( fixtures/discovery-v1/src/routing/route-request.mjs#L3-L11).

**T3 — Direct callers and overrides:** The active `resolvePolicy` export is called directly by `routeRequest` in `routing/route-request.mjs` (line 4) and `previewPolicy` in `admin/preview-policy.mjs` (line 4). `inspectBatch` calls `inspectRequest`, so it is a wrapper rather than a direct resolver caller ([inspect-batch.mjs:3–5]( fixtures/discovery-v1/src/batch/inspect-batch.mjs#L3-L5)). The separate same-named implementation is in `legacy/resolve-policy.mjs`; it is not the module imported by the active route or admin call sites ([route import]( fixtures/discovery-v1/src/routing/route-request.mjs#L1); [admin import]( fixtures/discovery-v1/src/admin/preview-policy.mjs#L1); [legacy implementation]( fixtures/discovery-v1/src/legacy/resolve-policy.mjs#L1-L5)).

A valid `limitOverride` is a nonnegative safe integer; it replaces the mode’s default `maxTerms`, including when it is zero. An invalid override (including omitted/undefined, negative, non-integer, or unsafe integer) falls back to `DEFAULT_LIMITS[normalizedMode]`; it does not throw. The route uses that effective `maxTerms` as `budget` and accepts when token count is less than or equal to it. [Override validation and fallback]( fixtures/discovery-v1/src/policy/resolve-policy.mjs#L3-L9); [budget and acceptance]( fixtures/discovery-v1/src/routing/route-request.mjs#L10-L11).
</answer>

<next_steps>
Ready to proceed.
</next_steps>
</results>
