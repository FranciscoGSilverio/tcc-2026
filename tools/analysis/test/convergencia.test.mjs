import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { appendRow, emptyRow, readRows } from '../../../runner/lib/dataset.mjs';
import { analyze, convergenceOverPoints, formatReport, POINTS } from '../convergencia.mjs';

const SCRIPT_PATH = resolve(import.meta.dirname, '..', 'convergencia.mjs');

let counter = 0;
function nextId(prefix) {
  counter += 1;
  return `${prefix}-${counter}`;
}

// Builds one dataset row the way the real pipeline would leave it: an
// emptyRow() from the real 41-column schema, with only the fields this
// test cares about set. `categories` is either an array of the 10
// decisao_N values (a classified row) or omitted (a valid row still
// pending evaluation, exactly as the runner leaves it before the blind
// evaluator runs).
function makeRow({ pLevel, oLevel, status = 'valid', categories = null, sessionId = null }) {
  const row = {
    ...emptyRow(),
    session_id: sessionId ?? nextId(`T2-${pLevel}-${oLevel}`),
    task: 'T2',
    p_level: pLevel,
    o_level: oLevel,
    status,
  };
  if (categories) {
    POINTS.forEach((point, index) => {
      row[`decisao_${point}`] = categories[index];
    });
  }
  return row;
}

function newDataset() {
  const dir = mkdtempSync(join(tmpdir(), 'convergencia-test-'));
  return join(dir, 'resultados.csv');
}

function writeRows(csvPath, rows) {
  for (const row of rows) appendRow(csvPath, row);
}

function analyzeCsv(csvPath) {
  return analyze(readRows(csvPath));
}

// Ten categories for a "fully agreeing" session, reused across the three
// executions of a cell in most fixtures below.
const AGREE_10 = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10'];

test('a cell where three sessions agree on 6 of 10 points prints 6/10', () => {
  const csvPath = newDataset();
  // Points 1-6 agree across all three rows; points 7-10 each get three
  // distinct categories, so they do not converge.
  const perRowCategories = [0, 1, 2].map((run) => [
    'p1', 'p2', 'p3', 'p4', 'p5', 'p6',
    `p7-run${run}`, `p8-run${run}`, `p9-run${run}`, `p10-run${run}`,
  ]);
  writeRows(csvPath, perRowCategories.map((categories) =>
    makeRow({ pLevel: 'P0', oLevel: 'O1', categories })));

  const result = analyzeCsv(csvPath);
  const cell = result.firstCut.find((entry) => entry.cell === 'P0-O1');
  assert.ok(cell, 'P0-O1 should have been computed');
  assert.equal(cell.convergence.converged, 6);
  assert.equal(cell.convergence.total, 10);
  assert.match(formatReport(result), /6\/10/);
});

test('"ausente" in all three executions of a point counts as convergence at that point', () => {
  const allAusente = Array(10).fill('ausente');
  const rows = [0, 1, 2].map(() => allAusente);
  const converged = convergenceOverPoints(
    rows.map((categories) => makeRow({ pLevel: 'P0', oLevel: 'O1', categories })),
    POINTS,
  );
  assert.equal(converged.converged, 10);
  assert.equal(converged.total, 10);
});

test('a cell with two valid sessions is refused, naming the cell and the count', () => {
  const csvPath = newDataset();
  writeRows(csvPath, [
    makeRow({ pLevel: 'P0', oLevel: 'O2', categories: AGREE_10 }),
    makeRow({ pLevel: 'P0', oLevel: 'O2', categories: AGREE_10 }),
  ]);

  const result = analyzeCsv(csvPath);
  assert.equal(result.firstCut.find((entry) => entry.cell === 'P0-O2'), undefined);
  const refusal = result.refusals.find((line) => line.includes('P0-O2'));
  assert.ok(refusal, 'expected a refusal naming P0-O2');
  assert.match(refusal, /\b2\b/);
});

test('a cell with four valid sessions is refused, without picking three', () => {
  const csvPath = newDataset();
  writeRows(csvPath, [
    makeRow({ pLevel: 'P1', oLevel: 'O1', categories: AGREE_10 }),
    makeRow({ pLevel: 'P1', oLevel: 'O1', categories: AGREE_10 }),
    makeRow({ pLevel: 'P1', oLevel: 'O1', categories: AGREE_10 }),
    makeRow({ pLevel: 'P1', oLevel: 'O1', categories: AGREE_10 }),
  ]);

  const result = analyzeCsv(csvPath);
  assert.equal(result.firstCut.find((entry) => entry.cell === 'P1-O1'), undefined);
  const refusal = result.refusals.find((line) => line.includes('P1-O1'));
  assert.ok(refusal, 'expected a refusal naming P1-O1');
  assert.match(refusal, /\b4\b/);
});

