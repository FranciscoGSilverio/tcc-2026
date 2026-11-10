import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { readRows } from '../../../runner/lib/dataset.mjs';
import { analyze, cliffsDelta, cliffsMagnitude, mean, sd } from '../resumo.mjs';

const DATASET = resolve(import.meta.dirname, '..', '..', '..', 'resultados.csv');

test('mean and sample standard deviation', () => {
  assert.equal(mean([1, 2, 3]), 2);
  assert.equal(sd([1, 2, 3]), 1);
  assert.ok(Number.isNaN(sd([4])), 'one value has no sample sd');
});

test("Cliff's delta counts dominance over every pair", () => {
  assert.equal(cliffsDelta([3, 4], [1, 2]), 1);
  assert.equal(cliffsDelta([1, 2], [3, 4]), -1);
  assert.equal(cliffsDelta([1, 1], [1, 1]), 0);
  // 2x2 with one tie and three wins: (3 - 0) / 4
  assert.equal(cliffsDelta([1, 2], [1, 0]), 0.75);
});

test("Cliff's magnitude uses the Romano et al. thresholds", () => {
  assert.equal(cliffsMagnitude(0.1), 'desprezível');
  assert.equal(cliffsMagnitude(-0.2), 'pequeno');
  assert.equal(cliffsMagnitude(0.4), 'médio');
  assert.equal(cliffsMagnitude(-0.5), 'grande');
});

test('on the real dataset: only valid rows, and convergence comes from convergencia.mjs', () => {
  const result = analyze(readRows(DATASET));
  assert.equal(result.scope.valid, 50);
  assert.equal(result.cells.reduce((acc, c) => acc + c.n, 0), 50);
  assert.equal(result.convergence['sonnet-5 P0-O1'], 0.5);
  assert.equal(result.convergence['haiku-4-5 P0-O1'], 0.1);
  const total = result.contrasts.find((c) => c.id === 'harness-total');
  assert.equal(total.metrics.find((m) => m.label.startsWith('taxa')).delta, 1);
});
