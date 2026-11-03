import { isDeepStrictEqual } from 'node:util';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { readFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';

function invalid(reason) {
  return { status: 'invalid', reason };
}

function lineRecords(text) {
  const records = [];
  let start = 0;
  while (start < text.length) {
    const newline = text.indexOf('\n', start);
    const end = newline === -1 ? text.length : newline + 1;
    records.push({
      start,
      end,
      text: text.slice(start, newline === -1 ? end : newline).replace(/\r$/, ''),
    });
    start = end;
  }
  return records;
}

function labelledFence(text, answerStart, answerEnd) {
  const lines = lineRecords(text);
  const blocks = [];
  let open = null;

  for (const line of lines) {
    const fenceMatch = line.text.match(/^( {0,3})(`{3,}|~{3,})(.*)$/);
    const fence = fenceMatch
      ? { char: fenceMatch[2][0], length: fenceMatch[2].length, info: fenceMatch[3] }
      : null;
    const labelLike = /^`{3,}[ \t]*discovery-facts(?:\b|$)/i.test(line.text);
    const labelAttempt = fence !== null && /\bdiscovery-facts\b/i.test(fence.info);
    if (line.text.includes('```discovery-facts') && !labelLike) {
      return { error: 'malformed_labelled_fence' };
    }
    if (labelAttempt && !labelLike) return { error: 'malformed_labelled_fence' };

    if (open === null) {
      if (!fence) continue;
      const inAnswer = line.start >= answerStart && line.start < answerEnd;
      if (labelLike) {
        if (line.text !== '```discovery-facts') return { error: 'malformed_labelled_fence' };
        open = { kind: 'labelled', char: '`', length: 3, inAnswer, bodyStart: line.end };
      } else {
        open = { kind: 'other', char: fence.char, length: fence.length, inAnswer };
      }
      continue;
    }

    if (labelLike) return { error: 'nested_labelled_fence' };
    if (
      open.kind === 'other'
      && fence
      && fence.char === open.char
      && fence.length >= open.length
      && fence.info.trim() === ''
    ) {
      open = null;
      continue;
    }
    if (open.kind === 'labelled' && line.text === '```') {
      blocks.push({
        inAnswer: open.inAnswer,
        body: text.slice(open.bodyStart, line.start).replace(/\n$/, ''),
      });
      open = null;
      continue;
    }
    if (
      open.kind === 'labelled'
      && fence
      && fence.char === open.char
      && fence.length >= open.length
      && fence.info.trim() === ''
    ) return { error: 'malformed_labelled_fence' };
  }

  if (open?.kind === 'labelled') return { error: 'unclosed_labelled_fence' };
  return { blocks };
}

function rejectDuplicateObjectKeys(text) {
  const stack = [];
  let index = 0;

  while (index < text.length) {
    const character = text[index];
    if (character === '"') {
      const start = index++;
      while (index < text.length) {
        if (text[index] === '\\') {
          index += 2;
        } else if (text[index++] === '"') {
          break;
        }
      }
      const token = text.slice(start, index);
      let next = index;
      while (/\s/.test(text[next] ?? '')) next += 1;
      if (text[next] === ':' && stack.at(-1)?.kind === 'object') {
        let key;
        try {
          key = JSON.parse(token);
        } catch {
          continue;
        }
        const keys = stack.at(-1).keys;
        if (keys.has(key)) return true;
        keys.add(key);
      }
      continue;
    }

    if (character === '{') stack.push({ kind: 'object', keys: new Set() });
    else if (character === '[') stack.push({ kind: 'array' });
    else if (character === '}' || character === ']') stack.pop();
    index += 1;
  }
  return false;
}

function resultsEnvelope(response) {
  const analysisOpen = [...response.matchAll(/<analysis>/g)];
  const analysisClose = [...response.matchAll(/<\/analysis>/g)];
  const resultsOpen = [...response.matchAll(/<results>/g)];
  const resultsClose = [...response.matchAll(/<\/results>/g)];
  const filesOpen = [...response.matchAll(/<files>/g)];
  const filesClose = [...response.matchAll(/<\/files>/g)];
  const answerOpen = [...response.matchAll(/<answer>/g)];
  const answerClose = [...response.matchAll(/<\/answer>/g)];
  const nextOpen = [...response.matchAll(/<next_steps>/g)];
  const nextClose = [...response.matchAll(/<\/next_steps>/g)];
  if (
    analysisOpen.length !== analysisClose.length
    || analysisOpen.length > 1
    || resultsOpen.length !== 1
    || resultsClose.length !== 1
    || filesOpen.length !== 1
    || filesClose.length !== 1
    || answerOpen.length !== 1
    || answerClose.length !== 1
    || nextOpen.length !== 1
    || nextClose.length !== 1
    || resultsOpen[0].index > resultsClose[0].index
    || (analysisOpen.length === 1 && (
      analysisOpen[0].index > analysisClose[0].index
      || resultsOpen[0].index < analysisClose[0].index + '</analysis>'.length
    ))
    || response.slice(0, analysisOpen.length === 1 ? analysisOpen[0].index : resultsOpen[0].index).trim() !== ''
    || (analysisOpen.length === 1
      && response.slice(analysisClose[0].index + '</analysis>'.length, resultsOpen[0].index).trim() !== '')
    || filesOpen[0].index < resultsOpen[0].index
    || filesClose[0].index < filesOpen[0].index
    || answerOpen[0].index < filesClose[0].index
    || answerClose[0].index < answerOpen[0].index
    || nextOpen[0].index < answerClose[0].index
    || nextClose[0].index < nextOpen[0].index
    || resultsClose[0].index < nextClose[0].index
    || response.slice(resultsClose[0].index + '</results>'.length).trim() !== ''
  ) {
    return null;
  }
  return {
    resultsStart: resultsOpen[0].index,
    resultsEnd: resultsClose[0].index + '</results>'.length,
    answerStart: answerOpen[0].index + '<answer>'.length,
    answerEnd: answerClose[0].index,
  };
}

export function extractResultsText(response) {
  if (typeof response !== 'string') return invalid('invalid_input');
  const envelope = resultsEnvelope(response);
  if (!envelope) return invalid('invalid_results_envelope');
  return { status: 'valid', resultsText: response.slice(envelope.resultsStart, envelope.resultsEnd) };
}

export function extractTypedFacts(response, caseId) {
  if (typeof response !== 'string' || !['trace', 'boundary'].includes(caseId)) {
    return invalid('invalid_input');
  }
  const envelope = resultsEnvelope(response);
  if (!envelope) return invalid('invalid_results_envelope');

  const fences = labelledFence(response, envelope.answerStart, envelope.answerEnd);
  if (fences.error) return invalid(fences.error);
  if (fences.blocks.some((block) => !block.inAnswer)) return invalid('labelled_fence_outside_answer');
  if (fences.blocks.length === 0) return { status: 'missing' };
  if (fences.blocks.length !== 1) return invalid('duplicate_labelled_fences');

  const json = fences.blocks[0].body;
  if (rejectDuplicateObjectKeys(json)) return invalid('duplicate_json_key');
  try {
    return { status: 'valid', facts: JSON.parse(json) };
  } catch {
    return invalid('malformed_json');
  }
}

export function parseJsonWithoutDuplicateKeys(text) {
  if (typeof text !== 'string' || rejectDuplicateObjectKeys(text)) {
    return { status: 'invalid', reason: 'duplicate_json_key_or_invalid_input' };
  }
  try {
    return { status: 'valid', value: JSON.parse(text) };
  } catch {
    return { status: 'invalid', reason: 'malformed_json' };
  }
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getOwnPath(root, path) {
  let value = root;
  for (const part of path) {
    if (!isRecord(value) && !Array.isArray(value)) return { present: false };
    if (!Object.hasOwn(value, part)) return { present: false };
    value = value[part];
  }
  return { present: true, value };
}

function templateShape(value, template) {
  if (template === null) return value === null ? 'valid' : 'invalid';
  if (Array.isArray(template)) {
    if (!Array.isArray(value)) return 'invalid';
    if (template.length === 0) return 'valid';
    const statuses = value.map((item) => templateShape(item, template[0]));
    if (statuses.includes('invalid')) return 'invalid';
    return statuses.includes('missing') ? 'missing' : 'valid';
  }
  if (isRecord(template)) {
    if (!isRecord(value)) return 'invalid';
    const templateKeys = Object.keys(template);
    if (Object.keys(value).some((key) => !Object.hasOwn(template, key))) return 'invalid';
    const statuses = templateKeys.map((key) => (
      Object.hasOwn(value, key) ? templateShape(value[key], template[key]) : 'missing'
    ));
    if (statuses.includes('invalid')) return 'invalid';
    return statuses.includes('missing') ? 'missing' : 'valid';
  }
  if (typeof template === 'number') {
    return typeof value === 'number'
      && Number.isFinite(value)
      && (Number.isInteger(template) ? Number.isInteger(value) : true)
      ? 'valid'
      : 'invalid';
  }
  return typeof value === typeof template ? 'valid' : 'invalid';
}

function matchesShape(value, shape) {
  if (!isRecord(shape) || typeof shape.$type !== 'string') return templateShape(value, shape);
  if (shape.$type === 'union') {
    const statuses = shape.anyOf.map((part) => matchesShape(value, part));
    return statuses.includes('valid') ? 'valid' : statuses.includes('missing') ? 'missing' : 'invalid';
  }
  if (shape.$type === 'enum') {
    return shape.values.some((part) => isDeepStrictEqual(value, part)) ? 'valid' : 'invalid';
  }
  if (shape.$type === 'object') {
    if (!isRecord(value)) return 'invalid';
    if (Object.keys(value).some((key) => !Object.hasOwn(shape.properties, key))) return 'invalid';
    const statuses = Object.entries(shape.properties).map(([key, child]) => (
      Object.hasOwn(value, key) ? matchesShape(value[key], child) : 'missing'
    ));
    if (statuses.includes('invalid')) return 'invalid';
    return statuses.includes('missing') ? 'missing' : 'valid';
  }
  if (shape.$type === 'array') {
    if (!Array.isArray(value)) return 'invalid';
    const statuses = value.map((item) => matchesShape(item, shape.items));
    if (statuses.includes('invalid')) return 'invalid';
    return statuses.includes('missing') ? 'missing' : 'valid';
  }
  if (shape.$type === 'integer') return Number.isSafeInteger(value) ? 'valid' : 'invalid';
  if (shape.$type === 'number') return typeof value === 'number' && Number.isFinite(value) ? 'valid' : 'invalid';
  if (shape.$type === 'null') return value === null ? 'valid' : 'invalid';
  if (shape.$type === 'boolean') return typeof value === 'boolean' ? 'valid' : 'invalid';
  if (shape.$type === 'string') return typeof value === 'string' ? 'valid' : 'invalid';
  return 'invalid';
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function matchesExpected(actual, fact) {
  const expectedValues = Array.isArray(fact.accepted) ? fact.accepted : [fact.expected];
  if (fact.match === 'unordered') {
    const actualCanonical = Array.isArray(actual) ? actual.map(canonicalJson).sort() : [];
    return expectedValues.some((expected) => (
      Array.isArray(actual)
      && actualCanonical.length === expected.length
      && isDeepStrictEqual(actualCanonical, expected.map(canonicalJson).sort())
    ));
  }
  return expectedValues.some((expected) => isDeepStrictEqual(actual, expected));
}

function classifyFact(typedFragment, fact) {
  if (typedFragment?.status === 'missing') return 'missing';
  if (typedFragment?.status === 'invalid') return 'invalid';
  if (typedFragment?.status !== 'valid') return 'invalid';
  if (!isRecord(typedFragment.facts)) return 'invalid';
  const questionValue = getOwnPath(typedFragment.facts, [fact.path[0]]);
  if (!questionValue.present) return 'missing';
  if (!isRecord(questionValue.value)) return 'invalid';
  const located = getOwnPath(typedFragment.facts, fact.path);
  if (!located.present) return 'missing';
  const shape = fact.shape ?? fact.expected ?? fact.accepted?.[0];
  const shapeStatus = matchesShape(located.value, shape);
  if (shapeStatus !== 'valid') return shapeStatus;
  if (!matchesExpected(located.value, fact)) return 'incorrect';
  return fact.acceptedOutcome === 'abstention' ? 'abstention' : 'correct';
}

function typedShapeIssues(answerKey, typedFragment) {
  if (typedFragment?.status !== 'valid') return [];
  if (!isRecord(typedFragment.facts)) return [{ path: '$', reason: 'root_must_be_object' }];
  const knownQuestionIds = new Set(answerKey.questions.map(({ id }) => id));
  const issues = Object.keys(typedFragment.facts)
    .filter((questionId) => !knownQuestionIds.has(questionId))
    .map((questionId) => ({ path: questionId, reason: 'unknown_question' }));
  for (const question of answerKey.questions) {
    if (!Object.hasOwn(typedFragment.facts, question.id)) continue;
    const value = typedFragment.facts[question.id];
    if (!isRecord(value)) {
      issues.push({ path: question.id, reason: 'question_must_be_object' });
      continue;
    }
    const knownFields = new Set(question.facts.map((fact) => fact.path[1]));
    for (const field of Object.keys(value)) {
      if (!knownFields.has(field)) issues.push({ path: `${question.id}.${field}`, reason: 'unknown_typed_field' });
    }
  }
  return issues;
}

function safeCitationPath(value, trialRoot) {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.includes('\\')
    || value.includes('\0')
    || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)
    || /^[A-Za-z]:/.test(value)
    || value.split('/').includes('..')
  ) return { status: 'invalid_path' };

  const root = resolve(trialRoot);
  const candidate = isAbsolute(value) ? resolve(value) : resolve(root, value);
  const fromRoot = relative(root, candidate);
  if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot) || fromRoot === '') {
    return { status: 'outside_root' };
  }
  const resolved = resolveInsideRoot(root, candidate);
  if (resolved.status !== 'inside_root') return { status: resolved.status };
  return { status: 'inside_root', path: fromRoot.split(sep).join('/') };
}

function resolveInsideRoot(trialRoot, candidate) {
  try {
    const rootRealPath = realpathSync(resolve(trialRoot));
    const candidateRealPath = realpathSync(candidate);
    const fromRoot = relative(rootRealPath, candidateRealPath);
    if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot) || fromRoot === '') {
      return { status: 'outside_root' };
    }
    return { status: 'inside_root', realPath: candidateRealPath };
  } catch {
    return { status: 'missing_file' };
  }
}

