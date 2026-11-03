import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { extractResultsText, extractTypedFacts } from './verifier.mjs';

const QUESTION_IDS = Object.freeze({
  trace: ['T1', 'T2', 'T3'],
  boundary: ['B1', 'B2', 'B3'],
});

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeTrialRoot(text, trialRoot) {
  const root = resolve(trialRoot).replace(/[\\/]$/, '');
  const rootPattern = new RegExp(`${escapeRegExp(root)}(?=$|[\\\\/])`, 'g');
  return text.replace(rootPattern, '${TRIAL_ROOT}');
}

export function normalizeWorkerOutput(response, { caseId, trialRoot } = {}) {
  if (!Object.hasOwn(QUESTION_IDS, caseId) || typeof trialRoot !== 'string' || trialRoot.length === 0) {
    throw new TypeError('caseId and explicit trialRoot are required');
  }
  const publicResults = extractResultsText(response);
  if (publicResults.status !== 'valid') {
    throw new TypeError(`Cannot normalize an invalid results envelope: ${publicResults.reason}`);
  }
  const typedFragment = extractTypedFacts(response, caseId);
  return {
    schemaVersion: 2,
    caseId,
    taskVersion: 2,
    sourceVersion: 2,
    resultsText: normalizeTrialRoot(publicResults.resultsText, trialRoot),
    typedFragment,
    answers: Object.fromEntries(QUESTION_IDS[caseId].map((questionId) => [questionId, {
      prose: '',
      citations: [],
      additionalClaims: [],
    }])),
    evidenceReviews: [],
    claimReviews: [],
  };
}

function usage() {
  return 'Usage: node grading/discovery-v2/normalize.mjs <trial-root> <trace|boundary> <worker-response-file>';
}

function main(argv) {
  const [, , trialRoot, caseId, responsePath] = argv;
  if (!trialRoot || !Object.hasOwn(QUESTION_IDS, caseId) || !responsePath) {
    process.stderr.write(`${usage()}\n`);
    process.exitCode = 2;
    return;
  }
  const responseFile = isAbsolute(responsePath) ? responsePath : resolve(trialRoot, responsePath);
  try {
    const response = readFileSync(responseFile, 'utf8');
    const normalized = normalizeWorkerOutput(response, { caseId, trialRoot });
    process.stdout.write(`${JSON.stringify(normalized, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv);
}
