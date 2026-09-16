import { appendFileSync, existsSync, writeFileSync } from 'node:fs';

const DECISION_COLUMNS = Array.from({ length: 10 }, (_, index) => `decisao_${index + 1}`);

export const COLUMNS = [
  'session_id', 'task', 'model', 'model_version', 'p_level', 'o_level', 'run_number',
  'started_at', 'ended_at',
  'image_digest', 'cli_version',
  'status', 'invalid_reason',
  'taxa_aceitacao', 'regressoes', 'violacoes', 'qualidade',
  'custo_usd', 'duracao_s', 'n_tool_calls', 'travou',
  ...DECISION_COLUMNS,
  'n_turns', 'travou_turnos', 'travou_sem_diff', 'travou_build',
  'tokens_input', 'tokens_output', 'tokens_cache_create', 'tokens_cache_read',
  'diff_path', 'transcript_path',
];

export function emptyRow() {
  return Object.fromEntries(COLUMNS.map((column) => [column, '']));
}

const escape = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export function appendRow(csvPath, row) {
  const unknown = Object.keys(row).filter((key) => !COLUMNS.includes(key));
  if (unknown.length > 0) {
    throw new Error(`row carries columns the schema does not know: ${unknown.join(', ')}`);
  }

  if (!existsSync(csvPath)) {
    writeFileSync(csvPath, `${COLUMNS.join(',')}\n`);
  }

  appendFileSync(csvPath, `${COLUMNS.map((column) => escape(row[column])).join(',')}\n`);
}
