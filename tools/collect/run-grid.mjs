#!/usr/bin/env node
import { join, resolve } from 'node:path';
import { readRows } from '../../runner/lib/dataset.mjs';
import { cellKey, collectedCounts, missingSessions } from './grid.mjs';
import { randomSeed, seededShuffle } from './shuffle.mjs';

const REPO = resolve(import.meta.dirname, '..', '..');

export const sessionLabel = (session) =>
  `${session.task}-${session.pLevel}-${session.oLevel} run ${session.run} (${session.model})`;

// The repetition numbers here are provisional: they are what will be
// derived if every session succeeds. runBatch derives them again from
// the dataset, one session at a time, and that is the number that ends
// up in the row. They agree whenever nothing fails, and when something
// fails the executed one is the one that counts.
export function planBatch({ rows, limit, seed }) {
  const missing = missingSessions(rows);

  const blocks = {};
  for (const session of missing) {
    blocks[session.block] = (blocks[session.block] ?? 0) + 1;
  }

  const counts = collectedCounts(rows);
  const ordered = seededShuffle(missing, seed).map((session) => {
    const key = cellKey(session);
    const run = (counts.get(key) ?? 0) + 1;
    counts.set(key, run);
    return { ...session, run };
  });

  return { seed, total: missing.length, blocks, batch: ordered.slice(0, limit) };
}

export function formatPlan(plan) {
  const byBlock = Object.entries(plan.blocks).map(([block, count]) => `${block}: ${count}`).join(', ');
  return [
    `semente: ${plan.seed}`,
    `faltam ${plan.total} sessões (${byBlock || 'nenhuma'})`,
    `este lote executa ${plan.batch.length}:`,
    ...plan.batch.map((session, index) => `  ${String(index + 1).padStart(2)}. ${sessionLabel(session)}`),
  ].join('\n');
}

const argument = (flag, fallback) => {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
};

function parseLimit(raw) {
  if (raw === undefined || raw === null) return Infinity;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    process.stderr.write(`--limite precisa ser um inteiro positivo; recebi "${raw}"\n`);
    process.exit(2);
  }
  return value;
}

async function main() {
  const limit = parseLimit(argument('--limite', null));
  const seed = argument('--seed', randomSeed());
  const datasetPath = resolve(
    argument('--dataset', process.env.RUNNER_DATASET_PATH ?? join(REPO, 'resultados.csv')),
  );
  const out = (line) => process.stdout.write(`${line}\n`);

  const plan = planBatch({ rows: readRows(datasetPath), limit, seed });
  out(formatPlan(plan));

  if (process.argv.includes('--dry-run')) {
    out('');
    out('--dry-run: nada foi executado e nada foi gravado.');
    return;
  }

  out('');
  out('execução ainda não implementada.');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  await main();
}
