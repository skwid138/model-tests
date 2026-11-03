import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

const manifestTools = await import('../manifest.mjs').catch(() => ({}));
const privacyTools = await import('../privacy.mjs');
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const traceAnswerKeyPath = 'grading/discovery-v2/answer-keys/trace.json';
const traceAnswerKeyBytes = readFileSync(resolve(repoRoot, traceAnswerKeyPath));
const traceAnswerKey = JSON.parse(traceAnswerKeyBytes.toString('utf8'));
const traceAnswerKeySha256 = createHash('sha256').update(traceAnswerKeyBytes).digest('hex');

function manifest(overrides = {}) {
  // Synthetic validator inputs only; this helper does not describe or archive a trial.
  return {
    schemaVersion: 2,
    caseId: 'trace',
    taskVersion: 2,
    sourceVersion: 2,
    model: {
      provider: { value: 'local', provenance: 'declared' },
      modelId: { value: 'model-id', provenance: 'declared' },
      rolePromptRef: { value: 'artifacts/prompt.txt', provenance: 'operator_reported' },
      settingsRef: { value: null, provenance: 'unknown' },
      roleBaselineSha256: { value: null, provenance: 'unknown' },
      providerArtifactSha256: { value: null, provenance: 'unknown' },
    },
    hardware: {
      ramMiB: { value: 4096, provenance: 'observed' },
      freeVramMiB: { value: 512, provenance: 'observed' },
    },
    timing: {
      submittedAtUtc: { value: '2026-11-02T00:00:00Z', provenance: 'observed' },
      elapsedSeconds: { value: 120, provenance: 'observed' },
      retries: { value: 0, provenance: 'observed' },
    },
    toolCalls: {
      count: { value: 7, provenance: 'observed' },
      traceStatus: 'available',
      traceSource: { value: 'tool-call-capture', provenance: 'observed' },
      coverage: 'complete',
      coverageRefs: ['artifacts/trace.json'],
    },
    instructions: { status: 'PASS', evidenceRefs: ['artifacts/compliance.md'] },
    telemetry: { status: 'captured', cloudNotApplicableApproved: false, provenance: 'observed', artifactRefs: ['artifacts/telemetry.json'] },
    operatorGates: {
      timeLimitSeconds: 180,
      minimumRamMiB: 4096,
      minimumFreeVramMiB: 512,
      status: 'PASS',
      stopReason: 'none',
      evidenceRefs: ['artifacts/gate-check.md'],
    },
    artifactRefs: ['artifacts/trace.json', 'artifacts/telemetry.json'],
    fixtureHashes: {
      taskPath: traceAnswerKey.taskPath,
      taskSha256: traceAnswerKey.taskSha256,
      sourceFilesSha256: traceAnswerKey.sourceFilesSha256,
      answerKeyPath: traceAnswerKeyPath,
      answerFileSha256: traceAnswerKeySha256,
    },
    evidenceReviews: [],
    claimReviews: [],
    protocolStatus: 'PASS',
    ...overrides,
  };
}

test('protocol PASS requires instruction PASS, a complete trace, coverage references, and known trace provenance', () => {
  assert.equal(typeof manifestTools.expectedProtocolStatus, 'function', 'v2 protocol validator is available');
  assert.deepEqual(manifestTools.expectedProtocolStatus(manifest()), { status: 'PASS', reasonCodes: [] });
  assert.equal(manifestTools.expectedProtocolStatus(manifest({ instructions: { status: 'FAIL', evidenceRefs: [] } })).status, 'FAIL');
  assert.equal(manifestTools.expectedProtocolStatus(manifest({ toolCalls: { ...manifest().toolCalls, coverageRefs: [] } })).status, 'UNKNOWN');
  assert.equal(manifestTools.expectedProtocolStatus(manifest({ toolCalls: { ...manifest().toolCalls, traceSource: { value: null, provenance: 'unknown' } } })).status, 'UNKNOWN');
});

test('focused manifest validation rejects fabricated unknown measurements and unsafe artifact references', () => {
  assert.equal(typeof manifestTools.validateTrialManifest, 'function', 'v2 manifest validation is available');
  assert.equal(manifestTools.validateTrialManifest(manifest()).valid, true);
  assert.equal(manifestTools.validateTrialManifest(manifest({ timing: { ...manifest().timing, elapsedSeconds: { value: 0, provenance: 'unknown' } } })).valid, false);
  assert.equal(manifestTools.validateTrialManifest(manifest({ artifactRefs: ['../private.log'] })).valid, false);
  assert.equal(manifestTools.validateTrialManifest(manifest({ telemetry: { status: 'not_applicable_explicitly_approved', cloudNotApplicableApproved: false, provenance: 'unknown', artifactRefs: [] } })).valid, false);
  assert.equal(manifestTools.validateTrialManifest(manifest({ telemetry: {
    status: 'not_applicable_explicitly_approved',
    cloudNotApplicableApproved: true,
    provenance: 'operator_reported',
    artifactRefs: [],
  } })).valid, true);
});

