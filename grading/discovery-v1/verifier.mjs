import { isDeepStrictEqual } from 'node:util';
import { isAbsolute, relative, resolve, sep } from 'node:path';

const PROTOCOL_STATUSES = new Set(['PASS', 'FAIL', 'UNKNOWN']);

export function combineEvidenceReviews(reviews) {
  const emptyDecision = (reviewerLabel) => ({
    reviewerLabel,
    citationsEntailClaim: null,
    branchCoverageComplete: null,
    decision: 'UNRESOLVED',
  });
  const slots = { A: emptyDecision('A'), B: emptyDecision('B') };
  const reasonCodes = [];
  const labelsSeen = new Set();
  const reviewList = Array.isArray(reviews) ? reviews : [];
  let invalidInput = reviews !== undefined && !Array.isArray(reviews);
  let missingReview = reviewList.length < 2;
  if (reviewList.length > 2) invalidInput = true;

  for (const review of reviewList) {
    if (!isRecord(review) || !['A', 'B'].includes(review.reviewerLabel) || labelsSeen.has(review.reviewerLabel)) {
      invalidInput = true;
      continue;
    }
    labelsSeen.add(review.reviewerLabel);
    const label = review.reviewerLabel;
    const exactFields = Object.keys(review).every((field) => (
      ['reviewerLabel', 'citationsEntailClaim', 'branchCoverageComplete'].includes(field)
    ));
    const validChecklist = typeof review.citationsEntailClaim === 'boolean'
      && typeof review.branchCoverageComplete === 'boolean';
    slots[label] = {
      reviewerLabel: label,
      citationsEntailClaim: typeof review.citationsEntailClaim === 'boolean'
        ? review.citationsEntailClaim
        : null,
      branchCoverageComplete: typeof review.branchCoverageComplete === 'boolean'
        ? review.branchCoverageComplete
        : null,
      decision: exactFields && validChecklist
        ? review.citationsEntailClaim && review.branchCoverageComplete
          ? 'SUPPORTED'
          : 'UNSUPPORTED'
        : 'UNRESOLVED',
    };
    if (!exactFields || !validChecklist) invalidInput = true;
  }

  if (labelsSeen.size !== 2) missingReview = true;
  const a = slots.A;
  const b = slots.B;
  const checklistAgrees = a.citationsEntailClaim === b.citationsEntailClaim
    && a.branchCoverageComplete === b.branchCoverageComplete;
  let status = 'UNRESOLVED';
  if (invalidInput) reasonCodes.push('review_input_invalid');
  else if (missingReview) reasonCodes.push('review_missing');
  else if (!checklistAgrees) reasonCodes.push('reviewer_disagreement');
  else status = a.decision;

  return {
    rubricVersion: 1,
    status,
    requiresAdjudication: status === 'UNRESOLVED',
    reasonCodes,
    reviewerA: a,
    reviewerB: b,
  };
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isUnknownValue(value) {
  return isRecord(value) ? value.status === 'unknown' : value === 'UNKNOWN';
}

function validateAnswerKey(answerKey) {
  if (
    !isRecord(answerKey)
    || answerKey.schemaVersion !== 1
    || typeof answerKey.caseId !== 'string'
    || !Array.isArray(answerKey.questions)
  ) {
    throw new TypeError('Invalid discovery answer key');
  }

  const questionIds = new Set();
  for (const question of answerKey.questions) {
    if (
      !isRecord(question)
      || typeof question.id !== 'string'
      || !['easy', 'medium', 'hard'].includes(question.tier)
      || !Array.isArray(question.requiredFacts)
      || questionIds.has(question.id)
    ) {
      throw new TypeError('Invalid or duplicate question in discovery answer key');
    }
    questionIds.add(question.id);

    const factIds = new Set();
    for (const fact of question.requiredFacts) {
      if (
        !isRecord(fact)
        || typeof fact.id !== 'string'
        || !Array.isArray(fact.accepted)
        || fact.accepted.length === 0
        || !Array.isArray(fact.evidence)
        || fact.evidence.length === 0
        || factIds.has(fact.id)
        || (fact.allowUnknown !== undefined && typeof fact.allowUnknown !== 'boolean')
      ) {
        throw new TypeError('Invalid or duplicate required fact in discovery answer key');
      }
      factIds.add(fact.id);
    }
  }
}

function citationPath(value, root) {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\\')) {
    return { status: 'invalid_path' };
  }

  const pathParts = value.split('/');
  if (pathParts.includes('..') || /^[A-Za-z]:/.test(value)) {
    return { status: 'invalid_path' };
  }

  const candidate = isAbsolute(value) ? resolve(value) : resolve(root, value);
  const pathFromRoot = relative(root, candidate);
  if (
    pathFromRoot === '..'
    || pathFromRoot.startsWith(`..${sep}`)
    || isAbsolute(pathFromRoot)
  ) {
    return { status: 'invalid_path' };
  }

  return { status: 'inside_root', path: pathFromRoot.split(sep).join('/') };
}

