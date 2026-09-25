// The auditor's checks, as pure functions over rows. Nothing here writes
// anything, anywhere.
//
// None of them looks at a *value* of a result: taxa_aceitacao, qualidade,
// violacoes, regressoes, cost and convergence appear only as "filled or
// empty", never compared to a threshold. An auditor that failed a dataset
// for a bad result would be filtering the data by the hypothesis.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { COLUMNS } from '../../runner/lib/dataset.mjs';
import { CONTEXTS, ORDERS, TASKS } from '../../runner/lib/capabilities.mjs';

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

// The sessions collected while image_digest could not hold still.
//
// Two separate causes, both now fixed, and both producing the same
// symptom -- a different digest per session for one unchanging
// environment. Until 23/09 prepare() rebuilt the image before every run.
// And until 25/09 buildImage() let BuildKit attach a provenance
// attestation, whose build timestamps changed .Id on every build even when
// every layer was CACHED: measured directly, two consecutive builds gave
// different .Id with identical RootFS layers and identical Config.
//
// So the environment never actually drifted -- the column was recording
// BuildKit's nonce. These rows keep the digests that were measured rather
// than being rewritten with one inferred later: the images they ran on are
// gone and their content cannot be checked now, and replacing a measured
// value with a plausible one is not something a dataset should carry.
// Verification 4 excludes them by name and reports them, so the exclusion
// is visible in every run of the auditor.
//
// They are named here rather than inferred from the data, because any rule
// that inferred the boundary would also read a rebuild in the middle of
// the collection as "a new regime starting here", which is precisely the
// event this verification exists to catch.
export const PRE_STABLE_DIGEST = new Set([
  // Rebuilt per session, before runner/build-image.mjs existed.
  'T1-P0-O1-mu4t4rvp',
  'T1-P0-O1-mu69pgsx',
  'T1-P1-O1-mu69tn5j',
  'T2-P0-O1-mudcr5pg',
  'T2-P0-O1-mudcyv6z',
  'T2-P0-O1-muddre1p',
  'T1-P2-O1-mue3d690',
  'T1-P0-O2-mue3ic8e',
  // Built once, but before --provenance=false made the digest stable.
  'T2-P2-O2-mug80u5e',
  'T2-P0-O1-mug8g8uw',
]);

// Groups the sessions by the value of a column that the protocol holds
// constant, and reports every group when there is more than one. Naming
// both sides matters: "the digest changed" is not actionable, "these
// twenty ran on one image and these twenty-three on another" is.
function constantColumn({ id, name, rows, column, excluded = new Set() }) {
  const considered = rows.filter((row) => row[column] && !excluded.has(row.session_id));
  const groups = new Map();
  for (const row of considered) {
    if (!groups.has(row[column])) groups.set(row[column], []);
    groups.get(row[column]).push(row.session_id);
  }

  const failures = groups.size > 1
    ? [...groups].map(([value, ids]) => `${value}: ${ids.join(', ')}`)
    : [];

  const skipped = rows.filter((row) => excluded.has(row.session_id)).map((row) => row.session_id);
  const notes = skipped.length > 0
    ? [`${skipped.length} sessão(ões) anterior(es) ao digest estável, fora desta verificação: ${skipped.join(', ')}`]
    : [];

  return { id, name, failures, notes };
}

export function loadTranscript(repoRoot, row) {
  if (!row.transcript_path) return { ok: false, reason: 'coluna transcript_path vazia' };
  const path = resolve(repoRoot, row.transcript_path);
  if (!existsSync(path)) return { ok: false, reason: `transcript ausente em ${row.transcript_path}` };

  const lines = readFileSync(path, 'utf8').split('\n').filter((line) => line.trim());
  if (lines.length === 0) return { ok: false, reason: 'transcript vazio' };

  const events = [];
  for (const [index, line] of lines.entries()) {
    try {
      events.push(JSON.parse(line));
    } catch {
      // A broken final line is a transcript cut off mid-write -- the
      // session died without anything noticing. A broken line anywhere
      // else is corruption of a different kind. Both fail; saying which
      // one is what makes the failure actionable.
      return index === lines.length - 1
        ? { ok: false, reason: 'transcript truncado na última linha' }
        : { ok: false, reason: `linha ${index + 1} ilegível` };
    }
  }

  return {
    ok: true,
    events,
    init: events.find((event) => event.type === 'system' && event.subtype === 'init'),
    results: events.filter((event) => event.type === 'result'),
  };
}

