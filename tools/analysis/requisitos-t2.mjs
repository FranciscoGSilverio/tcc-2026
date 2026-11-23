// Criterion C2 of the article for T2 (requirements met on the vague
// ticket, section III-F item f.2 and section IV-D), as a rule with one
// implementation. The T1 half of C2 is the hidden suite's byRule and
// needs no script; T2 has no suite, so its requirements are labelled
// here, from the archived diff, per session.
//
// The requirements were extracted from the ticket's sentences (article,
// section III-F). One label each:
//
// explicito -- "offer the user a way to find free times"
//   "sim" when the session added a GET route under src/ whose path names
//   availability or slots (the same rule as consulta_horarios in
//   seguranca.mjs, imported from there), or when a session listed in
//   EXCEPTIONS returns free times some other way. A 409 that only reports
//   the conflicting booking's own times does not count: those are the
//   occupied times the user already collided with, not free ones.
//
// varias_reservas -- "serve whoever organises several bookings at once"
//   "sim" when the session added a POST route whose path names batch or
//   bulk, or a query that accepts several rooms at once (an added line in
//   src/ declaring a `roomIds` field). One room per query, one booking
//   per request, is "nao".
//
// nao_quebra -- "do not break existing behaviour"
//   "sim" when `regressoes` in resultados.csv is 0: the runner restores
//   the seed's own tests and none of them failed after the session.
//
// passado -- "do not offer times that already passed"
//   Only for sessions with explicito = "sim". Taken from the blind
//   evaluator's decision point 9 (`decisao_9` = "filtrado" -> "sim",
//   anything else -> "nao"). It is the one label here not re-read from
//   the diff, and the CSV says so in its evidence column.
//
// Usage:
//   node tools/analysis/requisitos-t2.mjs            report in markdown
//   node tools/analysis/requisitos-t2.mjs --json     the same numbers as JSON
//   node tools/analysis/requisitos-t2.mjs --csv      also writes docs/dados/requisitos-t2.csv
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readRows } from '../../runner/lib/dataset.mjs';
import { classifySecurity, MODELS, parseDiff, readSession, sourceLines, toCsv } from './seguranca.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

// Read by hand. Each entry overrides one label of one session.
export const EXCEPTIONS = {
  'T2-P0-O1-mugaf8rz': {
    explicito: {
      value: 'sim',
      reason: 'sem rota nova, mas o 409 de conflito passa a trazer suggestedSlots: três horários livres calculados por findAvailableSlots (repository.ts), chamado em createBooking (service.ts)',
    },
  },
  'T2-P2-O2-muhczm73': {
    explicito: {
      value: 'nao',
      reason: 'o 409 passa a trazer só conflictingStartsAt/conflictingEndsAt, o horário ocupado da reserva conflitante; nenhum horário livre é oferecido',
    },
  },
};

