import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { appendRow, emptyRow, readRows } from '../../../runner/lib/dataset.mjs';
import { evaluateSession, runAll } from '../evaluate.mjs';

const REPO = resolve(import.meta.dirname, '..', '..', '..');

function fakeRepo() {
  const repoRoot = mkdtempSync(join(tmpdir(), 'blind-eval-repo-'));
  mkdirSync(join(repoRoot, 'tasks'), { recursive: true });
  writeFileSync(join(repoRoot, 'tasks', 'T1-validacao-de-reservas.md'), 'enunciado de T1');
  writeFileSync(join(repoRoot, 'tasks', 'T2-res-142.md'), 'enunciado de T2');
  return repoRoot;
}

function sessionDir(repoRoot, sessionId, diffText) {
  const dir = join(repoRoot, 'sessions', sessionId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'session.diff'), diffText);
  return dir;
}

const checklistJson = JSON.stringify({
  1: { resposta: 'sim', justificativa: 'a' }, 2: { resposta: 'sim', justificativa: 'b' },
  3: { resposta: 'nao', justificativa: 'c' }, 4: { resposta: 'nao', justificativa: 'd' },
  5: { resposta: 'sim', justificativa: 'e' }, 6: { resposta: 'nao', justificativa: 'f' },
});
const decisionJson = JSON.stringify({
  1: { categoria: 'endpoint novo', justificativa: 'a' }, 2: { categoria: 'horários livres', justificativa: 'b' },
  3: { categoria: 'fixa', justificativa: 'c' }, 4: { categoria: 'dia', justificativa: 'd' },
  5: { categoria: 'comercial', justificativa: 'e' }, 6: { categoria: 'uma sala', justificativa: 'f' },
  7: { categoria: 'UTC', justificativa: 'g' }, 8: { categoria: 'tudo livre', justificativa: 'h' },
  9: { categoria: 'filtrado', justificativa: 'i' }, 10: { categoria: 'ausente', justificativa: 'j' },
});

test('T1 session: only the checklist runs, decision points stay absent', async () => {
  const repoRoot = fakeRepo();
  sessionDir(repoRoot, 's1', 'diff text');
  let calls = 0;
  const callModelImpl = async () => { calls += 1; return { text: checklistJson, costUsd: 0.01, usage: {} }; };

  const result = await evaluateSession({
    row: { session_id: 's1', task: 'T1', diff_path: 'sessions/s1/session.diff' },
    repoRoot, apiKey: 'x', dryRun: false, callModelImpl,
  });

  assert.equal(calls, 1);
  assert.equal(result.evaluation.checklist.qualidade, 3);
  assert.equal(result.evaluation.decisionPoints, null);
});

test('T2 session: checklist and decision points both run', async () => {
  const repoRoot = fakeRepo();
  sessionDir(repoRoot, 's2', 'diff text');
  const responses = [checklistJson, decisionJson];
  const callModelImpl = async () => ({ text: responses.shift(), costUsd: 0.01, usage: {} });

  const result = await evaluateSession({
    row: { session_id: 's2', task: 'T2', diff_path: 'sessions/s2/session.diff' },
    repoRoot, apiKey: 'x', dryRun: false, callModelImpl,
  });

  assert.equal(result.evaluation.checklist.qualidade, 3);
  assert.equal(result.evaluation.decisionPoints.answers[1].categoria, 'endpoint novo');
  assert.equal(result.evaluation.totalCostUsd, 0.02);
});

test('writes evaluation.json under sessions/<id>/', async () => {
  const repoRoot = fakeRepo();
  sessionDir(repoRoot, 's3', 'diff text');
  const callModelImpl = async () => ({ text: checklistJson, costUsd: 0.01, usage: {} });

  await evaluateSession({
    row: { session_id: 's3', task: 'T1', diff_path: 'sessions/s3/session.diff' },
    repoRoot, apiKey: 'x', dryRun: false, callModelImpl,
  });

  const path = join(repoRoot, 'sessions', 's3', 'evaluation.json');
  assert.equal(existsSync(path), true);
  const written = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(written.sessionId, 's3');
});

