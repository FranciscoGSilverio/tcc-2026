import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { COLUMNS, emptyRow, appendRow } from '../lib/dataset.mjs';

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
