import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { validateEvidenceReviewRecord, validateManifestProtocol } from '../manifest.mjs';
import { combineEvidenceReviews } from '../verifier.mjs';

const schemaPath = fileURLToPath(new URL('../trial-manifest.schema.json', import.meta.url));
const schema = JSON.parse(await readFile(schemaPath, 'utf8'));

test('trial manifest requires complete provenance while rejecting unmodeled fields', () => {
  assert.equal(schema.properties.schemaVersion.const, 1);
  assert.equal(schema.additionalProperties, false);
  for (const field of [
    'task', 'role', 'model', 'hardware', 'context', 'trialRoot', 'timing',
    'retries', 'toolCalls', 'instructions', 'semanticGrades', 'evidenceReviews',
    'protocolStatus', 'telemetryArtifacts',
  ]) {
    assert.ok(schema.required.includes(field), `${field} is required`);
  }
  assert.ok(schema.properties.model.required.includes('overrideArtifact'));
  assert.ok(schema.properties.model.required.includes('quantization'));
});

test('unknown measurements must be explicit nulls with unknown provenance', () => {
  const measurement = schema.$defs.measurement;
  assert.deepEqual(measurement.properties.provenance.enum, [
    'declared', 'observed', 'operator_reported', 'unknown',
  ]);
  assert.equal(measurement.allOf[0].if.properties.provenance.const, 'unknown');
  assert.equal(measurement.allOf[0].then.properties.value.type, 'null');
  assert.deepEqual(measurement.allOf[0].else.properties.value.not, { type: 'null' });
});

test('artifact references are relative and cannot include traversal', () => {
  const pattern = new RegExp(schema.$defs.relativeArtifactPath.pattern);
  const rootMappingPattern = new RegExp(
    schema.$defs.relativeTextMeasurement.allOf[1].properties.value.pattern,
  );
  assert.match('captures/trace-1/manifest.json', pattern);
  assert.doesNotMatch('/Users/operator/capture.json', pattern);
  assert.doesNotMatch('../outside.json', pattern);
  assert.doesNotMatch('captures/../outside.json', pattern);
  assert.match('worktree/fixtures/discovery-v1', rootMappingPattern);
  assert.doesNotMatch('/Users/operator/worktree', rootMappingPattern);
  assert.doesNotMatch('C:/Users/operator/worktree', rootMappingPattern);
  assert.doesNotMatch('worktree/../other', rootMappingPattern);
});

test('text measurements keep portable model IDs and timestamps but reject path and URI forms', () => {
  const textPattern = new RegExp(
    schema.$defs.textMeasurement.allOf[1].properties.value.pattern,
  );
  assert.match('github-copilot/gpt-6-luna#medium', textPattern);
  assert.match('2026-11-02T12:00:00.000Z', textPattern);
  assert.doesNotMatch('/Users/operator/model', textPattern);
  assert.doesNotMatch('C:/Users/operator/model', textPattern);
  assert.doesNotMatch('\\\\server\\share\\model', textPattern);
  assert.doesNotMatch('ssh://private-host/model', textPattern);
  assert.doesNotMatch('file:/Users/operator/model', textPattern);
  assert.doesNotMatch('file:relative/model', textPattern);
  assert.doesNotMatch('mailto:operator@example.invalid', textPattern);
  assert.doesNotMatch('provider/../private-token', textPattern);
});

test('protocol and semantic status are separate manifest fields', () => {
  assert.deepEqual(schema.properties.instructions.properties.status.enum, ['PASS', 'FAIL', 'UNKNOWN']);
  assert.deepEqual(schema.properties.protocolStatus.enum, ['PASS', 'FAIL', 'UNKNOWN']);
  const passRule = schema.allOf.find((rule) => rule.if.properties.protocolStatus?.const === 'PASS');
  const failRule = schema.allOf.find((rule) => rule.if.properties.protocolStatus?.const === 'FAIL');
  assert.ok(passRule);
  assert.ok(failRule);
  assert.equal(passRule.then.properties.instructions.properties.status.const, 'PASS');
  assert.equal(passRule.then.properties.toolCalls.$ref, '#/$defs/completeTraceEvidence');
  assert.equal(schema.$defs.completeTraceEvidence.properties.traceStatus.const, 'available');
  assert.equal(schema.$defs.completeTraceEvidence.properties.coverage.const, 'complete');
  assert.equal(schema.$defs.completeTraceEvidence.properties.coverageRefs.minItems, 1);
  assert.deepEqual(
    schema.$defs.completeTraceEvidence.properties.traceSource.allOf[1].properties.provenance.enum,
    ['declared', 'observed', 'operator_reported'],
  );
  assert.equal(failRule.then.properties.instructions.properties.status.const, 'FAIL');
  assert.equal(schema.properties.semanticGrades.type, 'array');
  assert.deepEqual(schema.properties.semanticGrades.items.properties.facts.items.properties.outcome.enum, [
    'correct', 'missing', 'abstention', 'incorrect', 'unsupported',
  ]);
  assert.ok(schema.properties.evidenceReviews.items.required.includes('questionId'));
  assert.ok(schema.properties.evidenceReviews.items.required.includes('factId'));
  assert.equal(schema.properties.evidenceReviews.items.properties.reviewerA.allOf[1].properties.reviewerLabel.const, 'A');
  assert.equal(schema.properties.evidenceReviews.items.properties.reviewerB.allOf[1].properties.reviewerLabel.const, 'B');
  assert.ok(schema.$defs.reviewDecision.properties.decision.enum.includes('UNRESOLVED'));
  assert.equal(schema.properties.instructions.type, 'object');
  assert.equal(schema.properties.telemetryArtifacts.items.properties.path.$ref, '#/$defs/relativeArtifactPath');
});

