import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emptyRow } from '../../../runner/lib/dataset.mjs';
import { checkDataset, loadTranscript } from '../checks.mjs';
import { formatReport } from '../check-dataset.mjs';

// A row the way the runner leaves it: every collection column filled,
// and the three legitimate empties of the data dictionary respected.
function validRow(overrides = {}) {
  const row = { ...emptyRow() };
  for (const column of Object.keys(row)) row[column] = 'preenchido';
  return {
    ...row,
    session_id: 'T1-P0-O1-aaa', task: 'T1', p_level: 'P0', o_level: 'O1',
    model: 'claude-sonnet-5', run_number: '1', status: 'valid',
    invalid_reason: '', taxa_aceitacao: '0.85', qualidade: '4',
    image_digest: 'sha256:constante', cli_version: '2.1.272',
    transcript_path: 'sessions/T1-P0-O1-aaa/transcript.jsonl',
    ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`decisao_${i + 1}`, ''])),
    ...overrides,
  };
}

function t2Row(overrides = {}) {
  return validRow({
    session_id: 'T2-P0-O1-bbb', task: 'T2', taxa_aceitacao: '',
    transcript_path: 'sessions/T2-P0-O1-bbb/transcript.jsonl',
    ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`decisao_${i + 1}`, 'A'])),
    ...overrides,
  });
}

// Only the dataset checks are exercised here; the transcript ones get a
// loader that always reports a healthy transcript, so this file never
// touches the filesystem.
const healthyTranscript = () => ({
  ok: true,
  init: { type: 'system', subtype: 'init', plugins: [{ name: 'meeting-rooms-conventions' }] },
  results: [{ type: 'result', is_error: false, subtype: 'success' }],
  events: [],
});
const run = (rows) => checkDataset({ rows, repoRoot: '/nao-usado', load: healthyTranscript });
const check = (rows, id) => run(rows).find((result) => result.id === id);

test('the well-formed rows of both tasks pass every dataset check', () => {
  for (const result of run([validRow(), t2Row()])) {
    assert.deepEqual(result.failures, [], `verificação ${result.id} (${result.name})`);
  }
});

test('an invalid row with no valid replacement is a hole', () => {
  const orphan = validRow({ session_id: 'T1-P0-O1-ccc', status: 'invalid', invalid_reason: 'morreu' });
  const failures = check([orphan], 1).failures;
  assert.equal(failures.length, 1);
  assert.match(failures[0], /T1-P0-O1-ccc/);
});

test('an invalid row with a valid session of the same quintuple is not a hole', () => {
  const failed = validRow({ session_id: 'T1-P0-O1-ccc', status: 'invalid', invalid_reason: 'morreu' });
  assert.deepEqual(check([failed, validRow()], 1).failures, []);
});

test('an invalid row is not swept for empty columns; that is verification 1 job', () => {
  const failed = { ...emptyRow(), session_id: 'T1-P0-O1-ccc', task: 'T1', p_level: 'P0',
    o_level: 'O1', model: 'claude-sonnet-5', run_number: '1', status: 'invalid',
    invalid_reason: 'a aplicação não respondeu health antes da entrega' };
  assert.deepEqual(check([failed, validRow()], 2).failures, []);
});

test('an empty collection column in a valid row is caught and named', () => {
  const failures = check([validRow({ duracao_s: '' })], 2).failures;
  assert.equal(failures.length, 1);
  assert.match(failures[0], /duracao_s/);
});

test('the three legitimate empties of the dictionary are not failures', () => {
  assert.deepEqual(check([validRow(), t2Row()], 2).failures, []);
});

test('taxa_aceitacao must be empty in T2 and filled in T1', () => {
  assert.match(check([t2Row({ taxa_aceitacao: '0.9' })], 2).failures[0], /taxa_aceitacao/);
  assert.match(check([validRow({ taxa_aceitacao: '' })], 2).failures[0], /taxa_aceitacao/);
});

test('invalid_reason filled in a valid row is a contradiction', () => {
  assert.match(check([validRow({ invalid_reason: 'algo' })], 2).failures[0], /invalid_reason/);
});

test('a valid session with no qualidade has not been evaluated', () => {
  assert.match(check([validRow({ qualidade: '' })], 3).failures[0], /qualidade/);
});

test('a T2 session with empty decision columns has not been evaluated', () => {
  const failures = check([t2Row({ decisao_4: '', decisao_7: '' })], 3).failures;
  assert.equal(failures.length, 1);
  assert.match(failures[0], /decisao_4/);
  assert.match(failures[0], /decisao_7/);
});

