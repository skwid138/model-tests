import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

import { validateTrialManifest, expectedProtocolStatus } from './manifest.mjs';
import { scanPrivacyPatterns } from './privacy.mjs';
import {
  gradeSubmission,
  parseJsonWithoutDuplicateKeys,
  validateNormalizedSubmission,
  verifyFrozenSnapshot,
} from './verifier.mjs';

const ANSWER_KEYS = Object.freeze({
  trace: new URL('./answer-keys/trace.json', import.meta.url),
  boundary: new URL('./answer-keys/boundary.json', import.meta.url),
});

function readJson(path, label) {
  const parsed = parseJsonWithoutDuplicateKeys(readFileSync(path, 'utf8'));
  if (parsed.status !== 'valid') throw new TypeError(`${label} is invalid JSON: ${parsed.reason}`);
  return parsed.value;
}

function usage() {
  return 'Usage: node grading/discovery-v2/verify.mjs <trial-root> <trace|boundary> <submission.json> <manifest.json>';
}

export function verifyTrial({ trialRoot, caseId, answerKey, submission, manifest }) {
  if (!Object.hasOwn(ANSWER_KEYS, caseId) || typeof trialRoot !== 'string' || trialRoot.length === 0) {
    throw new TypeError('An explicit v2 caseId and trialRoot are required');
  }
  if (answerKey?.caseId !== caseId || manifest?.caseId !== caseId || submission?.caseId !== caseId) {
    throw new TypeError('Case identifiers do not agree');
  }
  const snapshot = verifyFrozenSnapshot(answerKey, resolve(trialRoot));
  if (!snapshot.valid) throw new TypeError(`Frozen v2 snapshot validation failed: ${snapshot.errors.join(', ')}`);
  if (!isDeepStrictEqual(manifest?.fixtureHashes, snapshot.hashes)) {
    throw new TypeError('Trial manifest fixture hashes do not match the verified task, source, and answer-key files');
  }

  const submissionCheck = validateNormalizedSubmission(answerKey, submission);
  if (!submissionCheck.valid) throw new TypeError(`Normalized submission validation failed: ${submissionCheck.errors.join(', ')}`);
  const privacyFindings = scanPrivacyPatterns(submission);
  if (privacyFindings.length > 0) {
    throw new TypeError(`Privacy review required before grading/archive: ${privacyFindings.map(({ path, patternId }) => `${path}:${patternId}`).join(', ')}`);
  }

  const manifestCheck = validateTrialManifest(manifest);
  if (!manifestCheck.valid) throw new TypeError(`Trial manifest validation failed: ${manifestCheck.errors.join(', ')}`);
  if (
    !isDeepStrictEqual(manifest.evidenceReviews, submission.evidenceReviews)
    || !isDeepStrictEqual(manifest.claimReviews, submission.claimReviews)
  ) throw new TypeError('Trial manifest review records do not match the normalized submission');
  return gradeSubmission(answerKey, submission, {
    trialRoot: resolve(trialRoot),
    protocolStatus: expectedProtocolStatus(manifest).status,
  });
}

function main(argv) {
  const [, , trialRootArg, caseId, submissionPath, manifestPath] = argv;
  if (!trialRootArg || !Object.hasOwn(ANSWER_KEYS, caseId) || !submissionPath || !manifestPath) {
    process.stderr.write(`${usage()}\n`);
    process.exitCode = 2;
    return;
  }

  try {
    const trialRoot = resolve(trialRootArg);
    const answerKey = readJson(ANSWER_KEYS[caseId], 'answer key');
    const submission = readJson(resolve(submissionPath), 'normalized submission');
    const manifest = readJson(resolve(manifestPath), 'trial manifest');
    const result = verifyTrial({ trialRoot, caseId, answerKey, submission, manifest });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv);
}
