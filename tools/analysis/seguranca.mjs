// Criterion C4 of the article (security, Table VI and section IV-E), as a
// rule with one implementation. Until this script existed the numbers in
// Table VI had no source in the repository.
//
// It reads each valid session's archived diff (sessions/<id>/session.diff)
// and, for T1, the hidden suite's result (sessions/<id>/result.json). It
// never runs the session's code: every label below is static, read off
// the diff, and says what the code was written to do, not what it does
// under load.
//
// Only added lines under src/ count. Tests, docs and the CHANGELOG are not
// the deliverable's behaviour, and a comment saying "two concurrent
// requests can no longer both pass" is not a mechanism.
//
// The labels, one per session:
//
// corrida_tratada (all sessions)
//   "sim" when the session made the conflict check and the write it
//   guards run inside one interactive Prisma transaction: an added line
//   calls `$transaction(` with a callback (`$transaction(async`,
//   `$transaction(fn)` and the like -- anything but the array form
//   `$transaction([`, which batches independent queries and does not make
//   a read-then-write atomic). The seed has no transaction anywhere, so
//   the race exists in every session that did not add one.
//   Every session the rule marks "sim" was read by hand to confirm that
//   the single-booking create path is inside the callback. Where it is
//   not, the session is in EXCEPTIONS with the reason.
//   This is structural. Whether SQLite plus Prisma's interactive
//   transaction actually serialises two simultaneous requests was not
//   exercised by any instrument of the study.
//
// consulta_horarios (T2 only)
//   "sim" when the session added a GET route under src/ whose path names
//   availability or slots (/availab|available|slots|free|livre/). A 409
//   that suggests alternatives is not a query; requisitos-t2.mjs counts it
//   separately, as meeting the ticket's explicit requirement.
//
// limite_periodo (T2 sessions with a query only, "" otherwise)
//   "sim" when an added line declares a named maximum for the query's
//   window or result -- `const MAX_<...>` whose name carries WINDOW,
//   RANGE, DAYS, SPAN, PERIOD, SLOTS or AVAILABILITY -- and the constant
//   is used on at least one other added line (declared and never checked
//   is not a limit). A cap on the number of slots returned counts: it
//   bounds the response the same way a cap on the window does. Read by
//   hand for every session that has a query.
//
// rotas_sem_validacao (all sessions)
//   Number of route registrations added under src/
//   (`app.get|post|put|patch|delete(`) with no `schema` within the call's
//   first three lines (stopping early at the next route registration).
//   The seed validates every route by schema; a new route without one
//   accepts any input.
//
// sql_cru (all sessions)
//   Number of added lines calling `$queryRawUnsafe`, `$executeRawUnsafe`,
//   or `$queryRaw(` / `$executeRaw(` in call form with a string built at
//   runtime. The tagged-template form is parameterised by Prisma and does
//   not count.
//
// segredo_no_codigo (all sessions)
//   Number of added lines under src/ assigning a string literal of six or
//   more characters to a name containing password, secret, api_key,
//   apikey or token.
//
// duracao_sem_limite (T1 only, "" for T2)
//   "sim" when the hidden suite's rule 4 (thirty minutes to eight hours)
//   did not pass all its assertions. Read from result.json, not from the
//   diff, because the suite is what decides whether the limit holds.
//
// Usage:
//   node tools/analysis/seguranca.mjs            report in markdown
//   node tools/analysis/seguranca.mjs --json     the same numbers as JSON
//   node tools/analysis/seguranca.mjs --csv      also writes docs/dados/seguranca.csv
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readRows } from '../../runner/lib/dataset.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

export const MODELS = ['claude-haiku-4-5', 'claude-sonnet-5', 'claude-opus-5'];

// Cases the rule cannot decide on its own, decided by reading the diff.
// Each entry overrides one label of one session and says why.
export const EXCEPTIONS = {
  'T2-P0-O2-mug9m7tj': {
    corrida_tratada: {
      value: 'nao',
      reason: 'a transação envolve só a nova rota POST /batch (createBatch); a criação de uma reserva por POST /bookings continua checando e gravando fora de transação',
    },
  },
};

// Splits a unified diff into the lines it adds, per file, with their
// line numbers in the new file. Carriage returns are dropped first: the
// archived diffs are checked out with CRLF on Windows, and a CR glued to
// every line would make `+++ b/x.ts\r` and `x.ts` different files.
export function parseDiff(text) {
  const files = {};
  let file = null;
  let line = 0;
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    if (raw.startsWith('+++ ')) {
      file = raw.startsWith('+++ b/') ? raw.slice(6) : null;
      if (file) files[file] ??= [];
      continue;
    }
    if (raw.startsWith('--- ') || raw.startsWith('diff --git')) continue;
    const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (hunk) {
      line = Number(hunk[1]);
      continue;
    }
    if (!file) continue;
    if (raw.startsWith('+')) {
      files[file].push({ line, text: raw.slice(1) });
      line += 1;
    } else if (!raw.startsWith('-') && !raw.startsWith('\\')) {
      line += 1;
    }
  }
  return files;
}