function lineCount(trialRoot, path) {
  try {
    const resolved = resolveInsideRoot(trialRoot, resolve(trialRoot, path));
    if (resolved.status !== 'inside_root') return null;
    const text = readFileSync(resolved.realPath, 'utf8');
    return text.length === 0 ? 0 : text.split(/\r?\n/).length - (text.endsWith('\n') || text.endsWith('\r\n') ? 1 : 0);
  } catch {
    return null;
  }
}

function validateCitation(citation, trialRoot, allowlist) {
  if (!isRecord(citation)) return { status: 'invalid_citation' };
  const statedRange = {
    ...(Object.hasOwn(citation, 'startLine') ? { startLine: citation.startLine } : {}),
    ...(Object.hasOwn(citation, 'endLine') ? { endLine: citation.endLine } : {}),
  };
  const path = safeCitationPath(citation.path, trialRoot);
  if (path.status !== 'inside_root') return { ...statedRange, status: path.status };
  if (!allowlist.has(path.path)) return { ...statedRange, status: 'outside_allowlist', path: path.path };
  if (
    !Number.isSafeInteger(citation.startLine)
    || !Number.isSafeInteger(citation.endLine)
    || citation.startLine < 1
    || citation.endLine < citation.startLine
  ) return { ...statedRange, status: 'invalid_line_range', path: path.path };
  const count = lineCount(trialRoot, path.path);
  if (count === null || citation.endLine > count) {
    return { ...statedRange, status: 'out_of_bounds', path: path.path, lineCount: count };
  }
  return {
    status: 'valid',
    path: path.path,
    startLine: citation.startLine,
    endLine: citation.endLine,
  };
}

