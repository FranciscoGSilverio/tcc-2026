import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO = resolve(import.meta.dirname, '..', '..');

// These tests exercise the whole pipeline and append a row each time they
// run. They must never touch the real dataset (resultados.csv), the file
// the actual collection lands in: a fixed path there would mean every
// `node --test` accumulates fake sessions into it unnoticed. Each test
// file run gets its own scratch CSV instead.
const DATASET_PATH = join(mkdtempSync(join(tmpdir(), 'end-to-end-dataset-')), 'resultados.csv');

const runFake = (fake) => {
  const result = spawnSync('node', [
    resolve(REPO, 'runner', 'run-session.mjs'), '--fake', fake, '--dataset', DATASET_PATH,
  ], {
    encoding: 'utf8', cwd: REPO,
  });
  return JSON.parse(result.stdout);
};

test('the noop fake scores the baseline and is recorded as valid', () => {
  const row = runFake('noop');
  assert.equal(row.status, 'valid');
  assert.equal(row.taxa_aceitacao, 0.5);
  assert.equal(row.regressoes, 0);
  assert.equal(row.travou_sem_diff, true);
  assert.equal(row.travou, true);
});

test('the reference fake scores full marks with no regressions', () => {
  const row = runFake('reference');
  assert.equal(row.status, 'valid');
  assert.equal(row.taxa_aceitacao, 1);
  assert.equal(row.regressoes, 0);
  assert.equal(row.travou, false);
});

test('a broken application is recorded as data, not discarded', () => {
  const row = runFake('break');
  assert.equal(row.status, 'valid');
  assert.equal(row.taxa_aceitacao, 0);
  assert.equal(row.travou_build, true);
  assert.equal(row.travou, true);
  assert.notEqual(row.invalid_reason, 'runner error');
});

test('an O2 session is accepted and recorded, no longer refused', () => {
  const result = spawnSync('node', [
    resolve(REPO, 'runner', 'run-session.mjs'),
    '--fake', 'noop', '--o', 'O2', '--dataset', DATASET_PATH,
  ], { encoding: 'utf8', cwd: REPO });
  const row = JSON.parse(result.stdout);
  assert.equal(row.o_level, 'O2');
  assert.equal(row.status, 'valid');
});
