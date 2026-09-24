import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyRow } from '../../../runner/lib/dataset.mjs';
import { checkDataset } from '../checks.mjs';

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
