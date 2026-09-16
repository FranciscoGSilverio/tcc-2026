import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

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
  } else {
    // A schema change after the file already exists must fail loudly, not
    // silently misalign new rows under an old header: a value that used
    // to land in `travou` would keep landing there under a header that no
    // longer calls that column `travou`, and nothing about writing the row
    // would notice.
    const existingHeader = readFileSync(csvPath, 'utf8').split('\n', 1)[0];
    const expectedHeader = COLUMNS.join(',');
    if (existingHeader !== expectedHeader) {
      throw new Error(
        `${csvPath} has a header that does not match the current schema; ` +
        `refusing to append a row that would misalign silently`,
      );
    }
  }

  appendFileSync(csvPath, `${COLUMNS.map((column) => escape(row[column])).join(',')}\n`);
}
