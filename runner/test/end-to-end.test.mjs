import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const REPO = resolve(import.meta.dirname, '..', '..');

const runFake = (fake) => {
  const result = spawnSync('node', [resolve(REPO, 'runner', 'run-session.mjs'), '--fake', fake], {
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
