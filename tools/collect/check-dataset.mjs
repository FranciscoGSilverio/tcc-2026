#!/usr/bin/env node
// Audits what has already been collected. It reads the dataset and the
// archived transcripts and writes nothing, anywhere -- so it can be run
// as often as anyone likes, including after the whole collection.
//
// It does not decide whether the data is good, only whether it is
// integral. Nothing here looks at the value of taxa_aceitacao, qualidade
// or convergence: those are results, and an auditor that failed a bad
// result would be filtering the dataset by the hypothesis.
import { join, resolve } from 'node:path';
import { readRows } from '../../runner/lib/dataset.mjs';
import { checkDataset } from './checks.mjs';

const REPO = resolve(import.meta.dirname, '..', '..');

export function formatReport(results) {
  const lines = [];
  for (const result of results) {
    lines.push(`${result.failures.length === 0 ? 'OK   ' : 'FALHA'} ${result.id}. ${result.name}`);
    for (const note of result.notes) lines.push(`      nota: ${note}`);
    for (const failure of result.failures) lines.push(`      ${failure}`);
  }
  const failed = results.filter((result) => result.failures.length > 0).length;
  lines.push('');
  lines.push(failed === 0
    ? `dataset íntegro: ${results.length} de ${results.length} verificações passaram`
    : `${failed} verificação(ões) reprovada(s)`);
  return lines.join('\n');
}

const argument = (flag, fallback) => {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
};

function main() {
  const datasetPath = resolve(
    argument('--dataset', process.env.RUNNER_DATASET_PATH ?? join(REPO, 'resultados.csv')),
  );
  const results = checkDataset({ rows: readRows(datasetPath), repoRoot: REPO });
  process.stdout.write(`${formatReport(results)}\n`);
  process.exit(results.some((result) => result.failures.length > 0) ? 1 : 0);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}
