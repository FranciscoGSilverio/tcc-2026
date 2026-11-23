import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyze, formatReport, ruleMet } from '../requisitos-t1.mjs';

const all = (passed, total) => ({ passed, total });
const FULL = { 1: all(10, 10), 2: all(2, 2), 3: all(3, 3), 4: all(4, 4), 5: all(2, 2), 6: all(3, 3), 7: all(2, 2) };

const row = (id, pLevel, task = 'T1', status = 'valid') => ({ session_id: id, task, p_level: pLevel, status });

test('a rule is met only when every one of its assertions passes', () => {
  assert.equal(ruleMet(FULL, 4), true);
  assert.equal(ruleMet({ ...FULL, 4: all(3, 4) }, 4), false);
});

test('a session without the per-rule detail is refused, not counted as a miss', () => {
  assert.throws(() => ruleMet({ 1: all(10, 10) }, 3), /regra 3/);
});

test('requirements are counted per (session, rule) pair, P0 apart from P1 and P2', () => {
  const byRule = {
    a: { ...FULL, 3: all(1, 3), 4: all(2, 4), 6: all(0, 3) }, // P0: misses 6, 3, 4
    b: FULL, // P1
    c: FULL, // P2
  };
  const result = analyze(
    [row('a', 'P0'), row('b', 'P1'), row('c', 'P2'), row('x', 'P0', 'T2'), row('y', 'P0', 'T1', 'invalid')],
    (id) => byRule[id],
  );
  const [sem, com] = result.groups;
  assert.equal(sem.n, 1);
  assert.equal(com.n, 2);
  assert.deepEqual(sem.types.map((t) => [t.met, t.total]), [[1, 1], [3, 4], [0, 2]]);
  assert.deepEqual(sem.implicito, { met: 3, total: 6, ratio: 0.5 });
  assert.equal(com.implicito.ratio, 1);
  assert.match(formatReport(result), /Implícito de domínio \(regras 3, 4\) \| 0% \(0\/2\)/);
});
