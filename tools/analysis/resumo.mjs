// Implements protocol section 7, "Plano de análise", items 1, 3, 4 and 5,
// and hands item 2 its numbers (the figures themselves are drawn by
// figuras.py, which reads `--json` from this script). Item 6 -- agreement
// between the blind evaluator and a human -- is concordancia.mjs, because
// it needs a labelled sample that does not live in the dataset.
//
// Descriptive by design. Section 7 rules out significance tests with
// this n, so nothing here computes a p-value; what it computes is means,
// standard deviations, Cliff's delta and the within-cell noise floor.
//
// Convergence is not recomputed here. It is a rule with one
// implementation (convergencia.mjs), and this script imports it rather
// than re-deriving it, for the same reason that script exists at all.
//
// It only reads. It never writes a byte anywhere.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readRows } from '../../runner/lib/dataset.mjs';
import { analyze as analyzeConvergence } from './convergencia.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

export const MODELS = ['claude-haiku-4-5', 'claude-sonnet-5', 'claude-opus-5'];
const SHORT = (model) => model.replace(/^claude-/, '');

// The per-session metrics of section 5.1 that are numbers. `violacoes`
// stays in although it has almost no variance (threat "Efeito de piso
// em violacoes", section 8): leaving it out would hide the floor rather
// than report it.
export const METRICS = [
  { column: 'taxa_aceitacao', label: 'taxa_aceitacao', tasks: ['T1'] },
  { column: 'qualidade', label: 'qualidade (0-6)', tasks: ['T1', 'T2'] },
  { column: 'violacoes', label: 'violacoes', tasks: ['T1', 'T2'] },
  { column: 'regressoes', label: 'regressoes', tasks: ['T1', 'T2'] },
  { column: 'custo_usd', label: 'custo (US$)', tasks: ['T1', 'T2'] },
  { column: 'n_turns', label: 'turnos', tasks: ['T1', 'T2'] },
  { column: 'duracao_s', label: 'duração (s)', tasks: ['T1', 'T2'] },
];

export function mean(values) {
  return values.length === 0 ? NaN : values.reduce((a, b) => a + b, 0) / values.length;
}

// Sample standard deviation (n - 1). With n = 2 or 3 this is a rough
// number, and it is reported as such; it is what section 7 item 1 asks for.
export function sd(values) {
  if (values.length < 2) return NaN;
  const m = mean(values);
  return Math.sqrt(values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1));
}

// Cliff's delta: P(x > y) - P(x < y) over every pair. Positive means the
// first group tends to be higher. With two sessions against two it can
// only take multiples of 0.25, and the report says so next to the number.
export function cliffsDelta(xs, ys) {
  if (xs.length === 0 || ys.length === 0) return NaN;
  let greater = 0;
  let less = 0;
  for (const x of xs) {
    for (const y of ys) {
      if (x > y) greater += 1;
      else if (x < y) less += 1;
    }
  }
  return (greater - less) / (xs.length * ys.length);
}

// Romano et al. (2006) thresholds, the usual reading of Cliff's delta.
export function cliffsMagnitude(delta) {
  const a = Math.abs(delta);
  if (Number.isNaN(a)) return '-';
  if (a < 0.147) return 'desprezível';
  if (a < 0.33) return 'pequeno';
  if (a < 0.474) return 'médio';
  return 'grande';
}

const numeric = (row, column) => (row[column] === '' ? null : Number(row[column]));

function valuesOf(rows, column) {
  return rows.map((row) => numeric(row, column)).filter((v) => v !== null && !Number.isNaN(v));
}

const select = (rows, { model, task, p, o }) => rows.filter((row) =>
  (model === undefined || row.model === model)
  && (task === undefined || row.task === task)
  && (p === undefined || row.p_level === p)
  && (o === undefined || row.o_level === o));

function describe(values) {
  return { n: values.length, mean: mean(values), sd: sd(values), values };
}

