// Implements the rule in
// docs/superpowers/specs/2026-09-23-script-de-convergencia-design.md.
//
// `convergencia` is T2's main response variable and does not exist in
// resultados.csv: it comes from applying a rule to three rows of the same
// cell (P level x O level), at analysis time. This script is that rule,
// with a single implementation, so whoever reads the dictionary and
// whoever runs the number are guaranteed to mean the same thing.
//
// It only reads. It never writes a byte anywhere.
import { resolve } from 'node:path';
import { readRows } from '../../runner/lib/dataset.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

const P_LEVELS = ['P0', 'P1', 'P2'];
const O_LEVELS = ['O1', 'O2'];
// Fixed print order: by P, then by O -- the same order the grid in
// protocol section 4.1 is read in.
export const CELLS = P_LEVELS.flatMap((p) => O_LEVELS.map((o) => `${p}-${o}`));

export const POINTS = Array.from({ length: 10 }, (_, index) => index + 1);
const decisionColumn = (point) => `decisao_${point}`;

// A row has ten decision columns filled together by the blind evaluator
// (tools/blind-evaluator/evaluate.mjs writes all ten of a T2 row's
// decisao_* fields in one updateRow call), so "some filled, some not" is
// not a state the pipeline produces. Still, this only asserts "classified"
// when every column carries a value, rather than trusting the first one,
// so a row that somehow ended up partially filled is treated as pending
// instead of silently computed on incomplete data.
export function isClassified(row) {
  return POINTS.every((point) => row[decisionColumn(point)] !== '');
}

function cellKey(row) {
  return `${row.p_level}-${row.o_level}`;
}

// Section 2's opening guard: only status = valid rows are sessions, and
// only T2 has convergence at all. `travou` is deliberately not part of
// this filter -- a session whose application would not boot still has a
// classifiable diff, and the protocol records it as data rather than
// discarding it (README.md, "Os três substitutos": the `break` fake keeps
// status: valid).
function validT2Rows(rows) {
  return rows.filter((row) => row.task === 'T2' && row.status === 'valid');
}

function groupByCell(rows) {
  const map = new Map(CELLS.map((cell) => [cell, []]));
  for (const row of rows) {
    const key = cellKey(row);
    if (map.has(key)) map.get(key).push(row);
  }
  return map;
}

// The three guards from section 3 of the design, in the order they are
// meant to fire: count first (a cell is a fixed set of exactly three
// sessions, not an estimate), then classification (an unevaluated session
// is "not ready", never "did not converge").
function resolveCell(cellRows) {
  if (cellRows.length !== 3) {
    return { status: 'count', count: cellRows.length };
  }
  const pending = cellRows.filter((row) => !isClassified(row));
  if (pending.length > 0) {
    return { status: 'pending', pendingSessionIds: pending.map((row) => row.session_id) };
  }
  return { status: 'ok', rows: cellRows };
}

// The convergence rule itself, applied to exactly three rows over
// whichever set of decision points is in scope (all ten for the first
// cut, the live subset for the second): for each point, do the three
// rows carry the same category -- "ausente" included, since three
// sessions that all left a point untouched agreed not to touch it.
export function convergenceOverPoints(cellRows, points) {
  let converged = 0;
  let distinctSum = 0;
  for (const point of points) {
    const categories = cellRows.map((row) => row[decisionColumn(point)]);
    const distinct = new Set(categories).size;
    distinctSum += distinct;
    if (distinct === 1) converged += 1;
  }
  const total = points.length;
  return {
    converged,
    total,
    ratio: total === 0 ? 0 : converged / total,
    avgDistinct: total === 0 ? 0 : distinctSum / total,
  };
}

function countLabel(count) {
  if (count === 0) return '0 sessões válidas e classificadas (requer exatamente 3)';
  if (count < 3) return `${count} sessões válidas e classificadas (requer exatamente 3)`;
  return `${count} sessões válidas e classificadas (requer exatamente 3; escolher quais três usar é decisão humana)`;
}

function cellRefusalMessage(cell, resolved) {
  if (resolved.status === 'count') {
    return `célula ${cell}: recusada — ${countLabel(resolved.count)}`;
  }
  return `célula ${cell}: recusada — sessão(ões) pendente(s) de avaliação: ${resolved.pendingSessionIds.join(', ')}`;
}

