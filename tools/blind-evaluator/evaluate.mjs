#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readRows, updateRow } from '../../runner/lib/dataset.mjs';
import { TASKS } from '../../runner/lib/capabilities.mjs';
import { callModel } from './lib/client.mjs';
import { buildChecklistPrompt, buildDecisionPointsPrompt } from './lib/prompts.mjs';
import { parseChecklistResponse, parseDecisionPointsResponse } from './lib/parse.mjs';
import { readReferenceMaterial } from './lib/reference-material.mjs';
import { PONTOS } from './lib/pontos.mjs';

const REPO = resolve(import.meta.dirname, '..', '..');

export async function evaluateSession({ row, repoRoot, apiKey, dryRun, callModelImpl = callModel }) {
  const task = TASKS[row.task];
  if (!task) throw new Error(`evaluateSession: unknown task in row: ${row.task}`);

  const diffPath = resolve(repoRoot, row.diff_path);
  const diffText = existsSync(diffPath) ? readFileSync(diffPath, 'utf8') : '';
  const statement = readFileSync(resolve(repoRoot, task.statement), 'utf8');
  // Deliberately REPO, not the repoRoot parameter above: repoRoot locates
  // this session's tasks/sessions files (and tests fake it with a plain
  // temp directory for hermeticity), but the reference material always
  // has to come from this tool's own real git checkout -- D9 requires
  // byte-identical content from the frozen seed commit, which only
  // exists in the actual research repository, never in a synthetic
  // repoRoot.
  const referenceMaterial = readReferenceMaterial(REPO);

  const checklistPrompt = buildChecklistPrompt({ statement, diff: diffText, referenceMaterial });
  const decisionPointsPrompt = task.decisionPoints
    ? buildDecisionPointsPrompt({ statement, diff: diffText })
    : null;

  if (dryRun) {
    return { dryRun: true, checklistPrompt, decisionPointsPrompt };
  }

  const checklistCall = await callModelImpl({ apiKey, prompt: checklistPrompt });
  const checklist = parseChecklistResponse(checklistCall.text);

  let decisionPoints = null;
  if (task.decisionPoints) {
    const decisionCall = await callModelImpl({ apiKey, prompt: decisionPointsPrompt });
    const parsed = parseDecisionPointsResponse(decisionCall.text);
    decisionPoints = { ...parsed, costUsd: decisionCall.costUsd };
  }

  const evaluation = {
    sessionId: row.session_id,
    evaluatedAt: new Date().toISOString(),
    model: 'claude-sonnet-5',
    checklist: { ...checklist, costUsd: checklistCall.costUsd },
    decisionPoints,
    totalCostUsd: checklistCall.costUsd + (decisionPoints?.costUsd ?? 0),
  };

  const outDir = join(repoRoot, 'sessions', row.session_id);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'evaluation.json'), JSON.stringify(evaluation, null, 2));

  return { dryRun: false, evaluation };
}

function applyToDataset(datasetPath, row, evaluation) {
  const fields = { qualidade: evaluation.checklist.qualidade };
  if (evaluation.decisionPoints) {
    for (const point of PONTOS) {
      fields[`decisao_${point.n}`] = evaluation.decisionPoints.answers[point.n].categoria;
    }
  }
  updateRow(datasetPath, row.session_id, fields);
}

export async function runAll({ datasetPath, repoRoot, apiKey, dryRun, callModelImpl = callModel, sessionId = null }) {
  const rows = readRows(datasetPath);
  const targets = sessionId ? rows.filter((row) => row.session_id === sessionId) : rows;

  for (const row of targets) {
    if (row.status !== 'valid') {
      process.stdout.write(`${row.session_id}: skipped, status is ${row.status || '(empty)'}\n`);
      continue;
    }
    const evalPath = join(repoRoot, 'sessions', row.session_id, 'evaluation.json');
    if (!dryRun && existsSync(evalPath)) {
      process.stdout.write(`${row.session_id}: already evaluated, skipping\n`);
      continue;
    }
    try {
      const result = await evaluateSession({ row, repoRoot, apiKey, dryRun, callModelImpl });
      if (dryRun) {
        process.stdout.write(`${row.session_id}: --- checklist prompt ---\n${result.checklistPrompt}\n`);
        if (result.decisionPointsPrompt) {
          process.stdout.write(`${row.session_id}: --- decision points prompt ---\n${result.decisionPointsPrompt}\n`);
        }
      } else {
        applyToDataset(datasetPath, row, result.evaluation);
        process.stdout.write(`${row.session_id}: evaluated, qualidade=${result.evaluation.checklist.qualidade}\n`);
      }
    } catch (error) {
      process.stderr.write(`${row.session_id}: evaluation failed: ${error.message}\n`);
    }
  }
}

const argument = (flag, fallback) => {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
};

async function main() {
  const sessionId = argument('--session', null);
  const all = process.argv.includes('--all');
  const dryRun = process.argv.includes('--dry-run');
  const datasetPath = resolve(
    argument('--dataset', process.env.RUNNER_DATASET_PATH ?? join(REPO, 'resultados.csv')),
  );

  if (!sessionId && !all) {
    process.stderr.write('usage: node evaluate.mjs --session <id> | --all [--dry-run] [--dataset <path>]\n');
    process.exit(1);
  }

  await runAll({
    datasetPath, repoRoot: REPO, apiKey: process.env.ANTHROPIC_API_KEY ?? '', dryRun, sessionId,
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  await main();
}