function citationStatus(citations, fact, root, sourceLineCounts) {
  if (citations.length === 0) return 'missing';

  let sawInvalidPath = false;
  let sawMisleadingLocation = false;
  const citedEvidence = new Set();
  for (const citation of citations) {
    if (!isRecord(citation)) {
      sawInvalidPath = true;
      continue;
    }
    const normalized = citationPath(citation.path, root);
    if (normalized.status !== 'inside_root') {
      sawInvalidPath = true;
      continue;
    }
    if (
      !Number.isSafeInteger(citation.startLine)
      || !Number.isSafeInteger(citation.endLine)
      || citation.startLine < 1
      || citation.endLine < citation.startLine
    ) {
      sawInvalidPath = true;
      continue;
    }
    if (
      sourceLineCounts
      && (!sourceLineCounts.has(normalized.path)
        || citation.endLine > sourceLineCounts.get(normalized.path))
    ) {
      sawInvalidPath = true;
      continue;
    }

    const matches = fact.evidence
      .map((span, index) => ({ span, index }))
      .filter(({ span }) => (
        normalized.path === span.path
        && citation.startLine >= span.startLine
        && citation.endLine <= span.endLine
      ));
    if (matches.length === 0) {
      sawMisleadingLocation = true;
    } else {
      for (const { index } of matches) citedEvidence.add(index);
    }
  }

  if (sawInvalidPath) return 'invalid_path';
  if (sawMisleadingLocation) return 'misleading';
  return citedEvidence.size === fact.evidence.length ? 'valid_location' : 'incomplete';
}

