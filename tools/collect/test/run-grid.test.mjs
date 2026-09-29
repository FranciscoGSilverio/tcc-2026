import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendRow, emptyRow, readRows } from '../../../runner/lib/dataset.mjs';
import { formatPlan, planBatch, runBatch, sessionLabel } from '../run-grid.mjs';

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

// A stand-in for run-session.mjs: it records the arguments it was given
// and appends the row a real session would have appended. `outcome`
// decides whether that row is valid, invalid, or never written at all
// (the refusal case, where run-session exits 2 without touching the
// dataset).
function fakeRunner({ outcome = () => 'valid', calls = [] } = {}) {
  let counter = 0;
  const run = (args) => {
    const flag = (name) => args[args.indexOf(name) + 1];
    calls.push(args);
    counter += 1;
    const decision = outcome(args, counter);
    if (decision === 'refused') return { status: 2 };
    const row = {
      ...emptyRow(),
      session_id: `${flag('--task')}-${flag('--p')}-${flag('--o')}-fake${counter}`,
      task: flag('--task'), p_level: flag('--p'), o_level: flag('--o'),
      model: flag('--model'), run_number: flag('--run'),
      status: decision, image_digest: 'sha256:novo', cli_version: '2.1.272',
      custo_usd: '0.50',
      invalid_reason: decision === 'invalid' ? 'falha de infraestrutura simulada' : '',
    };
    appendRow(flag('--dataset'), row);
    return { status: 0 };
  };
  return { run, calls };
}

function scratchDataset(rows = []) {
  const dir = mkdtempSync(join(tmpdir(), 'collect-driver-'));
  const datasetPath = join(dir, 'resultados.csv');
  for (const row of rows) appendRow(datasetPath, { ...emptyRow(), ...row });
  return { dir, datasetPath };
}

const silent = () => {};
const baseOptions = (datasetPath, dir) => ({
  datasetPath, repoRoot: dir, out: silent,
  runEvaluator: () => ({ status: 0 }),
  imageDigest: () => 'sha256:novo',
  now: () => new Date('2026-09-23T15:00:00.000Z'),
});

test('two runs with a limit of one execute two different sessions', async () => {
  const { dir, datasetPath } = scratchDataset();
  const runner = fakeRunner();
  const options = { ...baseOptions(datasetPath, dir), limit: 1, seed: 'abc123', runSession: runner.run };

  await runBatch(options);
  await runBatch(options);

  const rows = readRows(datasetPath);
  assert.equal(rows.length, 2);
  const key = (row) => `${row.task}|${row.p_level}|${row.o_level}|${row.model}|${row.run_number}`;
  assert.notEqual(key(rows[0]), key(rows[1]));
});

test('the repetition number handed to run-session is derived, never typed', async () => {
  const { dir, datasetPath } = scratchDataset([
    { session_id: 'seed-row', task: 'T1', p_level: 'P0', o_level: 'O1',
      model: 'claude-sonnet-5', run_number: '1', status: 'valid', image_digest: 'sha256:novo' },
  ]);
  const runner = fakeRunner();
  // Infinity, not a slice: the session this test is about must be in the
  // batch, and a shuffled slice might not contain it.
  await runBatch({ ...baseOptions(datasetPath, dir), limit: Infinity, seed: 'abc123', runSession: runner.run });

  const rows = readRows(datasetPath).filter(
    (row) => row.task === 'T1' && row.p_level === 'P0' && row.o_level === 'O1'
      && row.model === 'claude-sonnet-5');
  assert.deepEqual(rows.map((row) => row.run_number).sort(), ['1', '2']);
});

test('a session that fails twice stops the batch and leaves the rest alone', async () => {
  const { dir, datasetPath } = scratchDataset();
  const runner = fakeRunner({ outcome: (_args, counter) => (counter <= 2 ? 'invalid' : 'valid') });
  const lines = [];
  const result = await runBatch({
    ...baseOptions(datasetPath, dir), out: (line) => lines.push(line),
    limit: 10, seed: 'abc123', runSession: runner.run,
  });

  assert.equal(runner.calls.length, 2);
  assert.equal(result.executed, 0);
  assert.ok(result.stopped);
  assert.match(lines.join('\n'), /PARADO/);
  assert.match(lines.join('\n'), /falha de infraestrutura simulada/);
});

test('a session that fails once and succeeds on the retry does not stop the batch', async () => {
  const { dir, datasetPath } = scratchDataset();
  const runner = fakeRunner({ outcome: (_args, counter) => (counter === 1 ? 'invalid' : 'valid') });
  const result = await runBatch({
    ...baseOptions(datasetPath, dir), limit: 3, seed: 'abc123', runSession: runner.run,
  });

  assert.equal(result.executed, 3);
  assert.equal(result.stopped, null);
  assert.equal(runner.calls.length, 4);
});

