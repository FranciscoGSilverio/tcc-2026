// The auditor's checks, as pure functions over rows. Nothing here writes
// anything, anywhere.
//
// None of them looks at a *value* of a result: taxa_aceitacao, qualidade,
// violacoes, regressoes, cost and convergence appear only as "filled or
// empty", never compared to a threshold. An auditor that failed a dataset
// for a bad result would be filtering the data by the hypothesis.
import { COLUMNS } from '../../runner/lib/dataset.mjs';
import { TASKS } from '../../runner/lib/capabilities.mjs';

const DECISION_COLUMNS = Array.from({ length: 10 }, (_, index) => `decisao_${index + 1}`);

// The division of labour between verifications 2 and 3: verification 2
// owns the columns the runner writes, verification 3 the ones the blind
// evaluator writes. Without the split, a freshly collected batch -- which
// has not been through the evaluator yet -- would fail the wrong check.
export const EVALUATION_COLUMNS = ['qualidade', ...DECISION_COLUMNS];
export const COLLECTION_COLUMNS = COLUMNS.filter((column) => !EVALUATION_COLUMNS.includes(column));

const quintuple = (row) => `${row.task}|${row.p_level}|${row.o_level}|${row.model}|${row.run_number}`;
const validRows = (rows) => rows.filter((row) => row.status === 'valid');

function invalidWithoutReplacement(rows) {
  const replaced = new Set(validRows(rows).map(quintuple));
  const failures = rows
    .filter((row) => row.status !== 'valid' && !replaced.has(quintuple(row)))
    .map((row) => `${row.session_id}: status "${row.status || '(vazio)'}" e nenhuma sessão válida da mesma quíntupla`);
  return { id: 1, name: 'nenhuma linha inválida sem substituta', failures, notes: [] };
}

// Valid rows only. An invalid row has almost everything empty by
// construction -- the session died before anything was measured -- and
// sweeping it here would fail the dataset for having recorded a failure
// correctly. Invalid rows are verification 1's business.
function unexpectedEmptyColumns(rows) {
  const failures = [];
  for (const row of validRows(rows)) {
    const task = TASKS[row.task];
    if (!task) {
      failures.push(`${row.session_id}: tarefa desconhecida "${row.task}"`);
      continue;
    }
    for (const column of COLLECTION_COLUMNS) {
      const value = row[column];
      if (column === 'invalid_reason') {
        if (value !== '') failures.push(`${row.session_id}: invalid_reason preenchida numa sessão válida`);
        continue;
      }
      if (column === 'taxa_aceitacao') {
        if (task.hiddenSuite && value === '') {
          failures.push(`${row.session_id}: taxa_aceitacao vazia em ${row.task}, que tem suíte oculta`);
        }
        if (!task.hiddenSuite && value !== '') {
          failures.push(`${row.session_id}: taxa_aceitacao preenchida em ${row.task}, que não tem suíte oculta`);
        }
        continue;
      }
      if (value === '') failures.push(`${row.session_id}: coluna ${column} vazia`);
    }
  }
  return { id: 2, name: 'nenhuma coluna vazia fora do previsto', failures, notes: [] };
}

function everyValidSessionEvaluated(rows) {
  const failures = [];
  for (const row of validRows(rows)) {
    const task = TASKS[row.task];
    if (!task) continue; // already named by verification 2
    if (row.qualidade === '') failures.push(`${row.session_id}: qualidade vazia`);

    const empty = DECISION_COLUMNS.filter((column) => row[column] === '');
    const filled = DECISION_COLUMNS.filter((column) => row[column] !== '');
    if (task.decisionPoints && empty.length > 0) {
      failures.push(`${row.session_id}: ${empty.length} coluna(s) de decisão vazias em ${row.task}: ${empty.join(', ')}`);
    }
    if (!task.decisionPoints && filled.length > 0) {
      failures.push(`${row.session_id}: colunas de decisão preenchidas em ${row.task}, que não tem pontos de decisão: ${filled.join(', ')}`);
    }
  }
  return { id: 3, name: 'toda sessão válida foi avaliada', failures, notes: [] };
}

export function checkDataset({ rows }) {
  return [
    invalidWithoutReplacement(rows),
    unexpectedEmptyColumns(rows),
    everyValidSessionEvaluated(rows),
  ];
}
