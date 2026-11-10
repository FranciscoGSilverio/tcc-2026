import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readRows } from '../../../runner/lib/dataset.mjs';
import { PONTOS } from '../../blind-evaluator/lib/pontos.mjs';
import {
  cohensKappa, compare, decodeCsv, normalizeCategory, normalizeYesNo, parseLabels,
} from '../concordancia.mjs';
import { CHECKLIST, drawSample } from '../preparar-rotulagem.mjs';

const REPO = resolve(import.meta.dirname, '..', '..', '..');
const readEvaluation = (id) => JSON.parse(readFileSync(join(REPO, 'sessions', id, 'evaluation.json'), 'utf8'));

test('the kit asks the six questions exactly as the frozen checklist prompt does', () => {
  const prompt = readFileSync(join(REPO, 'tools/blind-evaluator/prompts/checklist.md'), 'utf8');
  CHECKLIST.forEach((question, i) => assert.ok(prompt.includes(`${i + 1}. ${question}`), `pergunta ${i + 1}`));
});

test('the sample is one T2 session per cell, reproducible from the seed', () => {
  const rows = readRows(join(REPO, 'resultados.csv'));
  const a = drawSample(rows, 'x');
  assert.deepEqual(a, drawSample(rows, 'x'));
  assert.equal(a.length, 10);
  const cells = new Set(a.map((id) => {
    const row = rows.find((r) => r.session_id === id);
    assert.equal(row.task, 'T2');
    assert.equal(row.status, 'valid');
    return `${row.model}|${row.p_level}|${row.o_level}`;
  }));
  assert.equal(cells.size, 10);
});

test('labels are accepted by number, text or abbreviation, and nothing else', () => {
  assert.equal(normalizeYesNo('S'), 'sim');
  assert.equal(normalizeYesNo('não'), 'nao');
  assert.equal(normalizeYesNo('talvez'), null);
  assert.equal(normalizeCategory(PONTOS[0], '3'), 'enriquece o erro 409');
  assert.equal(normalizeCategory(PONTOS[0], 'Combinacao'), 'combinação');
  assert.equal(normalizeCategory(PONTOS[0], 'a'), 'ausente');
  assert.equal(normalizeCategory(PONTOS[0], '9'), null);
});

test("Cohen's kappa: perfect, chance, and undefined", () => {
  assert.equal(cohensKappa([['s', 's'], ['n', 'n']]), 1);
  assert.equal(cohensKappa([['s', 's'], ['s', 'n'], ['n', 's'], ['n', 'n']]), 0);
  assert.ok(Number.isNaN(cohensKappa([['s', 's'], ['s', 's']])));
});

test('Excel CSV in Windows-1252 with semicolons is read', () => {
  const header = ['item', ...CHECKLIST.map((_, i) => `c${i + 1}`), ...PONTOS.map((p) => `d${p.n}`)].join(';');
  const buffer = Buffer.from(`${header}\r\nitem-01;n\xe3o\r\n`, 'latin1');
  const [row] = parseLabels(decodeCsv(buffer));
  assert.equal(normalizeYesNo(row.c1), 'nao');
});

test('a human who agrees with the evaluator everywhere gives 100%; one flip shows up as a disagreement', () => {
  const rows = readRows(join(REPO, 'resultados.csv'));
  const ids = drawSample(rows, 'teste');
  const key = { items: ids.map((id, i) => ({ item: `item-${i + 1}`, session_id: id })) };
  const labels = key.items.map(({ item, session_id: id }) => {
    const e = readEvaluation(id);
    return Object.fromEntries([
      ['item', item],
      ...CHECKLIST.map((_, i) => [`c${i + 1}`, e.checklist.answers[String(i + 1)].resposta]),
      ...PONTOS.map((p) => [`d${p.n}`, e.decisionPoints.answers[String(p.n)].categoria]),
    ]);
  });
  const perfect = compare(labels, key, readEvaluation);
  assert.deepEqual(perfect.errors, []);
  assert.equal(perfect.checklist.pooled.agreement, 1);
  assert.equal(perfect.points.pooled.agreement, 1);

  labels[0].c1 = labels[0].c1 === 'sim' ? 'n' : 's';
  const flipped = compare(labels, key, readEvaluation);
  assert.equal(flipped.checklist.per[0].disagreements.length, 1);
  assert.equal(flipped.checklist.pooled.n, 60);
  assert.equal(flipped.points.pooled.n, 100);
});