function citationCoverage(citations, fact, trialRoot, allowlist) {
  const results = citations.map((citation) => validateCitation(citation, trialRoot, allowlist));
  const valid = results.filter((result) => result.status === 'valid');
  const status = citations.length === 0
    ? 'missing'
    : results.every((result) => result.status === 'valid')
      ? 'valid'
      : 'invalid';
  const spans = (fact.evidence ?? []).map((span, spanIndex) => ({
    spanIndex,
    path: span.path,
    startLine: span.startLine,
    endLine: span.endLine,
    overlaps: valid.some((citation) => (
      citation.path === span.path
      && citation.startLine <= span.endLine
      && citation.endLine >= span.startLine
    )),
  }));
  return { status, citations: results, canonicalSpanCoverage: spans };
}

function normalizedReview(reviewerLabel, review) {
  const valid = isRecord(review)
    && Object.keys(review).every((key) => ['reviewerLabel', 'citationsEntailClaim', 'branchCoverageComplete'].includes(key))
    && typeof review.citationsEntailClaim === 'boolean'
    && typeof review.branchCoverageComplete === 'boolean';
  return {
    reviewerLabel,
    citationsEntailClaim: valid ? review.citationsEntailClaim : null,
    branchCoverageComplete: valid ? review.branchCoverageComplete : null,
    decision: valid
      ? review.citationsEntailClaim && review.branchCoverageComplete ? 'SUPPORTED' : 'UNSUPPORTED'
      : 'UNRESOLVED',
  };
}