test('a T1 session with decision columns filled is a misfiled row', () => {
  assert.match(check([validRow({ decisao_1: 'A' })], 3).failures[0], /decisao_1/);
});

test('one image digest across the new regime passes', () => {
  assert.deepEqual(check([validRow(), t2Row()], 4).failures, []);
});

test('a digest that changes mid-collection fails and names both sides', () => {
  const failures = check([
    validRow({ session_id: 'a', image_digest: 'sha256:um' }),
    validRow({ session_id: 'b', image_digest: 'sha256:dois' }),
  ], 4).failures;
  assert.equal(failures.length, 2);
  assert.match(failures.join('\n'), /sha256:um.*a/s);
  assert.match(failures.join('\n'), /sha256:dois.*b/s);
});

test('the sessions from before the digest was stable are excluded and named, not failed', () => {
  const result = check([
    validRow({ session_id: 'T1-P0-O1-mu69pgsx', image_digest: 'sha256:antiga-1' }),
    validRow({ session_id: 'T1-P1-O1-mu69tn5j', image_digest: 'sha256:antiga-2' }),
    validRow({ session_id: 'nova', image_digest: 'sha256:constante' }),
  ], 4);
  assert.deepEqual(result.failures, []);
  assert.equal(result.notes.length, 1);
  assert.match(result.notes[0], /T1-P0-O1-mu69pgsx/);
  assert.match(result.notes[0], /T1-P1-O1-mu69tn5j/);
});

test('one cli version across the whole collection passes', () => {
  assert.deepEqual(check([validRow(), t2Row()], 5).failures, []);
});

test('a cli version that changes fails and names both sides', () => {
  const failures = check([
    validRow({ session_id: 'a', cli_version: '2.1.272' }),
    validRow({ session_id: 'b', cli_version: '2.1.280' }),
  ], 5).failures;
  assert.equal(failures.length, 2);
  assert.match(failures.join('\n'), /2\.1\.280/);
});

test('the cli version check covers the old sessions too, because that constant never broke', () => {
  const failures = check([
    validRow({ session_id: 'T1-P0-O1-mu69pgsx', cli_version: '2.1.100' }),
    validRow({ session_id: 'nova', cli_version: '2.1.272' }),
  ], 5).failures;
  assert.equal(failures.length, 2);
});

const initEvent = (plugins = []) =>
  JSON.stringify({ type: 'system', subtype: 'init', plugins, claude_code_version: '2.1.272' });
const resultEvent = (overrides = {}) =>
  JSON.stringify({ type: 'result', subtype: 'success', is_error: false, num_turns: 12, ...overrides });

// Writes a transcript where the row says it is, inside a throwaway repo
// root, so the checks exercise the real path handling rather than a stub.
function scratchRepo(transcripts) {
  const root = mkdtempSync(join(tmpdir(), 'collect-checks-'));
  for (const [sessionId, lines] of Object.entries(transcripts)) {
    mkdirSync(join(root, 'sessions', sessionId), { recursive: true });
    writeFileSync(join(root, 'sessions', sessionId, 'transcript.jsonl'), lines.join('\n'));
  }
  return root;
}

const onDisk = (rows, transcripts, id) => {
  const root = scratchRepo(transcripts);
  return checkDataset({ rows, repoRoot: root }).find((result) => result.id === id);
};

test('an O1 transcript with one init and one result is sane', () => {
  const row = validRow({ session_id: 's1', o_level: 'O1', transcript_path: 'sessions/s1/transcript.jsonl' });
  assert.deepEqual(onDisk([row], { s1: [initEvent(), resultEvent()] }, 7).failures, []);
});

test('an O2 transcript carries four result events, one per chained call', () => {
  const row = validRow({ session_id: 's2', o_level: 'O2', transcript_path: 'sessions/s2/transcript.jsonl' });
  const four = [initEvent(), resultEvent(), resultEvent(), resultEvent(), resultEvent()];
  assert.deepEqual(onDisk([row], { s2: four }, 7).failures, []);

  const three = [initEvent(), resultEvent(), resultEvent(), resultEvent()];
  const failures = onDisk([row], { s2: three }, 7).failures;
  assert.equal(failures.length, 1);
  assert.match(failures[0], /3 evento\(s\) result, 4 esperado\(s\)/);
});

test('a truncated transcript is caught, and the last line is named as the break', () => {
  const row = validRow({ session_id: 's3', transcript_path: 'sessions/s3/transcript.jsonl' });
  const truncated = [initEvent(), '{"type":"result","subty'];
  assert.match(onDisk([row], { s3: truncated }, 7).failures[0], /truncado/);
});

