import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeLabels } from '../src/group-labels.mjs';

test('trims and lowercases labels', () => {
  assert.deepEqual(
    summarizeLabels(['  Cedar ', 'cedar', 'CEDAR']),
    [{ label: 'cedar', count: 3 }],
  );
});

test('counts duplicates after normalization', () => {
  assert.deepEqual(
    summarizeLabels(['maple', 'oak', 'MAPLE', 'oak', 'maple']),
    [
      { label: 'maple', count: 3 },
      { label: 'oak', count: 2 },
    ],
  );
});

test('skips non-string values', () => {
  assert.deepEqual(
    summarizeLabels([
      42,
      ' Maple ',
      null,
      undefined,
      true,
      { label: 'birch' },
      'MAPLE',
      'oak',
    ]),
    [
      { label: 'maple', count: 2 },
      { label: 'oak', count: 1 },
    ],
  );
});

test('skips strings that are blank after trimming', () => {
  assert.deepEqual(summarizeLabels(['', '   ', '\t\n']), []);
  assert.deepEqual(
    summarizeLabels(['oak', '  ', ' Maple ', '\t\n', 'OAK']),
    [
      { label: 'oak', count: 2 },
      { label: 'maple', count: 1 },
    ],
  );
});

test('returns an empty array for empty input', () => {
  assert.deepEqual(summarizeLabels([]), []);
});

test('sorts by descending count, then ascending ASCII label', () => {
  assert.deepEqual(
    summarizeLabels(['delta', 'bravo', 'charlie', 'bravo', 'charlie', 'alpha']),
    [
      { label: 'bravo', count: 2 },
      { label: 'charlie', count: 2 },
      { label: 'alpha', count: 1 },
      { label: 'delta', count: 1 },
    ],
  );
});

test('does not mutate the input array', () => {
  const input = [' Cedar ', 42, '  ', 'OAK'];
  const before = [...input];

  summarizeLabels(input);

  assert.deepEqual(input, before);
});

test('keeps results independent across repeated and different calls', () => {
  const input = ['pear', ' PEAR ', 'plum'];
  const expected = [
    { label: 'pear', count: 2 },
    { label: 'plum', count: 1 },
  ];
  const first = summarizeLabels(input);

  assert.deepEqual(first, expected);
  first[0].label = 'changed';
  first[0].count = 99;
  first.push({ label: 'added', count: 1 });

  const repeated = summarizeLabels(input);
  assert.deepEqual(repeated, expected);
  assert.notStrictEqual(first, repeated);
  assert.notStrictEqual(first[0], repeated[0]);
  assert.deepEqual(summarizeLabels(['fig']), [{ label: 'fig', count: 1 }]);
});