export function combineEvidenceReviews(reviews = []) {
  const supplied = Array.isArray(reviews) ? reviews : [];
  const byLabel = new Map();
  let invalidInput = !Array.isArray(reviews) || supplied.length > 2;
  for (const review of supplied) {
    if (!isRecord(review) || !['A', 'B'].includes(review.reviewerLabel) || byLabel.has(review.reviewerLabel)) {
      invalidInput = true;
      continue;
    }
    byLabel.set(review.reviewerLabel, review);
  }
  const reviewerA = normalizedReview('A', byLabel.get('A'));
  const reviewerB = normalizedReview('B', byLabel.get('B'));
  const checklistAgrees = reviewerA.citationsEntailClaim === reviewerB.citationsEntailClaim
    && reviewerA.branchCoverageComplete === reviewerB.branchCoverageComplete;
  const validBoth = reviewerA.decision !== 'UNRESOLVED' && reviewerB.decision !== 'UNRESOLVED';
  const status = invalidInput || !validBoth || !checklistAgrees
    ? 'UNRESOLVED'
    : reviewerA.decision;
  const reasonCodes = invalidInput
    ? ['review_input_invalid']
    : !validBoth
      ? ['review_missing_or_invalid']
      : !checklistAgrees
        ? ['reviewer_disagreement']
        : [];
  return {
    rubricVersion: 2,
    status,
    requiresAdjudication: status === 'UNRESOLVED',
    reasonCodes,
    reviewerA,
    reviewerB,
  };
}