export function gradeSubmission(answerKey, submission, {
  sourceRoot,
  sourceLineCounts,
  protocolStatus = 'UNKNOWN',
} = {}) {
  validateAnswerKey(answerKey);
  if (
    !isRecord(submission)
    || submission.caseId !== answerKey.caseId
    || !isRecord(submission.answers)
  ) {
    throw new TypeError('Submission caseId or answers are invalid');
  }
  if (typeof sourceRoot !== 'string' || sourceRoot.length === 0) {
    throw new TypeError('An explicit sourceRoot is required');
  }
  if (sourceLineCounts !== undefined && !(sourceLineCounts instanceof Map)) {
    throw new TypeError('sourceLineCounts must be a Map when provided');
  }
  if (!PROTOCOL_STATUSES.has(protocolStatus)) {
    throw new TypeError('protocolStatus must be PASS, FAIL, or UNKNOWN');
  }

  const resolvedRoot = resolve(sourceRoot);
  const evidenceReviews = Array.isArray(submission.evidenceReviews) ? submission.evidenceReviews : [];
  if (submission.evidenceReviews !== undefined && !Array.isArray(submission.evidenceReviews)) {
    throw new TypeError('evidenceReviews must be an array when provided');
  }
  const knownFactsByQuestion = new Map(answerKey.questions.map((question) => [
    question.id,
    new Set(question.requiredFacts.map(({ id }) => id)),
  ]));
  const reviewsByFact = new Map();
  for (const review of evidenceReviews) {
    if (
      !isRecord(review)
      || typeof review.questionId !== 'string'
      || typeof review.factId !== 'string'
      || !knownFactsByQuestion.get(review.questionId)?.has(review.factId)
    ) {
      throw new TypeError('Evidence review must reference a known question and fact');
    }
    const key = `${review.questionId}\0${review.factId}`;
    reviewsByFact.set(key, [...(reviewsByFact.get(key) ?? []), {
      reviewerLabel: review.reviewerLabel,
      citationsEntailClaim: review.citationsEntailClaim,
      branchCoverageComplete: review.branchCoverageComplete,
      ...Object.fromEntries(Object.entries(review).filter(([field]) => (
        !['questionId', 'factId', 'reviewerLabel', 'citationsEntailClaim', 'branchCoverageComplete'].includes(field)
      ))),
    }]);
  }
  for (const [questionId, answer] of Object.entries(submission.answers)) {
    if (knownFactsByQuestion.has(questionId) && answer !== undefined && !isRecord(answer)) {
      throw new TypeError('Each provided question answer must be an object');
    }
    if (
      isRecord(answer)
      && answer.additionalClaims !== undefined
      && (!Array.isArray(answer.additionalClaims)
        || answer.additionalClaims.some((claim) => (
          !isRecord(claim)
          || typeof claim.text !== 'string'
          || !Array.isArray(claim.citations)
        )))
    ) {
      throw new TypeError('additionalClaims must preserve claim text and citations as an array');
    }
  }
  for (const question of answerKey.questions) {
    for (const fact of question.requiredFacts) {
      for (const span of fact.evidence) {
        if (
          !isRecord(span)
          || typeof span.path !== 'string'
          || !Number.isSafeInteger(span.startLine)
          || !Number.isSafeInteger(span.endLine)
          || span.startLine < 1
          || span.endLine < span.startLine
        ) {
          throw new TypeError('Invalid source evidence span in discovery answer key');
        }
        const normalized = citationPath(span.path, resolvedRoot);
        if (normalized.status !== 'inside_root' || normalized.path !== span.path) {
          throw new TypeError('Answer-key evidence must use canonical paths inside sourceRoot');
        }
        if (
          sourceLineCounts
          && (!sourceLineCounts.has(normalized.path)
            || span.endLine > sourceLineCounts.get(normalized.path))
        ) {
          throw new TypeError('Answer-key evidence extends beyond the provided source snapshot');
        }
      }
    }
  }
  const items = [];
  const byTier = {};
  let totalCorrect = 0;
  let totalDenominator = 0;
  let totalUnsupported = 0;
  const knownQuestionIds = new Set(answerKey.questions.map(({ id }) => id));

  for (const question of answerKey.questions) {
    const response = submission.answers[question.id];
    const facts = isRecord(response?.facts) ? response.facts : {};
    const citations = Array.isArray(response?.citations) ? response.citations : [];
    const additionalClaims = Array.isArray(response?.additionalClaims) ? response.additionalClaims : [];
    const unsupportedFacts = Object.keys(facts).filter((id) => (
      !question.requiredFacts.some((fact) => fact.id === id)
    ));
    const knownFactIds = new Set(question.requiredFacts.map(({ id }) => id));
    const unsupportedQuestionCitations = citations.filter((citation) => (
      !isRecord(citation) || !knownFactIds.has(citation.factId)
    ));
    const unsupportedExtraClaims = unsupportedFacts.length
      + unsupportedQuestionCitations.length
      + additionalClaims.length;
    const factResults = question.requiredFacts.map((fact) => {
      const hasAnswer = Object.hasOwn(facts, fact.id);
      const isUnknown = isUnknownValue(facts[fact.id]);
      let outcome = 'missing';
      if (hasAnswer) {
        const accepted = (!isUnknown || fact.allowUnknown === true)
          && fact.accepted.some((expected) => isDeepStrictEqual(facts[fact.id], expected));
        const abstentionOnlyFact = fact.allowUnknown === true
          && fact.accepted.every(isUnknownValue);
        outcome = accepted
          ? 'correct'
          : isUnknown && !abstentionOnlyFact
            ? 'abstention'
          : abstentionOnlyFact && !isUnknown
            ? 'unsupported'
            : 'incorrect';
      }
      const factCitations = citations.filter((citation) => (
        isRecord(citation) && citation.factId === fact.id
      ));

      return {
        id: fact.id,
        outcome,
        citation: citationStatus(factCitations, fact, resolvedRoot, sourceLineCounts),
        evidenceReview: {
          questionId: question.id,
          factId: fact.id,
          ...combineEvidenceReviews(reviewsByFact.get(`${question.id}\0${fact.id}`) ?? []),
        },
      };
    });
    const unsupportedClaims = unsupportedExtraClaims
      + factResults.filter(({ outcome }) => outcome === 'unsupported').length;
    const correct = factResults.filter(({ outcome }) => outcome === 'correct').length;
    const denominator = question.requiredFacts.length;
    totalCorrect += correct;
    totalDenominator += denominator;
    totalUnsupported += unsupportedClaims;

    byTier[question.tier] ??= { correct: 0, denominator: 0 };
    byTier[question.tier].correct += correct;
    byTier[question.tier].denominator += denominator;
    items.push({
      questionId: question.id,
      tier: question.tier,
      correct,
      denominator,
      facts: factResults,
      unsupportedClaims,
    });
  }

  const unsupportedQuestionAnswers = Object.entries(submission.answers)
    .filter(([questionId]) => !knownQuestionIds.has(questionId))
    .reduce((count, [, answer]) => count
      + (isRecord(answer?.facts) ? Object.keys(answer.facts).length : 0)
      + (Array.isArray(answer?.additionalClaims) ? answer.additionalClaims.length : 0), 0);
  totalUnsupported += unsupportedQuestionAnswers;

  return {
    schemaVersion: 1,
    caseId: answerKey.caseId,
    protocolStatus,
    totals: {
      correct: totalCorrect,
      denominator: totalDenominator,
      unsupported: totalUnsupported,
    },
    byTier,
    items,
  };
}
