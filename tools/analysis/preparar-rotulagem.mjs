// Builds the hand-labelling kit behind protocol section 7, item 6: the
// agreement between the blind evaluator and a human classification
// (spec of the blind evaluator, decision D3). D3 deferred this until real
// T2 diffs existed; the collection produced thirty, and the number was
// never measured.
//
// The kit is blind in the same sense the evaluator is (spec, D9): the
// human sees the statement, the diff and the frozen reference material,
// and nothing that names P, O, the model or the session. Items are
// numbered in a seeded shuffled order, so the numbering carries no
// condition either. The evaluator's own answers are deliberately left out
// of the kit -- a human who reads them first is checking the evaluator,
// not classifying independently, and the agreement would be inflated.
//
// The key that maps item to session goes into chave.json, which the
// labeller must not open before finishing. concordancia.mjs reads it.
//
// Sample: one T2 session per T2 cell (ten cells), drawn with the seed.
// That covers every model and condition without the labeller being able
// to tell which is which, and gives 60 checklist and 100 decision-point
// judgements -- enough for a percentage and a kappa, few enough for one
// person in an afternoon.
//
// Writes only into --saida (default rotulagem/ at the repository root).
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readRows } from '../../runner/lib/dataset.mjs';
import { TASKS } from '../../runner/lib/capabilities.mjs';
import { randomSeed, seededShuffle } from '../collect/shuffle.mjs';
import { readReferenceMaterial } from '../blind-evaluator/lib/reference-material.mjs';
import { AUSENTE, PONTOS } from '../blind-evaluator/lib/pontos.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

export const CHECKLIST = [
  'A lógica de negócio nova está na camada de serviço, e não nas rotas?',
  'As entradas novas são validadas por schema?',
  'Os caminhos de erro têm resposta explícita com código de status apropriado?',
  'Valores fixos (durações, limites, janelas) estão nomeados, em vez de literais espalhados?',
  'Há testes escritos que verificam comportamento observável, e não implementação interna?',
  'O código novo reusa utilitários do material de referência quando um deles se aplica, em vez de reimplementar?',
];

export const LABEL_COLUMNS = [
  'item',
  ...CHECKLIST.map((_, i) => `c${i + 1}`),
  ...PONTOS.map((p) => `d${p.n}`),
];