export function validateEvidenceReviewRecord(record) {
  if (!isRecord(record) || typeof record.questionId !== 'string' || typeof record.factId !== 'string') {
    return { valid: false, expectedStatus: 'UNRESOLVED', reasonCodes: ['review_record_invalid'] };
  }
  const reviews = ['A', 'B'].flatMap((label) => {
    const reviewer = record[`reviewer${label}`];
    return isRecord(reviewer)
      ? [{ reviewerLabel: label, ...Object.fromEntries(Object.entries(reviewer).filter(([key]) => key !== 'reviewerLabel' && key !== 'decision')) }]
      : [];
  });
  const expected = { questionId: record.questionId, factId: record.factId, ...combineEvidenceReviews(reviews) };
  return {
    valid: isDeepStrictEqual(record, expected),
    expectedStatus: expected.status,
    reasonCodes: expected.reasonCodes,
  };
}

function claimReviewerDecision(review) {
  const allowedDispositions = ['supported', 'unsupported_established', 'contradicted', 'not_reviewed'];
  if (
    !isRecord(review)
    || Object.keys(review).some((key) => !['claimAtomic', 'sourceScopeComplete', 'reviewCompleted', 'evidenceDisposition'].includes(key))
    || typeof review.claimAtomic !== 'boolean'
    || typeof review.sourceScopeComplete !== 'boolean'
    || typeof review.reviewCompleted !== 'boolean'
    || !allowedDispositions.includes(review.evidenceDisposition)
  ) return 'UNRESOLVED';
  if (!review.claimAtomic || !review.sourceScopeComplete || !review.reviewCompleted) return 'UNRESOLVED';
  if (review.evidenceDisposition === 'supported') return 'SUPPORTED';
  if (['unsupported_established', 'contradicted'].includes(review.evidenceDisposition)) return 'UNSUPPORTED';
  return 'UNRESOLVED';
}

export function combineClaimReviews(reviewA, reviewB) {
  const decisionA = claimReviewerDecision(reviewA);
  const decisionB = claimReviewerDecision(reviewB);
  const sameEvidenceDisposition = reviewA?.evidenceDisposition === reviewB?.evidenceDisposition;
  const status = decisionA === decisionB
    && decisionA !== 'UNRESOLVED'
    && sameEvidenceDisposition
    ? decisionA
    : 'UNRESOLVED';
  return {
    status,
    requiresAdjudication: status === 'UNRESOLVED',
    reviewerA: { ...reviewA, decision: decisionA },
    reviewerB: { ...reviewB, decision: decisionB },
  };
}

function validateAnswerKey(answerKey) {
  if (
    !isRecord(answerKey)
    || answerKey.schemaVersion !== 2
    || !['trace', 'boundary'].includes(answerKey.caseId)
    || !Array.isArray(answerKey.questions)
  ) throw new TypeError('Invalid discovery-v2 answer key');
  const questions = new Set();
  for (const question of answerKey.questions) {
    if (!isRecord(question) || typeof question.id !== 'string' || !Array.isArray(question.facts) || questions.has(question.id)) {
      throw new TypeError('Invalid or duplicate discovery-v2 question');
    }
    questions.add(question.id);
    const facts = new Set();
    for (const fact of question.facts) {
      if (
        !isRecord(fact)
        || typeof fact.id !== 'string'
        || !Array.isArray(fact.path)
        || !Array.isArray(fact.evidence)
        || facts.has(fact.id)
      ) throw new TypeError('Invalid or duplicate discovery-v2 fact');
      facts.add(fact.id);
    }
  }
}

