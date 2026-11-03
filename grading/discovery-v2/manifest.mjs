import { scanPrivacyPatterns } from './privacy.mjs';
import { isDeepStrictEqual } from 'node:util';

const PROVENANCE = new Set(['observed', 'declared', 'operator_reported', 'unknown']);
const INSTRUCTION_STATUS = new Set(['PASS', 'FAIL', 'UNKNOWN']);
const V2_SOURCE_PATHS = [
  'fixtures/discovery-v2/src/admin/preview-policy.mjs',
  'fixtures/discovery-v2/src/batch/inspect-batch.mjs',
  'fixtures/discovery-v2/src/index.mjs',
  'fixtures/discovery-v2/src/input/parse-request.mjs',
  'fixtures/discovery-v2/src/legacy/resolve-policy.mjs',
  'fixtures/discovery-v2/src/policy/defaults.mjs',
  'fixtures/discovery-v2/src/policy/resolve-policy.mjs',
  'fixtures/discovery-v2/src/routing/route-request.mjs',
];

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeRelativeArtifactRef(value) {
  return typeof value === 'string'
    && value.length > 0
    && !value.startsWith('/')
    && !value.startsWith('~')
    && !value.startsWith('$')
    && !value.includes('\\')
    && !value.includes('\0')
    && !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)
    && !value.split('/').includes('..')
    && value.split('/').every((part) => part !== '' && part !== '.');
}

function knownTraceSource(source) {
  return isRecord(source)
    && typeof source.value === 'string'
    && source.value.trim() !== ''
    && source.provenance !== 'unknown'
    && PROVENANCE.has(source.provenance);
}

function safeCoverageRefs(value) {
  return Array.isArray(value) && value.length > 0 && value.every(safeRelativeArtifactRef);
}

function measuredGateViolation(manifest) {
  const gates = manifest?.operatorGates;
  const ram = manifest?.hardware?.ramMiB;
  const vram = manifest?.hardware?.freeVramMiB;
  const elapsed = manifest?.timing?.elapsedSeconds;
  return (
    (ram?.provenance === 'observed' && Number.isSafeInteger(ram.value) && ram.value < (gates?.minimumRamMiB ?? 4096))
    || (vram?.provenance === 'observed' && Number.isSafeInteger(vram.value) && vram.value < (gates?.minimumFreeVramMiB ?? 512))
    || (elapsed?.provenance === 'observed' && typeof elapsed.value === 'number' && Number.isFinite(elapsed.value) && elapsed.value > (gates?.timeLimitSeconds ?? 180))
  );
}

function operatorGateMeasurementsObserved(manifest) {
  const ram = manifest?.hardware?.ramMiB;
  const vram = manifest?.hardware?.freeVramMiB;
  const elapsed = manifest?.timing?.elapsedSeconds;
  const gates = manifest?.operatorGates;
  return ram?.provenance === 'observed'
    && Number.isSafeInteger(ram.value)
    && ram.value >= (gates?.minimumRamMiB ?? 4096)
    && vram?.provenance === 'observed'
    && Number.isSafeInteger(vram.value)
    && vram.value >= (gates?.minimumFreeVramMiB ?? 512)
    && elapsed?.provenance === 'observed'
    && typeof elapsed.value === 'number'
    && Number.isFinite(elapsed.value)
    && elapsed.value >= 0
    && elapsed.value <= (gates?.timeLimitSeconds ?? 180);
}

export function expectedProtocolStatus(manifest) {
  if (
    manifest?.instructions?.status === 'FAIL'
    || manifest?.operatorGates?.status === 'FAIL'
    || measuredGateViolation(manifest)
  ) {
    const reason = manifest?.operatorGates?.status === 'FAIL' || measuredGateViolation(manifest)
      ? 'operator_gate_violation_observed'
      : 'instruction_violation_observed';
    return { status: 'FAIL', reasonCodes: [reason] };
  }
  if (manifest?.instructions?.status !== 'PASS') {
    return { status: 'UNKNOWN', reasonCodes: ['instruction_status_unknown'] };
  }
  if (!safeCoverageRefs(manifest?.instructions?.evidenceRefs)) {
    return { status: 'UNKNOWN', reasonCodes: ['instruction_evidence_missing_or_unsafe'] };
  }
  if (manifest?.operatorGates?.status !== 'PASS') {
    return { status: 'UNKNOWN', reasonCodes: ['operator_gate_status_unknown'] };
  }
  if (!operatorGateMeasurementsObserved(manifest)) {
    return { status: 'UNKNOWN', reasonCodes: ['operator_gate_measurements_not_observed'] };
  }
  const toolCalls = manifest?.toolCalls;
  const reasons = [];
  if (toolCalls?.traceStatus !== 'available') reasons.push('trace_unavailable');
  if (toolCalls?.coverage !== 'complete') reasons.push('trace_coverage_incomplete');
  if (!safeCoverageRefs(toolCalls?.coverageRefs)) reasons.push('trace_coverage_reference_missing_or_unsafe');
  if (!knownTraceSource(toolCalls?.traceSource)) reasons.push('trace_source_unknown');
  return reasons.length === 0
    ? { status: 'PASS', reasonCodes: [] }
    : { status: 'UNKNOWN', reasonCodes: reasons };
}

