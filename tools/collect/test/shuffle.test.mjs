import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomSeed, seededShuffle } from '../shuffle.mjs';

const items = Array.from({ length: 43 }, (_, index) => index);

test('the same seed produces the same order', () => {
  assert.deepEqual(seededShuffle(items, 'abc123'), seededShuffle(items, 'abc123'));
});

test('different seeds produce different orders', () => {
  assert.notDeepEqual(seededShuffle(items, 'abc123'), seededShuffle(items, 'def456'));
});

test('shuffling is a permutation and not a rewrite', () => {
  const shuffled = seededShuffle(items, 'abc123');
  assert.equal(shuffled.length, items.length);
  assert.deepEqual([...shuffled].sort((a, b) => a - b), items);
});

test('the order actually changes, so nothing is silently returning the input', () => {
  assert.notDeepEqual(seededShuffle(items, 'abc123'), items);
});

test('the input list is not mutated', () => {
  const original = [...items];
  seededShuffle(items, 'abc123');
  assert.deepEqual(items, original);
});

test('a generated seed is a short printable string', () => {
  assert.match(randomSeed(), /^[0-9a-f]{8}$/);
  assert.notEqual(randomSeed(), randomSeed());
});