test('protocol PASS requires a complete trace and known trace source', () => {
  const manifest = {
    instructions: { status: 'PASS' },
    protocolStatus: 'PASS',
    toolCalls: {
      traceStatus: 'available',
      coverage: 'complete',
      coverageRefs: ['trace/tool-call-sequence.json'],
      traceSource: { value: 'parent_tool_trace', provenance: 'observed' },
    },
  };

  assert.deepEqual(validateManifestProtocol(manifest), {
    valid: true,
    expectedStatus: 'PASS',
    reasonCodes: [],
  });
});

test('unavailable or incomplete trace evidence cannot be promoted to PASS', () => {
  const complete = {
    instructions: { status: 'PASS' },
    protocolStatus: 'PASS',
    toolCalls: {
      traceStatus: 'available',
      coverage: 'complete',
      coverageRefs: ['trace/tool-call-sequence.json'],
      traceSource: { value: 'parent_tool_trace', provenance: 'observed' },
    },
  };
  const incompleteVariants = [
    { traceStatus: 'unavailable' },
    { coverage: 'partial' },
    { coverageRefs: [] },
    { traceSource: { value: null, provenance: 'unknown' } },
    { traceSource: { value: '', provenance: 'observed' } },
  ];

  for (const change of incompleteVariants) {
    const manifest = structuredClone(complete);
    Object.assign(manifest.toolCalls, change);
    const result = validateManifestProtocol(manifest);
    assert.equal(result.valid, false);
    assert.equal(result.expectedStatus, 'UNKNOWN');
    assert.ok(result.reasonCodes.length > 0);
  }
});

test('observed instruction failure yields FAIL while insufficient evidence yields UNKNOWN', () => {
  const observedViolation = validateManifestProtocol({
    instructions: { status: 'FAIL' },
    protocolStatus: 'FAIL',
    toolCalls: { traceStatus: 'unavailable', coverage: 'unknown', coverageRefs: [], traceSource: { value: null, provenance: 'unknown' } },
  });
  assert.deepEqual(observedViolation, {
    valid: true,
    expectedStatus: 'FAIL',
    reasonCodes: ['instruction_violation_observed'],
  });

  const insufficientEvidence = validateManifestProtocol({
    instructions: { status: 'PASS' },
    protocolStatus: 'UNKNOWN',
    toolCalls: { traceStatus: 'available', coverage: 'partial', coverageRefs: [], traceSource: { value: 'parent_output', provenance: 'observed' } },
  });
  assert.equal(insufficientEvidence.valid, true);
  assert.equal(insufficientEvidence.expectedStatus, 'UNKNOWN');

  const unsupportedFailure = validateManifestProtocol({
    instructions: { status: 'PASS' },
    protocolStatus: 'FAIL',
    toolCalls: {
      traceStatus: 'available',
      coverage: 'complete',
      coverageRefs: ['trace/tool-call-sequence.json'],
      traceSource: { value: 'parent_tool_trace', provenance: 'observed' },
    },
  });
  assert.equal(unsupportedFailure.valid, false);
  assert.equal(unsupportedFailure.expectedStatus, 'PASS');
});

test('manifest evidence-review fields must faithfully match the linked two-review combiner', () => {
  const combined = combineEvidenceReviews([
    { reviewerLabel: 'A', citationsEntailClaim: true, branchCoverageComplete: true },
    { reviewerLabel: 'B', citationsEntailClaim: true, branchCoverageComplete: true },
  ]);
  const review = {
    questionId: 'T1',
    factId: 'public_entry',
    ...combined,
  };

  assert.deepEqual(validateEvidenceReviewRecord(review), {
    valid: true,
    expectedStatus: 'SUPPORTED',
    reasonCodes: [],
  });

  const contradictoryRecord = structuredClone(review);
  contradictoryRecord.reviewerB.decision = 'UNSUPPORTED';
  const validation = validateEvidenceReviewRecord(contradictoryRecord);
  assert.equal(validation.valid, false);
  assert.equal(validation.expectedStatus, 'SUPPORTED');

  const disagreement = {
    questionId: 'T1',
    factId: 'public_entry',
    ...combineEvidenceReviews([
      { reviewerLabel: 'A', citationsEntailClaim: true, branchCoverageComplete: true },
      { reviewerLabel: 'B', citationsEntailClaim: false, branchCoverageComplete: true },
    ]),
  };
  assert.equal(validateEvidenceReviewRecord(disagreement).valid, true);
  assert.equal(validateEvidenceReviewRecord(disagreement).expectedStatus, 'UNRESOLVED');

  const unsupported = {
    questionId: 'T1',
    factId: 'public_entry',
    ...combineEvidenceReviews([
      { reviewerLabel: 'A', citationsEntailClaim: false, branchCoverageComplete: false },
      { reviewerLabel: 'B', citationsEntailClaim: false, branchCoverageComplete: false },
    ]),
  };
  assert.equal(unsupported.status, 'UNSUPPORTED');
  assert.equal(validateEvidenceReviewRecord(unsupported).valid, true);
});