// Item 1: every metric, every cell actually collected (model x task x P x O).
function perCell(rows) {
  const keys = new Map();
  for (const row of rows) {
    const key = `${row.model}|${row.task}|${row.p_level}|${row.o_level}`;
    if (!keys.has(key)) keys.set(key, { model: row.model, task: row.task, p: row.p_level, o: row.o_level });
  }
  const order = (c) => [MODELS.indexOf(c.model), c.task, c.p, c.o].join('|');
  return [...keys.values()]
    .sort((a, b) => order(a).localeCompare(order(b)))
    .map((cell) => {
      const cellRows = select(rows, cell);
      const metrics = {};
      for (const metric of METRICS) {
        if (metric.tasks.includes(cell.task)) metrics[metric.column] = describe(valuesOf(cellRows, metric.column));
      }
      return { ...cell, n: cellRows.length, travou: cellRows.filter((r) => r.travou === 'true').length, metrics };
    });
}

function convergenceByCell(allRows) {
  const result = analyzeConvergence(allRows);
  const map = new Map();
  for (const { cell, convergence } of result.firstCut) map.set(cell, convergence.ratio);
  return map;
}
const convergenceKey = (model, p, o) => `${SHORT(model)} ${p}-${o}`;

// Item 3: the model effect at the two extreme configurations.
function modelTable(rows, convergence) {
  const lines = [];
  for (const model of MODELS) {
    for (const [p, o] of [['P0', 'O1'], ['P2', 'O2']]) {
      const t1 = select(rows, { model, task: 'T1', p, o });
      const t2 = select(rows, { model, task: 'T2', p, o });
      const both = [...t1, ...t2];
      lines.push({
        model, p, o,
        taxa_aceitacao: mean(valuesOf(t1, 'taxa_aceitacao')),
        qualidade_t1: mean(valuesOf(t1, 'qualidade')),
        qualidade_t2: mean(valuesOf(t2, 'qualidade')),
        convergencia: convergence.get(convergenceKey(model, p, o)) ?? NaN,
        custo: mean(valuesOf(both, 'custo_usd')),
      });
    }
  }
  return lines;
}

// Item 4. The two contrasts the protocol names, plus three exploratory
// ones inside the Sonnet grid, labelled as outside the plan so nobody
// cites them as if they had been planned.
export const CONTRASTS = [
  {
    id: 'harness-total', planned: true,
    title: 'Efeito total do harness (Sonnet): P2-O2 contra P0-O1',
    a: { model: 'claude-sonnet-5', p: 'P2', o: 'O2' },
    b: { model: 'claude-sonnet-5', p: 'P0', o: 'O1' },
  },
  {
    id: 'pp3', planned: true,
    title: 'PP3: Haiku com harness completo (P2-O2) contra Opus sem harness (P0-O1)',
    a: { model: 'claude-haiku-4-5', p: 'P2', o: 'O2' },
    b: { model: 'claude-opus-5', p: 'P0', o: 'O1' },
  },
  {
    id: 'p1-vs-p0', planned: false,
    title: 'Sonnet, contexto: P1 contra P0 (O1 e O2 juntos)',
    a: { model: 'claude-sonnet-5', p: 'P1' },
    b: { model: 'claude-sonnet-5', p: 'P0' },
  },
  {
    id: 'p2-vs-p1', planned: false,
    title: 'Sonnet, forma do contexto: P2 contra P1 (O1 e O2 juntos)',
    a: { model: 'claude-sonnet-5', p: 'P2' },
    b: { model: 'claude-sonnet-5', p: 'P1' },
  },
  {
    id: 'o2-vs-o1', planned: false,
    title: 'Sonnet, ordem: O2 contra O1 (P0, P1 e P2 juntos)',
    a: { model: 'claude-sonnet-5', o: 'O2' },
    b: { model: 'claude-sonnet-5', o: 'O1' },
  },
];

const CONTRAST_METRICS = [
  { column: 'taxa_aceitacao', task: 'T1', label: 'taxa_aceitacao (T1)' },
  { column: 'qualidade', task: 'T1', label: 'qualidade (T1)' },
  { column: 'qualidade', task: 'T2', label: 'qualidade (T2)' },
  { column: 'custo_usd', task: undefined, label: 'custo US$ (T1+T2)' },
];