test('dry-run builds the prompts and never calls the model', async () => {
  const repoRoot = fakeRepo();
  sessionDir(repoRoot, 's4', 'diff text');
  let calls = 0;
  const callModelImpl = async () => { calls += 1; return { text: checklistJson, costUsd: 0, usage: {} }; };

  const result = await evaluateSession({
    row: { session_id: 's4', task: 'T1', diff_path: 'sessions/s4/session.diff' },
    repoRoot, apiKey: 'x', dryRun: true, callModelImpl,
  });

  assert.equal(calls, 0);
  assert.match(result.checklistPrompt, /diff text/);
  assert.equal(existsSync(join(repoRoot, 'sessions', 's4', 'evaluation.json')), false);
});

test('a category outside the closed list fails the session without writing anything', async () => {
  const repoRoot = fakeRepo();
  sessionDir(repoRoot, 's5', 'diff text');
  const callModelImpl = async () => ({ text: '{"garbage": true}', costUsd: 0.01, usage: {} });

  await assert.rejects(() => evaluateSession({
    row: { session_id: 's5', task: 'T1', diff_path: 'sessions/s5/session.diff' },
    repoRoot, apiKey: 'x', dryRun: false, callModelImpl,
  }));
  assert.equal(existsSync(join(repoRoot, 'sessions', 's5', 'evaluation.json')), false);
});

test('CLI: --all skips a row whose status is not valid and one already evaluated', async () => {
  const repoRoot = fakeRepo();
  const datasetPath = join(repoRoot, 'r.csv');
  appendRow(datasetPath, { ...emptyRow(), session_id: 'skip-invalid', task: 'T1', status: 'invalid', diff_path: 'sessions/skip-invalid/session.diff' });
  appendRow(datasetPath, { ...emptyRow(), session_id: 'already-done', task: 'T1', status: 'valid', diff_path: 'sessions/already-done/session.diff' });
  sessionDir(repoRoot, 'already-done', 'diff text');
  writeFileSync(join(repoRoot, 'sessions', 'already-done', 'evaluation.json'), '{}');

  let calls = 0;
  await runAll({ datasetPath, repoRoot, apiKey: 'x', dryRun: false, callModelImpl: async () => { calls += 1; return { text: checklistJson, costUsd: 0, usage: {} }; } });

  assert.equal(calls, 0);
});

// Acceptance criterion from the design spec, section 10: no T1 session
// ever writes a decisao_* column, at the dataset level -- not just in
// evaluation.json, which evaluateSession's own tests above already cover.
test('CLI: a T1 row never gets a decisao_* column written', async () => {
  const repoRoot = fakeRepo();
  const datasetPath = join(repoRoot, 'r.csv');
  appendRow(datasetPath, { ...emptyRow(), session_id: 't1-row', task: 'T1', status: 'valid', diff_path: 'sessions/t1-row/session.diff' });
  sessionDir(repoRoot, 't1-row', 'diff text');

  await runAll({ datasetPath, repoRoot, apiKey: 'x', dryRun: false, callModelImpl: async () => ({ text: checklistJson, costUsd: 0.01, usage: {} }) });

  const [row] = readRows(datasetPath);
  assert.equal(row.qualidade, '3');
  assert.equal(row.decisao_1, '');
  assert.equal(row.decisao_10, '');
});

// Acceptance criterion: a category-outside-the-list failure must not
// touch the dataset at all -- checked here at the CLI level, not just
// that evaluateSession throws (already covered above).
test('CLI: a failed evaluation during --all leaves the dataset row untouched', async () => {
  const repoRoot = fakeRepo();
  const datasetPath = join(repoRoot, 'r.csv');
  appendRow(datasetPath, { ...emptyRow(), session_id: 'will-fail', task: 'T1', status: 'valid', diff_path: 'sessions/will-fail/session.diff' });
  sessionDir(repoRoot, 'will-fail', 'diff text');

  await runAll({ datasetPath, repoRoot, apiKey: 'x', dryRun: false, callModelImpl: async () => ({ text: '{"garbage": true}', costUsd: 0.01, usage: {} }) });

  const [row] = readRows(datasetPath);
  assert.equal(row.qualidade, '');
  assert.equal(existsSync(join(repoRoot, 'sessions', 'will-fail', 'evaluation.json')), false);
});
