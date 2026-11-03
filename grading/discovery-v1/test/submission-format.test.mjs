import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const schema = JSON.parse(await readFile(
  fileURLToPath(new URL('../submission.schema.json', import.meta.url)),
  'utf8',
));
const example = JSON.parse(await readFile(
  fileURLToPath(new URL('../submission.example.json', import.meta.url)),
  'utf8',
));
const guide = await readFile(new URL('../submission-format.md', import.meta.url), 'utf8');

test('coordinator submission schema and example define the verifier input shape without gold', () => {
  assert.equal(schema.properties.schemaVersion.const, 1);
  assert.deepEqual(schema.properties.caseId.enum, ['trace', 'boundary']);
  assert.deepEqual(schema.required, ['schemaVersion', 'caseId', 'answers', 'evidenceReviews']);
  assert.deepEqual(example.caseId, 'trace');
  assert.deepEqual(Object.keys(example.answers.T1), ['facts', 'citations', 'additionalClaims']);
  assert.deepEqual(example.evidenceReviews, []);
  assert.equal(Object.hasOwn(example, 'accepted'), false);
  assert.match(JSON.stringify(example), /faithfully-transcribed-value/);
});

test('coordinator guide names every fact slot and prohibits answer repair or inference', () => {
  for (const slot of [
    'public_entry', 'immediate_delegate', 'strict_execution_path', 'strict_route_and_budget',
    'direct_active_callers', 'unused_lookalike', 'override_effect', 'ordinary_result',
    'missing_input_result', 'blank_strict_result', 'invalid_fields_result',
    'zero_budget_edge_result', 'deployment_override',
  ]) {
    assert.ok(guide.includes(`\`${slot}\``), `${slot} has a normalization slot`);
  }
  assert.match(guide, /without correcting, completing, interpreting, or making them match the gold/i);
  assert.match(guide, /stop grading that item and request user adjudication/i);
  assert.match(guide, /omitted.*grades as `missing`/i);
});