function contrasts(rows, convergence) {
  return CONTRASTS.map((contrast) => {
    const metrics = CONTRAST_METRICS.map((metric) => {
      const xs = valuesOf(select(rows, { ...contrast.a, task: metric.task }), metric.column);
      const ys = valuesOf(select(rows, { ...contrast.b, task: metric.task }), metric.column);
      const delta = cliffsDelta(xs, ys);
      return {
        label: metric.label, nA: xs.length, nB: ys.length,
        meanA: mean(xs), meanB: mean(ys), delta, magnitude: cliffsMagnitude(delta),
      };
    });
    // Convergence is one number per cell, so it has no distribution to
    // feed Cliff's delta. It is reported as a plain difference, and only
    // when both sides are single cells.
    let convergenceDiff = null;
    if (contrast.a.o && contrast.a.p && contrast.b.o && contrast.b.p) {
      const ca = convergence.get(convergenceKey(contrast.a.model, contrast.a.p, contrast.a.o));
      const cb = convergence.get(convergenceKey(contrast.b.model, contrast.b.p, contrast.b.o));
      convergenceDiff = { a: ca, b: cb, diff: ca - cb };
    }
    return { ...contrast, metrics, convergenceDiff };
  });
}

// Item 5: within-cell spread of taxa_aceitacao in T1, the noise floor.
// No difference smaller than this should be read as an effect.
function noiseFloor(rows) {
  const cells = perCell(rows).filter((cell) => cell.task === 'T1');
  const ranges = cells.map((cell) => {
    const values = cell.metrics.taxa_aceitacao.values;
    return { model: cell.model, p: cell.p, o: cell.o, values, range: Math.max(...values) - Math.min(...values) };
  });
  const qualityRanges = perCell(rows).map((cell) => {
    const values = cell.metrics.qualidade.values;
    return Math.max(...values) - Math.min(...values);
  });
  return {
    ranges,
    maxRange: Math.max(...ranges.map((r) => r.range)),
    meanRange: mean(ranges.map((r) => r.range)),
    qualityMaxRange: Math.max(...qualityRanges),
    qualityMeanRange: mean(qualityRanges),
  };
}

export function analyze(allRows) {
  const rows = allRows.filter((row) => row.status === 'valid');
  const convergence = convergenceByCell(allRows);
  return {
    scope: {
      valid: rows.length,
      invalid: allRows.length - rows.length,
      t1: rows.filter((r) => r.task === 'T1').length,
      t2: rows.filter((r) => r.task === 'T2').length,
    },
    cells: perCell(rows),
    convergence: Object.fromEntries(convergence),
    modelTable: modelTable(rows, convergence),
    contrasts: contrasts(rows, convergence),
    noiseFloor: noiseFloor(rows),
  };
}

// ---- formatting -----------------------------------------------------

const fmt = (value, decimals = 2) => (Number.isNaN(value) || value === undefined || value === null
  ? '—'
  : value.toFixed(decimals).replace('.', ','));
const signed = (value, decimals = 2) => (Number.isNaN(value) ? '—' : `${value > 0 ? '+' : ''}${fmt(value, decimals)}`);
const decimalsFor = (column) => (column === 'n_turns' || column === 'duracao_s' ? 1 : column === 'taxa_aceitacao' ? 3 : 2);

function table(header, rows) {
  return [
    `| ${header.join(' | ')} |`,
    `|${header.map(() => '---').join('|')}|`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ];
}

