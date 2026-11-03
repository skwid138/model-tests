import { isDeepStrictEqual } from 'node:util';

import { combineEvidenceReviews } from './verifier.mjs';

const KNOWN_PROVENANCE = new Set(['declared', 'observed', 'operator_reported']);

export function validateEvidenceReviewRecord(record) {
  if (
    record === null
    || typeof record !== 'object'
    || Array.isArray(record)
    || typeof record.questionId !== 'string'
    || typeof record.factId !== 'string'
  ) {
    return { valid: false, expectedStatus: 'UNRESOLVED', reasonCodes: ['review_record_invalid'] };
  }

  if (
    Array.isArray(record.reasonCodes)
    && record.reasonCodes.length === 1
    && record.reasonCodes[0] === 'review_input_invalid'
  ) {
    const decisionsAreSafe = [record.reviewerA, record.reviewerB].every((decision, index) => {
      const expectedLabel = index === 0 ? 'A' : 'B';
      if (
        decision?.reviewerLabel !== expectedLabel
        || ![null, true, false].includes(decision.citationsEntailClaim)
        || ![null, true, false].includes(decision.branchCoverageComplete)
      ) return false;
      const derivedDecision = typeof decision.citationsEntailClaim === 'boolean'
        && typeof decision.branchCoverageComplete === 'boolean'
        ? decision.citationsEntailClaim && decision.branchCoverageComplete ? 'SUPPORTED' : 'UNSUPPORTED'
        : 'UNRESOLVED';
      return decision.decision === derivedDecision || decision.decision === 'UNRESOLVED';
    });
    const valid = record.rubricVersion === 1
      && record.status === 'UNRESOLVED'
      && record.requiresAdjudication === true
      && decisionsAreSafe;
    return {
      valid,
      expectedStatus: 'UNRESOLVED',
      reasonCodes: ['review_input_invalid'],
    };
  }

  const suppliedDecisions = [record.reviewerA, record.reviewerB];
  const inputReviews = suppliedDecisions.flatMap((decision, index) => (
    decision
    && (typeof decision.citationsEntailClaim === 'boolean'
      || typeof decision.branchCoverageComplete === 'boolean')
      ? [{
        reviewerLabel: index === 0 ? 'A' : 'B',
        citationsEntailClaim: decision.citationsEntailClaim,
        branchCoverageComplete: decision.branchCoverageComplete,
      }]
      : []
  ));
  const combined = combineEvidenceReviews(inputReviews);
  const expected = {
    questionId: record.questionId,
    factId: record.factId,
    ...combined,
  };
  return {
    valid: isDeepStrictEqual(record, expected),
    expectedStatus: combined.status,
    reasonCodes: combined.reasonCodes,
  };
}

function traceEvidence(manifest) {
  const toolCalls = manifest?.toolCalls;
  const reasons = [];
  if (toolCalls?.traceStatus !== 'available') reasons.push('trace_unavailable');
  if (toolCalls?.coverage !== 'complete') reasons.push('trace_coverage_incomplete');
  if (!Array.isArray(toolCalls?.coverageRefs) || toolCalls.coverageRefs.length === 0) {
    reasons.push('trace_coverage_reference_missing');
  }
  const traceSource = toolCalls?.traceSource;
  if (
    typeof traceSource?.value !== 'string'
    || traceSource.value.trim() === ''
    || !KNOWN_PROVENANCE.has(traceSource.provenance)
  ) {
    reasons.push('trace_source_unknown');
  }
  return { complete: reasons.length === 0, reasons };
}

export function expectedProtocolStatus(manifest) {
  if (manifest?.instructions?.status === 'FAIL') {
    return { status: 'FAIL', reasonCodes: ['instruction_violation_observed'] };
  }
  if (manifest?.instructions?.status !== 'PASS') {
    return { status: 'UNKNOWN', reasonCodes: ['instruction_status_unknown'] };
  }

  const trace = traceEvidence(manifest);
  if (!trace.complete) return { status: 'UNKNOWN', reasonCodes: trace.reasons };
  return { status: 'PASS', reasonCodes: [] };
}

// This validates only protocol-status consistency, not the complete JSON Schema
// or the authenticity of referenced trace artifacts.
export function validateManifestProtocol(manifest) {
  const expected = expectedProtocolStatus(manifest);
  return {
    valid: manifest?.protocolStatus === expected.status,
    expectedStatus: expected.status,
    reasonCodes: expected.reasonCodes,
  };
}
