import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  COLUMNS, functionsFromEslint, parseCsv, SEED, summarize, touchedFunctions,
} from '../complexidade.mjs';
import { toCsv } from '../seguranca.mjs';

const SCRIPT_PATH = resolve(import.meta.dirname, '..', 'complexidade.mjs');

// ESLint's JSON formatter output for one file, trimmed to what is read.
const ESLINT = [{
  filePath: '/tmp/w/src/modules/bookings/service.ts',
  messages: [
    { ruleId: 'complexity', message: "Async function 'updateBooking' has a complexity of 13. Maximum allowed is 0.", line: 10, endLine: 40 },
    { ruleId: 'complexity', message: 'Arrow function has a complexity of 2. Maximum allowed is 0.', line: 20, endLine: 22 },
    { ruleId: 'complexity', message: "Function 'untouched' has a complexity of 1. Maximum allowed is 0.", line: 50, endLine: 55 },
    { ruleId: 'no-console', message: 'Unexpected console statement.', line: 21, endLine: 21 },
  ],
}];

test('functionsFromEslint keeps complexity messages, with name, span and a repository-relative path', () => {
  const functions = functionsFromEslint(ESLINT, '/tmp/w');
  assert.deepEqual(functions.map(({ funcao, complexidade }) => [funcao, complexidade]), [
    ['updateBooking', 13], ['Arrow function', 2], ['untouched', 1],
  ]);
  assert.equal(functions[0].arquivo, 'src/modules/bookings/service.ts');
  assert.equal(functions[0].linha_final, 40);
});

test('a function is touched when an added line falls in its span, and so is the function around it', () => {
  const diff = [
    '--- a/src/modules/bookings/service.ts',
    '+++ b/src/modules/bookings/service.ts',
    '@@ -20,2 +21,3 @@',
    ' context at 21',
    '+added at 22',
    ' context at 23',
  ].join('\r\n');
  const touched = touchedFunctions(functionsFromEslint(ESLINT, '/tmp/w'), diff);
  assert.deepEqual(touched.map(({ funcao }) => funcao), ['updateBooking', 'Arrow function']);
});

test('a line added in another file touches nothing here', () => {
  const diff = ['--- a/src/other.ts', '+++ b/src/other.ts', '@@ -1,0 +1,1 @@', '+x'].join('\n');
  assert.deepEqual(touchedFunctions(functionsFromEslint(ESLINT, '/tmp/w'), diff), []);
});

const RECORDS = [
  { session_id: SEED, task: '', model: '', p_level: '', o_level: '', arquivo: 'src/a.ts', funcao: 'f, with comma', linha: 1, linha_final: 3, complexidade: 4 },
  { session_id: 's1', task: 'T1', model: 'claude-haiku-4-5', p_level: 'P0', o_level: 'O1', arquivo: 'src/b.ts', funcao: 'updateBooking', linha: 1, linha_final: 9, complexidade: 12 },
  { session_id: 's1', task: 'T1', model: 'claude-haiku-4-5', p_level: 'P0', o_level: 'O1', arquivo: 'src/b.ts', funcao: 'g', linha: 10, linha_final: 12, complexidade: 2 },
  { session_id: 's2', task: 'T2', model: 'claude-haiku-4-5', p_level: 'P1', o_level: 'O1', arquivo: 'src/b.ts', funcao: 'updateBooking', linha: 1, linha_final: 9, complexidade: 11 },
];

test('summarize restricts models to the extreme configurations but counts every session over the limit', () => {
  const summary = summarize(RECORDS);
  assert.deepEqual(summary.semente, { n: 1, acima: 0, maximo: 4 });
  assert.deepEqual(summary.por_modelo_extremos['claude-haiku-4-5'], { n: 2, acima: 1, proporcao: 0.5 });
  assert.equal(summary.por_modelo_extremos['claude-opus-5'].n, 0);
  assert.equal(summary.todas_as_sessoes.acima, 2);
  assert.deepEqual(summary.todas_as_sessoes.por_funcao, { 'src/b.ts:updateBooking': 2 });
  assert.deepEqual(summary.distribuicoes['claude-haiku-4-5'], [12, 2]);
});

test('the CSV round-trips, quoted fields included', () => {
  const parsed = parseCsv(toCsv(RECORDS, COLUMNS));
  assert.equal(parsed.length, RECORDS.length);
  assert.equal(parsed[0].funcao, 'f, with comma');
  assert.deepEqual(summarize(parsed), summarize(RECORDS));
});

test('--do-csv aggregates a published CSV without Docker', () => {
  const dir = mkdtempSync(join(tmpdir(), 'complexidade-test-'));
  const path = join(dir, 'complexidade.csv');
  writeFileSync(path, toCsv(RECORDS, COLUMNS).replace(/\n/g, '\r\n'));
  const out = execFileSync(process.execPath, [SCRIPT_PATH, '--do-csv', '--csv-path', path, '--json'], { encoding: 'utf8' });
  const summary = JSON.parse(out);
  assert.equal(summary.semente.n, 1);
  assert.equal(summary.todas_as_sessoes.acima, 2);
  const markdown = execFileSync(process.execPath, [SCRIPT_PATH, '--do-csv', '--csv-path', path], { encoding: 'utf8' });
  assert.match(markdown, /\| haiku-4-5 \| 2 \| 1 \| 50,0% \|/);
});