const BATCH_ROUTE = /\bapp\.post\s*(<[^>]*>)?\s*\(\s*(['"`])[^'"`]*(batch|bulk)[^'"`]*\2/i;
const SEVERAL_ROOMS = /\broomIds\b/;

export function classifyRequirements({ sessionId, diff, regressoes, decisao9 }) {
  const lines = sourceLines(parseDiff(diff));
  const security = classifySecurity({ sessionId: '', task: 'T2', diff });
  const record = { session_id: sessionId };

  record.explicito = security.consulta_horarios;
  record.explicito_evidencia = security.consulta_evidencia;

  const batch = lines.find(({ text }) => BATCH_ROUTE.test(text));
  const rooms = lines.find(({ text }) => SEVERAL_ROOMS.test(text));
  const several = batch ?? rooms;
  record.varias_reservas = several ? 'sim' : 'nao';
  record.varias_evidencia = several ? `${several.path}:${several.line} ${several.text.trim().slice(0, 60)}` : '';

  record.nao_quebra = Number(regressoes) === 0 ? 'sim' : 'nao';
  record.nao_quebra_evidencia = `regressoes=${regressoes}`;

  record.excecao = '';
  for (const [label, { value, reason }] of Object.entries(EXCEPTIONS[sessionId] ?? {})) {
    record[label] = value;
    record[`${label}_evidencia`] = `exceção manual: ${reason}`;
    record.excecao = `${label}: ${reason}`;
  }

  record.passado = record.explicito === 'sim' ? (decisao9 === 'filtrado' ? 'sim' : 'nao') : '';
  record.passado_evidencia = record.explicito === 'sim' ? `avaliador cego, decisao_9=${decisao9}` : '';
  return record;
}

export const COLUMNS = [
  'session_id', 'model', 'p_level', 'o_level',
  'explicito', 'explicito_evidencia',
  'varias_reservas', 'varias_evidencia',
  'nao_quebra', 'nao_quebra_evidencia',
  'passado', 'passado_evidencia',
  'excecao',
];

export function analyze({ rows, repoRoot = REPO_ROOT, read = readSession }) {
  return rows
    .filter((row) => row.status === 'valid' && row.task === 'T2')
    .map((row) => ({
      ...classifyRequirements({
        sessionId: row.session_id,
        diff: read(repoRoot, row.session_id).diff,
        regressoes: row.regressoes,
        decisao9: row.decisao_9,
      }),
      model: row.model, p_level: row.p_level, o_level: row.o_level,
    }));
}

const LABELS = ['explicito', 'varias_reservas', 'nao_quebra', 'passado'];
const extreme = (record) => (record.p_level === 'P0' && record.o_level === 'O1')
  || (record.p_level === 'P2' && record.o_level === 'O2');

export function summarize(records) {
  const tally = (list) => Object.fromEntries(LABELS.map((label) => {
    const applicable = list.filter((record) => record[label] !== '');
    return [label, { sim: applicable.filter((record) => record[label] === 'sim').length, de: applicable.length }];
  }));
  const sonnet = records.filter((record) => record.model === 'claude-sonnet-5');
  return {
    sessoes: records.length,
    extremos_por_modelo: Object.fromEntries(MODELS.map((model) => [model, tally(records.filter((record) => record.model === model && extreme(record)))])),
    p0o1_por_modelo: Object.fromEntries(MODELS.map((model) => [model, tally(records.filter((record) => record.model === model && record.p_level === 'P0' && record.o_level === 'O1'))])),
    sonnet_sem_guia: tally(sonnet.filter((record) => record.p_level === 'P0')),
    sonnet_com_guia: tally(sonnet.filter((record) => record.p_level !== 'P0')),
  };
}

export function formatReport(summary) {
  const cell = ({ sim, de }) => `${sim}/${de}`;
  const table = (title, groups) => [
    `### ${title}`,
    '',
    '| grupo | explícito | várias reservas | não quebrar | passado (avaliador) |',
    '|---|---|---|---|---|',
    ...Object.entries(groups).map(([name, value]) => `| ${name.replace(/^claude-/, '')} | ${LABELS.map((label) => cell(value[label])).join(' | ')} |`),
    '',
  ];
  return [
    '## Requisitos atendidos em T2 (C2)',
    '',
    `Sessões válidas de T2: ${summary.sessoes}. Cada célula: sessões que atendem / sessões em que o requisito se aplica.`,
    '',
    ...table('Configurações extremas (P0-O1 e P2-O2), por modelo', summary.extremos_por_modelo),
    ...table('Só P0-O1, por modelo', summary.p0o1_por_modelo),
    ...table('Sonnet, sem guia (P0) e com guia (P1 e P2)', { 'sem guia': summary.sonnet_sem_guia, 'com guia': summary.sonnet_com_guia }),
  ].join('\n');
}

function main() {
  const records = analyze({ rows: readRows(join(REPO_ROOT, 'resultados.csv')) });
  const summary = summarize(records);
  if (process.argv.includes('--csv')) {
    const path = join(REPO_ROOT, 'docs', 'dados', 'requisitos-t2.csv');
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