// Added lines of production code: under src/, and not comments.
export function sourceLines(files) {
  return Object.entries(files)
    .filter(([path]) => path.startsWith('src/'))
    .flatMap(([path, lines]) => lines.map((entry, index) => ({ path, index, ...entry, all: lines })))
    .filter(({ text }) => !/^\s*(\/\/|\*|\/\*)/.test(text));
}

const INTERACTIVE_TRANSACTION = /\$transaction\s*\(\s*(?!\[)/;
const ROUTE = /\bapp\.(get|post|put|patch|delete)\s*(<[^>]*>)?\s*\(\s*(['"`])([^'"`]*)\3/;
const QUERY_PATH = /availab|available|slots|free|livre/i;
const LIMIT_CONSTANT = /\bconst\s+(MAX_[A-Z0-9_]*(?:WINDOW|RANGE|DAYS|SPAN|PERIOD|SLOTS|AVAILABILITY)[A-Z0-9_]*)\b/;
const RAW_SQL = /\$(queryRawUnsafe|executeRawUnsafe)\s*\(|\$(queryRaw|executeRaw)\s*\(\s*(['"`]|[A-Za-z_])/;
const SECRET = /\b\w*(password|secret|api_?key|apikey|token)\w*\b\s*[:=]\s*(['"`])[^'"`]{6,}\2/i;

const where = ({ path, line }) => `${path}:${line}`;

const EVIDENCE_OF = {
  corrida_tratada: 'corrida_evidencia',
  consulta_horarios: 'consulta_evidencia',
  limite_periodo: 'limite_evidencia',
};

export function classifySecurity({ sessionId, task, diff, hidden = null }) {
  const lines = sourceLines(parseDiff(diff));
  const record = { session_id: sessionId };

  const transaction = lines.find(({ text }) => INTERACTIVE_TRANSACTION.test(text));
  record.corrida_tratada = transaction ? 'sim' : 'nao';
  record.corrida_evidencia = transaction ? `${where(transaction)} ${transaction.text.trim().slice(0, 60)}` : '';

  const routes = lines.map((entry) => ({ entry, match: entry.text.match(ROUTE) })).filter(({ match }) => match);
  const queries = routes.filter(({ match }) => match[1] === 'get' && QUERY_PATH.test(match[4]));
  record.consulta_horarios = task === 'T2' ? (queries.length > 0 ? 'sim' : 'nao') : '';
  record.consulta_evidencia = queries.length > 0
    ? queries.map(({ entry, match }) => `${where(entry)} GET ${match[4]}`).join('; ')
    : '';

  record.limite_periodo = '';
  record.limite_evidencia = '';
  if (record.consulta_horarios === 'sim') {
    const declared = lines.map((entry) => ({ entry, match: entry.text.match(LIMIT_CONSTANT) })).filter(({ match }) => match);
    const used = declared.find(({ entry, match }) => lines.some((other) => other !== entry
      && new RegExp(`\\b${match[1]}\\b`).test(other.text)));
    record.limite_periodo = used ? 'sim' : 'nao';
    record.limite_evidencia = used ? `${where(used.entry)} ${used.entry.text.trim().slice(0, 60)}` : '';
  }

  const unvalidated = routes.filter(({ entry }) => {
    const following = entry.all.slice(entry.index + 1, entry.index + 3);
    const nextRoute = following.findIndex(({ text }) => ROUTE.test(text));
    const call = [entry, ...(nextRoute === -1 ? following : following.slice(0, nextRoute))]
      .map(({ text }) => text).join(' ');
    return !/\bschema\b/.test(call);
  });
  record.rotas_sem_validacao = unvalidated.length;
  record.rotas_sem_validacao_evidencia = unvalidated.map(({ entry }) => where(entry)).join('; ');

  const raw = lines.filter(({ text }) => RAW_SQL.test(text));
  record.sql_cru = raw.length;
  const secrets = lines.filter(({ text }) => SECRET.test(text));
  record.segredo_no_codigo = secrets.length;
  record.sql_segredo_evidencia = [...raw, ...secrets].map(where).join('; ');

  if (task === 'T1' && hidden?.byRule?.['4']) {
    const rule4 = hidden.byRule['4'];
    record.duracao_sem_limite = rule4.passed < rule4.total ? 'sim' : 'nao';
    record.duracao_evidencia = `regra 4: ${rule4.passed}/${rule4.total}`;
  } else {
    record.duracao_sem_limite = '';
    record.duracao_evidencia = '';
  }

  const exceptions = EXCEPTIONS[sessionId] ?? {};
  record.excecao = '';
  for (const [label, { value, reason }] of Object.entries(exceptions)) {
    record[label] = value;
    if (EVIDENCE_OF[label]) record[EVIDENCE_OF[label]] = `exceção manual: ${reason}`;
    record.excecao = `${label}: ${reason}`;
  }
  return record;
}

export const COLUMNS = [
  'session_id', 'task', 'model', 'p_level', 'o_level',
  'corrida_tratada', 'corrida_evidencia',
  'consulta_horarios', 'consulta_evidencia',
  'limite_periodo', 'limite_evidencia',
  'rotas_sem_validacao', 'rotas_sem_validacao_evidencia',
  'sql_cru', 'segredo_no_codigo', 'sql_segredo_evidencia',
  'duracao_sem_limite', 'duracao_evidencia',
  'excecao',
];

export function csvField(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(records, columns) {
  return [columns.join(','), ...records.map((record) => columns.map((column) => csvField(record[column])).join(','))].join('\n') + '\n';
}

export function readSession(repoRoot, sessionId) {
  const dir = join(repoRoot, 'sessions', sessionId);
  const diff = existsSync(join(dir, 'session.diff')) ? readFileSync(join(dir, 'session.diff'), 'utf8') : '';
  const result = existsSync(join(dir, 'result.json')) ? JSON.parse(readFileSync(join(dir, 'result.json'), 'utf8')) : null;
  return { diff, hidden: result?.hidden ?? null };
}

export function analyze({ rows, repoRoot = REPO_ROOT, read = readSession }) {
  return rows
    .filter((row) => row.status === 'valid')
    .map((row) => {
      const { diff, hidden } = read(repoRoot, row.session_id);
      return {
        ...classifySecurity({ sessionId: row.session_id, task: row.task, diff, hidden }),
        task: row.task, model: row.model, p_level: row.p_level, o_level: row.o_level,
      };
    });
}

const extreme = (record) => (record.p_level === 'P0' && record.o_level === 'O1')
  || (record.p_level === 'P2' && record.o_level === 'O2');

export function summarize(records) {
  const count = (list, label, value = 'sim') => list.filter((record) => record[label] === value).length;
  const queries = records.filter((record) => record.consulta_horarios === 'sim');
  const t1Bare = records.filter((record) => record.task === 'T1' && record.p_level === 'P0');
  return {
    sessoes: records.length,
    corrida_persiste: count(records, 'corrida_tratada', 'nao'),
    corrida_tratada: records.filter((record) => record.corrida_tratada === 'sim').map((record) => record.session_id),
    consultas: queries.length,
    consultas_sem_limite: count(queries, 'limite_periodo', 'nao'),
    limite_por_modelo_extremos: Object.fromEntries(MODELS.map((model) => {
      const own = records.filter((record) => record.model === model && record.task === 'T2' && extreme(record));
      const withQuery = own.filter((record) => record.consulta_horarios === 'sim');
      return [model, { sessoes: own.length, com_consulta: withQuery.length, com_limite: count(withQuery, 'limite_periodo') }];
    })),
    sessoes_com_rota_sem_validacao: records.filter((record) => record.rotas_sem_validacao > 0).length,
    sessoes_com_sql_cru: records.filter((record) => record.sql_cru > 0).length,
    sessoes_com_segredo: records.filter((record) => record.segredo_no_codigo > 0).length,
    t1_sem_guia: t1Bare.length,
    t1_sem_guia_duracao_sem_limite: count(t1Bare, 'duracao_sem_limite'),
  };
}

export function formatReport(summary) {
  const lines = [
    '## Segurança (C4)',
    '',
    `Sessões válidas: ${summary.sessoes}.`,
    '',
    '| falha | sessões afetadas |',
    '|---|---|',
    `| comandos maliciosos (SQL cru), segredo no código ou rota sem validação | ${Math.max(summary.sessoes_com_sql_cru, summary.sessoes_com_segredo, summary.sessoes_com_rota_sem_validacao) === 0 ? 0 : `SQL ${summary.sessoes_com_sql_cru}, segredo ${summary.sessoes_com_segredo}, rota ${summary.sessoes_com_rota_sem_validacao}`} de ${summary.sessoes} |`,
    `| reserva duplicada por acesso simultâneo (sem transação) | ${summary.corrida_persiste} de ${summary.sessoes} |`,
    `| consulta de horários sem limite de período | ${summary.consultas_sem_limite} de ${summary.consultas} |`,
    `| duração da reserva sem limite (T1, sem guia) | ${summary.t1_sem_guia_duracao_sem_limite} de ${summary.t1_sem_guia} |`,
    '',
    `Sessões com transação envolvendo checagem e gravação: ${summary.corrida_tratada.join(', ') || '(nenhuma)'}.`,
    '',
    'Limite de período nas configurações extremas (P0-O1 e P2-O2), T2:',
    '',
    '| modelo | sessões | com consulta | com limite |',
    '|---|---|---|---|',
    ...Object.entries(summary.limite_por_modelo_extremos).map(([model, value]) => `| ${model.replace(/^claude-/, '')} | ${value.sessoes} | ${value.com_consulta} | ${value.com_limite} |`),
    '',
  ];
  return lines.join('\n');
}

function main() {
  const rows = readRows(join(REPO_ROOT, 'resultados.csv'));
  const records = analyze({ rows });
  const summary = summarize(records);
  if (process.argv.includes('--csv')) {
    const path = join(REPO_ROOT, 'docs', 'dados', 'seguranca.csv');
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, toCsv(records, COLUMNS));
  }
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify({ resumo: summary, sessoes: records }, null, 2)}\n`);
    return;
  }
  process.stdout.write(formatReport(summary));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