export function validateNormalizedSubmission(answerKey, submission) {
  const errors = [];
  if (!isRecord(submission) || submission.schemaVersion !== 2 || submission.caseId !== answerKey?.caseId) {
    return { valid: false, errors: ['submission_identity_invalid'] };
  }
  if (submission.taskVersion !== 2 || submission.sourceVersion !== 2 || typeof submission.resultsText !== 'string') {
    errors.push('submission_version_or_results_invalid');
  } else {
    const publicResults = extractResultsText(submission.resultsText);
    if (publicResults.status !== 'valid' || publicResults.resultsText !== submission.resultsText) {
      errors.push('public_results_envelope_invalid');
    }
  }
  const fragment = submission.typedFragment;
  if (!isRecord(fragment) || !['valid', 'missing', 'invalid'].includes(fragment.status)) {
    errors.push('typed_fragment_status_invalid');
  } else if (fragment.status === 'valid') {
    if (!Object.hasOwn(fragment, 'facts')) errors.push('typed_fragment_facts_missing');
  } else if (fragment.status === 'invalid' && (typeof fragment.reason !== 'string' || fragment.reason.length === 0)) {
    errors.push('typed_fragment_reason_missing');
  } else if (Object.hasOwn(fragment, 'facts')) {
    errors.push('nonvalid_fragment_must_not_include_facts');
  }

  const questions = new Map((answerKey.questions ?? []).map((question) => [question.id, question]));
  if (!isRecord(submission.answers)) errors.push('answers_invalid');
  else {
    for (const questionId of questions.keys()) {
      if (!Object.hasOwn(submission.answers, questionId)) errors.push(`answer_missing:${questionId}`);
    }
    for (const [questionId, answer] of Object.entries(submission.answers)) {
      const question = questions.get(questionId);
      if (!question || !isRecord(answer) || typeof answer.prose !== 'string' || !Array.isArray(answer.citations) || !Array.isArray(answer.additionalClaims)) {
        errors.push(`answer_invalid:${questionId}`);
        continue;
      }
      const factIds = new Set(question.facts.map(({ id }) => id));
      for (const citation of answer.citations) {
        if (!isRecord(citation) || typeof citation.factId !== 'string' || !factIds.has(citation.factId)) {
          errors.push(`fact_citation_reference_invalid:${questionId}`);
        }
      }
      const claimIds = new Set();
      for (const claim of answer.additionalClaims) {
        if (
          !isRecord(claim)
          || typeof claim.id !== 'string'
          || !new RegExp(`^${questionId}-C[0-9]{2,}$`).test(claim.id)
          || typeof claim.text !== 'string'
          || claim.text.length === 0
          || !Array.isArray(claim.citations)
          || claimIds.has(claim.id)
        ) {
          errors.push(`additional_claim_invalid:${questionId}`);
          continue;
        }
        claimIds.add(claim.id);
      }
    }
  }
  if (!Array.isArray(submission.evidenceReviews)) errors.push('evidence_reviews_invalid');
  else {
    const seen = new Set();
    for (const review of submission.evidenceReviews) {
      const question = questions.get(review?.questionId);
      if (!question || !question.facts.some(({ id }) => id === review.factId)) {
        errors.push('evidence_review_reference_invalid');
        continue;
      }
      const key = `${review.questionId}\0${review.factId}`;
      if (seen.has(key)) errors.push('evidence_review_duplicate');
      seen.add(key);
    }
  }
  if (!Array.isArray(submission.claimReviews)) errors.push('claim_reviews_invalid');
  else {
    const claims = new Set();
    for (const [questionId, answer] of Object.entries(submission.answers ?? {})) {
      for (const claim of answer?.additionalClaims ?? []) claims.add(`${questionId}\0${claim.id}`);
    }
    const seen = new Set();
    for (const review of submission.claimReviews) {
      const key = `${review?.questionId}\0${review?.claimId}`;
      if (!claims.has(key)) errors.push('claim_review_reference_invalid');
      if (seen.has(key)) errors.push('claim_review_duplicate');
      seen.add(key);
    }
  }
  return { valid: errors.length === 0, errors };
}

function findReviews(records, questionId, factId) {
  const record = records.find((item) => item.questionId === questionId && item.factId === factId);
  if (!record) return [];
  return ['A', 'B'].flatMap((label) => {
    const value = record[`reviewer${label}`];
    return value === undefined ? [] : [{ reviewerLabel: label, ...value }];
  });
}

function citationListFor(answer, factId) {
  if (!isRecord(answer) || !Array.isArray(answer.citations)) return [];
  return answer.citations.filter((citation) => citation?.factId === factId);
}