test('a valid session with empty decisao_* is reported as pending, and its cell is not computed', () => {
  const csvPath = newDataset();
  const pendingId = nextId('T2-P1-O2-pending');
  writeRows(csvPath, [
    makeRow({ pLevel: 'P1', oLevel: 'O2', categories: AGREE_10 }),
    makeRow({ pLevel: 'P1', oLevel: 'O2', categories: AGREE_10 }),
    makeRow({ pLevel: 'P1', oLevel: 'O2', sessionId: pendingId }), // no categories: still awaiting evaluation
  ]);

  const result = analyzeCsv(csvPath);
  assert.equal(result.firstCut.find((entry) => entry.cell === 'P1-O2'), undefined);
  const refusal = result.refusals.find((line) => line.includes('P1-O2'));
  assert.ok(refusal, 'expected a refusal naming P1-O2');
  assert.match(refusal, /pendente/);
  assert.match(refusal, new RegExp(pendingId));
});

test('an invalid session is ignored: three valid plus one invalid computes normally', () => {
  const csvPath = newDataset();
  writeRows(csvPath, [
    makeRow({ pLevel: 'P2', oLevel: 'O1', categories: AGREE_10 }),
    makeRow({ pLevel: 'P2', oLevel: 'O1', categories: AGREE_10 }),
    makeRow({ pLevel: 'P2', oLevel: 'O1', categories: AGREE_10 }),
    makeRow({ pLevel: 'P2', oLevel: 'O1', status: 'invalid', categories: AGREE_10 }),
  ]);

  const result = analyzeCsv(csvPath);
  const cell = result.firstCut.find((entry) => entry.cell === 'P2-O1');
  assert.ok(cell, 'P2-O1 should have been computed from the three valid rows');
  assert.equal(cell.convergence.converged, 10);
  assert.equal(cell.convergence.total, 10);
});

test('with an incomplete dataset, the second cut is not printed and the output says what is missing', () => {
  const csvPath = newDataset();
  writeRows(csvPath, [
    makeRow({ pLevel: 'P0', oLevel: 'O1', categories: AGREE_10 }),
    makeRow({ pLevel: 'P0', oLevel: 'O1', categories: AGREE_10 }),
    makeRow({ pLevel: 'P0', oLevel: 'O1', categories: AGREE_10 }),
  ]);

  const result = analyzeCsv(csvPath);
  assert.equal(result.secondCut, null);
  assert.ok(result.missing.length > 0);
  const report = formatReport(result);
  assert.doesNotMatch(report, /vivos/);
  assert.match(report, /segundo recorte: recusado/);
  // The five other cells never showed up at all -- still named as missing.
  assert.match(report, /P0-O2/);
  assert.match(report, /P2-O2/);
});

test('with all six T2 cells complete, the second cut is printed and inert points are dataset-wide, not per-cell', () => {
  const csvPath = newDataset();
  const cells = [['P0', 'O1'], ['P0', 'O2'], ['P1', 'O1'], ['P1', 'O2'], ['P2', 'O1'], ['P2', 'O2']];

  for (const [pLevel, oLevel] of cells) {
    for (let run = 0; run < 3; run += 1) {
      // Point 5 is "ausente" everywhere: truly inert.
      // Point 7 is "ausente" only inside P0-O1's three rows: locally
      // unanimous, but live, because P2-O2 (among others) takes a real
      // position on it below.
      const categories = POINTS.map((point) => {
        if (point === 5) return 'ausente';
        if (point === 7 && pLevel === 'P0' && oLevel === 'O1') return 'ausente';
        if (point === 7) return `p7-${pLevel}-${oLevel}`;
        return `common-${point}`;
      });
      writeRows(csvPath, [makeRow({ pLevel, oLevel, categories })]);
    }
  }

  const result = analyzeCsv(csvPath);
  assert.equal(result.scope.sessionCount, 18);
  assert.equal(result.scope.cellCount, 6);
  assert.ok(result.secondCut, 'expected the second cut to be computable');
  assert.deepEqual(result.secondCut.inertPoints, [5]);
  assert.ok(!result.secondCut.livePoints.includes(5));
  assert.ok(result.secondCut.livePoints.includes(7), 'point 7 is not globally inert and must stay live');
  assert.equal(result.secondCut.livePoints.length, 9);

  // P0-O1 converged locally on "ausente" for point 7 (all three rows
  // agree), and that point must still count in its denominator (9 live
  // points), not be dropped as if it were inert.
  const p0o1 = result.secondCut.perCell.find((entry) => entry.cell === 'P0-O1');
  assert.equal(p0o1.convergence.total, 9);
  assert.equal(p0o1.convergence.converged, 9);

  const report = formatReport(result);
  assert.match(report, /vivos/);
  assert.match(report, /pontos inertes.*: 5/);
});

test('running the script does not modify the dataset file', () => {
  const csvPath = newDataset();
  writeRows(csvPath, [
    makeRow({ pLevel: 'P0', oLevel: 'O1', categories: AGREE_10 }),
    makeRow({ pLevel: 'P0', oLevel: 'O1', categories: AGREE_10 }),
    makeRow({ pLevel: 'P0', oLevel: 'O1', categories: AGREE_10 }),
  ]);
  const before = readFileSync(csvPath, 'utf8');

  const output = execFileSync('node', [SCRIPT_PATH, '--dataset', csvPath], { encoding: 'utf8' });

  const after = readFileSync(csvPath, 'utf8');
  assert.equal(after, before);
  assert.match(output, /escopo:/);
});
