import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPlan, planBatch, sessionLabel } from '../run-grid.mjs';

const collected = [
  { task: 'T1', p_level: 'P0', o_level: 'O1', model: 'claude-sonnet-5', status: 'valid' },
  { task: 'T1', p_level: 'P1', o_level: 'O1', model: 'claude-sonnet-5', status: 'valid' },
  { task: 'T2', p_level: 'P0', o_level: 'O1', model: 'claude-sonnet-5', status: 'valid' },
  { task: 'T2', p_level: 'P0', o_level: 'O1', model: 'claude-sonnet-5', status: 'valid' },
  { task: 'T2', p_level: 'P0', o_level: 'O1', model: 'claude-sonnet-5', status: 'valid' },
  { task: 'T1', p_level: 'P2', o_level: 'O1', model: 'claude-sonnet-5', status: 'valid' },
  { task: 'T1', p_level: 'P0', o_level: 'O2', model: 'claude-sonnet-5', status: 'valid' },
];

test('the plan covers everything missing and counts it by block', () => {
  const plan = planBatch({ rows: collected, limit: Infinity, seed: 'abc123' });
  assert.equal(plan.total, 43);
  assert.deepEqual(plan.blocks, { principal: 23, modelo: 20 });
  assert.equal(plan.batch.length, 43);
});

test('a limit shortens the batch without changing what is missing', () => {
  const plan = planBatch({ rows: collected, limit: 10, seed: 'abc123' });
  assert.equal(plan.total, 43);
  assert.equal(plan.batch.length, 10);
});

test('the same seed plans the same batch', () => {
  const first = planBatch({ rows: collected, limit: 10, seed: 'abc123' });
  const second = planBatch({ rows: collected, limit: 10, seed: 'abc123' });
  assert.deepEqual(first.batch, second.batch);
});

test('a different seed plans a different batch', () => {
  const first = planBatch({ rows: collected, limit: 10, seed: 'abc123' });
  const second = planBatch({ rows: collected, limit: 10, seed: 'def456' });
  assert.notDeepEqual(first.batch, second.batch);
});

test('the repetition number continues from what the dataset already holds', () => {
  const plan = planBatch({ rows: collected, limit: Infinity, seed: 'abc123' });
  // T1-P0-O1 on sonnet already has run 1, so its one missing session is run 2.
  const carried = plan.batch.filter(
    (s) => s.task === 'T1' && s.pLevel === 'P0' && s.oLevel === 'O1' && s.model === 'claude-sonnet-5');
  assert.deepEqual(carried.map((s) => s.run), [2]);
  // An untouched cell starts at 1 and counts up.
  const fresh = plan.batch
    .filter((s) => s.task === 'T2' && s.pLevel === 'P1' && s.oLevel === 'O2')
    .map((s) => s.run)
    .sort();
  assert.deepEqual(fresh, [1, 2, 3]);
});

test('no repetition number is planned twice inside one cell', () => {
  const plan = planBatch({ rows: collected, limit: Infinity, seed: 'abc123' });
  const seen = new Set();
  for (const session of plan.batch) {
    const key = `${session.task}|${session.pLevel}|${session.oLevel}|${session.model}|${session.run}`;
    assert.ok(!seen.has(key), `planned twice: ${key}`);
    seen.add(key);
  }
});

test('the printed plan names the seed, the totals and every session', () => {
  const text = formatPlan(planBatch({ rows: collected, limit: 3, seed: 'abc123' }));
  assert.match(text, /semente: abc123/);
  assert.match(text, /faltam 43/);
  assert.match(text, /principal: 23/);
  assert.match(text, /modelo: 20/);
  assert.equal(text.split('\n').filter((line) => /^\s+\d+\./.test(line)).length, 3);
});

test('a session label carries every factor the dataset will record', () => {
  const label = sessionLabel({ task: 'T2', pLevel: 'P1', oLevel: 'O2', model: 'claude-opus-5', run: 3 });
  assert.match(label, /T2/);
  assert.match(label, /P1/);
  assert.match(label, /O2/);
  assert.match(label, /claude-opus-5/);
  assert.match(label, /3/);
});
