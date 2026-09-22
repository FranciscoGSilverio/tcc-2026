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

// Symmetric to escape(): a field is quoted when it contains a comma, a
// quote or a newline, and a doubled quote inside a quoted field means one
// literal quote. A naive split(',') would corrupt any invalid_reason or
// detail string that happens to contain a comma.
function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i += 1; continue;
      }
      field += char; i += 1; continue;
    }
    if (char === '"') { inQuotes = true; i += 1; continue; }
    if (char === ',') { row.push(field); field = ''; i += 1; continue; }
    if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; i += 1; continue; }
    if (char === '\r') { i += 1; continue; }
    field += char; i += 1;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

export function readRows(csvPath) {
  if (!existsSync(csvPath)) return [];
  const text = readFileSync(csvPath, 'utf8');
  const parsed = parseCsv(text).filter((cells) => cells.length > 1 || cells[0] !== '');
  const [header, ...dataRows] = parsed;
  if (!header) return [];
  return dataRows.map((cells) => Object.fromEntries(header.map((column, index) => [column, cells[index] ?? ''])));
}

// Rewrites one session's row in place. The dataset is append-only for
// collection, but the blind evaluator runs afterwards over archived
// diffs, so it has to fill columns on rows that already exist. The whole
// file is small (dozens of rows for this project), so read-patch-rewrite
// is simpler than an in-place seek and is exactly as correct.
export function updateRow(csvPath, sessionId, fields) {
  const unknown = Object.keys(fields).filter((key) => !COLUMNS.includes(key));
  if (unknown.length > 0) {
    throw new Error(`updateRow: unknown column(s): ${unknown.join(', ')}`);
  }
  if (!existsSync(csvPath)) {
    throw new Error(`updateRow: ${csvPath} does not exist`);
  }

  const existingHeader = readFileSync(csvPath, 'utf8').split('\n', 1)[0];
  const expectedHeader = COLUMNS.join(',');
  if (existingHeader !== expectedHeader) {
    throw new Error(
      `${csvPath} has a header that does not match the current schema; ` +
      `refusing to update a row that would misalign silently`,
    );
  }

  const rows = readRows(csvPath);
  const index = rows.findIndex((row) => row.session_id === sessionId);
  if (index === -1) {
    throw new Error(`updateRow: no row with session_id ${sessionId} in ${csvPath}`);
  }
  rows[index] = { ...rows[index], ...fields };

  const lines = [expectedHeader, ...rows.map((row) => COLUMNS.map((column) => escape(row[column])).join(','))];
  writeFileSync(csvPath, `${lines.join('\n')}\n`);
}