test('a refusal that writes no row counts as a failed attempt', async () => {
  const { dir, datasetPath } = scratchDataset();
  const runner = fakeRunner({ outcome: () => 'refused' });
  const lines = [];
  const result = await runBatch({
    ...baseOptions(datasetPath, dir), out: (line) => lines.push(line),
    limit: 5, seed: 'abc123', runSession: runner.run,
  });

  assert.equal(readRows(datasetPath).length, 0);
  assert.ok(result.stopped);
  assert.match(lines.join('\n'), /sem gravar linha/);
});

test('the image change allowance is spent once, and only when the digest differs', async () => {
  const { dir, datasetPath } = scratchDataset([
    { session_id: 'antiga', task: 'T1', p_level: 'P0', o_level: 'O1', model: 'claude-sonnet-5',
      run_number: '1', status: 'valid', image_digest: 'sha256:antiga' },
  ]);
  const runner = fakeRunner();
  await runBatch({ ...baseOptions(datasetPath, dir), limit: 3, seed: 'abc123', runSession: runner.run });

  const allowed = runner.calls.map((args) => args.includes('--allow-image-change'));
  assert.deepEqual(allowed, [true, false, false]);
});

test('no allowance is spent when the image already matches the dataset', async () => {
  const { dir, datasetPath } = scratchDataset([
    { session_id: 'atual', task: 'T1', p_level: 'P0', o_level: 'O1', model: 'claude-sonnet-5',
      run_number: '1', status: 'valid', image_digest: 'sha256:novo' },
  ]);
  const runner = fakeRunner();
  await runBatch({ ...baseOptions(datasetPath, dir), limit: 2, seed: 'abc123', runSession: runner.run });

  assert.deepEqual(runner.calls.map((args) => args.includes('--allow-image-change')), [false, false]);
});

test('the blind evaluator runs once at the end of the batch', async () => {
  const { dir, datasetPath } = scratchDataset();
  let evaluated = 0;
  const runner = fakeRunner();
  await runBatch({
    ...baseOptions(datasetPath, dir), limit: 2, seed: 'abc123',
    runSession: runner.run, runEvaluator: () => { evaluated += 1; return { status: 0 }; },
  });
  assert.equal(evaluated, 1);
});

// The sessions that did land are valid data whatever went wrong with the
// next one, and evaluate.mjs --all skips whatever already has an
// evaluation.json. Skipping the evaluator here would leave them
// unevaluated, and the auditor's verification 3 would then fail on the
// next run reporting "qualidade vazia" for sessions whose only problem is
// that a later session broke. The stop is the batch record's business.
test('the blind evaluator also runs when the batch stopped early', async () => {
  const { dir, datasetPath } = scratchDataset();
  let evaluated = 0;
  const stopping = fakeRunner({ outcome: (_args, counter) => (counter <= 2 ? 'valid' : 'invalid') });
  const result = await runBatch({
    ...baseOptions(datasetPath, dir), limit: 5, seed: 'abc123',
    runSession: stopping.run, runEvaluator: () => { evaluated += 1; return { status: 0 }; },
  });
  assert.ok(result.stopped);
  assert.equal(result.executed, 2);
  assert.equal(evaluated, 1);
});

test('the batch record says what was promised, what ran, and where it stopped', async () => {
  const { dir, datasetPath } = scratchDataset();
  const runner = fakeRunner({ outcome: (_args, counter) => (counter <= 2 ? 'valid' : 'invalid') });
  const result = await runBatch({
    ...baseOptions(datasetPath, dir), limit: 5, seed: 'abc123', runSession: runner.run,
  });

  const record = JSON.parse(readFileSync(result.recordPath, 'utf8'));
  assert.equal(record.seed, 'abc123');
  assert.equal(record.promised.length, 5);
  assert.equal(record.executed.length, 2);
  assert.ok(record.stopped);
  assert.match(record.stopped.reason, /falha de infraestrutura simulada/);
  assert.equal(readdirSync(join(dir, 'sessions', 'lotes')).length, 1);
});

test('a dry run writes no batch record', async () => {
  const { dir, datasetPath } = scratchDataset();
  const runner = fakeRunner();
  await runBatch({
    ...baseOptions(datasetPath, dir), limit: 5, seed: 'abc123',
    runSession: runner.run, dryRun: true,
  });

  assert.equal(runner.calls.length, 0);
  assert.equal(readRows(datasetPath).length, 0);
  assert.equal(existsSync(join(dir, 'sessions', 'lotes')), false);
});

test('progress names the session and the running total', async () => {
  const { dir, datasetPath } = scratchDataset();
  const lines = [];
  const runner = fakeRunner();
  await runBatch({
    ...baseOptions(datasetPath, dir), out: (line) => lines.push(line),
    limit: 2, seed: 'abc123', runSession: runner.run,
  });

  const progress = lines.filter((line) => line.startsWith('['));
  assert.equal(progress.length, 2);
  assert.match(progress[0], /\[1\/2\]/);
  assert.match(progress[1], /acumulado \$1\.00/);
});
