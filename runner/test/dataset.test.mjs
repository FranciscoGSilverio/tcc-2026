import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  COLUMNS, emptyRow, appendRow, readRows, updateRow,
} from '../lib/dataset.mjs';

test('the schema carries every group the spec lists', () => {
  for (const column of [
    'session_id', 'task', 'model', 'model_version', 'p_level', 'o_level', 'run_number',
    'started_at', 'ended_at', 'image_digest', 'cli_version', 'status', 'invalid_reason',
    'taxa_aceitacao', 'regressoes', 'violacoes', 'qualidade', 'custo_usd', 'duracao_s',
    'n_tool_calls', 'travou', 'n_turns', 'travou_turnos', 'travou_sem_diff', 'travou_build',
    'tokens_input', 'tokens_output', 'tokens_cache_create', 'tokens_cache_read',
    'diff_path', 'transcript_path',
  ]) {
    assert.ok(COLUMNS.includes(column), `missing column ${column}`);
  }
});

test('the ten decision columns of the ambiguous task exist', () => {
  for (let index = 1; index <= 10; index += 1) {
    assert.ok(COLUMNS.includes(`decisao_${index}`), `missing decisao_${index}`);
  }
});

test('an empty row has one key per column and no extras', () => {
  const row = emptyRow();
  assert.deepEqual(Object.keys(row).sort(), [...COLUMNS].sort());
  assert.equal(Object.values(row).every((value) => value === ''), true);
});

test('writes the header once and appends rows under it', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dataset-'));
  const path = join(directory, 'resultados.csv');

  appendRow(path, { ...emptyRow(), session_id: 'a', task: 'T1' });
  appendRow(path, { ...emptyRow(), session_id: 'b', task: 'T1' });

  const lines = readFileSync(path, 'utf8').trim().split('\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[0], COLUMNS.join(','));
  assert.match(lines[1], /^a,T1,/);
  assert.match(lines[2], /^b,T1,/);
});

test('quotes a value that carries a comma, so the row keeps its shape', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dataset-'));
  const path = join(directory, 'resultados.csv');

  appendRow(path, { ...emptyRow(), session_id: 'a', invalid_reason: 'broke, badly' });

  const row = readFileSync(path, 'utf8').trim().split('\n')[1];
  assert.match(row, /"broke, badly"/);
  assert.equal(row.split(',').length > COLUMNS.length - 1, true);
});

test('refuses a row carrying a column the schema does not know', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dataset-'));
  const path = join(directory, 'resultados.csv');
  assert.throws(() => appendRow(path, { ...emptyRow(), surpresa: 1 }), /surpresa/);
});

test('refuses to append under a header that does not match the current schema', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dataset-'));
  const path = join(directory, 'resultados.csv');
  writeFileSync(path, 'session_id,task,an_old_column\n');

  assert.throws(
    () => appendRow(path, { ...emptyRow(), session_id: 'a' }),
    /header/,
  );

  // Nothing was appended: the file still holds only the stale header.
  assert.equal(readFileSync(path, 'utf8'), 'session_id,task,an_old_column\n');
});

function tempCsv() {
  return join(mkdtempSync(join(tmpdir(), 'dataset-')), 'r.csv');
}

test('readRows round-trips a value containing a comma and a quote', () => {
  const path = tempCsv();
  const row = { ...emptyRow(), session_id: 'abc', invalid_reason: 'failed, said "why"' };
  appendRow(path, row);

  const [read] = readRows(path);
  assert.equal(read.session_id, 'abc');
  assert.equal(read.invalid_reason, 'failed, said "why"');
});

test('readRows returns an empty array for a missing file', () => {
  assert.deepEqual(readRows(join(tmpdir(), 'does-not-exist-xyz.csv')), []);
});

test('updateRow merges fields into the matching row and leaves others untouched', () => {
  const path = tempCsv();
  appendRow(path, { ...emptyRow(), session_id: 'a', qualidade: '' });
  appendRow(path, { ...emptyRow(), session_id: 'b', qualidade: '' });

  updateRow(path, 'a', { qualidade: 5 });

  const rows = readRows(path);
  assert.equal(rows.find((r) => r.session_id === 'a').qualidade, '5');
  assert.equal(rows.find((r) => r.session_id === 'b').qualidade, '');
});

test('updateRow rejects a session_id that does not exist', () => {
  const path = tempCsv();
  appendRow(path, { ...emptyRow(), session_id: 'a' });
  assert.throws(() => updateRow(path, 'nonexistent', { qualidade: 1 }), /no row/);
});

test('updateRow rejects a field that is not a declared column', () => {
  const path = tempCsv();
  appendRow(path, { ...emptyRow(), session_id: 'a' });
  assert.throws(() => updateRow(path, 'a', { not_a_column: 1 }), /unknown column/);
});

test('updateRow rejects a file whose header does not match the current schema', () => {
  const path = tempCsv();
  writeFileSync(path, 'session_id,old_column\na,1\n');
  assert.throws(() => updateRow(path, 'a', { qualidade: 1 }), /does not match/);
});
