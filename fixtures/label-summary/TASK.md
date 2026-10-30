# Task: summarize labels

Read this task and the fixture tests before changing code. The module is an intentionally incomplete starter. First run the exact test command below and confirm that it produces behavioral assertion failures, not an import or syntax error. Then implement the contract, run the same command again, and report the exact results, files changed, and unresolved limitations.

## Contract

Implement the exported `summarizeLabels(values)` function in `src/group-labels.mjs`.

- Accept an array of ASCII label strings mixed with other values.
- Trim each string and lowercase it.
- Discard non-string values and strings that are blank after trimming.
- Count duplicates after normalization.
- Return a new array of `{ label, count }` objects.
- Sort by descending count, then ascending ASCII alphabetic label order for ties.
- Do not mutate the input.
- Each call must return an independent array and independent result objects. Mutating a prior result must not affect later calls, including a repeated call with the same input.

Create the named-export helper `src/normalize-label.mjs` with `normalizeLabel(value)`. It returns the normalized label, or `null` for a non-string or blank value. Modify the grouping module to import and actually use this helper.

## Run steps

1. Read this task and `test/group-labels.test.mjs`.
2. From the repository root, run exactly:

   ```sh
   node --test fixtures/label-summary/test/group-labels.test.mjs
   ```

3. Confirm that the baseline shows behavioral assertion failures. Stop if the test runner reports a loader, syntax, or other unexpected execution error.
4. Check which file-creation and file-edit tools are actually available. Use an available mechanism to create the helper and edit the grouping module. Do not assume a tool name or retry a malformed tool call.
5. Run the exact test command again and report its output summary, files changed, and any limitations.

Only the two source files named above may be created or edited. The tests, this task, documentation, instructions, and Git metadata are frozen. Follow the repository's `AGENTS.md`; if any instruction conflicts with a higher-priority instruction, stop and report the conflict rather than bypassing it.