// Pure computation: takes every row of resultados.csv (or a fixture) and
// returns a structured result. Kept separate from formatting and from
// reading the file so each concern can be tested on its own.
export function analyze(allRows) {
  const rows = validT2Rows(allRows);
  const byCell = groupByCell(rows);

  const cellResults = CELLS.map((cell) => ({ cell, resolved: resolveCell(byCell.get(cell)) }));
  const computed = cellResults.filter((entry) => entry.resolved.status === 'ok');
  const refused = cellResults.filter((entry) => entry.resolved.status !== 'ok');

  const firstCut = computed.map(({ cell, resolved }) => ({
    cell,
    convergence: convergenceOverPoints(resolved.rows, POINTS),
  }));

  const scope = {
    sessionCount: computed.length * 3,
    cellCount: computed.length,
  };

  // Guard 3: the second cut needs all six T2 cells complete, because with
  // a partial dataset there is no way to know which points are globally
  // inert -- that was the actual mistake behind the 22/09 "3/8" number.
  let secondCut = null;
  let missing = [];
  if (computed.length === CELLS.length) {
    const allRowsInScope = computed.flatMap((entry) => entry.resolved.rows);
    const inertPoints = POINTS.filter((point) =>
      allRowsInScope.every((row) => row[decisionColumn(point)] === 'ausente'));
    const livePoints = POINTS.filter((point) => !inertPoints.includes(point));
    secondCut = {
      inertPoints,
      livePoints,
      perCell: computed.map(({ cell, resolved }) => ({
        cell,
        convergence: convergenceOverPoints(resolved.rows, livePoints),
      })),
    };
  } else {
    missing = refused.map(({ cell, resolved }) => cellRefusalMessage(cell, resolved));
  }

  return {
    scope,
    firstCut,
    refusals: refused.map(({ cell, resolved }) => cellRefusalMessage(cell, resolved)),
    secondCut,
    missing,
  };
}

function formatNumber(value, decimals = 2) {
  return value.toFixed(decimals).replace('.', ',');
}

function formatFraction(convergence) {
  return `${convergence.converged}/${convergence.total} = ${formatNumber(convergence.ratio)}`;
}

function formatCellTable(entries, header) {
  const lines = [`célula    ${header}   categorias distintas/ponto`];
  for (const { cell, convergence } of entries) {
    lines.push(`${cell.padEnd(9)} ${formatFraction(convergence).padStart(17)}   ${formatNumber(convergence.avgDistinct).padStart(24)}`);
  }
  return lines;
}

export function formatReport(result) {
  const lines = [];
  lines.push(`escopo: ${result.scope.sessionCount} sessões de T2, válidas e classificadas, em ${result.scope.cellCount} célula(s)`);
  lines.push('');

  if (result.firstCut.length > 0) {
    lines.push(...formatCellTable(result.firstCut, 'convergência(10)'));
  } else {
    lines.push('(nenhuma célula de T2 pôde ser calculada)');
  }

  if (result.refusals.length > 0) {
    lines.push('');
    lines.push(...result.refusals);
  }

  lines.push('');
  if (result.secondCut) {
    const { inertPoints, livePoints, perCell } = result.secondCut;
    lines.push(`pontos inertes no dataset (ausentes em todas as ${result.scope.sessionCount}): ${inertPoints.length > 0 ? inertPoints.join(', ') : '(nenhum)'}`);
    lines.push(...formatCellTable(perCell, `convergência(${livePoints.length} vivos)`));
  } else {
    lines.push('segundo recorte: recusado — depende das seis células de T2 completas (válidas e classificadas). Falta:');
    lines.push(...result.missing.map((line) => `  ${line}`));
  }

  return `${lines.join('\n')}\n`;
}

const argument = (flag, fallback) => {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
};

async function main() {
  const datasetPath = resolve(
    argument('--dataset', process.env.RUNNER_DATASET_PATH ?? resolve(REPO_ROOT, 'resultados.csv')),
  );
  const rows = readRows(datasetPath);
  const result = analyze(rows);
  process.stdout.write(formatReport(result));
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  await main();
}