export function validateManifestProtocol(manifest) {
  const expected = expectedProtocolStatus(manifest);
  return {
    valid: manifest?.protocolStatus === expected.status,
    expectedStatus: expected.status,
    reasonCodes: expected.reasonCodes,
  };
}

function measurementErrors(value, path, errors) {
  if (!isRecord(value) || Object.keys(value).sort().join(',') !== 'provenance,value') {
    errors.push(`${path}:measurement_shape_invalid`);
    return;
  }
  if (!PROVENANCE.has(value.provenance)) errors.push(`${path}:provenance_invalid`);
  if (value.value !== null && !['string', 'number', 'boolean'].includes(typeof value.value)) {
    errors.push(`${path}:value_type_invalid`);
  }
  if (typeof value.value === 'string' && value.value.trim() === '') errors.push(`${path}:value_empty`);
  if (typeof value.value === 'number' && !Number.isFinite(value.value)) errors.push(`${path}:value_non_finite`);
  if ((value.value === null) !== (value.provenance === 'unknown')) {
    errors.push(`${path}:unknown_value_provenance_mismatch`);
  }
}

function valueConstraint(value, path, predicate, description, errors) {
  if (value?.value !== null && value?.value !== undefined && !predicate(value.value)) {
    errors.push(`${path}:${description}`);
  }
}

function refsErrors(refs, path, errors, { allowEmpty = true } = {}) {
  if (!Array.isArray(refs) || (!allowEmpty && refs.length === 0)) {
    errors.push(`${path}:reference_list_invalid`);
    return;
  }
  for (const [index, reference] of refs.entries()) {
    if (!safeRelativeArtifactRef(reference)) errors.push(`${path}[${index}]:unsafe_reference`);
  }
}

function reviewRecordsErrors(records, kind, errors) {
  if (!Array.isArray(records)) {
    errors.push(`${kind}:records_invalid`);
    return;
  }
  const seen = new Set();
  for (const record of records) {
    const isEvidence = kind === 'evidenceReviews';
    const idField = isEvidence ? 'factId' : 'claimId';
    if (!isRecord(record) || typeof record.questionId !== 'string' || typeof record[idField] !== 'string') {
      errors.push(`${kind}:record_invalid`);
      continue;
    }
    const key = `${record.questionId}\0${record[idField]}`;
    if (seen.has(key)) errors.push(`${kind}:duplicate_record`);
    seen.add(key);
    for (const reviewerLabel of ['reviewerA', 'reviewerB']) {
      const reviewer = record[reviewerLabel];
      if (reviewer === undefined) continue;
      const fields = isEvidence
        ? ['citationsEntailClaim', 'branchCoverageComplete']
        : ['claimAtomic', 'sourceScopeComplete', 'reviewCompleted', 'evidenceDisposition'];
      if (
        !isRecord(reviewer)
        || Object.keys(reviewer).some((field) => !fields.includes(field))
        || (isEvidence && fields.some((field) => typeof reviewer[field] !== 'boolean'))
        || (!isEvidence && (
          ['claimAtomic', 'sourceScopeComplete', 'reviewCompleted'].some((field) => typeof reviewer[field] !== 'boolean')
          || !['supported', 'unsupported_established', 'contradicted', 'not_reviewed'].includes(reviewer.evidenceDisposition)
        ))
      ) errors.push(`${kind}:${reviewerLabel}_checklist_invalid`);
    }
  }
}

