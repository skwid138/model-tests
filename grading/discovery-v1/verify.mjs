import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { relative, resolve, sep } from 'node:path';

import { gradeSubmission } from './verifier.mjs';

const CASE_IDS = new Set(['trace', 'boundary']);
const REVIEWER_LABELS = new Set(['A', 'B']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateSubmissionDocument(submission, caseId) {
  if (
    !isRecord(submission)
    || submission.schemaVersion !== 1
    || submission.caseId !== caseId
    || !isRecord(submission.answers)
    || !Array.isArray(submission.evidenceReviews)
  ) {
    throw new TypeError('Submission must use schemaVersion 1 with matching caseId, answers, and evidenceReviews');
  }

  for (const [questionId, answer] of Object.entries(submission.answers)) {
    if (
      !/^[TB][1-3]$/.test(questionId)
      || !isRecord(answer)
      || !isRecord(answer.facts)
      || !Array.isArray(answer.citations)
      || !Array.isArray(answer.additionalClaims)
    ) {
      throw new TypeError('Each provided question answer requires facts, citations, and additionalClaims');
    }
    for (const citation of answer.citations) {
      if (
        !isRecord(citation)
        || typeof citation.factId !== 'string'
        || typeof citation.path !== 'string'
        || !Number.isSafeInteger(citation.startLine)
        || !Number.isSafeInteger(citation.endLine)
      ) {
        throw new TypeError('Fact citations require factId, path, startLine, and endLine');
      }
    }
    for (const claim of answer.additionalClaims) {
      if (
        !isRecord(claim)
        || typeof claim.text !== 'string'
        || !Array.isArray(claim.citations)
        || claim.citations.some((citation) => (
          !isRecord(citation)
          || typeof citation.path !== 'string'
          || !Number.isSafeInteger(citation.startLine)
          || !Number.isSafeInteger(citation.endLine)
        ))
      ) {
        throw new TypeError('Additional claims require transcribed text and citation arrays');
      }
    }
  }
  for (const review of submission.evidenceReviews) {
    if (
      !isRecord(review)
      || typeof review.questionId !== 'string'
      || typeof review.factId !== 'string'
      || !REVIEWER_LABELS.has(review.reviewerLabel)
      || typeof review.citationsEntailClaim !== 'boolean'
      || typeof review.branchCoverageComplete !== 'boolean'
    ) {
      throw new TypeError('Evidence-review inputs require question/fact IDs, reviewer A/B, and both checklist decisions');
    }
  }
}

async function lineCountFor(root, relativePath) {
  if (
    typeof relativePath !== 'string'
    || relativePath.includes('\\')
    || relativePath.split('/').includes('..')
  ) {
    throw new Error('Invalid gold evidence path');
  }
  const filePath = await realpath(resolve(root, relativePath));
  const pathFromRoot = relative(root, filePath);
  if (pathFromRoot === '..' || pathFromRoot.startsWith(`..${sep}`) || pathFromRoot.startsWith(sep)) {
    throw new Error('Gold evidence path escaped the trial root');
  }
  const content = await readFile(filePath, 'utf8');
  return {
    lineCount: content.length === 0
      ? 0
      : content.split(/\r?\n/).length - (content.endsWith('\n') ? 1 : 0),
    sha256: createHash('sha256').update(content).digest('hex'),
  };
}

export async function verify({ trialRoot, caseId, submissionPath, protocolStatus = 'UNKNOWN' }) {
  if (!CASE_IDS.has(caseId)) throw new TypeError('caseId must be trace or boundary');
  const root = await realpath(resolve(trialRoot));
  const answerKeyUrl = new URL(`./answer-keys/${caseId}.json`, import.meta.url);
  const [answerKeyText, submissionText] = await Promise.all([
    readFile(answerKeyUrl, 'utf8'),
    readFile(resolve(submissionPath), 'utf8'),
  ]);
  const answerKey = JSON.parse(answerKeyText);
  const submission = JSON.parse(submissionText);
  validateSubmissionDocument(submission, caseId);
  const taskFile = caseId === 'trace' ? 'trace.md' : 'boundaries.md';
  const taskPath = `fixtures/discovery-v1/tasks/${taskFile}`;
  if (
    typeof answerKey.taskSha256 !== 'string'
    || !/^[a-f0-9]{64}$/.test(answerKey.taskSha256)
    || !answerKey.sourceFilesSha256
    || typeof answerKey.sourceFilesSha256 !== 'object'
    || Array.isArray(answerKey.sourceFilesSha256)
  ) {
    throw new TypeError('Frozen answer key is missing task/source hashes');
  }
  const hashedPaths = Object.keys(answerKey.sourceFilesSha256);
  const allowedEvidencePaths = new Set([...hashedPaths, taskPath]);
  for (const question of answerKey.questions) {
    for (const fact of question.requiredFacts) {
      for (const span of fact.evidence) {
        if (!allowedEvidencePaths.has(span.path)) {
          throw new TypeError('Gold evidence is outside the frozen task/source snapshot');
        }
      }
    }
  }
  const sourceLineCounts = new Map();
  for (const path of [taskPath, ...hashedPaths]) {
    const expectedHash = path === taskPath
      ? answerKey.taskSha256
      : answerKey.sourceFilesSha256[path];
    if (typeof expectedHash !== 'string' || !/^[a-f0-9]{64}$/.test(expectedHash)) {
      throw new TypeError('Frozen source hash is invalid');
    }
    const actual = await lineCountFor(root, path);
    if (actual.sha256 !== expectedHash) {
      throw new Error('Frozen task/source hash mismatch');
    }
    sourceLineCounts.set(path, actual.lineCount);
  }

  return gradeSubmission(answerKey, submission, {
    sourceRoot: root,
    sourceLineCounts,
    protocolStatus,
  });
}

export async function main(args = process.argv.slice(2), {
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  if (args.length === 1 && args[0] === '--help') {
    stdout.write('Usage: node grading/discovery-v1/verify.mjs TRIAL_ROOT CASE_ID SUBMISSION.json [COORDINATOR_RECORDED_PROTOCOL_STATUS]\n');
    return 0;
  }
  if (args.length < 3 || args.length > 4) {
    stderr.write('Expected TRIAL_ROOT, CASE_ID, SUBMISSION.json, and optional protocol status\n');
    return 2;
  }
  try {
    const protocolStatus = args[3] ?? 'UNKNOWN';
    const result = await verify({
      trialRoot: args[0],
      caseId: args[1],
      submissionPath: args[2],
      protocolStatus,
    });
    stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  } catch (error) {
    stderr.write(`Verification failed: ${error instanceof Error ? error.message : 'invalid input'}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await main();
}
