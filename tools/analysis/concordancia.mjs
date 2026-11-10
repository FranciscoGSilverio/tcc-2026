// Protocol section 7, item 6: agreement between the blind evaluator and
// a human classification of the same diffs (blind-evaluator spec, D3).
//
// Reads the labels a person filled in the kit made by
// preparar-rotulagem.mjs, the kit's key, and each session's archived
// evaluation.json, and reports raw agreement and Cohen's kappa for each
// instrument, per question/point and pooled, plus every disagreement with
// the evaluator's own justification -- which is what a reviewer needs to
// decide whether the disagreement is the evaluator's error or the human's.
//
// It only reads. It never writes a byte anywhere.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AUSENTE, PONTOS } from '../blind-evaluator/lib/pontos.mjs';
import { CHECKLIST, LABEL_COLUMNS } from './preparar-rotulagem.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

// Excel saves "CSV" in the system code page unless told otherwise; a
// failed UTF-8 decode is read again as Windows-1252 rather than refused.
export function decodeCsv(buffer) {
  const utf8 = buffer.toString('utf8');
  const text = utf8.includes('�') ? new TextDecoder('windows-1252').decode(buffer) : utf8;
  return text.replace(/^﻿/, '');
}

export function parseLabels(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  const separator = lines[0].includes(';') ? ';' : ',';
  const cells = (line) => line.split(separator).map((c) => c.trim().replace(/^"(.*)"$/, '$1').trim());
  const header = cells(lines[0]).map((h) => h.toLowerCase());
  for (const column of LABEL_COLUMNS) {
    if (!header.includes(column)) throw new Error(`coluna ${column} ausente em rotulos.csv`);
  }
  return lines.slice(1).map((line) => {
    const values = cells(line);
    return Object.fromEntries(header.map((h, i) => [h, values[i] ?? '']));
  });
}

const fold = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

export function normalizeYesNo(value) {
  const v = fold(value);
  if (['s', 'sim', 'y', 'yes', '1'].includes(v)) return 'sim';
  if (['n', 'nao', 'no', '0'].includes(v)) return 'nao';
  return null;
}

// A category by its number in the kit's table, by its text, or `a` /
// `ausente`. Anything else is an error: the evaluator is held to the
// closed list (spec, D7), and so is the human.
export function normalizeCategory(point, value) {
  const v = fold(value);
  if (v === 'a' || v === fold(AUSENTE)) return AUSENTE;
  if (/^\d+$/.test(v)) return point.categorias[Number(v) - 1] ?? null;
  return point.categorias.find((c) => fold(c) === v) ?? null;
}

// Cohen's kappa for two raters over the same items. With every judgement
// in one category on both sides, expected agreement is 1 and kappa is
// undefined; that is reported as such rather than as 0 or 1.
export function cohensKappa(pairs) {
  const n = pairs.length;
  if (n === 0) return NaN;
  const observed = pairs.filter(([a, b]) => a === b).length / n;
  const categories = new Set(pairs.flat());
  let expected = 0;
  for (const c of categories) {
    const pa = pairs.filter(([a]) => a === c).length / n;
    const pb = pairs.filter(([, b]) => b === c).length / n;
    expected += pa * pb;
  }
  return expected === 1 ? NaN : (observed - expected) / (1 - expected);
}

// Landis & Koch (1977), the conventional reading.
export function kappaReading(k) {
  if (Number.isNaN(k)) return 'indefinido (sem variação)';
  if (k < 0) return 'pior que o acaso';
  if (k <= 0.2) return 'leve';
  if (k <= 0.4) return 'razoável';
  if (k <= 0.6) return 'moderada';
  if (k <= 0.8) return 'substancial';
  return 'quase perfeita';
}