export function validateTrialManifest(manifest) {
  const errors = [];
  if (
    !isRecord(manifest)
    || manifest.schemaVersion !== 2
    || !['trace', 'boundary'].includes(manifest.caseId)
    || manifest.taskVersion !== 2
    || manifest.sourceVersion !== 2
  ) {
    return { valid: false, errors: ['manifest_identity_invalid'], protocol: { valid: false, expectedStatus: 'UNKNOWN', reasonCodes: ['manifest_identity_invalid'] } };
  }

  if (!isRecord(manifest.model)) errors.push('model:shape_invalid');
  else {
    for (const field of ['provider', 'modelId', 'rolePromptRef', 'settingsRef', 'roleBaselineSha256', 'providerArtifactSha256']) {
      measurementErrors(manifest.model[field], `model.${field}`, errors);
    }
    for (const field of ['roleBaselineSha256', 'providerArtifactSha256']) {
      const value = manifest.model[field]?.value;
      if (value !== null && !/^[a-f0-9]{64}$/.test(value)) errors.push(`model.${field}:hash_invalid`);
    }
    for (const field of ['rolePromptRef', 'settingsRef']) {
      const reference = manifest.model[field]?.value;
      if (reference !== null && !safeRelativeArtifactRef(reference)) errors.push(`model.${field}:unsafe_reference`);
    }
  }
  if (!isRecord(manifest.hardware)) errors.push('hardware:shape_invalid');
  else for (const field of ['ramMiB', 'freeVramMiB']) {
    measurementErrors(manifest.hardware[field], `hardware.${field}`, errors);
    valueConstraint(manifest.hardware[field], `hardware.${field}`, (value) => Number.isSafeInteger(value) && value >= 0, 'must_be_nonnegative_integer', errors);
  }
  if (!isRecord(manifest.timing)) errors.push('timing:shape_invalid');
  else {
    for (const field of ['submittedAtUtc', 'elapsedSeconds', 'retries']) measurementErrors(manifest.timing[field], `timing.${field}`, errors);
    valueConstraint(manifest.timing.elapsedSeconds, 'timing.elapsedSeconds', (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0, 'must_be_nonnegative_seconds', errors);
    valueConstraint(manifest.timing.retries, 'timing.retries', (value) => Number.isSafeInteger(value) && value >= 0, 'must_be_nonnegative_integer', errors);
    valueConstraint(manifest.timing.submittedAtUtc, 'timing.submittedAtUtc', (value) => (
      typeof value === 'string'
      && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
      && Number.isFinite(Date.parse(value))
    ), 'must_be_utc_timestamp', errors);
  }

  const calls = manifest.toolCalls;
  if (!isRecord(calls)) errors.push('toolCalls:shape_invalid');
  else {
    measurementErrors(calls.count, 'toolCalls.count', errors);
    valueConstraint(calls.count, 'toolCalls.count', (value) => Number.isSafeInteger(value) && value >= 0, 'must_be_nonnegative_integer', errors);
    if (!['available', 'unavailable', 'incomplete'].includes(calls.traceStatus)) errors.push('toolCalls.traceStatus:invalid');
    if (!['complete', 'incomplete', 'unknown'].includes(calls.coverage)) errors.push('toolCalls.coverage:invalid');
    if (!isRecord(calls.traceSource)) errors.push('toolCalls.traceSource:shape_invalid');
    else measurementErrors(calls.traceSource, 'toolCalls.traceSource', errors);
    refsErrors(calls.coverageRefs, 'toolCalls.coverageRefs', errors);
  }

  const instructions = manifest.instructions;
  if (!isRecord(instructions) || !INSTRUCTION_STATUS.has(instructions.status)) errors.push('instructions:status_invalid');
  else {
    refsErrors(instructions.evidenceRefs, 'instructions.evidenceRefs', errors);
    if (instructions.status !== 'UNKNOWN' && (!Array.isArray(instructions.evidenceRefs) || instructions.evidenceRefs.length === 0)) {
      errors.push('instructions:known_status_requires_evidence');
    }
  }

  const telemetry = manifest.telemetry;
  if (
    !isRecord(telemetry)
    || !['captured', 'not_collected', 'not_applicable_explicitly_approved'].includes(telemetry.status)
    || typeof telemetry.cloudNotApplicableApproved !== 'boolean'
    || !PROVENANCE.has(telemetry.provenance)
  ) errors.push('telemetry:shape_invalid');
  else {
    refsErrors(telemetry.artifactRefs, 'telemetry.artifactRefs', errors);
    if (telemetry.status === 'not_applicable_explicitly_approved' && telemetry.cloudNotApplicableApproved !== true) {
      errors.push('telemetry:cloud_not_applicable_without_approval');
    }
    if (telemetry.status !== 'not_applicable_explicitly_approved' && telemetry.cloudNotApplicableApproved) {
      errors.push('telemetry:approval_status_mismatch');
    }
    if (telemetry.status === 'captured' && telemetry.artifactRefs.length === 0) errors.push('telemetry:captured_without_artifacts');
    if (telemetry.status !== 'not_collected' && telemetry.provenance === 'unknown') {
      errors.push('telemetry:known_status_requires_provenance');
    }
  }

  const gates = manifest.operatorGates;
  if (
    !isRecord(gates)
    || gates.timeLimitSeconds !== 180
    || gates.minimumRamMiB !== 4096
    || gates.minimumFreeVramMiB !== 512
    || !['PASS', 'FAIL', 'UNKNOWN'].includes(gates.status)
    || !['none', 'telemetry_loss', 'ram_floor', 'free_vram_floor', 'time_limit', 'preflight_floor_violation', 'not_stopped_on_floor', 'not_stopped_on_telemetry_loss', 'exceeded_time_limit', 'other_violation', 'unknown'].includes(gates.stopReason)
  ) errors.push('operatorGates:required_fields_invalid');
  else {
    refsErrors(gates.evidenceRefs, 'operatorGates.evidenceRefs', errors);
    if (measuredGateViolation(manifest) && gates.status !== 'FAIL') {
      errors.push('operatorGates:known_measurement_violation_requires_FAIL');
    }
    const hasGateEvidence = Array.isArray(gates.evidenceRefs) && gates.evidenceRefs.length > 0;
    if (gates.status === 'PASS') {
      const ram = manifest.hardware?.ramMiB;
      const vram = manifest.hardware?.freeVramMiB;
      const elapsed = manifest.timing?.elapsedSeconds;
      if (
        !Number.isSafeInteger(ram?.value)
        || ram.value < gates.minimumRamMiB
        || ram.provenance !== 'observed'
        || !Number.isSafeInteger(vram?.value)
        || vram.value < gates.minimumFreeVramMiB
        || vram.provenance !== 'observed'
        || typeof elapsed?.value !== 'number'
        || !Number.isFinite(elapsed.value)
        || elapsed.value < 0
        || elapsed.value > gates.timeLimitSeconds
        || elapsed.provenance !== 'observed'
        || gates.stopReason === 'unknown'
        || !hasGateEvidence
      ) errors.push('operatorGates:pass_not_supported_by_measurements');
      if (['preflight_floor_violation', 'not_stopped_on_floor', 'not_stopped_on_telemetry_loss', 'exceeded_time_limit', 'other_violation'].includes(gates.stopReason)) {
        errors.push('operatorGates:pass_conflicts_with_violation_reason');
      }
    }
    if (gates.status === 'FAIL') {
      if (
        !['preflight_floor_violation', 'not_stopped_on_floor', 'not_stopped_on_telemetry_loss', 'exceeded_time_limit', 'other_violation'].includes(gates.stopReason)
        || !hasGateEvidence
      ) errors.push('operatorGates:failure_requires_reason_and_evidence');
    }
  }
  refsErrors(manifest.artifactRefs, 'artifactRefs', errors);
  const fixtureHashes = manifest.fixtureHashes;
  const expectedTaskPath = `fixtures/discovery-v2/tasks/${manifest.caseId === 'trace' ? 'trace' : 'boundaries'}.md`;
  const expectedKeyPath = `grading/discovery-v2/answer-keys/${manifest.caseId === 'trace' ? 'trace' : 'boundary'}.json`;
  if (!isRecord(fixtureHashes)) errors.push('fixtureHashes:shape_invalid');
  else {
    if (fixtureHashes.taskPath !== expectedTaskPath) errors.push('fixtureHashes:task_path_invalid');
    if (fixtureHashes.answerKeyPath !== expectedKeyPath) errors.push('fixtureHashes:answer_key_path_invalid');
    if (!/^[a-f0-9]{64}$/.test(fixtureHashes.taskSha256 ?? '')) errors.push('fixtureHashes:task_hash_invalid');
    if (!/^[a-f0-9]{64}$/.test(fixtureHashes.answerFileSha256 ?? '')) errors.push('fixtureHashes:answer_key_hash_invalid');
    if (
      !isRecord(fixtureHashes.sourceFilesSha256)
      || !isDeepStrictEqual(Object.keys(fixtureHashes.sourceFilesSha256).sort(), [...V2_SOURCE_PATHS].sort())
    ) errors.push('fixtureHashes:source_allowlist_invalid');
    else for (const [path, hash] of Object.entries(fixtureHashes.sourceFilesSha256)) {
      if (!/^[a-f0-9]{64}$/.test(hash)) errors.push(`fixtureHashes:source_hash_invalid:${path}`);
    }
  }
  reviewRecordsErrors(manifest.evidenceReviews, 'evidenceReviews', errors);
  reviewRecordsErrors(manifest.claimReviews, 'claimReviews', errors);
  if (typeof manifest.protocolStatus !== 'string' || !['PASS', 'FAIL', 'UNKNOWN'].includes(manifest.protocolStatus)) {
    errors.push('protocolStatus:invalid');
  }
  const protocol = validateManifestProtocol(manifest);
  if (!protocol.valid) errors.push('protocolStatus:inconsistent');
  for (const finding of scanPrivacyPatterns(manifest)) errors.push(`privacy:${finding.path}:${finding.patternId}`);
  return { valid: errors.length === 0, errors, protocol };
}
