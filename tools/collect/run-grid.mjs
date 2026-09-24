#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readRows } from '../../runner/lib/dataset.mjs';
import { SESSION_IMAGE, imageId } from '../../runner/lib/container.mjs';
import { cellKey, collectedCounts, missingSessions, nextRunNumber } from './grid.mjs';
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

// run-session.mjs appends exactly one row per invocation, or none when it
// refuses (exit 2). So the dataset is the judge of what happened, not the
// child's exit code: count the rows before, run, count after.
function spawnSession(args, repoRoot) {
  const result = spawnSync('node', args, { cwd: repoRoot, stdio: 'inherit' });
  return { status: result.status ?? 1 };
}

function spawnEvaluator(datasetPath, repoRoot) {
  const result = spawnSync(
    'node',
    [join('tools', 'blind-evaluator', 'evaluate.mjs'), '--all', '--dataset', datasetPath],
    { cwd: repoRoot, stdio: 'inherit' },
  );
  return { status: result.status ?? 1 };
}

function liveImageDigest() {
  try {
    return imageId(SESSION_IMAGE);
  } catch {
    return null;
  }
}

const lastRecordedDigest = (rows) => {
  const digests = rows.map((row) => row.image_digest).filter(Boolean);
  return digests[digests.length - 1] ?? null;
};

// Written only on a real run, never on a dry run. It exists because the
// batch-check skill has to compare what the batch promised with what it
// delivered, and the auditor cannot: the auditor only sees the dataset,
// where seven integral sessions out of a promised ten look exactly like
// seven integral sessions. Terminal scrollback is not evidence -- it is
// usually not even in the agent's context -- so the promise is written
// down.
function writeBatchRecord({ repoRoot, plan, executed, stopped, startedAt, endedAt, datasetPath }) {
  const dir = join(repoRoot, 'sessions', 'lotes');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${startedAt.replaceAll(':', '-')}.json`);
  writeFileSync(path, `${JSON.stringify({
    seed: plan.seed, dataset: datasetPath, startedAt, endedAt,
    promised: plan.batch, executed, stopped,
  }, null, 2)}\n`);
  return path;
}

export async function runBatch({
  datasetPath, repoRoot = REPO, limit = Infinity, seed = randomSeed(), dryRun = false,
  out = (line) => process.stdout.write(`${line}\n`),
  runSession = (args) => spawnSession(args, repoRoot),
  runEvaluator = () => spawnEvaluator(datasetPath, repoRoot),
  imageDigest = liveImageDigest,
  now = () => new Date(),
}) {
  const startedAt = now().toISOString();
  const plan = planBatch({ rows: readRows(datasetPath), limit, seed });
  out(formatPlan(plan));

  if (dryRun) {
    out('');
    out('--dry-run: nada foi executado e nada foi gravado.');
    return { seed, executed: 0, stopped: null, costUsd: 0, recordPath: null };
  }
  if (plan.batch.length === 0) {
    out('');
    out('nada a coletar.');
    return { seed, executed: 0, stopped: null, costUsd: 0, recordPath: null };
  }

  // The dataset carries one digest per session for everything collected
  // before runner/build-image.mjs existed, so the first session of the new
  // regime has to be let through the drift guard. Passing the flag on
  // every batch's first session would disable the guard once per batch
  // for no reason: after one valid session the dataset's baseline IS the
  // current image. So the allowance is taken only when the digests
  // actually differ, and it is spent by the first session that records.
  const digest = imageDigest();
  let allowImageChange = digest !== null && digest !== lastRecordedDigest(readRows(datasetPath));
  if (allowImageChange) {
    out(`atenção: o digest da imagem mudou em relação ao dataset; a primeira sessão do lote leva --allow-image-change`);
  }

  const executed = [];
  let costUsd = 0;
  let stopped = null;

  for (const [index, planned] of plan.batch.entries()) {
    let succeeded = null;
    let lastReason = '';

    for (let attempt = 1; attempt <= 2 && !succeeded; attempt += 1) {
      const before = readRows(datasetPath);
      const run = nextRunNumber(before, planned);
      const args = [
        join('runner', 'run-session.mjs'),
        '--task', planned.task, '--p', planned.pLevel, '--o', planned.oLevel,
        '--model', planned.model, '--run', String(run), '--dataset', datasetPath,
      ];
      if (allowImageChange) args.push('--allow-image-change');

      const child = runSession(args);
      const after = readRows(datasetPath);
      const row = after.length > before.length ? after[after.length - 1] : null;

      if (row?.status === 'valid') {
        succeeded = row;
        break;
      }
      lastReason = row
        ? (row.invalid_reason || 'sessão inválida sem motivo registrado')
        : `run-session.mjs saiu com código ${child.status} sem gravar linha`;
      out(`  tentativa ${attempt} de ${sessionLabel({ ...planned, run })} falhou: ${lastReason}`);
    }

    if (!succeeded) {
      stopped = { session: planned, reason: lastReason };
      out(`PARADO em ${sessionLabel(planned)}: duas tentativas seguidas falharam.`);
      out(`${plan.batch.length - index - 1} sessão(ões) do lote não foram executadas. Conserte e rode de novo — o que já foi coletado não se repete.`);
      break;
    }

    allowImageChange = false;
    const sessionCost = Number(succeeded.custo_usd) || 0;
    costUsd += sessionCost;
    executed.push({
      sessionId: succeeded.session_id, task: planned.task, pLevel: planned.pLevel,
      oLevel: planned.oLevel, model: planned.model, run: succeeded.run_number, costUsd: sessionCost,
    });
    out(`[${index + 1}/${plan.batch.length}] ${sessionLabel({ ...planned, run: succeeded.run_number })}`
      + ` — valid, $${sessionCost.toFixed(2)} (acumulado $${costUsd.toFixed(2)})`);
  }

  if (!stopped) {
    out('');
    out('lote concluído; avaliando o que ainda não tem evaluation.json');
    runEvaluator();
  }

  const recordPath = writeBatchRecord({
    repoRoot, plan, executed, stopped, startedAt, endedAt: now().toISOString(), datasetPath,
  });
  out(`registro do lote: ${recordPath}`);

  return { seed, executed: executed.length, stopped, costUsd, recordPath };
}

async function main() {
  const limit = parseLimit(argument('--limite', null));
  const seed = argument('--seed', randomSeed());
  const datasetPath = resolve(
    argument('--dataset', process.env.RUNNER_DATASET_PATH ?? join(REPO, 'resultados.csv')),
  );
  const result = await runBatch({
    datasetPath, limit, seed, dryRun: process.argv.includes('--dry-run'),
  });
  if (result.stopped) process.exit(1);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  await main();
}