// Fifty transcripts read three times over would be waste with nothing in
// return, so the loader is wrapped once per run and the three checks
// share what it read.
function memoize(load) {
  const cache = new Map();
  return (repoRoot, row) => {
    if (!cache.has(row.session_id)) cache.set(row.session_id, load(repoRoot, row));
    return cache.get(row.session_id);
  };
}

function pluginLoadedInP2(rows, repoRoot, load) {
  const pluginName = CONTEXTS.P2.pluginName;
  const failures = [];
  for (const row of validRows(rows).filter((candidate) => candidate.p_level === 'P2')) {
    const transcript = load(repoRoot, row);
    if (!transcript.ok) {
      failures.push(`${row.session_id}: ${transcript.reason}`);
      continue;
    }
    const loaded = transcript.init?.plugins ?? [];
    const names = loaded
      .map((plugin) => (typeof plugin === 'string' ? plugin : plugin?.name))
      .filter(Boolean);
    if (!names.some((name) => String(name).includes(pluginName))) {
      failures.push(`${row.session_id}: init registrou plugins ${JSON.stringify(loaded)}`);
    }
  }
  return { id: 6, name: 'toda sessão P2 carregou o plugin', failures, notes: [] };
}

function transcriptsSane(rows, repoRoot, load) {
  const failures = [];
  for (const row of validRows(rows)) {
    const transcript = load(repoRoot, row);
    if (!transcript.ok) {
      failures.push(`${row.session_id}: ${transcript.reason}`);
      continue;
    }
    if (!transcript.init) {
      failures.push(`${row.session_id}: sem evento de init`);
      continue;
    }
    const order = ORDERS[row.o_level];
    if (!order) {
      failures.push(`${row.session_id}: nível de ordem desconhecido "${row.o_level}"`);
      continue;
    }
    if (transcript.results.length !== order.calls) {
      failures.push(
        `${row.session_id}: ${transcript.results.length} evento(s) result, `
        + `${order.calls} esperado(s) em ${row.o_level}`,
      );
    }
  }
  return { id: 7, name: 'todo transcript está são', failures, notes: [] };
}

// Checks that every CLI error is ACCOUNTED FOR BY A COLUMN, not that no
// CLI error exists. The difference matters, and getting it wrong made this
// verification judge results.
//
// The turn ceiling is a safety stop against an infinite loop, never a
// measure of quality or performance. A session that reaches it is data:
// travou_turnos records it, travou includes it, and the protocol preserves
// the session with a score of zero rather than discarding it. Two opus
// sessions of 25/09 came back with subtype error_max_turns, both with a
// diff of fifteen files, a building application and a full classification
// -- and this verification failed them, which is exactly the filtering by
// hypothesis the auditor is forbidden from doing.
//
// So error_max_turns fails only when travou_turnos did NOT record it,
// which is the case the verification was written for: a CLI error that
// enters the dataset as valid with no trace anywhere. That case still has
// teeth, and it covers a real gap -- in O2 the runner reads the stop
// reason from the last of the four calls, so a middle step that hit the
// ceiling would leave travou_turnos false and be caught here.
function noCliError(rows, repoRoot, load) {
  const failures = [];
  for (const row of validRows(rows)) {
    const transcript = load(repoRoot, row);
    // An unreadable transcript is verification 7's failure; reporting it
    // twice would double-count one defect.
    if (!transcript.ok) continue;
    for (const [index, result] of transcript.results.entries()) {
      if (result.subtype === 'error_max_turns') {
        if (String(row.travou_turnos) !== 'true') {
          failures.push(
            `${row.session_id}: evento result ${index + 1} bateu no teto de turnos e `
            + `travou_turnos não registrou (vale "${row.travou_turnos}")`,
          );
        }
        continue;
      }
      if (result.is_error) {
        failures.push(`${row.session_id}: evento result ${index + 1} com is_error true`);
      }
      if (result.subtype !== 'success') {
        failures.push(`${row.session_id}: evento result ${index + 1} com subtype "${result.subtype}"`);
      }
    }
  }
  return { id: 8, name: 'todo erro do CLI está registrado em coluna', failures, notes: [] };
}

export function checkDataset({ rows, repoRoot, load = loadTranscript }) {
  const read = memoize(load);
  return [
    invalidWithoutReplacement(rows),
    unexpectedEmptyColumns(rows),
    everyValidSessionEvaluated(rows),
    constantColumn({
      id: 4, name: 'image_digest constante', rows, column: 'image_digest', excluded: PRE_STABLE_DIGEST,
    }),
    constantColumn({ id: 5, name: 'cli_version constante', rows, column: 'cli_version' }),
    pluginLoadedInP2(rows, repoRoot, read),
    transcriptsSane(rows, repoRoot, read),
    noCliError(rows, repoRoot, read),
  ];
}