// One session per T2 cell, chosen by the seed, then the whole sample
// shuffled again so item order does not follow cell order.
export function drawSample(rows, seed, perCell = 1) {
  const t2 = rows.filter((r) => r.task === 'T2' && r.status === 'valid');
  const cells = new Map();
  for (const row of t2) {
    const key = `${row.model}|${row.p_level}|${row.o_level}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(row.session_id);
  }
  const picked = [...cells.keys()].sort().flatMap((key) =>
    seededShuffle([...cells.get(key)].sort(), `${seed}|${key}`).slice(0, perCell));
  return seededShuffle(picked, `${seed}|ordem`);
}

function instructions({ count, seed }) {
  const points = PONTOS.map((p) =>
    `| d${p.n} | ${p.nome} | ${p.categorias.map((c, i) => `${i + 1} = \`${c}\``).join(' · ')} · \`a\` = \`${AUSENTE}\` |`).join('\n');
  return `# Rotulagem às cegas — instruções

Você vai classificar ${count} diffs da tarefa T2 (ticket RES-142) com os
mesmos dois instrumentos que o avaliador cego usou. O resultado mede o
quanto o avaliador concorda com uma pessoa (protocolo, seção 7, item 6).

## Regras

1. **Não abra \`chave.json\`** antes de terminar. Ela diz de que sessão veio
   cada item; saber isso contamina o rótulo.
2. **Não abra \`sessions/\`, \`resultados.csv\` nem nenhum \`evaluation.json\`.**
   Lá estão as respostas do avaliador; ver antes transforma a rotulagem em
   conferência, e a concordância sai inflada.
3. Rotule sozinho(a). Se duas pessoas rotularem, cada uma preenche a sua
   cópia de \`rotulos.csv\`, sem conversar até o fim.
4. Julgue **só o que o diff mostra**. Não premie a solução que parece melhor.

## Material

- \`enunciado-T2.md\` — o ticket, exatamente como o agente recebeu.
- \`material-de-referencia.txt\` — \`src/shared/\` e \`src/plugins/\` da semente,
  congelados. Só serve para a pergunta c6 (reúso).
- \`itens/item-NN.diff\` — o que cada sessão mudou.
- \`rotulos.csv\` — a planilha a preencher, separada por \`;\`. Abre no Excel;
  salve como **CSV UTF-8** se puder (o script também aceita o CSV comum do
  Excel).

## Checklist — colunas c1 a c6, responda \`s\` (sim) ou \`n\` (não)

Se o diff não mostra o suficiente para decidir, responda \`n\`.

${CHECKLIST.map((q, i) => `- **c${i + 1}.** ${q}`).join('\n')}

## Pontos de decisão — colunas d1 a d10

O ticket é ambíguo de propósito: quem implementou teve de decidir coisas
que o texto não decide. Para cada ponto, escreva o número da categoria que
o diff mostra, ou \`a\` se o diff não toma posição. Escreva a categoria que
o diff mostra, não a que você escolheria.

| coluna | ponto | categorias |
|---|---|---|
${points}

Também vale escrever o texto da categoria em vez do número.

## Ao terminar

Devolva \`rotulos.csv\`. O cálculo é:

\`\`\`
node tools/analysis/concordancia.mjs --rotulos <pasta>/rotulos.csv --chave <pasta>/chave.json
\`\`\`

Amostra sorteada com a semente \`${seed}\`; com ela,
\`node tools/analysis/preparar-rotulagem.mjs --seed ${seed}\` refaz o mesmo kit.
`;
}

const argument = (flag, fallback) => {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
};

function main() {
  const out = resolve(argument('--saida', join(REPO_ROOT, 'rotulagem')));
  const seed = argument('--seed', randomSeed());
  const perCell = Number(argument('--por-celula', '1'));
  const datasetPath = resolve(argument('--dataset', join(REPO_ROOT, 'resultados.csv')));

  if (existsSync(join(out, 'rotulos.csv')) && !process.argv.includes('--sobrescrever')) {
    process.stderr.write(`${join(out, 'rotulos.csv')} já existe — pode conter rótulos. Use --sobrescrever ou outra --saida.\n`);
    process.exit(1);
  }

  const sample = drawSample(readRows(datasetPath), seed, perCell);
  mkdirSync(join(out, 'itens'), { recursive: true });

  const key = sample.map((sessionId, index) => {
    const item = `item-${String(index + 1).padStart(2, '0')}`;
    const diff = readFileSync(join(REPO_ROOT, 'sessions', sessionId, 'session.diff'), 'utf8');
    writeFileSync(join(out, 'itens', `${item}.diff`), diff);
    return { item, session_id: sessionId };
  });

  writeFileSync(join(out, 'enunciado-T2.md'), readFileSync(join(REPO_ROOT, TASKS.T2.statement), 'utf8'));
  writeFileSync(join(out, 'material-de-referencia.txt'), readReferenceMaterial(REPO_ROOT));
  writeFileSync(join(out, 'LEIA-ME.md'), instructions({ count: sample.length, seed }));
  // BOM so Excel opens it as UTF-8; semicolons because that is what a
  // pt-BR Excel expects.
  const csv = [LABEL_COLUMNS.join(';'), ...key.map(({ item }) => [item, ...LABEL_COLUMNS.slice(1).map(() => '')].join(';'))];
  writeFileSync(join(out, 'rotulos.csv'), `﻿${csv.join('\r\n')}\r\n`);
  writeFileSync(join(out, 'chave.json'), `${JSON.stringify({
    aviso: 'Não abra antes de terminar a rotulagem.',
    seed, perCell, items: key,
  }, null, 2)}\n`);

  process.stdout.write(`kit com ${sample.length} itens em ${out} (semente ${seed})\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
