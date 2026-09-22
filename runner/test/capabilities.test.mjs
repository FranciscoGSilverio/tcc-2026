import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
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
  assert.throws(
    () => resolveSession({ task: 'T1', pLevel: 'P0', oLevel: 'O2' }),
    (error) => error instanceof UnsupportedSessionError && /order level O2/.test(error.message),
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
    resolveSession({ task: 'T9', pLevel: 'P2', oLevel: 'O2' });
    assert.fail('should have refused');
  } catch (error) {
    for (const fragment of ['task T9', 'context level P2', 'order level O2']) {
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
