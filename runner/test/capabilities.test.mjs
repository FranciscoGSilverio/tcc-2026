import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CONTEXTS, ORDERS, TASKS, UnsupportedSessionError, resolveSession,
} from '../lib/capabilities.mjs';

const REPO = resolve(import.meta.dirname, '..', '..');

test('each task resolves to its own statement file', () => {
  // The regression this table exists for: `--task T2` used to record T2
  // and deliver T1's statement, because the path was hardcoded.
  const t1 = resolveSession({ task: 'T1', pLevel: 'P0', oLevel: 'O1' });
  const t2 = resolveSession({ task: 'T2', pLevel: 'P0', oLevel: 'O1' });

  assert.match(t1.statement, /T1-/);
  assert.match(t2.statement, /T2-/);
  assert.notEqual(t1.statement, t2.statement);
});

test('the hidden suite applies to T1 and not to T2', () => {
  assert.equal(resolveSession({ task: 'T1', pLevel: 'P0', oLevel: 'O1' }).hiddenSuite, true);
  assert.equal(resolveSession({ task: 'T2', pLevel: 'P0', oLevel: 'O1' }).hiddenSuite, false);
});

test('P0 carries no context file and P1 carries one', () => {
  assert.equal(resolveSession({ task: 'T1', pLevel: 'P0', oLevel: 'O1' }).contextFile, null);
  assert.match(
    resolveSession({ task: 'T1', pLevel: 'P1', oLevel: 'O1' }).contextFile,
    /contexts\/P1\/CLAUDE\.md$/,
  );
});

test('an unbuilt context level is refused, not silently downgraded', () => {
  assert.throws(
    () => resolveSession({ task: 'T1', pLevel: 'P2', oLevel: 'O1' }),
    (error) => error instanceof UnsupportedSessionError && /context level P2/.test(error.message),
  );
});

test('an unbuilt order level is refused, not silently downgraded', () => {
  // O2 is built (see the O2 tests below), so this now probes a level that
  // genuinely does not exist instead of one that used to be unbuilt.
  assert.throws(
    () => resolveSession({ task: 'T1', pLevel: 'P0', oLevel: 'O9' }),
    (error) => error instanceof UnsupportedSessionError && /order level O9/.test(error.message),
  );
});

test('an unknown task is refused', () => {
  assert.throws(
    () => resolveSession({ task: 'T9', pLevel: 'P0', oLevel: 'O1' }),
    (error) => error instanceof UnsupportedSessionError && /task T9/.test(error.message),
  );
});

test('the refusal names every missing level at once', () => {
  try {
    resolveSession({ task: 'T9', pLevel: 'P2', oLevel: 'O9' });
    assert.fail('should have refused');
  } catch (error) {
    for (const fragment of ['task T9', 'context level P2', 'order level O9']) {
      assert.match(error.message, new RegExp(fragment));
    }
  }
});

test('every declared path exists on disk', () => {
  // Keeps the table from rotting: renaming a statement or the context
  // file without updating the table fails here instead of at session time.
  for (const [task, { statement }] of Object.entries(TASKS)) {
    assert.equal(existsSync(resolve(REPO, statement)), true, `${task}: ${statement}`);
  }
  for (const [level, file] of Object.entries(CONTEXTS)) {
    if (file) assert.equal(existsSync(resolve(REPO, file)), true, `${level}: ${file}`);
  }
});

test('O1 is a single call', () => {
  assert.equal(ORDERS.O1.calls, 1);
});

test('decision points apply to T2 and not to T1', () => {
  assert.equal(resolveSession({ task: 'T1', pLevel: 'P0', oLevel: 'O1' }).decisionPoints, false);
  assert.equal(resolveSession({ task: 'T2', pLevel: 'P0', oLevel: 'O1' }).decisionPoints, true);
});

test('O2 declares four chained steps and O1 declares none', () => {
  assert.equal(resolveSession({ task: 'T1', pLevel: 'P0', oLevel: 'O1' }).steps, null);
  const o2 = resolveSession({ task: 'T1', pLevel: 'P0', oLevel: 'O2' });
  assert.equal(o2.calls, 4);
  assert.equal(o2.steps.length, 4);
});

test('every O2 step file exists on disk', () => {
  for (const step of resolveSession({ task: 'T1', pLevel: 'P0', oLevel: 'O2' }).steps) {
    assert.equal(existsSync(resolve(REPO, step)), true, step);
  }
});

test('only the first O2 step carries the statement placeholder', () => {
  const steps = resolveSession({ task: 'T1', pLevel: 'P0', oLevel: 'O2' }).steps;
  const texts = steps.map((step) => readFileSync(resolve(REPO, step), 'utf8'));
  assert.match(texts[0], /\{\{ENUNCIADO\}\}/);
  for (const text of texts.slice(1)) {
    assert.doesNotMatch(text, /\{\{ENUNCIADO\}\}/);
  }
});

test('the O2 steps carry the wording frozen in protocol section 3.3', () => {
  const steps = resolveSession({ task: 'T1', pLevel: 'P0', oLevel: 'O2' }).steps;
  const texts = steps.map((step) => readFileSync(resolve(REPO, step), 'utf8'));
  assert.match(texts[0], /Não altere nenhum arquivo/);
  assert.match(texts[1], /O plano vai na sua resposta, não em arquivo/);
  assert.match(texts[2], /Implemente o plano/);
  assert.match(texts[3], /Execute os testes e a verificação de tipos/);
});