test('a transcript broken in the middle is a different failure from a truncation', () => {
  const row = validRow({ session_id: 's4', transcript_path: 'sessions/s4/transcript.jsonl' });
  const broken = [initEvent(), '{isto nao e json}', resultEvent()];
  assert.match(onDisk([row], { s4: broken }, 7).failures[0], /linha 2 ilegível/);
});

test('a missing transcript file is caught', () => {
  const row = validRow({ session_id: 's5', transcript_path: 'sessions/s5/transcript.jsonl' });
  assert.match(onDisk([row], {}, 7).failures[0], /ausente/);
});

test('a transcript with no init event is caught', () => {
  const row = validRow({ session_id: 's6', transcript_path: 'sessions/s6/transcript.jsonl' });
  assert.match(onDisk([row], { s6: [resultEvent()] }, 7).failures[0], /sem evento de init/);
});

test('a P2 session whose init reports the plugin passes', () => {
  const row = validRow({ session_id: 's7', p_level: 'P2', transcript_path: 'sessions/s7/transcript.jsonl' });
  const lines = [initEvent([{ name: 'meeting-rooms-conventions', version: '1.0.0' }]), resultEvent()];
  assert.deepEqual(onDisk([row], { s7: lines }, 6).failures, []);
});

test('a P2 session whose init reports no plugin ran as P1 with extra steps', () => {
  const row = validRow({ session_id: 's8', p_level: 'P2', transcript_path: 'sessions/s8/transcript.jsonl' });
  const failures = onDisk([row], { s8: [initEvent([]), resultEvent()] }, 6).failures;
  assert.equal(failures.length, 1);
  assert.match(failures[0], /s8/);
});

test('sessions that are not P2 are outside the plugin check', () => {
  const row = validRow({ session_id: 's9', p_level: 'P0', transcript_path: 'sessions/s9/transcript.jsonl' });
  assert.deepEqual(onDisk([row], { s9: [initEvent([]), resultEvent()] }, 6).failures, []);
});

test('a result event reporting an error is caught even though the row says valid', () => {
  const row = validRow({ session_id: 's10', transcript_path: 'sessions/s10/transcript.jsonl' });
  const lines = [initEvent(), resultEvent({ is_error: true })];
  assert.match(onDisk([row], { s10: lines }, 8).failures[0], /is_error/);
});

test('a result subtype other than success is caught', () => {
  const row = validRow({ session_id: 's11', transcript_path: 'sessions/s11/transcript.jsonl' });
  const lines = [initEvent(), resultEvent({ subtype: 'error_max_turns' })];
  assert.match(onDisk([row], { s11: lines }, 8).failures[0], /error_max_turns/);
});

test('an unreadable transcript is reported once, by verification 7 only', () => {
  const row = validRow({ session_id: 's12', transcript_path: 'sessions/s12/transcript.jsonl' });
  assert.equal(onDisk([row], {}, 7).failures.length, 1);
  assert.deepEqual(onDisk([row], {}, 8).failures, []);
});

test('the loader reads a transcript once even though three checks want it', () => {
  const row = validRow({ session_id: 's13', transcript_path: 'sessions/s13/transcript.jsonl' });
  let reads = 0;
  const counting = (repoRoot, target) => { reads += 1; return healthyTranscript(repoRoot, target); };
  checkDataset({ rows: [row], repoRoot: '/nao-usado', load: counting });
  assert.equal(reads, 1);
});

test('loadTranscript reports the path it could not find', () => {
  const result = loadTranscript('/nao-existe', { session_id: 'x', transcript_path: 'sessions/x/transcript.jsonl' });
  assert.equal(result.ok, false);
  assert.match(result.reason, /sessions\/x\/transcript\.jsonl/);
});

test('the report marks each verification and names what failed', () => {
  const text = formatReport([
    { id: 1, name: 'primeira', failures: [], notes: [] },
    { id: 2, name: 'segunda', failures: ['sessao-x: coluna duracao_s vazia'], notes: [] },
    { id: 4, name: 'quarta', failures: [], notes: ['2 sessões anteriores: a, b'] },
  ]);
  assert.match(text, /OK.*1\. primeira/);
  assert.match(text, /FALHA.*2\. segunda/);
  assert.match(text, /sessao-x: coluna duracao_s vazia/);
  assert.match(text, /nota: 2 sessões anteriores/);
  assert.match(text, /1 verificação\(ões\) reprovada\(s\)/);
});

test('a clean report says so in one line', () => {
  const text = formatReport([{ id: 1, name: 'primeira', failures: [], notes: [] }]);
  assert.match(text, /dataset íntegro/);
});