export function compare(labels, key, readEvaluation) {
  const sessionOf = new Map(key.items.map(({ item, session_id: s }) => [item, s]));
  const errors = [];
  const checklist = CHECKLIST.map((_, i) => ({ id: `c${i + 1}`, pairs: [], disagreements: [] }));
  const points = PONTOS.map((p) => ({ id: `d${p.n}`, point: p, pairs: [], disagreements: [] }));

  for (const row of labels) {
    const sessionId = sessionOf.get(row.item);
    if (!sessionId) { errors.push(`${row.item}: item fora da chave`); continue; }
    const evaluation = readEvaluation(sessionId);
    checklist.forEach((q, i) => {
      const human = normalizeYesNo(row[q.id] ?? '');
      if (human === null) { errors.push(`${row.item} ${q.id}: "${row[q.id] ?? ''}" não é s/n`); return; }
      const answer = evaluation.checklist.answers[String(i + 1)];
      q.pairs.push([human, answer.resposta]);
      if (human !== answer.resposta) q.disagreements.push({ item: row.item, sessionId, human, model: answer.resposta, why: answer.justificativa });
    });
    points.forEach((d) => {
      const human = normalizeCategory(d.point, row[d.id] ?? '');
      if (human === null) { errors.push(`${row.item} ${d.id}: "${row[d.id] ?? ''}" não é categoria de "${d.point.nome}"`); return; }
      const answer = evaluation.decisionPoints.answers[String(d.point.n)];
      d.pairs.push([human, answer.categoria]);
      if (human !== answer.categoria) d.disagreements.push({ item: row.item, sessionId, human, model: answer.categoria, why: answer.justificativa });
    });
  }
  const missing = key.items.filter(({ item }) => !labels.some((r) => r.item === item)).map(({ item }) => item);
  if (missing.length) errors.push(`itens sem rótulo: ${missing.join(', ')}`);

  const summarize = (list, qualify) => {
    const pooled = list.flatMap((entry) => entry.pairs.map(([a, b]) => (qualify ? [`${entry.id}:${a}`, `${entry.id}:${b}`] : [a, b])));
    return {
      per: list.map((entry) => ({
        id: entry.id,
        n: entry.pairs.length,
        agreement: entry.pairs.filter(([a, b]) => a === b).length / entry.pairs.length,
        kappa: cohensKappa(entry.pairs),
        disagreements: entry.disagreements,
      })),
      pooled: {
        n: pooled.length,
        agreement: pooled.filter(([a, b]) => a === b).length / pooled.length,
        kappa: cohensKappa(pooled),
      },
    };
  };

  // Decision points are pooled with each label qualified by its point, so
  // "ausente" in point 5 and "ausente" in point 7 are different
  // categories for the expected-agreement term, as they should be.
  return { errors, checklist: summarize(checklist, false), points: summarize(points, true) };
}

const pct = (v) => `${(v * 100).toFixed(0)}%`;
const num = (v) => (Number.isNaN(v) ? '—' : v.toFixed(2).replace('.', ','));

export function formatReport(result) {
  const out = ['# Concordância avaliador cego × humano', ''];
  if (result.errors.length) {
    out.push('**Rótulos com problema — corrija e rode de novo:**', '', ...result.errors.map((e) => `- ${e}`), '');
  }
  for (const [title, block, names] of [
    ['Checklist (qualidade)', result.checklist, CHECKLIST],
    ['Pontos de decisão (convergência)', result.points, PONTOS.map((p) => p.nome)],
  ]) {
    out.push(`## ${title}`, '');
    out.push(`Agregado: concordância **${pct(block.pooled.agreement)}** em ${block.pooled.n} julgamentos, kappa de Cohen **${num(block.pooled.kappa)}** (${kappaReading(block.pooled.kappa)}).`, '');
    out.push('| | pergunta | n | concordância | kappa |', '|---|---|---|---|---|');
    block.per.forEach((p, i) => out.push(`| ${p.id} | ${names[i]} | ${p.n} | ${pct(p.agreement)} | ${num(p.kappa)} |`));
    out.push('');
    const all = block.per.flatMap((p) => p.disagreements.map((d) => ({ ...d, id: p.id })));
    if (all.length) {
      out.push('Desacordos:', '');
      for (const d of all) out.push(`- **${d.item} ${d.id}** (${d.sessionId}): humano \`${d.human}\`, avaliador \`${d.model}\` — ${d.why}`);
      out.push('');
    }
  }
  out.push('Kappa lido pelos limiares de Landis e Koch (1977). Com 10 itens por pergunta, o kappa individual é instável; o número a reportar é o agregado.');
  return `${out.join('\n')}\n`;
}

const argument = (flag, fallback) => {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
};

function main() {
  const dir = join(REPO_ROOT, 'rotulagem');
  const labels = parseLabels(decodeCsv(readFileSync(resolve(argument('--rotulos', join(dir, 'rotulos.csv'))))));
  const key = JSON.parse(readFileSync(resolve(argument('--chave', join(dir, 'chave.json'))), 'utf8'));
  const readEvaluation = (sessionId) =>
    JSON.parse(readFileSync(join(REPO_ROOT, 'sessions', sessionId, 'evaluation.json'), 'utf8'));
  const result = compare(labels, key, readEvaluation);
  process.stdout.write(formatReport(result));
  process.exit(result.errors.length ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