export function gradeSubmission(answerKey, submission, { trialRoot, protocolStatus = 'UNKNOWN' } = {}) {
  validateAnswerKey(answerKey);
  const submissionValidation = validateNormalizedSubmission(answerKey, submission);
  if (!submissionValidation.valid) throw new TypeError(`Invalid normalized submission: ${submissionValidation.errors.join(', ')}`);
  if (
    !isRecord(submission)
    || submission.schemaVersion !== 2
    || submission.caseId !== answerKey.caseId
    || !isRecord(submission.typedFragment)
    || !['valid', 'missing', 'invalid'].includes(submission.typedFragment.status)
    || !isRecord(submission.answers)
    || typeof submission.resultsText !== 'string'
  ) throw new TypeError('Invalid discovery-v2 normalized submission');
  if (typeof trialRoot !== 'string' || trialRoot.length === 0) throw new TypeError('An explicit trialRoot is required');
  if (!['PASS', 'FAIL', 'UNKNOWN'].includes(protocolStatus)) throw new TypeError('Invalid protocol status');

  const allowlist = new Set(Object.keys(answerKey.sourceFilesSha256 ?? {}));
  allowlist.add(answerKey.taskPath);
  const items = [];
  const allClaims = [];
  const shapeIssues = typedShapeIssues(answerKey, submission.typedFragment);
  let correct = 0;
  let abstentions = 0;
  let denominator = 0;
  let missing = 0;
  let invalidCount = 0;
  let incorrect = 0;
  for (const question of answerKey.questions) {
    const answer = submission.answers[question.id];
    if (answer !== undefined && (!isRecord(answer) || !Array.isArray(answer.citations) || !Array.isArray(answer.additionalClaims))) {
      throw new TypeError(`Invalid normalized answer for ${question.id}`);
    }
    const facts = question.facts.map((fact) => {
      const outcome = classifyFact(submission.typedFragment, fact);
      const coverage = citationCoverage(citationListFor(answer, fact.id), fact, trialRoot, allowlist);
      const evidenceReview = {
        questionId: question.id,
        factId: fact.id,
        ...combineEvidenceReviews(findReviews(submission.evidenceReviews ?? [], question.id, fact.id)),
      };
      if (outcome === 'correct') correct += 1;
      else if (outcome === 'abstention') abstentions += 1;
      else if (outcome === 'missing') missing += 1;
      else if (outcome === 'invalid') invalidCount += 1;
      else incorrect += 1;
      denominator += 1;
      return { id: fact.id, outcome, citation: coverage, evidenceReview };
    });

    for (const claim of answer?.additionalClaims ?? []) {
      if (!isRecord(claim) || typeof claim.id !== 'string' || typeof claim.text !== 'string' || !Array.isArray(claim.citations)) {
        throw new TypeError(`Invalid additional claim in ${question.id}`);
      }
      const reviews = (submission.claimReviews ?? []).find((record) => (
        record.questionId === question.id && record.claimId === claim.id
      ));
      const review = reviews
        ? combineClaimReviews(reviews.reviewerA, reviews.reviewerB)
        : combineClaimReviews(undefined, undefined);
      const citations = claim.citations.map((citation) => validateCitation(citation, trialRoot, allowlist));
      allClaims.push({
        questionId: question.id,
        id: claim.id,
        text: claim.text,
        citations,
        review,
      });
    }
    items.push({ questionId: question.id, tier: question.tier, facts });
  }
  const unsupportedClaims = allClaims.filter(({ review }) => review.status === 'UNSUPPORTED').length;
  const unresolvedClaims = allClaims.filter(({ review }) => review.status === 'UNRESOLVED').length;
  return {
    schemaVersion: 2,
    caseId: answerKey.caseId,
    protocolStatus,
    formatStatus: submission.typedFragment.status,
    typedShapeIssues: shapeIssues,
    totals: {
      correct,
      abstentions,
      denominator,
      missing,
      invalid: invalidCount,
      incorrect,
      unsupportedClaims,
      unresolvedClaims,
    },
    items,
    additionalClaims: allClaims,
  };
}

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

function digest(text) {
  return createHash('sha256').update(text).digest('hex');
}