test('operator protocol gates validate measured preflight floors, elapsed cutoff, and known violations', () => {
  assert.equal(manifestTools.expectedProtocolStatus(manifest()).status, 'PASS');
  assert.equal(manifestTools.expectedProtocolStatus(manifest({ operatorGates: { ...manifest().operatorGates, status: 'FAIL' } })).status, 'FAIL');
  assert.equal(manifestTools.expectedProtocolStatus(manifest({ operatorGates: { ...manifest().operatorGates, status: 'UNKNOWN' } })).status, 'UNKNOWN');
  assert.equal(manifestTools.validateTrialManifest(manifest({
    hardware: { ...manifest().hardware, ramMiB: { value: 3000, provenance: 'observed' } },
  })).valid, false);
  const lowRamUnknown = manifest({
    hardware: { ...manifest().hardware, ramMiB: { value: 3000, provenance: 'observed' } },
    operatorGates: { ...manifest().operatorGates, status: 'UNKNOWN', stopReason: 'unknown', evidenceRefs: [] },
    protocolStatus: 'FAIL',
  });
  assert.equal(manifestTools.expectedProtocolStatus(lowRamUnknown).status, 'FAIL');
  assert.equal(manifestTools.validateTrialManifest(lowRamUnknown).valid, false);
  assert.equal(manifestTools.validateTrialManifest(manifest({
    timing: { ...manifest().timing, elapsedSeconds: { value: 181, provenance: 'observed' } },
  })).valid, false);
  assert.equal(manifestTools.validateTrialManifest(manifest({
    hardware: { ...manifest().hardware, freeVramMiB: { value: null, provenance: 'unknown' } },
  })).valid, false);
  const knownViolation = manifest({
    timing: { ...manifest().timing, elapsedSeconds: { value: 181, provenance: 'observed' } },
    operatorGates: { ...manifest().operatorGates, status: 'FAIL', stopReason: 'exceeded_time_limit' },
    protocolStatus: 'FAIL',
  });
  assert.equal(manifestTools.validateTrialManifest(knownViolation).valid, true);
  assert.equal(manifestTools.expectedProtocolStatus(knownViolation).status, 'FAIL');
});

test('declared hardware or duration values cannot qualify an operator gate as PASS', () => {
  const declaredOnly = manifest({
    hardware: {
      ramMiB: { value: 8192, provenance: 'declared' },
      freeVramMiB: { value: 2048, provenance: 'declared' },
    },
    timing: {
      ...manifest().timing,
      elapsedSeconds: { value: 90, provenance: 'declared' },
    },
    protocolStatus: 'UNKNOWN',
  });
  assert.equal(manifestTools.expectedProtocolStatus(declaredOnly).status, 'UNKNOWN');
  assert.equal(manifestTools.validateTrialManifest(declaredOnly).valid, false);
});

test('privacy pattern checks report categories and field paths without returning matched secret text', () => {
  const findings = privacyTools.scanPrivacyPatterns({
    response: 'Authorization: Bearer abc.def.token',
    ref: '/Users/local-user/session.md',
    claim: 'https://internal.example.invalid/path',
  });
  assert.deepEqual(findings.map(({ path, patternId }) => [path, patternId]), [
    ['response', 'bearer_credential'],
    ['ref', 'machine_local_path'],
    ['claim', 'http_endpoint'],
  ]);
  assert.equal(JSON.stringify(findings).includes('abc.def.token'), false);
  const keyedCredential = privacyTools.scanPrivacyPatterns({ metadata: { nested: { apiKey: 'placeholder' } } });
  assert.deepEqual(keyedCredential, [{ path: 'metadata.nested.apiKey', patternId: 'credential_field_name' }]);
  assert.equal(JSON.stringify(keyedCredential).includes('placeholder'), false);
  assert.deepEqual(privacyTools.scanPrivacyPatterns({ metadata: { aws_secret_access_key: 'placeholder' } }), [
    { path: 'metadata.aws_secret_access_key', patternId: 'credential_field_name' },
  ]);
  assert.deepEqual(privacyTools.scanPrivacyPatterns({ nested: { 'api-key': 'placeholder' } }), [
    { path: 'nested.api-key', patternId: 'credential_field_name' },
  ]);
  assert.deepEqual(privacyTools.scanPrivacyPatterns({ childMetadata: { childId: 'ses_0123456789abcdef012345' } }), [
    { path: 'childMetadata.childId', patternId: 'session_identifier' },
  ]);
  assert.equal(manifestTools.validateTrialManifest(manifest({
    model: { ...manifest().model, apiKey: 'placeholder' },
  })).valid, false);
});
