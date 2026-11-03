import assert from 'node:assert/strict';
import test from 'node:test';

const verifier = await import('../verifier.mjs').catch(() => ({}));

test('typed facts are extracted only from a labelled block inside results.answer', () => {
  assert.equal(typeof verifier.extractTypedFacts, 'function', 'v2 typed-answer extraction is available');
  const response = `<analysis>short intent summary</analysis>
<results><files></files><answer>Context.
\`\`\`discovery-facts
{"T1":{"entry":{"file":"fixtures/discovery-v2/src/index.mjs","symbol":"inspectRequest"}}}
\`\`\`
More answer prose.</answer><next_steps></next_steps></results>`;

  assert.deepEqual(verifier.extractTypedFacts(response, 'trace'), {
    status: 'valid',
    facts: { T1: { entry: { file: 'fixtures/discovery-v2/src/index.mjs', symbol: 'inspectRequest' } } },
  });
});

test('format states distinguish absent fragments from malformed, misplaced, duplicate, and duplicate-key fragments', () => {
  const wrap = (answer) => `<analysis>intent</analysis><results><files></files><answer>\n${answer}\n</answer><next_steps></next_steps></results>`;
  assert.deepEqual(verifier.extractTypedFacts(wrap('no fragment'), 'trace'), { status: 'missing' });
  assert.equal(verifier.extractTypedFacts(wrap('```discovery-facts\n{"x":}\n```'), 'trace').status, 'invalid');
  assert.equal(verifier.extractTypedFacts(wrap('```discovery-facts\n{}'), 'trace').status, 'invalid');
  assert.equal(verifier.extractTypedFacts(wrap('```discovery-facts\n{}\n```\n```discovery-facts\n{}\n```'), 'trace').status, 'invalid');
  assert.equal(verifier.extractTypedFacts(wrap('```discovery-facts\n{"outer":{"name":1,"\\u006eame":2}}\n```'), 'trace').reason, 'duplicate_json_key');
  assert.equal(verifier.extractTypedFacts(
    '<analysis>\n```discovery-facts\n{"decoy":true}\n```\n</analysis>\n<results><files></files><answer>No block.</answer><next_steps></next_steps></results>',
    'trace',
  ).reason, 'labelled_fence_outside_answer');
  assert.equal(verifier.extractTypedFacts(
    '<analysis>\n```discovery-facts\n{"decoy":true}\n```\n</analysis>\n<results><files></files><answer>\n```discovery-facts\n{}\n```\n</answer><next_steps></next_steps></results>',
    'trace',
  ).reason, 'labelled_fence_outside_answer');
  assert.equal(verifier.extractTypedFacts(
    '<analysis></analysis><results><files></files><answer>No block.</answer><next_steps>\n```discovery-facts\n{}\n```\n</next_steps></results>',
    'trace',
  ).reason, 'labelled_fence_outside_answer');
  assert.equal(verifier.extractTypedFacts(
    '<analysis></analysis><results><files></files><answer>\n```json\n```discovery-facts\n{}\n```\n```\n</answer><next_steps></next_steps></results>',
    'trace',
  ).reason, 'nested_labelled_fence');
});

test('format extraction refuses duplicate or malformed native results envelopes instead of selecting a decoy', () => {
  const one = '<results><files></files><answer>\n```discovery-facts\n{}\n```\n</answer><next_steps></next_steps></results>';
  assert.equal(verifier.extractTypedFacts(`<analysis></analysis>${one}${one}`, 'trace').reason, 'invalid_results_envelope');
  assert.equal(verifier.extractTypedFacts(
    '<analysis></analysis><results><files></files><answer>```discovery-facts\n{}\n```</answer></results>',
    'trace',
  ).reason, 'invalid_results_envelope');
});

test('a results envelope nested inside analysis is never extracted as public results', () => {
  const fake = '<analysis>\n<results><files></files><answer>\n```discovery-facts\n{}\n```\n</answer><next_steps></next_steps></results>\n</analysis>';
  assert.equal(verifier.extractTypedFacts(fake, 'trace').status, 'invalid');
  assert.equal(verifier.extractResultsText(fake).status, 'invalid');
});

test('a nested results envelope inside another wrapper is not treated as the native results output', () => {
  const wrapped = '<wrapper><results><files></files><answer></answer><next_steps></next_steps></results></wrapper>';
  assert.equal(verifier.extractResultsText(wrapped).status, 'invalid');
});

test('a whitespace-after-ticks discovery label is malformed, not an ordinary fence or missing fragment', () => {
  const response = '<results><files></files><answer>\n``` discovery-facts\n{}\n```\n</answer><next_steps></next_steps></results>';
  const extracted = verifier.extractTypedFacts(response, 'trace');
  assert.equal(extracted.status, 'invalid');
  assert.equal(extracted.reason, 'malformed_labelled_fence');
});

test('discovery facts inside a properly closed tilde fence are rejected as nested content', () => {
  const response = '<results><files></files><answer>\n~~~text\n```discovery-facts\n{}\n```\n~~~\n</answer><next_steps></next_steps></results>';
  const extracted = verifier.extractTypedFacts(response, 'trace');
  assert.equal(extracted.status, 'invalid');
  assert.equal(extracted.reason, 'nested_labelled_fence');
});

test('unclosed or too-short-closed tilde fences cannot expose an inner labelled block', () => {
  const unclosed = '<results><files></files><answer>\n~~~text\n```discovery-facts\n{}\n```\n</answer><next_steps></next_steps></results>';
  const shortClose = '<results><files></files><answer>\n~~~~text\n~~~\n```discovery-facts\n{}\n```\n~~~~\n</answer><next_steps></next_steps></results>';
  assert.equal(verifier.extractTypedFacts(unclosed, 'trace').status, 'invalid');
  assert.equal(verifier.extractTypedFacts(shortClose, 'trace').status, 'invalid');
});

test('a closed tilde fence before a standalone exact labelled block does not hide the block', () => {
  const response = '<results><files></files><answer>\n~~~text\nunlabelled example\n~~~\n```discovery-facts\n{}\n```\n</answer><next_steps></next_steps></results>';
  assert.deepEqual(verifier.extractTypedFacts(response, 'trace'), { status: 'valid', facts: {} });
});

test('backtick outer-fence closing length is matched without weakening the exact facts opener', () => {
  const nested = '<results><files></files><answer>\n````text\n```discovery-facts\n{}\n```\n````\n</answer><next_steps></next_steps></results>';
  const shortClose = '<results><files></files><answer>\n````text\n```\n```discovery-facts\n{}\n```\n````\n</answer><next_steps></next_steps></results>';
  const matchingClose = '<results><files></files><answer>\n````text\ntext\n````\n```discovery-facts\n{}\n```\n</answer><next_steps></next_steps></results>';
  assert.equal(verifier.extractTypedFacts(nested, 'trace').reason, 'nested_labelled_fence');
  assert.equal(verifier.extractTypedFacts(shortClose, 'trace').reason, 'nested_labelled_fence');
  assert.deepEqual(verifier.extractTypedFacts(matchingClose, 'trace'), { status: 'valid', facts: {} });
});
