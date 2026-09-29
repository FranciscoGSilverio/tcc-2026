import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cellKey, collectedCounts, missingSessions, nextRunNumber, targetSessions } from '../grid.mjs';

// The seven valid sessions the dataset holds on 2026-09-23, reduced to
// the columns the grid reads. Written out rather than read from
// resultados.csv, so the test keeps meaning the same thing after the
// collection has filled the real file.
const collected = [
  { task: 'T1', p_level: 'P0', o_level: 'O1', model: 'claude-sonnet-5', status: 'valid' },
  { task: 'T1', p_level: 'P1', o_level: 'O1', model: 'claude-sonnet-5', status: 'valid' },
  { task: 'T2', p_level: 'P0', o_level: 'O1', model: 'claude-sonnet-5', status: 'valid' },
  { task: 'T2', p_level: 'P0', o_level: 'O1', model: 'claude-sonnet-5', status: 'valid' },
  { task: 'T2', p_level: 'P0', o_level: 'O1', model: 'claude-sonnet-5', status: 'valid' },
  { task: 'T1', p_level: 'P2', o_level: 'O1', model: 'claude-sonnet-5', status: 'valid' },
  { task: 'T1', p_level: 'P0', o_level: 'O2', model: 'claude-sonnet-5', status: 'valid' },
];

test('the target is fifty sessions, thirty of them the main grid', () => {
  const target = targetSessions();
  assert.equal(target.length, 50);
  assert.equal(target.filter((s) => s.block === 'principal').length, 30);
  assert.equal(target.filter((s) => s.block === 'modelo').length, 20);
});

test('every target session names a model, a task, a context and an order', () => {
  for (const session of targetSessions()) {
    assert.ok(session.model && session.task && session.pLevel && session.oLevel);
  }
});

test('the main grid repeats T1 twice and T2 three times in every cell', () => {
  const cell = targetSessions().filter(
    (s) => s.block === 'principal' && s.pLevel === 'P1' && s.oLevel === 'O2');
  assert.equal(cell.filter((s) => s.task === 'T1').length, 2);
  assert.equal(cell.filter((s) => s.task === 'T2').length, 3);
});

test('an empty dataset is missing the whole target', () => {
  assert.equal(missingSessions([]).length, 50);
});

test('the seven sessions already collected leave forty-three missing', () => {
  const missing = missingSessions(collected);
  assert.equal(missing.length, 43);
  assert.equal(missing.filter((s) => s.block === 'principal').length, 23);
  assert.equal(missing.filter((s) => s.block === 'modelo').length, 20);
});

test('a cell already full stops appearing in what is missing', () => {
  // T2-P0-O1 on sonnet has all three of its repetitions.
  const missing = missingSessions(collected);
  assert.equal(missing.filter((s) => cellKey(s) === 'T2|P0|O1|claude-sonnet-5').length, 0);
  // T1-P0-O1 on sonnet has one of its two.
  assert.equal(missing.filter((s) => cellKey(s) === 'T1|P0|O1|claude-sonnet-5').length, 1);
});

test('an invalid row does not count as collected', () => {
  const rows = [{ ...collected[0], status: 'invalid' }];
  assert.equal(collectedCounts(rows).size, 0);
  assert.equal(missingSessions(rows).length, 50);
});

test('the repetition number is derived from the dataset, not typed', () => {
  const session = { task: 'T1', pLevel: 'P0', oLevel: 'O1', model: 'claude-sonnet-5' };
  assert.equal(nextRunNumber([], session), 1);
  assert.equal(nextRunNumber(collected, session), 2);
  assert.equal(nextRunNumber([...collected, { ...collected[0] }], session), 3);
});