export function verifyFrozenSnapshot(answerKey, trialRoot) {
  const errors = [];
  const expectedTask = `fixtures/discovery-v2/tasks/${answerKey?.caseId === 'trace' ? 'trace' : 'boundaries'}.md`;
  const expectedAnswerKey = `grading/discovery-v2/answer-keys/${answerKey?.caseId === 'trace' ? 'trace' : 'boundary'}.json`;
  if (answerKey?.schemaVersion !== 2 || answerKey?.sourceVersion !== 2 || answerKey?.taskVersion !== 2) {
    errors.push('version_mismatch');
  }
  if (answerKey?.taskPath !== expectedTask) errors.push('task_path_mismatch');
  const sourceHashes = answerKey?.sourceFilesSha256;
  if (
    !isRecord(sourceHashes)
    || !isDeepStrictEqual(Object.keys(sourceHashes).sort(), [...V2_SOURCE_PATHS].sort())
  ) {
    errors.push('source_allowlist_mismatch');
  }

  const files = isRecord(sourceHashes) ? Object.entries(sourceHashes) : [];
  const actualSourceHashes = {};
  for (const [path, expectedHash] of files) {
    if (!/^[a-f0-9]{64}$/.test(expectedHash)) {
      errors.push(`invalid_source_hash:${path}`);
      continue;
    }
    try {
      const sourceFile = resolveInsideRoot(trialRoot, resolve(trialRoot, path));
      if (sourceFile.status !== 'inside_root') {
        errors.push(`${sourceFile.status === 'outside_root' ? 'source_outside_root' : 'source_missing'}:${path}`);
        continue;
      }
      const actual = digest(readFileSync(sourceFile.realPath));
      actualSourceHashes[path] = actual;
      if (actual !== expectedHash) errors.push(`source_hash_mismatch:${path}`);
    } catch {
      errors.push(`source_missing:${path}`);
    }
  }

  let actualTaskSha256 = null;
  let taskText = null;
  try {
    const taskFile = resolveInsideRoot(trialRoot, resolve(trialRoot, answerKey.taskPath));
    if (taskFile.status !== 'inside_root') {
      errors.push(taskFile.status === 'outside_root' ? 'task_outside_root' : 'task_missing');
    } else {
      taskText = readFileSync(taskFile.realPath, 'utf8');
      actualTaskSha256 = digest(taskText);
      if (actualTaskSha256 !== answerKey.taskSha256) errors.push('task_hash_mismatch');
      const listedPaths = [...taskText.matchAll(/^- `(fixtures\/discovery-v2\/src\/[^`]+)`$/gm)].map((match) => match[1]);
      if (!isDeepStrictEqual([...listedPaths].sort(), [...V2_SOURCE_PATHS].sort())) errors.push('task_allowlist_mismatch');
    }
  } catch {
    errors.push('task_missing');
  }

  if (taskText !== null) {
    for (const question of answerKey.questions ?? []) {
      for (const fact of question.facts ?? []) {
        for (const span of fact.evidence ?? []) {
          const count = lineCount(trialRoot, span.path);
          if (
            !Number.isSafeInteger(span.startLine)
            || !Number.isSafeInteger(span.endLine)
            || span.startLine < 1
            || span.endLine < span.startLine
            || count === null
            || span.endLine > count
            || (!Object.hasOwn(sourceHashes ?? {}, span.path) && span.path !== answerKey.taskPath)
          ) errors.push(`invalid_evidence_span:${question.id}:${fact.id}`);
        }
      }
    }
  }

  let actualAnswerKeySha256 = null;
  let authoritativeAnswerKeySha256 = null;
  try {
    const authoritativeKeyBytes = readFileSync(new URL(`./answer-keys/${answerKey?.caseId === 'trace' ? 'trace' : 'boundary'}.json`, import.meta.url));
    authoritativeAnswerKeySha256 = digest(authoritativeKeyBytes);
    const authoritativeKey = parseJsonWithoutDuplicateKeys(authoritativeKeyBytes.toString('utf8'));
    if (authoritativeKey.status !== 'valid' || !isDeepStrictEqual(authoritativeKey.value, answerKey)) {
      errors.push('coordinator_answer_key_mismatch');
    }
  } catch {
    errors.push('coordinator_answer_key_missing');
  }
  const keyFile = resolveInsideRoot(trialRoot, resolve(trialRoot, expectedAnswerKey));
  if (keyFile.status !== 'inside_root') {
    errors.push(keyFile.status === 'outside_root' ? 'answer_key_outside_root' : 'answer_key_missing');
  } else {
    const keyBytes = readFileSync(keyFile.realPath);
    actualAnswerKeySha256 = digest(keyBytes);
    const parsedKey = parseJsonWithoutDuplicateKeys(keyBytes.toString('utf8'));
    if (parsedKey.status !== 'valid' || !isDeepStrictEqual(parsedKey.value, answerKey)) errors.push('answer_key_mismatch');
    if (actualAnswerKeySha256 !== authoritativeAnswerKeySha256) errors.push('answer_key_hash_mismatch');
  }

  return {
    valid: errors.length === 0,
    errors,
    hashes: {
      taskPath: answerKey?.taskPath ?? null,
      taskSha256: actualTaskSha256,
      sourceFilesSha256: actualSourceHashes,
      answerKeyPath: expectedAnswerKey,
      answerFileSha256: actualAnswerKeySha256,
    },
  };
}