export function formatReport(result) {
  const out = [];
  out.push('# Resumo descritivo da coleta');
  out.push('');
  out.push(`Gerado por \`node tools/analysis/resumo.mjs\` a partir de \`resultados.csv\`. Só linhas \`status = valid\`: ${result.scope.valid} sessões (${result.scope.t1} de T1, ${result.scope.t2} de T2); ${result.scope.invalid} inválidas ficam fora. Análise descritiva, sem teste de significância (protocolo, seção 7).`);
  out.push('');

  out.push('## 1. Média e desvio-padrão por célula');
  out.push('');
  out.push('Formato `média ± dp`. Com n = 2 (T1) ou 3 (T2), o desvio-padrão é indicativo.');
  for (const task of ['T1', 'T2']) {
    out.push('');
    out.push(`### ${task}`);
    out.push('');
    const metrics = METRICS.filter((m) => m.tasks.includes(task));
    const header = ['modelo', 'P', 'O', 'n', ...metrics.map((m) => m.label)];
    if (task === 'T2') header.push('convergência');
    const rows = result.cells.filter((c) => c.task === task).map((cell) => {
      const row = [SHORT(cell.model), cell.p, cell.o, String(cell.n),
        ...metrics.map((m) => `${fmt(cell.metrics[m.column].mean, decimalsFor(m.column))} ± ${fmt(cell.metrics[m.column].sd, decimalsFor(m.column))}`)];
      if (task === 'T2') row.push(fmt(result.convergence[convergenceKey(cell.model, cell.p, cell.o)]));
      return row;
    });
    out.push(...table(header, rows));
  }
  const stuck = result.cells.reduce((acc, c) => acc + c.travou, 0);
  out.push('');
  out.push(`Sessões com \`travou = true\`: ${stuck}.`);
  out.push('');

  out.push('## 3. Efeito do modelo nas duas configurações extremas');
  out.push('');
  out.push(...table(
    ['modelo', 'configuração', 'taxa_aceitacao (T1)', 'qualidade T1', 'qualidade T2', 'convergência (T2)', 'custo médio US$'],
    result.modelTable.map((r) => [SHORT(r.model), `${r.p}-${r.o}`, fmt(r.taxa_aceitacao, 3), fmt(r.qualidade_t1), fmt(r.qualidade_t2), fmt(r.convergencia), fmt(r.custo)]),
  ));
  out.push('');

  out.push('## 4. Tamanho de efeito (delta de Cliff)');
  out.push('');
  out.push('Delta positivo: o primeiro grupo tende a ser maior. Magnitude pelos limiares de Romano et al. (2006): < 0,147 desprezível, < 0,33 pequeno, < 0,474 médio, acima grande. Com 2 sessões contra 2, o delta só assume múltiplos de 0,25 — é uma descrição da sobreposição das amostras, não uma estimativa precisa. Convergência é um número por célula e por isso entra como diferença simples, sem delta.');
  for (const contrast of result.contrasts) {
    out.push('');
    out.push(`### ${contrast.title}${contrast.planned ? '' : ' — exploratório, fora do plano da seção 7'}`);
    out.push('');
    out.push(...table(
      ['métrica', 'n (1º · 2º)', 'média 1º', 'média 2º', 'delta de Cliff', 'magnitude'],
      contrast.metrics.map((m) => [m.label, `${m.nA} · ${m.nB}`, fmt(m.meanA, 3), fmt(m.meanB, 3), signed(m.delta), m.magnitude]),
    ));
    if (contrast.convergenceDiff) {
      const c = contrast.convergenceDiff;
      out.push('');
      out.push(`Convergência (T2): ${fmt(c.a)} contra ${fmt(c.b)}, diferença ${signed(c.diff)}.`);
    }
  }
  out.push('');

  out.push('## 5. Piso de ruído em T1');
  out.push('');
  out.push('Amplitude de `taxa_aceitacao` entre as duas repetições da mesma célula. Nenhuma diferença entre células menor que isto deve ser lida como efeito.');
  out.push('');
  out.push(...table(
    ['modelo', 'P', 'O', 'repetições', 'amplitude'],
    result.noiseFloor.ranges.map((r) => [SHORT(r.model), r.p, r.o, r.values.map((v) => fmt(v, 3)).join(' · '), fmt(r.range, 3)]),
  ));
  out.push('');
  out.push(`Amplitude máxima: **${fmt(result.noiseFloor.maxRange, 3)}** (média ${fmt(result.noiseFloor.meanRange, 3)}). Em \`qualidade\`, nas 20 células das duas tarefas: amplitude máxima ${fmt(result.noiseFloor.qualityMaxRange, 0)}, média ${fmt(result.noiseFloor.qualityMeanRange)} ponto(s).`);
  out.push('');
  out.push('## 6. Concordância do avaliador cego com humano');
  out.push('');
  out.push('Fora deste script: `node tools/analysis/concordancia.mjs`, sobre a amostra rotulada à mão (ver `tools/analysis/README.md`).');
  return `${out.join('\n')}\n`;
}

const argument = (flag, fallback) => {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
};

async function main() {
  const datasetPath = resolve(argument('--dataset', process.env.RUNNER_DATASET_PATH ?? resolve(REPO_ROOT, 'resultados.csv')));
  const result = analyze(readRows(datasetPath));
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(formatReport(result));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
