# Coleta em lotes — plano de implementação

> **Para executores:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development ou superpowers:executing-plans para executar tarefa a tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** construir as três peças que fecham a coleta — o driver que roda as 43 sessões que faltam em lotes retomáveis, o auditor que confere a integridade do que foi gravado, e a skill que faz a leitura entre lotes no lugar do orientando.

**Arquitetura:** ferramenta nova em `tools/collect/`, no mesmo estilo de `tools/convention-check/` e `tools/blind-evaluator/` — módulos pequenos e puros, testáveis sem contêiner e sem rede, mais dois CLIs finos que orquestram. Nada aqui importa `runner/lib/container.mjs` exceto uma única leitura de digest no driver. A composição da grade vira dado em um arquivo só, pelo mesmo motivo que `runner/lib/capabilities.mjs` existe: rótulo e comportamento não podem ter duas fontes.

**Tech Stack:** Node 22+, módulos ES, zero dependências novas. Testes com `node --test`.

**Spec:** `docs/superpowers/specs/2026-09-23-coleta-em-lotes-design.md` — leia antes de começar. O plano argumenta a partir dela.

---

## Notas sobre correções e desvios em relação à spec aprovada

**1. O número era 48 e é 43.** A spec dizia "48 sessões restantes" no objetivo e no primeiro critério de aceite, e ao mesmo tempo dizia "23 da grade principal e 20 das células de modelo" — que somam 43. O 48 vinha de contar as cinco sessões do controle de deriva da seção 4.3 do protocolo, que a seção 2 da própria spec exclui explicitamente. **O arquivo da spec já foi corrigido** (objetivo, critério de aceite, e um parágrafo novo na seção 2 mostrando a conta inteira). O alvo é 50, o dataset tem 7 válidas, faltam 43. Se você está lendo uma cópia em cache que diz 48, releia o arquivo.

**2. `--allow-image-change` só é passada quando o digest realmente mudou.** A spec diz "a primeira sessão leva `--allow-image-change` automaticamente, e só a primeira". Ao pé da letra, isso desliga a guarda de deriva de imagem uma vez por lote — cinco vezes ao longo da coleta, sendo que depois da primeira sessão válida a linha de base do dataset *já é* a imagem atual. O driver implementa a intenção e não a letra: lê o digest vivo, compara com o último gravado no dataset, e só gasta a permissão se forem diferentes — e só até uma sessão válida registrar o digest novo. Em todos os lotes seguintes a guarda vale integralmente, sem ninguém precisar lembrar de nada.

**3. Adição de escopo: o driver grava um registro do lote em `sessions/lotes/`.** O passo 2 da skill — "confere que o lote entregou o que prometeu" — é, pela própria spec, a única coisa que o auditor não consegue fazer, porque ele só enxerga o dataset. Mas a skill também não consegue, se a única evidência do que foi prometido for a rolagem do terminal, que quase nunca está no contexto do agente. Um JSON por lote com o plano prometido, o que executou e onde parou é o que torna esse passo executável e testável. **É escopo novo e está aqui declarado para poder ser vetado:** sem ele, o passo 2 da skill vira uma pergunta ao Francisco, e o critério de aceite "a skill detecta um lote que parou antes do limite pedido" não tem como ser verificado.

## Global Constraints

- Nenhuma dependência nova. Nenhum `package.json` novo.
- Código e comentários em inglês; documentação, prompts e saída de terminal em português.
- Nenhum teste escreve em `resultados.csv` nem em `resultados-piloto.csv`. Todo teste que precise de dataset cria um CSV em diretório temporário e passa o caminho explicitamente. Este projeto já foi mordido por isso: doze linhas falsas entraram no dataset real porque `run-session.mjs` tinha o caminho fixo no código.
- Nenhum teste sobe contêiner, chama a API, ou depende de Docker. Tudo que toca o mundo (`spawnSync`, leitura de digest, leitura de transcript) é injetável.
- O auditor **não escreve nada**, em lugar nenhum, nunca. Nem log, nem cache, nem arquivo temporário.
- O auditor **não olha para resultado**: `taxa_aceitacao`, `qualidade`, `violacoes`, `regressoes`, custo e convergência entram nas verificações apenas como "preenchido ou vazio", nunca como valor comparado a um limiar. Um auditor que reprovasse resultado ruim estaria filtrando o dataset pela hipótese.
- Contagem de sessão coletada usa **só linhas `status = valid`**. Uma linha `invalid` é uma tentativa que falhou: fica no dataset como evidência e a sessão que ela representa continua faltando.
- Rodar os testes: `node --test tools/collect/test/*.test.mjs` (o glob é expandido pelo shell; `node --test <diretório>` falha nesta instalação do Node, ver `docs/superpowers/2026-09-16-execucao-runner.md`).
- Commit ao fim de cada tarefa.

---
## Estrutura de arquivos

```
tools/collect/
  grid.mjs             a composição da grade como dado + "o que falta" + número de repetição derivado
  shuffle.mjs          embaralhamento com semente reproduzível
  run-grid.mjs         CLI do driver: planeja, imprime, executa, retoma
  checks.mjs           as oito verificações, funções puras
  check-dataset.mjs    CLI do auditor: imprime e vira portão pelo código de saída
  README.md            como rodar as duas ferramentas
  test/
    grid.test.mjs
    shuffle.test.mjs
    run-grid.test.mjs
    checks.test.mjs
.claude/skills/verificar-lote/SKILL.md
```

`grid.mjs` e `shuffle.mjs` não conhecem o sistema de arquivos nem processos: recebem linhas e devolvem listas. `run-grid.mjs` e `check-dataset.mjs` são as únicas peças que tocam o mundo, e mesmo elas recebem os pontos de contato por parâmetro para que os testes não precisem de Docker.

---

### Tarefa 1: a grade como dado, e o que falta dela

**Arquivos:**
- Criar: `tools/collect/grid.mjs`
- Criar: `tools/collect/test/grid.test.mjs`

**Interfaces:**
- Produz: `GRID`, `REPETITIONS`, `cellKey({task,pLevel,oLevel,model})`, `targetSessions()`, `collectedCounts(rows)`, `missingSessions(rows)`, `nextRunNumber(rows, session)`.
- Consome: `readRows` não é usado aqui — este módulo recebe linhas já lidas, para continuar puro.

Uma sessão planejada é o objeto `{ block, task, pLevel, oLevel, model }`. O número de repetição **não** faz parte dele: é derivado do dataset no momento de executar, por `nextRunNumber`. Foi assim que `--run` deixou de ser responsabilidade de quem dispara.

- [ ] **Passo 1: escrever os testes que falham**

Crie `tools/collect/test/grid.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cellKey, collectedCounts, missingSessions, nextRunNumber, targetSessions } from '../grid.mjs';

// The seven valid sessions the dataset holds on 2026-09-23, reduced to
// the columns the grid reads. Written out rather than read from
// resultados.csv, so the test keeps meaning the same thing after the
// collection has filled the real file.
const collected = [
  { task: 'T1', p_level: 'P0', o_level: 'O1', model: 'claude-sonnet-5', status: 'valid' },
  { task: 'T1', p_level: 'P1', o_level: 'O1', model: 'claude-sonnet-5', status: 'valid' },
  { task: 'T2', p_level: 'P0', o_level: 'O1', model: 'claude-sonnet-5', status: 'valid' },
  { task: 'T2', p_level: 'P0', o_level: 'O1', model: 'claude-sonnet-5', status: 'valid' },
  { task: 'T2', p_level: 'P0', o_level: 'O1', model: 'claude-sonnet-5', status: 'valid' },
  { task: 'T1', p_level: 'P2', o_level: 'O1', model: 'claude-sonnet-5', status: 'valid' },
  { task: 'T1', p_level: 'P0', o_level: 'O2', model: 'claude-sonnet-5', status: 'valid' },
];

test('the target is fifty sessions, thirty of them the main grid', () => {
  const target = targetSessions();
  assert.equal(target.length, 50);
  assert.equal(target.filter((s) => s.block === 'principal').length, 30);
  assert.equal(target.filter((s) => s.block === 'modelo').length, 20);
});

test('every target session names a model, a task, a context and an order', () => {
  for (const session of targetSessions()) {
    assert.ok(session.model && session.task && session.pLevel && session.oLevel);
  }
});

test('the main grid repeats T1 twice and T2 three times in every cell', () => {
  const cell = targetSessions().filter(
    (s) => s.block === 'principal' && s.pLevel === 'P1' && s.oLevel === 'O2');
  assert.equal(cell.filter((s) => s.task === 'T1').length, 2);
  assert.equal(cell.filter((s) => s.task === 'T2').length, 3);
});

test('an empty dataset is missing the whole target', () => {
  assert.equal(missingSessions([]).length, 50);
});

test('the seven sessions already collected leave forty-three missing', () => {
  const missing = missingSessions(collected);
  assert.equal(missing.length, 43);
  assert.equal(missing.filter((s) => s.block === 'principal').length, 23);
  assert.equal(missing.filter((s) => s.block === 'modelo').length, 20);
});

test('a cell already full stops appearing in what is missing', () => {
  // T2-P0-O1 on sonnet has all three of its repetitions.
  const missing = missingSessions(collected);
  assert.equal(missing.filter((s) => cellKey(s) === 'T2|P0|O1|claude-sonnet-5').length, 0);
  // T1-P0-O1 on sonnet has one of its two.
  assert.equal(missing.filter((s) => cellKey(s) === 'T1|P0|O1|claude-sonnet-5').length, 1);
});

test('an invalid row does not count as collected', () => {
  const rows = [{ ...collected[0], status: 'invalid' }];
  assert.equal(collectedCounts(rows).size, 0);
  assert.equal(missingSessions(rows).length, 50);
});

test('the repetition number is derived from the dataset, not typed', () => {
  const session = { task: 'T1', pLevel: 'P0', oLevel: 'O1', model: 'claude-sonnet-5' };
  assert.equal(nextRunNumber([], session), 1);
  assert.equal(nextRunNumber(collected, session), 2);
  assert.equal(nextRunNumber([...collected, { ...collected[0] }], session), 3);
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `node --test tools/collect/test/grid.test.mjs`
Esperado: falha ao importar, `Cannot find module '../grid.mjs'`.

- [ ] **Passo 3: implementar**

Crie `tools/collect/grid.mjs`:

```js
// The composition of the collection grid, declared as data in one place,
// for the same reason runner/lib/capabilities.mjs exists: a label and the
// thing it stands for must not have two sources.
//
// Protocol section 4.1 is the main grid; 4.2 the model cells. Section
// 4.3's drift control is deliberately absent: it exists only if
// collection happens in two windows separated in time, and the decision
// is to collect in one. If that changes it comes back, and that is the
// only reason it would be out.
export const GRID = {
  principal: {
    models: ['claude-sonnet-5'],
    cells: [['P0', 'O1'], ['P0', 'O2'], ['P1', 'O1'], ['P1', 'O2'], ['P2', 'O1'], ['P2', 'O2']],
  },
  modelo: {
    models: ['claude-haiku-4-5', 'claude-opus-5'],
    cells: [['P0', 'O1'], ['P2', 'O2']],
  },
};

// T1 is scored by the hidden suite, so two runs are enough to see the
// cell. T2 is scored by convergence between runs, which needs three.
export const REPETITIONS = { T1: 2, T2: 3 };

// A cell of the collection is the quadruple. The repetition number is
// what distinguishes sessions inside it, and it is never part of a
// planned session: it is derived from the dataset at the moment of
// launching, by nextRunNumber.
export const cellKey = ({ task, pLevel, oLevel, model }) =>
  `${task}|${pLevel}|${oLevel}|${model}`;

const rowCellKey = (row) => `${row.task}|${row.p_level}|${row.o_level}|${row.model}`;

export function targetSessions() {
  const sessions = [];
  for (const [block, { models, cells }] of Object.entries(GRID)) {
    for (const model of models) {
      for (const [pLevel, oLevel] of cells) {
        for (const [task, times] of Object.entries(REPETITIONS)) {
          for (let repetition = 0; repetition < times; repetition += 1) {
            sessions.push({ block, task, pLevel, oLevel, model });
          }
        }
      }
    }
  }
  return sessions;
}

// Only `valid` rows count. An invalid row is a failed attempt: it stays
// in the dataset as evidence, and the session it stands for is still
// missing. Counting it would leave a hole nobody notices until analysis.
export function collectedCounts(rows) {
  const counts = new Map();
  for (const row of rows) {
    if (row.status !== 'valid') continue;
    const key = rowCellKey(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function missingSessions(rows) {
  const remaining = collectedCounts(rows);
  const missing = [];
  for (const session of targetSessions()) {
    const key = cellKey(session);
    const already = remaining.get(key) ?? 0;
    if (already > 0) {
      remaining.set(key, already - 1);
      continue;
    }
    missing.push(session);
  }
  return missing;
}

export function nextRunNumber(rows, session) {
  return (collectedCounts(rows).get(cellKey(session)) ?? 0) + 1;
}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `node --test tools/collect/test/grid.test.mjs`
Esperado: 8 testes PASS.

- [ ] **Passo 5: conferir contra o dataset real, sem escrever nada**

Run:
```
node --input-type=module -e "
const { readRows } = await import('./runner/lib/dataset.mjs');
const { missingSessions } = await import('./tools/collect/grid.mjs');
const missing = missingSessions(readRows('resultados.csv'));
console.log(missing.length, missing.filter(s => s.block === 'principal').length, missing.filter(s => s.block === 'modelo').length);
"
```
Esperado: `43 23 20`. Se não bater, pare: o alvo ou a leitura está errado, e nada adiante faz sentido.

- [ ] **Passo 6: commit**

```bash
git add tools/collect/grid.mjs tools/collect/test/grid.test.mjs
git commit -m "feat: declare the collection grid as data and derive what is missing from the dataset"
```

---

### Tarefa 2: embaralhamento com semente reproduzível

**Arquivos:**
- Criar: `tools/collect/shuffle.mjs`
- Criar: `tools/collect/test/shuffle.test.mjs`

**Interfaces:**
- Produz: `randomSeed()` (string hex de 8 caracteres), `seededShuffle(items, seed)` (nova lista, entrada não mutada).

A seção 4.5 do protocolo exige ordem embaralhada, "para que variação temporal do serviço não se confunda com uma célula específica". `Math.random` embaralha mas não deixa ninguém refazer a ordem depois, e uma ordem que ninguém consegue refazer não é auditável. Daí uma semente explícita, que o driver imprime.

- [ ] **Passo 1: escrever os testes que falham**

Crie `tools/collect/test/shuffle.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomSeed, seededShuffle } from '../shuffle.mjs';

const items = Array.from({ length: 43 }, (_, index) => index);

test('the same seed produces the same order', () => {
  assert.deepEqual(seededShuffle(items, 'abc123'), seededShuffle(items, 'abc123'));
});

test('different seeds produce different orders', () => {
  assert.notDeepEqual(seededShuffle(items, 'abc123'), seededShuffle(items, 'def456'));
});

test('shuffling is a permutation and not a rewrite', () => {
  const shuffled = seededShuffle(items, 'abc123');
  assert.equal(shuffled.length, items.length);
  assert.deepEqual([...shuffled].sort((a, b) => a - b), items);
});

test('the order actually changes, so nothing is silently returning the input', () => {
  assert.notDeepEqual(seededShuffle(items, 'abc123'), items);
});

test('the input list is not mutated', () => {
  const original = [...items];
  seededShuffle(items, 'abc123');
  assert.deepEqual(items, original);
});

test('a generated seed is a short printable string', () => {
  assert.match(randomSeed(), /^[0-9a-f]{8}$/);
  assert.notEqual(randomSeed(), randomSeed());
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `node --test tools/collect/test/shuffle.test.mjs`
Esperado: falha ao importar, `Cannot find module '../shuffle.mjs'`.

- [ ] **Passo 3: implementar**

Crie `tools/collect/shuffle.mjs`:

```js
// Protocol section 4.5 requires the collection order to be shuffled, so
// that temporal variation in the service does not line up with one cell.
// A shuffle nobody can reproduce is not auditable, though: the driver
// prints a seed, and anyone can pass it back to rebuild the exact order
// the collection ran in. Math.random cannot do that, so this is a small
// explicit generator instead.
import { randomBytes } from 'node:crypto';

export const randomSeed = () => randomBytes(4).toString('hex');

// FNV-1a over the seed text, so any string works as a seed.
function hashSeed(seed) {
  let hash = 0x811c9dc5;
  for (const character of String(seed)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// mulberry32: small, well known, and far more than enough to order
// fifty items. Nothing statistical rests on it -- it only has to be
// deterministic given the seed and not obviously patterned.
function generator(seed) {
  let state = hashSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle(items, seed) {
  const next = generator(seed);
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(next() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  return shuffled;
}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `node --test tools/collect/test/shuffle.test.mjs`
Esperado: 6 testes PASS.

- [ ] **Passo 5: commit**

```bash
git add tools/collect/shuffle.mjs tools/collect/test/shuffle.test.mjs
git commit -m "feat: shuffle the collection order with a seed that can be printed and replayed"
```

---
### Tarefa 3: o driver planeja e imprime, sem gastar nada

**Arquivos:**
- Criar: `tools/collect/run-grid.mjs`
- Criar: `tools/collect/test/run-grid.test.mjs`

**Interfaces:**
- Consome: `missingSessions`, `collectedCounts`, `cellKey` (Tarefa 1); `randomSeed`, `seededShuffle` (Tarefa 2); `readRows` de `runner/lib/dataset.mjs`.
- Produz: `planBatch({ rows, limit, seed })` → `{ seed, total, blocks, batch }`, onde cada item de `batch` é `{ block, task, pLevel, oLevel, model, run }`; `formatPlan(plan)` → string; `sessionLabel(session)` → string.

O número de repetição que aparece no plano é **provisório**: é o que será derivado se tudo der certo, calculado somando os alvos em cima do que o dataset já tem. Na execução ele é derivado de novo, do dataset, sessão a sessão (Tarefa 4). Os dois coincidem quando nada falha, e quando algo falha o da execução é que vale.

- [ ] **Passo 1: escrever os testes que falham**

Crie `tools/collect/test/run-grid.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPlan, planBatch, sessionLabel } from '../run-grid.mjs';

const collected = [
  { task: 'T1', p_level: 'P0', o_level: 'O1', model: 'claude-sonnet-5', status: 'valid' },
  { task: 'T1', p_level: 'P1', o_level: 'O1', model: 'claude-sonnet-5', status: 'valid' },
  { task: 'T2', p_level: 'P0', o_level: 'O1', model: 'claude-sonnet-5', status: 'valid' },
  { task: 'T2', p_level: 'P0', o_level: 'O1', model: 'claude-sonnet-5', status: 'valid' },
  { task: 'T2', p_level: 'P0', o_level: 'O1', model: 'claude-sonnet-5', status: 'valid' },
  { task: 'T1', p_level: 'P2', o_level: 'O1', model: 'claude-sonnet-5', status: 'valid' },
  { task: 'T1', p_level: 'P0', o_level: 'O2', model: 'claude-sonnet-5', status: 'valid' },
];

test('the plan covers everything missing and counts it by block', () => {
  const plan = planBatch({ rows: collected, limit: Infinity, seed: 'abc123' });
  assert.equal(plan.total, 43);
  assert.deepEqual(plan.blocks, { principal: 23, modelo: 20 });
  assert.equal(plan.batch.length, 43);
});

test('a limit shortens the batch without changing what is missing', () => {
  const plan = planBatch({ rows: collected, limit: 10, seed: 'abc123' });
  assert.equal(plan.total, 43);
  assert.equal(plan.batch.length, 10);
});

test('the same seed plans the same batch', () => {
  const first = planBatch({ rows: collected, limit: 10, seed: 'abc123' });
  const second = planBatch({ rows: collected, limit: 10, seed: 'abc123' });
  assert.deepEqual(first.batch, second.batch);
});

test('a different seed plans a different batch', () => {
  const first = planBatch({ rows: collected, limit: 10, seed: 'abc123' });
  const second = planBatch({ rows: collected, limit: 10, seed: 'def456' });
  assert.notDeepEqual(first.batch, second.batch);
});

test('the repetition number continues from what the dataset already holds', () => {
  const plan = planBatch({ rows: collected, limit: Infinity, seed: 'abc123' });
  // T1-P0-O1 on sonnet already has run 1, so its one missing session is run 2.
  const carried = plan.batch.filter(
    (s) => s.task === 'T1' && s.pLevel === 'P0' && s.oLevel === 'O1' && s.model === 'claude-sonnet-5');
  assert.deepEqual(carried.map((s) => s.run), [2]);
  // An untouched cell starts at 1 and counts up.
  const fresh = plan.batch
    .filter((s) => s.task === 'T2' && s.pLevel === 'P1' && s.oLevel === 'O2')
    .map((s) => s.run)
    .sort();
  assert.deepEqual(fresh, [1, 2, 3]);
});

test('no repetition number is planned twice inside one cell', () => {
  const plan = planBatch({ rows: collected, limit: Infinity, seed: 'abc123' });
  const seen = new Set();
  for (const session of plan.batch) {
    const key = `${session.task}|${session.pLevel}|${session.oLevel}|${session.model}|${session.run}`;
    assert.ok(!seen.has(key), `planned twice: ${key}`);
    seen.add(key);
  }
});

test('the printed plan names the seed, the totals and every session', () => {
  const text = formatPlan(planBatch({ rows: collected, limit: 3, seed: 'abc123' }));
  assert.match(text, /semente: abc123/);
  assert.match(text, /faltam 43/);
  assert.match(text, /principal: 23/);
  assert.match(text, /modelo: 20/);
  assert.equal(text.split('\n').filter((line) => /^\s+\d+\./.test(line)).length, 3);
});

test('a session label carries every factor the dataset will record', () => {
  const label = sessionLabel({ task: 'T2', pLevel: 'P1', oLevel: 'O2', model: 'claude-opus-5', run: 3 });
  assert.match(label, /T2/);
  assert.match(label, /P1/);
  assert.match(label, /O2/);
  assert.match(label, /claude-opus-5/);
  assert.match(label, /3/);
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `node --test tools/collect/test/run-grid.test.mjs`
Esperado: falha ao importar, `Cannot find module '../run-grid.mjs'`.

- [ ] **Passo 3: implementar a parte de planejamento**

Crie `tools/collect/run-grid.mjs` com só o que os testes acima exigem — a execução entra na Tarefa 4:

```js
#!/usr/bin/env node
import { join, resolve } from 'node:path';
import { readRows } from '../../runner/lib/dataset.mjs';
import { cellKey, collectedCounts, missingSessions } from './grid.mjs';
import { randomSeed, seededShuffle } from './shuffle.mjs';

const REPO = resolve(import.meta.dirname, '..', '..');

export const sessionLabel = (session) =>
  `${session.task}-${session.pLevel}-${session.oLevel} run ${session.run} (${session.model})`;

// The repetition numbers here are provisional: they are what will be
// derived if every session succeeds. runBatch derives them again from
// the dataset, one session at a time, and that is the number that ends
// up in the row. They agree whenever nothing fails, and when something
// fails the executed one is the one that counts.
export function planBatch({ rows, limit, seed }) {
  const missing = missingSessions(rows);

  const blocks = {};
  for (const session of missing) {
    blocks[session.block] = (blocks[session.block] ?? 0) + 1;
  }

  const counts = collectedCounts(rows);
  const ordered = seededShuffle(missing, seed).map((session) => {
    const key = cellKey(session);
    const run = (counts.get(key) ?? 0) + 1;
    counts.set(key, run);
    return { ...session, run };
  });

  return { seed, total: missing.length, blocks, batch: ordered.slice(0, limit) };
}

export function formatPlan(plan) {
  const byBlock = Object.entries(plan.blocks).map(([block, count]) => `${block}: ${count}`).join(', ');
  return [
    `semente: ${plan.seed}`,
    `faltam ${plan.total} sessões (${byBlock || 'nenhuma'})`,
    `este lote executa ${plan.batch.length}:`,
    ...plan.batch.map((session, index) => `  ${String(index + 1).padStart(2)}. ${sessionLabel(session)}`),
  ].join('\n');
}

const argument = (flag, fallback) => {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
};

function parseLimit(raw) {
  if (raw === undefined || raw === null) return Infinity;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    process.stderr.write(`--limite precisa ser um inteiro positivo; recebi "${raw}"\n`);
    process.exit(2);
  }
  return value;
}

async function main() {
  const limit = parseLimit(argument('--limite', null));
  const seed = argument('--seed', randomSeed());
  const datasetPath = resolve(
    argument('--dataset', process.env.RUNNER_DATASET_PATH ?? join(REPO, 'resultados.csv')),
  );
  const out = (line) => process.stdout.write(`${line}\n`);

  const plan = planBatch({ rows: readRows(datasetPath), limit, seed });
  out(formatPlan(plan));

  if (process.argv.includes('--dry-run')) {
    out('');
    out('--dry-run: nada foi executado e nada foi gravado.');
    return;
  }

  out('');
  out('execução ainda não implementada.');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  await main();
}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `node --test tools/collect/test/run-grid.test.mjs`
Esperado: 8 testes PASS.

- [ ] **Passo 5: rodar o dry-run contra o dataset real**

Run: `node tools/collect/run-grid.mjs --dry-run --seed abc123`
Esperado: `faltam 43 sessões (principal: 23, modelo: 20)`, seguido de 43 linhas numeradas, e a linha final dizendo que nada foi executado.

Run: `git status --porcelain`
Esperado: saída vazia fora dos arquivos novos da tarefa. O dry-run não pode ter tocado em `resultados.csv`.

- [ ] **Passo 6: commit**

```bash
git add tools/collect/run-grid.mjs tools/collect/test/run-grid.test.mjs
git commit -m "feat: plan a collection batch from the dataset and print it without spending anything"
```

---

### Tarefa 4: o driver executa, retoma, e para quando algo quebra duas vezes

**Arquivos:**
- Modificar: `tools/collect/run-grid.mjs`
- Modificar: `tools/collect/test/run-grid.test.mjs`

**Interfaces:**
- Consome: `nextRunNumber` (Tarefa 1); `appendRow`, `readRows` de `runner/lib/dataset.mjs`; `SESSION_IMAGE`, `imageId` de `runner/lib/container.mjs`.
- Produz: `runBatch({ datasetPath, repoRoot, limit, seed, out, runSession, runEvaluator, imageDigest, now })` → `{ seed, executed, stopped, costUsd, recordPath }`.

Os quatro pontos de contato com o mundo (`runSession`, `runEvaluator`, `imageDigest`, `now`) têm implementação real como valor padrão e são injetáveis, para que o teste rode sem Docker, sem API e sem relógio.

**Como uma sessão é julgada.** `run-session.mjs` acrescenta exatamente uma linha por invocação, ou nenhuma quando recusa (saída 2). Então o driver conta as linhas antes, roda, conta depois: se não cresceu, foi recusa; se cresceu, a última linha é daquela sessão, e `status` diz se valeu. O dataset é o juiz, não a saída do processo filho.

**Por que duas tentativas e não mais.** Falhar duas vezes seguidas na mesma sessão significa que algo está quebrado — imagem, chave, rede, protocolo. Continuar gastaria crédito produzindo mais do mesmo. O driver para, diz qual sessão e por quê, e deixa o resto para depois do conserto.

- [ ] **Passo 1: escrever os testes que falham**

Acrescente a `tools/collect/test/run-grid.test.mjs` (mantendo os imports já existentes e adicionando os de baixo no topo do arquivo):

```js
import { mkdtempSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendRow, emptyRow, readRows } from '../../../runner/lib/dataset.mjs';
import { runBatch } from '../run-grid.mjs';

// A stand-in for run-session.mjs: it records the arguments it was given
// and appends the row a real session would have appended. `outcome`
// decides whether that row is valid, invalid, or never written at all
// (the refusal case, where run-session exits 2 without touching the
// dataset).
function fakeRunner({ outcome = () => 'valid', calls = [] } = {}) {
  let counter = 0;
  const run = (args) => {
    const flag = (name) => args[args.indexOf(name) + 1];
    calls.push(args);
    counter += 1;
    const decision = outcome(args, counter);
    if (decision === 'refused') return { status: 2 };
    const row = {
      ...emptyRow(),
      session_id: `${flag('--task')}-${flag('--p')}-${flag('--o')}-fake${counter}`,
      task: flag('--task'), p_level: flag('--p'), o_level: flag('--o'),
      model: flag('--model'), run_number: flag('--run'),
      status: decision, image_digest: 'sha256:novo', cli_version: '2.1.272',
      custo_usd: '0.50',
      invalid_reason: decision === 'invalid' ? 'falha de infraestrutura simulada' : '',
    };
    appendRow(flag('--dataset'), row);
    return { status: 0 };
  };
  return { run, calls };
}

function scratchDataset(rows = []) {
  const dir = mkdtempSync(join(tmpdir(), 'collect-driver-'));
  const datasetPath = join(dir, 'resultados.csv');
  for (const row of rows) appendRow(datasetPath, { ...emptyRow(), ...row });
  return { dir, datasetPath };
}

const silent = () => {};
const baseOptions = (datasetPath, dir) => ({
  datasetPath, repoRoot: dir, out: silent,
  runEvaluator: () => ({ status: 0 }),
  imageDigest: () => 'sha256:novo',
  now: () => new Date('2026-09-23T15:00:00.000Z'),
});

test('two runs with a limit of one execute two different sessions', async () => {
  const { dir, datasetPath } = scratchDataset();
  const runner = fakeRunner();
  const options = { ...baseOptions(datasetPath, dir), limit: 1, seed: 'abc123', runSession: runner.run };

  await runBatch(options);
  await runBatch(options);

  const rows = readRows(datasetPath);
  assert.equal(rows.length, 2);
  const key = (row) => `${row.task}|${row.p_level}|${row.o_level}|${row.model}|${row.run_number}`;
  assert.notEqual(key(rows[0]), key(rows[1]));
});

test('the repetition number handed to run-session is derived, never typed', async () => {
  const { dir, datasetPath } = scratchDataset([
    { session_id: 'seed-row', task: 'T1', p_level: 'P0', o_level: 'O1',
      model: 'claude-sonnet-5', run_number: '1', status: 'valid', image_digest: 'sha256:novo' },
  ]);
  const runner = fakeRunner();
  // Infinity, not a slice: the session this test is about must be in the
  // batch, and a shuffled slice might not contain it.
  await runBatch({ ...baseOptions(datasetPath, dir), limit: Infinity, seed: 'abc123', runSession: runner.run });

  const rows = readRows(datasetPath).filter(
    (row) => row.task === 'T1' && row.p_level === 'P0' && row.o_level === 'O1'
      && row.model === 'claude-sonnet-5');
  assert.deepEqual(rows.map((row) => row.run_number).sort(), ['1', '2']);
});

test('a session that fails twice stops the batch and leaves the rest alone', async () => {
  const { dir, datasetPath } = scratchDataset();
  const runner = fakeRunner({ outcome: (_args, counter) => (counter <= 2 ? 'invalid' : 'valid') });
  const lines = [];
  const result = await runBatch({
    ...baseOptions(datasetPath, dir), out: (line) => lines.push(line),
    limit: 10, seed: 'abc123', runSession: runner.run,
  });

  assert.equal(runner.calls.length, 2);
  assert.equal(result.executed, 0);
  assert.ok(result.stopped);
  assert.match(lines.join('\n'), /PARADO/);
  assert.match(lines.join('\n'), /falha de infraestrutura simulada/);
});

test('a session that fails once and succeeds on the retry does not stop the batch', async () => {
  const { dir, datasetPath } = scratchDataset();
  const runner = fakeRunner({ outcome: (_args, counter) => (counter === 1 ? 'invalid' : 'valid') });
  const result = await runBatch({
    ...baseOptions(datasetPath, dir), limit: 3, seed: 'abc123', runSession: runner.run,
  });

  assert.equal(result.executed, 3);
  assert.equal(result.stopped, null);
  assert.equal(runner.calls.length, 4);
});

test('a refusal that writes no row counts as a failed attempt', async () => {
  const { dir, datasetPath } = scratchDataset();
  const runner = fakeRunner({ outcome: () => 'refused' });
  const lines = [];
  const result = await runBatch({
    ...baseOptions(datasetPath, dir), out: (line) => lines.push(line),
    limit: 5, seed: 'abc123', runSession: runner.run,
  });

  assert.equal(readRows(datasetPath).length, 0);
  assert.ok(result.stopped);
  assert.match(lines.join('\n'), /sem gravar linha/);
});

test('the image change allowance is spent once, and only when the digest differs', async () => {
  const { dir, datasetPath } = scratchDataset([
    { session_id: 'antiga', task: 'T1', p_level: 'P0', o_level: 'O1', model: 'claude-sonnet-5',
      run_number: '1', status: 'valid', image_digest: 'sha256:antiga' },
  ]);
  const runner = fakeRunner();
  await runBatch({ ...baseOptions(datasetPath, dir), limit: 3, seed: 'abc123', runSession: runner.run });

  const allowed = runner.calls.map((args) => args.includes('--allow-image-change'));
  assert.deepEqual(allowed, [true, false, false]);
});

test('no allowance is spent when the image already matches the dataset', async () => {
  const { dir, datasetPath } = scratchDataset([
    { session_id: 'atual', task: 'T1', p_level: 'P0', o_level: 'O1', model: 'claude-sonnet-5',
      run_number: '1', status: 'valid', image_digest: 'sha256:novo' },
  ]);
  const runner = fakeRunner();
  await runBatch({ ...baseOptions(datasetPath, dir), limit: 2, seed: 'abc123', runSession: runner.run });

  assert.deepEqual(runner.calls.map((args) => args.includes('--allow-image-change')), [false, false]);
});

test('the blind evaluator runs once, after the batch, and not after a stop', async () => {
  const { dir, datasetPath } = scratchDataset();
  let evaluated = 0;
  const runner = fakeRunner();
  await runBatch({
    ...baseOptions(datasetPath, dir), limit: 2, seed: 'abc123',
    runSession: runner.run, runEvaluator: () => { evaluated += 1; return { status: 0 }; },
  });
  assert.equal(evaluated, 1);

  const stopping = fakeRunner({ outcome: () => 'invalid' });
  await runBatch({
    ...baseOptions(datasetPath, dir), limit: 2, seed: 'abc123',
    runSession: stopping.run, runEvaluator: () => { evaluated += 1; return { status: 0 }; },
  });
  assert.equal(evaluated, 1);
});

test('the batch record says what was promised, what ran, and where it stopped', async () => {
  const { dir, datasetPath } = scratchDataset();
  const runner = fakeRunner({ outcome: (_args, counter) => (counter <= 2 ? 'valid' : 'invalid') });
  const result = await runBatch({
    ...baseOptions(datasetPath, dir), limit: 5, seed: 'abc123', runSession: runner.run,
  });

  const record = JSON.parse(readFileSync(result.recordPath, 'utf8'));
  assert.equal(record.seed, 'abc123');
  assert.equal(record.promised.length, 5);
  assert.equal(record.executed.length, 2);
  assert.ok(record.stopped);
  assert.match(record.stopped.reason, /falha de infraestrutura simulada/);
  assert.equal(readdirSync(join(dir, 'sessions', 'lotes')).length, 1);
});

test('a dry run writes no batch record', async () => {
  const { dir, datasetPath } = scratchDataset();
  const runner = fakeRunner();
  await runBatch({
    ...baseOptions(datasetPath, dir), limit: 5, seed: 'abc123',
    runSession: runner.run, dryRun: true,
  });

  assert.equal(runner.calls.length, 0);
  assert.equal(readRows(datasetPath).length, 0);
  assert.equal(existsSync(join(dir, 'sessions', 'lotes')), false);
});

test('progress names the session and the running total', async () => {
  const { dir, datasetPath } = scratchDataset();
  const lines = [];
  const runner = fakeRunner();
  await runBatch({
    ...baseOptions(datasetPath, dir), out: (line) => lines.push(line),
    limit: 2, seed: 'abc123', runSession: runner.run,
  });

  const progress = lines.filter((line) => line.startsWith('['));
  assert.equal(progress.length, 2);
  assert.match(progress[0], /\[1\/2\]/);
  assert.match(progress[1], /acumulado \$1\.00/);
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `node --test tools/collect/test/run-grid.test.mjs`
Esperado: os 8 testes da Tarefa 3 continuam passando; os 11 novos falham com `runBatch is not a function`.

- [ ] **Passo 3: implementar a execução**

Em `tools/collect/run-grid.mjs`, acrescente os imports e substitua o `main()` da Tarefa 3:

```js
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SESSION_IMAGE, imageId } from '../../runner/lib/container.mjs';
import { nextRunNumber } from './grid.mjs';
```

(`cellKey`, `collectedCounts` e `missingSessions` continuam importados de `./grid.mjs`; `readRows` de `dataset.mjs` continua como está.)

```js
// run-session.mjs appends exactly one row per invocation, or none when it
// refuses (exit 2). So the dataset is the judge of what happened, not the
// child's exit code: count the rows before, run, count after.
function spawnSession(args, repoRoot) {
  const result = spawnSync('node', args, { cwd: repoRoot, stdio: 'inherit' });
  return { status: result.status ?? 1 };
}

function spawnEvaluator(datasetPath, repoRoot) {
  const result = spawnSync(
    'node',
    [join('tools', 'blind-evaluator', 'evaluate.mjs'), '--all', '--dataset', datasetPath],
    { cwd: repoRoot, stdio: 'inherit' },
  );
  return { status: result.status ?? 1 };
}

function liveImageDigest() {
  try {
    return imageId(SESSION_IMAGE);
  } catch {
    return null;
  }
}

const lastRecordedDigest = (rows) => {
  const digests = rows.map((row) => row.image_digest).filter(Boolean);
  return digests[digests.length - 1] ?? null;
};

// Written only on a real run, never on a dry run. It exists because the
// batch-check skill has to compare what the batch promised with what it
// delivered, and the auditor cannot: the auditor only sees the dataset,
// where seven integral sessions out of a promised ten look exactly like
// seven integral sessions. Terminal scrollback is not evidence -- it is
// usually not even in the agent's context -- so the promise is written
// down.
function writeBatchRecord({ repoRoot, plan, executed, stopped, startedAt, endedAt, datasetPath }) {
  const dir = join(repoRoot, 'sessions', 'lotes');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${startedAt.replaceAll(':', '-')}.json`);
  writeFileSync(path, `${JSON.stringify({
    seed: plan.seed, dataset: datasetPath, startedAt, endedAt,
    promised: plan.batch, executed, stopped,
  }, null, 2)}\n`);
  return path;
}

export async function runBatch({
  datasetPath, repoRoot = REPO, limit = Infinity, seed = randomSeed(), dryRun = false,
  out = (line) => process.stdout.write(`${line}\n`),
  runSession = (args) => spawnSession(args, repoRoot),
  runEvaluator = () => spawnEvaluator(datasetPath, repoRoot),
  imageDigest = liveImageDigest,
  now = () => new Date(),
}) {
  const startedAt = now().toISOString();
  const plan = planBatch({ rows: readRows(datasetPath), limit, seed });
  out(formatPlan(plan));

  if (dryRun) {
    out('');
    out('--dry-run: nada foi executado e nada foi gravado.');
    return { seed, executed: 0, stopped: null, costUsd: 0, recordPath: null };
  }
  if (plan.batch.length === 0) {
    out('');
    out('nada a coletar.');
    return { seed, executed: 0, stopped: null, costUsd: 0, recordPath: null };
  }

  // The dataset carries one digest per session for everything collected
  // before runner/build-image.mjs existed, so the first session of the new
  // regime has to be let through the drift guard. Passing the flag on
  // every batch's first session would disable the guard once per batch
  // for no reason: after one valid session the dataset's baseline IS the
  // current image. So the allowance is taken only when the digests
  // actually differ, and it is spent by the first session that records.
  const digest = imageDigest();
  let allowImageChange = digest !== null && digest !== lastRecordedDigest(readRows(datasetPath));
  if (allowImageChange) {
    out(`atenção: o digest da imagem mudou em relação ao dataset; a primeira sessão do lote leva --allow-image-change`);
  }

  const executed = [];
  let costUsd = 0;
  let stopped = null;

  for (const [index, planned] of plan.batch.entries()) {
    let succeeded = null;
    let lastReason = '';

    for (let attempt = 1; attempt <= 2 && !succeeded; attempt += 1) {
      const before = readRows(datasetPath);
      const run = nextRunNumber(before, planned);
      const args = [
        join('runner', 'run-session.mjs'),
        '--task', planned.task, '--p', planned.pLevel, '--o', planned.oLevel,
        '--model', planned.model, '--run', String(run), '--dataset', datasetPath,
      ];
      if (allowImageChange) args.push('--allow-image-change');

      const child = runSession(args);
      const after = readRows(datasetPath);
      const row = after.length > before.length ? after[after.length - 1] : null;

      if (row?.status === 'valid') {
        succeeded = row;
        break;
      }
      lastReason = row
        ? (row.invalid_reason || 'sessão inválida sem motivo registrado')
        : `run-session.mjs saiu com código ${child.status} sem gravar linha`;
      out(`  tentativa ${attempt} de ${sessionLabel({ ...planned, run })} falhou: ${lastReason}`);
    }

    if (!succeeded) {
      stopped = { session: planned, reason: lastReason };
      out(`PARADO em ${sessionLabel(planned)}: duas tentativas seguidas falharam.`);
      out(`${plan.batch.length - index - 1} sessão(ões) do lote não foram executadas. Conserte e rode de novo — o que já foi coletado não se repete.`);
      break;
    }

    allowImageChange = false;
    const sessionCost = Number(succeeded.custo_usd) || 0;
    costUsd += sessionCost;
    executed.push({
      sessionId: succeeded.session_id, task: planned.task, pLevel: planned.pLevel,
      oLevel: planned.oLevel, model: planned.model, run: succeeded.run_number, costUsd: sessionCost,
    });
    out(`[${index + 1}/${plan.batch.length}] ${sessionLabel({ ...planned, run: succeeded.run_number })}`
      + ` — valid, $${sessionCost.toFixed(2)} (acumulado $${costUsd.toFixed(2)})`);
  }

  if (!stopped) {
    out('');
    out('lote concluído; avaliando o que ainda não tem evaluation.json');
    runEvaluator();
  }

  const recordPath = writeBatchRecord({
    repoRoot, plan, executed, stopped, startedAt, endedAt: now().toISOString(), datasetPath,
  });
  out(`registro do lote: ${recordPath}`);

  return { seed, executed: executed.length, stopped, costUsd, recordPath };
}

async function main() {
  const limit = parseLimit(argument('--limite', null));
  const seed = argument('--seed', randomSeed());
  const datasetPath = resolve(
    argument('--dataset', process.env.RUNNER_DATASET_PATH ?? join(REPO, 'resultados.csv')),
  );
  const result = await runBatch({
    datasetPath, limit, seed, dryRun: process.argv.includes('--dry-run'),
  });
  if (result.stopped) process.exit(1);
}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `node --test tools/collect/test/run-grid.test.mjs`
Esperado: 19 testes PASS.

- [ ] **Passo 5: conferir que `sessions/lotes/` entra no repositório**

Run: `git check-ignore -v sessions/lotes 2>&1 || echo "não ignorado"`
Esperado: `não ignorado`. `sessions/` é versionado de propósito desde 23/09; o registro do lote é evidência do que foi tentado e segue a mesma regra.

- [ ] **Passo 6: dry-run real, e o dataset intacto**

Run: `node tools/collect/run-grid.mjs --dry-run --limite 10`
Esperado: plano de 10 sessões, semente impressa, e a linha final dizendo que nada foi gravado.

Run: `git status --porcelain resultados.csv`
Esperado: saída vazia.

- [ ] **Passo 7: commit**

```bash
git add tools/collect/run-grid.mjs tools/collect/test/run-grid.test.mjs
git commit -m "feat: run a collection batch that resumes from the dataset and stops on repeated failure"
```

---
### Tarefa 5: as três verificações que só olham o dataset

**Arquivos:**
- Criar: `tools/collect/checks.mjs`
- Criar: `tools/collect/test/checks.test.mjs`

**Interfaces:**
- Consome: `COLUMNS` de `runner/lib/dataset.mjs`; `TASKS` de `runner/lib/capabilities.mjs`.
- Produz: `EVALUATION_COLUMNS`, `COLLECTION_COLUMNS`, e as três primeiras verificações via `checkDataset({ rows })`, que devolve uma lista de `{ id, name, failures, notes }` — `failures` vazio significa passou.

**Por que a verificação 2 só olha linhas válidas.** Uma linha `invalid` tem quase tudo vazio por construção: a sessão morreu antes de medir. Varrer coluna vazia nela reprovaria o dataset por registrar corretamente uma falha. Quem cobre linha inválida é a verificação 1, que pergunta outra coisa — se aquela sessão foi refeita.

**Por que 2 e 3 não se sobrepõem.** A verificação 2 é dona das colunas que o runner escreve; a 3 é dona das que o avaliador cego escreve (`qualidade` e `decisao_*`). Sem essa divisão as duas reprovariam a mesma coisa em momentos diferentes da coleta, e um lote recém-coletado — que ainda não passou pelo avaliador — reprovaria na verificação errada.

- [ ] **Passo 1: escrever os testes que falham**

Crie `tools/collect/test/checks.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyRow } from '../../../runner/lib/dataset.mjs';
import { checkDataset } from '../checks.mjs';

// A row the way the runner leaves it: every collection column filled,
// and the three legitimate empties of the data dictionary respected.
function validRow(overrides = {}) {
  const row = { ...emptyRow() };
  for (const column of Object.keys(row)) row[column] = 'preenchido';
  return {
    ...row,
    session_id: 'T1-P0-O1-aaa', task: 'T1', p_level: 'P0', o_level: 'O1',
    model: 'claude-sonnet-5', run_number: '1', status: 'valid',
    invalid_reason: '', taxa_aceitacao: '0.85', qualidade: '4',
    image_digest: 'sha256:constante', cli_version: '2.1.272',
    transcript_path: 'sessions/T1-P0-O1-aaa/transcript.jsonl',
    ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`decisao_${i + 1}`, ''])),
    ...overrides,
  };
}

function t2Row(overrides = {}) {
  return validRow({
    session_id: 'T2-P0-O1-bbb', task: 'T2', taxa_aceitacao: '',
    transcript_path: 'sessions/T2-P0-O1-bbb/transcript.jsonl',
    ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`decisao_${i + 1}`, 'A'])),
    ...overrides,
  });
}

// Only the dataset checks are exercised here; the transcript ones get a
// loader that always reports a healthy transcript, so this file never
// touches the filesystem.
const healthyTranscript = () => ({
  ok: true,
  init: { type: 'system', subtype: 'init', plugins: [{ name: 'meeting-rooms-conventions' }] },
  results: [{ type: 'result', is_error: false, subtype: 'success' }],
  events: [],
});
const run = (rows) => checkDataset({ rows, repoRoot: '/nao-usado', load: healthyTranscript });
const check = (rows, id) => run(rows).find((result) => result.id === id);

test('the well-formed rows of both tasks pass every dataset check', () => {
  for (const result of run([validRow(), t2Row()])) {
    assert.deepEqual(result.failures, [], `verificação ${result.id} (${result.name})`);
  }
});

test('an invalid row with no valid replacement is a hole', () => {
  const orphan = validRow({ session_id: 'T1-P0-O1-ccc', status: 'invalid', invalid_reason: 'morreu' });
  const failures = check([orphan], 1).failures;
  assert.equal(failures.length, 1);
  assert.match(failures[0], /T1-P0-O1-ccc/);
});

test('an invalid row with a valid session of the same quintuple is not a hole', () => {
  const failed = validRow({ session_id: 'T1-P0-O1-ccc', status: 'invalid', invalid_reason: 'morreu' });
  assert.deepEqual(check([failed, validRow()], 1).failures, []);
});

test('an invalid row is not swept for empty columns; that is verification 1 job', () => {
  const failed = { ...emptyRow(), session_id: 'T1-P0-O1-ccc', task: 'T1', p_level: 'P0',
    o_level: 'O1', model: 'claude-sonnet-5', run_number: '1', status: 'invalid',
    invalid_reason: 'a aplicação não respondeu health antes da entrega' };
  assert.deepEqual(check([failed, validRow()], 2).failures, []);
});

test('an empty collection column in a valid row is caught and named', () => {
  const failures = check([validRow({ duracao_s: '' })], 2).failures;
  assert.equal(failures.length, 1);
  assert.match(failures[0], /duracao_s/);
});

test('the three legitimate empties of the dictionary are not failures', () => {
  assert.deepEqual(check([validRow(), t2Row()], 2).failures, []);
});

test('taxa_aceitacao must be empty in T2 and filled in T1', () => {
  assert.match(check([t2Row({ taxa_aceitacao: '0.9' })], 2).failures[0], /taxa_aceitacao/);
  assert.match(check([validRow({ taxa_aceitacao: '' })], 2).failures[0], /taxa_aceitacao/);
});

test('invalid_reason filled in a valid row is a contradiction', () => {
  assert.match(check([validRow({ invalid_reason: 'algo' })], 2).failures[0], /invalid_reason/);
});

test('a valid session with no qualidade has not been evaluated', () => {
  assert.match(check([validRow({ qualidade: '' })], 3).failures[0], /qualidade/);
});

test('a T2 session with empty decision columns has not been evaluated', () => {
  const failures = check([t2Row({ decisao_4: '', decisao_7: '' })], 3).failures;
  assert.equal(failures.length, 1);
  assert.match(failures[0], /decisao_4/);
  assert.match(failures[0], /decisao_7/);
});

test('a T1 session with decision columns filled is a misfiled row', () => {
  assert.match(check([validRow({ decisao_1: 'A' })], 3).failures[0], /decisao_1/);
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `node --test tools/collect/test/checks.test.mjs`
Esperado: falha ao importar, `Cannot find module '../checks.mjs'`.

- [ ] **Passo 3: implementar**

Crie `tools/collect/checks.mjs`:

```js
// The auditor's checks, as pure functions over rows. Nothing here writes
// anything, anywhere.
//
// None of them looks at a *value* of a result: taxa_aceitacao, qualidade,
// violacoes, regressoes, cost and convergence appear only as "filled or
// empty", never compared to a threshold. An auditor that failed a dataset
// for a bad result would be filtering the data by the hypothesis.
import { COLUMNS } from '../../runner/lib/dataset.mjs';
import { TASKS } from '../../runner/lib/capabilities.mjs';

const DECISION_COLUMNS = Array.from({ length: 10 }, (_, index) => `decisao_${index + 1}`);

// The division of labour between verifications 2 and 3: verification 2
// owns the columns the runner writes, verification 3 the ones the blind
// evaluator writes. Without the split, a freshly collected batch -- which
// has not been through the evaluator yet -- would fail the wrong check.
export const EVALUATION_COLUMNS = ['qualidade', ...DECISION_COLUMNS];
export const COLLECTION_COLUMNS = COLUMNS.filter((column) => !EVALUATION_COLUMNS.includes(column));

const quintuple = (row) => `${row.task}|${row.p_level}|${row.o_level}|${row.model}|${row.run_number}`;
const validRows = (rows) => rows.filter((row) => row.status === 'valid');

function invalidWithoutReplacement(rows) {
  const replaced = new Set(validRows(rows).map(quintuple));
  const failures = rows
    .filter((row) => row.status !== 'valid' && !replaced.has(quintuple(row)))
    .map((row) => `${row.session_id}: status "${row.status || '(vazio)'}" e nenhuma sessão válida da mesma quíntupla`);
  return { id: 1, name: 'nenhuma linha inválida sem substituta', failures, notes: [] };
}

// Valid rows only. An invalid row has almost everything empty by
// construction -- the session died before anything was measured -- and
// sweeping it here would fail the dataset for having recorded a failure
// correctly. Invalid rows are verification 1's business.
function unexpectedEmptyColumns(rows) {
  const failures = [];
  for (const row of validRows(rows)) {
    const task = TASKS[row.task];
    if (!task) {
      failures.push(`${row.session_id}: tarefa desconhecida "${row.task}"`);
      continue;
    }
    for (const column of COLLECTION_COLUMNS) {
      const value = row[column];
      if (column === 'invalid_reason') {
        if (value !== '') failures.push(`${row.session_id}: invalid_reason preenchida numa sessão válida`);
        continue;
      }
      if (column === 'taxa_aceitacao') {
        if (task.hiddenSuite && value === '') {
          failures.push(`${row.session_id}: taxa_aceitacao vazia em ${row.task}, que tem suíte oculta`);
        }
        if (!task.hiddenSuite && value !== '') {
          failures.push(`${row.session_id}: taxa_aceitacao preenchida em ${row.task}, que não tem suíte oculta`);
        }
        continue;
      }
      if (value === '') failures.push(`${row.session_id}: coluna ${column} vazia`);
    }
  }
  return { id: 2, name: 'nenhuma coluna vazia fora do previsto', failures, notes: [] };
}

function everyValidSessionEvaluated(rows) {
  const failures = [];
  for (const row of validRows(rows)) {
    const task = TASKS[row.task];
    if (!task) continue; // already named by verification 2
    if (row.qualidade === '') failures.push(`${row.session_id}: qualidade vazia`);

    const empty = DECISION_COLUMNS.filter((column) => row[column] === '');
    const filled = DECISION_COLUMNS.filter((column) => row[column] !== '');
    if (task.decisionPoints && empty.length > 0) {
      failures.push(`${row.session_id}: ${empty.length} coluna(s) de decisão vazias em ${row.task}: ${empty.join(', ')}`);
    }
    if (!task.decisionPoints && filled.length > 0) {
      failures.push(`${row.session_id}: colunas de decisão preenchidas em ${row.task}, que não tem pontos de decisão: ${filled.join(', ')}`);
    }
  }
  return { id: 3, name: 'toda sessão válida foi avaliada', failures, notes: [] };
}

export function checkDataset({ rows }) {
  return [
    invalidWithoutReplacement(rows),
    unexpectedEmptyColumns(rows),
    everyValidSessionEvaluated(rows),
  ];
}
```

Nesta tarefa `checkDataset` aceita e ignora `repoRoot` e `load`; eles passam a ser usados na Tarefa 7.

- [ ] **Passo 4: rodar e ver passar**

Run: `node --test tools/collect/test/checks.test.mjs`
Esperado: 11 testes PASS. O primeiro teste (`passa em toda verificação`) passa porque só existem três verificações até aqui.

- [ ] **Passo 5: commit**

```bash
git add tools/collect/checks.mjs tools/collect/test/checks.test.mjs
git commit -m "feat: check the dataset for holes, unexpected empties and unevaluated sessions"
```

---

### Tarefa 6: as duas constantes do ambiente

**Arquivos:**
- Modificar: `tools/collect/checks.mjs`
- Modificar: `tools/collect/test/checks.test.mjs`

**Interfaces:**
- Produz: `PRE_BUILD_ONCE` (conjunto de ids), e as verificações 4 e 5 na lista de `checkDataset`.

**Por que a fronteira é uma lista de ids e não uma regra.** O protocolo (seção 3.4) trata a imagem como constante, e ela não era: `prepare()` reconstruía antes de cada sessão, e as oito primeiras gravaram oito digests diferentes. `runner/build-image.mjs` consertou isso em 23/09. A verificação precisa, então, saber onde começa o regime novo — e **qualquer regra que inferisse essa fronteira dos dados leria uma reconstrução no meio da coleta como "um regime novo começando aqui"**, que é exatamente o evento que a verificação existe para pegar. Os oito ids são dado congelado, conhecido e finito; ficam escritos.

- [ ] **Passo 1: escrever os testes que falham**

Acrescente a `tools/collect/test/checks.test.mjs`:

```js
test('one image digest across the new regime passes', () => {
  assert.deepEqual(check([validRow(), t2Row()], 4).failures, []);
});

test('a digest that changes mid-collection fails and names both sides', () => {
  const failures = check([
    validRow({ session_id: 'a', image_digest: 'sha256:um' }),
    validRow({ session_id: 'b', image_digest: 'sha256:dois' }),
  ], 4).failures;
  assert.equal(failures.length, 2);
  assert.match(failures.join('\n'), /sha256:um.*a/s);
  assert.match(failures.join('\n'), /sha256:dois.*b/s);
});

test('the sessions from before build-image.mjs are excluded and named, not failed', () => {
  const result = check([
    validRow({ session_id: 'T1-P0-O1-mu69pgsx', image_digest: 'sha256:antiga-1' }),
    validRow({ session_id: 'T1-P1-O1-mu69tn5j', image_digest: 'sha256:antiga-2' }),
    validRow({ session_id: 'nova', image_digest: 'sha256:constante' }),
  ], 4);
  assert.deepEqual(result.failures, []);
  assert.equal(result.notes.length, 1);
  assert.match(result.notes[0], /T1-P0-O1-mu69pgsx/);
  assert.match(result.notes[0], /T1-P1-O1-mu69tn5j/);
});

test('one cli version across the whole collection passes', () => {
  assert.deepEqual(check([validRow(), t2Row()], 5).failures, []);
});

test('a cli version that changes fails and names both sides', () => {
  const failures = check([
    validRow({ session_id: 'a', cli_version: '2.1.272' }),
    validRow({ session_id: 'b', cli_version: '2.1.280' }),
  ], 5).failures;
  assert.equal(failures.length, 2);
  assert.match(failures.join('\n'), /2\.1\.280/);
});

test('the cli version check covers the old sessions too, because that constant never broke', () => {
  const failures = check([
    validRow({ session_id: 'T1-P0-O1-mu69pgsx', cli_version: '2.1.100' }),
    validRow({ session_id: 'nova', cli_version: '2.1.272' }),
  ], 5).failures;
  assert.equal(failures.length, 2);
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `node --test tools/collect/test/checks.test.mjs`
Esperado: os seis novos falham com `Cannot read properties of undefined (reading 'failures')` — `check(rows, 4)` não encontra verificação com esse id.

- [ ] **Passo 3: implementar**

Em `tools/collect/checks.mjs`, acrescente antes de `checkDataset`:

```js
// The eight sessions collected while prepare() still rebuilt the image
// before every run, each one carrying its own digest -- the defect
// runner/build-image.mjs fixed on 23/09/2026. Verification 4 excludes
// them by name and reports them, instead of inferring the boundary from
// the data: any rule that inferred it (longest constant suffix, first
// repeated digest) would also read a rebuild in the middle of the
// collection as "a new regime starting here", which is precisely the
// event this verification exists to catch.
export const PRE_BUILD_ONCE = new Set([
  'T1-P0-O1-mu4t4rvp',
  'T1-P0-O1-mu69pgsx',
  'T1-P1-O1-mu69tn5j',
  'T2-P0-O1-mudcr5pg',
  'T2-P0-O1-mudcyv6z',
  'T2-P0-O1-muddre1p',
  'T1-P2-O1-mue3d690',
  'T1-P0-O2-mue3ic8e',
]);

// Groups the sessions by the value of a column that the protocol holds
// constant, and reports every group when there is more than one. Naming
// both sides matters: "the digest changed" is not actionable, "these
// twenty ran on one image and these twenty-three on another" is.
function constantColumn({ id, name, rows, column, excluded = new Set() }) {
  const considered = rows.filter((row) => row[column] && !excluded.has(row.session_id));
  const groups = new Map();
  for (const row of considered) {
    if (!groups.has(row[column])) groups.set(row[column], []);
    groups.get(row[column]).push(row.session_id);
  }

  const failures = groups.size > 1
    ? [...groups].map(([value, ids]) => `${value}: ${ids.join(', ')}`)
    : [];

  const skipped = rows.filter((row) => excluded.has(row.session_id)).map((row) => row.session_id);
  const notes = skipped.length > 0
    ? [`${skipped.length} sessão(ões) anterior(es) ao regime de imagem única, fora desta verificação: ${skipped.join(', ')}`]
    : [];

  return { id, name, failures, notes };
}
```

E acrescente as duas entradas em `checkDataset`, depois de `everyValidSessionEvaluated(rows)`:

```js
    constantColumn({
      id: 4, name: 'image_digest constante', rows, column: 'image_digest', excluded: PRE_BUILD_ONCE,
    }),
    constantColumn({ id: 5, name: 'cli_version constante', rows, column: 'cli_version' }),
```

- [ ] **Passo 4: rodar e ver passar**

Run: `node --test tools/collect/test/checks.test.mjs`
Esperado: 17 testes PASS.

- [ ] **Passo 5: commit**

```bash
git add tools/collect/checks.mjs tools/collect/test/checks.test.mjs
git commit -m "feat: hold the image digest and the cli version to the constants the protocol declares"
```

---
### Tarefa 7: as três verificações que abrem os transcripts

**Arquivos:**
- Modificar: `tools/collect/checks.mjs`
- Modificar: `tools/collect/test/checks.test.mjs`

**Interfaces:**
- Consome: `CONTEXTS`, `ORDERS` de `runner/lib/capabilities.mjs`.
- Produz: `loadTranscript(repoRoot, row)` → `{ ok: true, events, init, results }` ou `{ ok: false, reason }`; as verificações 6, 7 e 8 em `checkDataset({ rows, repoRoot, load })`.

São estas três que justificam guardar os transcripts: elas conferem o que ficou **registrado**, não o que o runner achou na hora. A 8 é a que fecha um buraco real — `is_error` é lido por `readTranscript` hoje e não vai para coluna nenhuma nem é conferido por nada, então uma sessão em que o CLI reportasse erro entraria como `valid`, sem rastro, desde que tivesse produzido transcript e diff. Fica como verificação e não como coluna nova: o dado já está arquivado, e acrescentar coluna quebraria a guarda de cabeçalho do dataset e exigiria migrar as linhas já coletadas.

Cada linha é lida **uma vez** e o resultado é reaproveitado pelas três verificações — cinquenta transcripts de algumas centenas de kilobytes lidos três vezes seria desperdício sem contrapartida.

- [ ] **Passo 1: escrever os testes que falham**

Acrescente a `tools/collect/test/checks.test.mjs` (e os imports de `node:fs`, `node:os` e `node:path` no topo):

```js
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadTranscript } from '../checks.mjs';

const initEvent = (plugins = []) =>
  JSON.stringify({ type: 'system', subtype: 'init', plugins, claude_code_version: '2.1.272' });
const resultEvent = (overrides = {}) =>
  JSON.stringify({ type: 'result', subtype: 'success', is_error: false, num_turns: 12, ...overrides });

// Writes a transcript where the row says it is, inside a throwaway repo
// root, so the checks exercise the real path handling rather than a stub.
function scratchRepo(transcripts) {
  const root = mkdtempSync(join(tmpdir(), 'collect-checks-'));
  for (const [sessionId, lines] of Object.entries(transcripts)) {
    mkdirSync(join(root, 'sessions', sessionId), { recursive: true });
    writeFileSync(join(root, 'sessions', sessionId, 'transcript.jsonl'), lines.join('\n'));
  }
  return root;
}

const onDisk = (rows, transcripts, id) => {
  const root = scratchRepo(transcripts);
  return checkDataset({ rows, repoRoot: root }).find((result) => result.id === id);
};

test('an O1 transcript with one init and one result is sane', () => {
  const row = validRow({ session_id: 's1', o_level: 'O1', transcript_path: 'sessions/s1/transcript.jsonl' });
  assert.deepEqual(onDisk([row], { s1: [initEvent(), resultEvent()] }, 7).failures, []);
});

test('an O2 transcript carries four result events, one per chained call', () => {
  const row = validRow({ session_id: 's2', o_level: 'O2', transcript_path: 'sessions/s2/transcript.jsonl' });
  const four = [initEvent(), resultEvent(), resultEvent(), resultEvent(), resultEvent()];
  assert.deepEqual(onDisk([row], { s2: four }, 7).failures, []);

  const three = [initEvent(), resultEvent(), resultEvent(), resultEvent()];
  const failures = onDisk([row], { s2: three }, 7).failures;
  assert.equal(failures.length, 1);
  assert.match(failures[0], /3 evento\(s\) result, 4 esperado\(s\)/);
});

test('a truncated transcript is caught, and the last line is named as the break', () => {
  const row = validRow({ session_id: 's3', transcript_path: 'sessions/s3/transcript.jsonl' });
  const truncated = [initEvent(), '{"type":"result","subty'];
  assert.match(onDisk([row], { s3: truncated }, 7).failures[0], /truncado/);
});

test('a transcript broken in the middle is a different failure from a truncation', () => {
  const row = validRow({ session_id: 's4', transcript_path: 'sessions/s4/transcript.jsonl' });
  const broken = [initEvent(), '{isto nao e json}', resultEvent()];
  assert.match(onDisk([row], { s4: broken }, 7).failures[0], /linha 2 ilegível/);
});

test('a missing transcript file is caught', () => {
  const row = validRow({ session_id: 's5', transcript_path: 'sessions/s5/transcript.jsonl' });
  assert.match(onDisk([row], {}, 7).failures[0], /ausente/);
});

test('a transcript with no init event is caught', () => {
  const row = validRow({ session_id: 's6', transcript_path: 'sessions/s6/transcript.jsonl' });
  assert.match(onDisk([row], { s6: [resultEvent()] }, 7).failures[0], /sem evento de init/);
});

test('a P2 session whose init reports the plugin passes', () => {
  const row = validRow({ session_id: 's7', p_level: 'P2', transcript_path: 'sessions/s7/transcript.jsonl' });
  const lines = [initEvent([{ name: 'meeting-rooms-conventions', version: '1.0.0' }]), resultEvent()];
  assert.deepEqual(onDisk([row], { s7: lines }, 6).failures, []);
});

test('a P2 session whose init reports no plugin ran as P1 with extra steps', () => {
  const row = validRow({ session_id: 's8', p_level: 'P2', transcript_path: 'sessions/s8/transcript.jsonl' });
  const failures = onDisk([row], { s8: [initEvent([]), resultEvent()] }, 6).failures;
  assert.equal(failures.length, 1);
  assert.match(failures[0], /s8/);
});

test('sessions that are not P2 are outside the plugin check', () => {
  const row = validRow({ session_id: 's9', p_level: 'P0', transcript_path: 'sessions/s9/transcript.jsonl' });
  assert.deepEqual(onDisk([row], { s9: [initEvent([]), resultEvent()] }, 6).failures, []);
});

test('a result event reporting an error is caught even though the row says valid', () => {
  const row = validRow({ session_id: 's10', transcript_path: 'sessions/s10/transcript.jsonl' });
  const lines = [initEvent(), resultEvent({ is_error: true })];
  assert.match(onDisk([row], { s10: lines }, 8).failures[0], /is_error/);
});

test('a result subtype other than success is caught', () => {
  const row = validRow({ session_id: 's11', transcript_path: 'sessions/s11/transcript.jsonl' });
  const lines = [initEvent(), resultEvent({ subtype: 'error_max_turns' })];
  assert.match(onDisk([row], { s11: lines }, 8).failures[0], /error_max_turns/);
});

test('an unreadable transcript is reported once, by verification 7 only', () => {
  const row = validRow({ session_id: 's12', transcript_path: 'sessions/s12/transcript.jsonl' });
  assert.equal(onDisk([row], {}, 7).failures.length, 1);
  assert.deepEqual(onDisk([row], {}, 8).failures, []);
});

test('the loader reads a transcript once even though three checks want it', () => {
  const row = validRow({ session_id: 's13', transcript_path: 'sessions/s13/transcript.jsonl' });
  let reads = 0;
  const counting = (repoRoot, target) => { reads += 1; return healthyTranscript(repoRoot, target); };
  checkDataset({ rows: [row], repoRoot: '/nao-usado', load: counting });
  assert.equal(reads, 1);
});

test('loadTranscript reports the path it could not find', () => {
  const result = loadTranscript('/nao-existe', { session_id: 'x', transcript_path: 'sessions/x/transcript.jsonl' });
  assert.equal(result.ok, false);
  assert.match(result.reason, /sessions\/x\/transcript\.jsonl/);
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `node --test tools/collect/test/checks.test.mjs`
Esperado: os 14 novos falham; os 17 anteriores continuam passando.

- [ ] **Passo 3: implementar**

Em `tools/collect/checks.mjs`, acrescente os imports e as três verificações:

```js
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONTEXTS, ORDERS } from '../../runner/lib/capabilities.mjs';
```

```js
export function loadTranscript(repoRoot, row) {
  if (!row.transcript_path) return { ok: false, reason: 'coluna transcript_path vazia' };
  const path = resolve(repoRoot, row.transcript_path);
  if (!existsSync(path)) return { ok: false, reason: `transcript ausente em ${row.transcript_path}` };

  const lines = readFileSync(path, 'utf8').split('\n').filter((line) => line.trim());
  if (lines.length === 0) return { ok: false, reason: 'transcript vazio' };

  const events = [];
  for (const [index, line] of lines.entries()) {
    try {
      events.push(JSON.parse(line));
    } catch {
      // A broken final line is a transcript cut off mid-write -- the
      // session died without anything noticing. A broken line anywhere
      // else is corruption of a different kind. Both fail; saying which
      // one is what makes the failure actionable.
      return index === lines.length - 1
        ? { ok: false, reason: 'transcript truncado na última linha' }
        : { ok: false, reason: `linha ${index + 1} ilegível` };
    }
  }

  return {
    ok: true,
    events,
    init: events.find((event) => event.type === 'system' && event.subtype === 'init'),
    results: events.filter((event) => event.type === 'result'),
  };
}

// Fifty transcripts read three times over would be waste with nothing in
// return, so the loader is wrapped once per run and the three checks
// share what it read.
function memoize(load) {
  const cache = new Map();
  return (repoRoot, row) => {
    if (!cache.has(row.session_id)) cache.set(row.session_id, load(repoRoot, row));
    return cache.get(row.session_id);
  };
}

function pluginLoadedInP2(rows, repoRoot, load) {
  const pluginName = CONTEXTS.P2.pluginName;
  const failures = [];
  for (const row of validRows(rows).filter((candidate) => candidate.p_level === 'P2')) {
    const transcript = load(repoRoot, row);
    if (!transcript.ok) {
      failures.push(`${row.session_id}: ${transcript.reason}`);
      continue;
    }
    const loaded = transcript.init?.plugins ?? [];
    const names = loaded
      .map((plugin) => (typeof plugin === 'string' ? plugin : plugin?.name))
      .filter(Boolean);
    if (!names.some((name) => String(name).includes(pluginName))) {
      failures.push(`${row.session_id}: init registrou plugins ${JSON.stringify(loaded)}`);
    }
  }
  return { id: 6, name: 'toda sessão P2 carregou o plugin', failures, notes: [] };
}

function transcriptsSane(rows, repoRoot, load) {
  const failures = [];
  for (const row of validRows(rows)) {
    const transcript = load(repoRoot, row);
    if (!transcript.ok) {
      failures.push(`${row.session_id}: ${transcript.reason}`);
      continue;
    }
    if (!transcript.init) {
      failures.push(`${row.session_id}: sem evento de init`);
      continue;
    }
    const order = ORDERS[row.o_level];
    if (!order) {
      failures.push(`${row.session_id}: nível de ordem desconhecido "${row.o_level}"`);
      continue;
    }
    if (transcript.results.length !== order.calls) {
      failures.push(
        `${row.session_id}: ${transcript.results.length} evento(s) result, `
        + `${order.calls} esperado(s) em ${row.o_level}`,
      );
    }
  }
  return { id: 7, name: 'todo transcript está são', failures, notes: [] };
}

function noCliError(rows, repoRoot, load) {
  const failures = [];
  for (const row of validRows(rows)) {
    const transcript = load(repoRoot, row);
    // An unreadable transcript is verification 7's failure; reporting it
    // twice would double-count one defect.
    if (!transcript.ok) continue;
    for (const [index, result] of transcript.results.entries()) {
      if (result.is_error) {
        failures.push(`${row.session_id}: evento result ${index + 1} com is_error true`);
      }
      if (result.subtype !== 'success') {
        failures.push(`${row.session_id}: evento result ${index + 1} com subtype "${result.subtype}"`);
      }
    }
  }
  return { id: 8, name: 'nenhuma sessão reporta erro do CLI', failures, notes: [] };
}
```

E substitua `checkDataset`:

```js
export function checkDataset({ rows, repoRoot, load = loadTranscript }) {
  const read = memoize(load);
  return [
    invalidWithoutReplacement(rows),
    unexpectedEmptyColumns(rows),
    everyValidSessionEvaluated(rows),
    constantColumn({
      id: 4, name: 'image_digest constante', rows, column: 'image_digest', excluded: PRE_BUILD_ONCE,
    }),
    constantColumn({ id: 5, name: 'cli_version constante', rows, column: 'cli_version' }),
    pluginLoadedInP2(rows, repoRoot, read),
    transcriptsSane(rows, repoRoot, read),
    noCliError(rows, repoRoot, read),
  ];
}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `node --test tools/collect/test/checks.test.mjs`
Esperado: 31 testes PASS.

- [ ] **Passo 5: commit**

```bash
git add tools/collect/checks.mjs tools/collect/test/checks.test.mjs
git commit -m "feat: audit the archived transcripts for the plugin, a whole loop and a clean cli result"
```

---

### Tarefa 8: o auditor como comando, e como portão

**Arquivos:**
- Criar: `tools/collect/check-dataset.mjs`
- Modificar: `tools/collect/test/checks.test.mjs`

**Interfaces:**
- Consome: `checkDataset` (Tarefas 5 a 7); `readRows` de `runner/lib/dataset.mjs`.
- Produz: `formatReport(results)` → string; o CLI `node tools/collect/check-dataset.mjs [--dataset <caminho>]`, com saída 1 se qualquer verificação reprovar.

O código de saída é o que deixa o auditor virar portão: a skill roda o comando e não precisa interpretar prosa para saber se passou.

- [ ] **Passo 1: escrever os testes que falham**

Acrescente a `tools/collect/test/checks.test.mjs`:

```js
import { formatReport } from '../check-dataset.mjs';

test('the report marks each verification and names what failed', () => {
  const text = formatReport([
    { id: 1, name: 'primeira', failures: [], notes: [] },
    { id: 2, name: 'segunda', failures: ['sessao-x: coluna duracao_s vazia'], notes: [] },
    { id: 4, name: 'quarta', failures: [], notes: ['2 sessões anteriores: a, b'] },
  ]);
  assert.match(text, /OK.*1\. primeira/);
  assert.match(text, /FALHA.*2\. segunda/);
  assert.match(text, /sessao-x: coluna duracao_s vazia/);
  assert.match(text, /nota: 2 sessões anteriores/);
  assert.match(text, /1 verificação\(ões\) reprovada\(s\)/);
});

test('a clean report says so in one line', () => {
  const text = formatReport([{ id: 1, name: 'primeira', failures: [], notes: [] }]);
  assert.match(text, /dataset íntegro/);
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `node --test tools/collect/test/checks.test.mjs`
Esperado: falha ao importar, `Cannot find module '../check-dataset.mjs'`.

- [ ] **Passo 3: implementar**

Crie `tools/collect/check-dataset.mjs`:

```js
#!/usr/bin/env node
// Audits what has already been collected. It reads the dataset and the
// archived transcripts and writes nothing, anywhere -- so it can be run
// as often as anyone likes, including after the whole collection.
//
// It does not decide whether the data is good, only whether it is
// integral. Nothing here looks at the value of taxa_aceitacao, qualidade
// or convergence: those are results, and an auditor that failed a bad
// result would be filtering the dataset by the hypothesis.
import { join, resolve } from 'node:path';
import { readRows } from '../../runner/lib/dataset.mjs';
import { checkDataset } from './checks.mjs';

const REPO = resolve(import.meta.dirname, '..', '..');

export function formatReport(results) {
  const lines = [];
  for (const result of results) {
    lines.push(`${result.failures.length === 0 ? 'OK   ' : 'FALHA'} ${result.id}. ${result.name}`);
    for (const note of result.notes) lines.push(`      nota: ${note}`);
    for (const failure of result.failures) lines.push(`      ${failure}`);
  }
  const failed = results.filter((result) => result.failures.length > 0).length;
  lines.push('');
  lines.push(failed === 0
    ? `dataset íntegro: ${results.length} de ${results.length} verificações passaram`
    : `${failed} verificação(ões) reprovada(s)`);
  return lines.join('\n');
}

const argument = (flag, fallback) => {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
};

function main() {
  const datasetPath = resolve(
    argument('--dataset', process.env.RUNNER_DATASET_PATH ?? join(REPO, 'resultados.csv')),
  );
  const results = checkDataset({ rows: readRows(datasetPath), repoRoot: REPO });
  process.stdout.write(`${formatReport(results)}\n`);
  process.exit(results.some((result) => result.failures.length > 0) ? 1 : 0);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `node --test tools/collect/test/checks.test.mjs`
Esperado: 33 testes PASS.

- [ ] **Passo 5: rodar o auditor contra o dataset real**

Run: `node tools/collect/check-dataset.mjs; echo "saída: $?"`

Esperado: as oito verificações em `OK`, a verificação 4 trazendo uma nota que nomeia as sete sessões do dataset anteriores ao regime de imagem única, e `saída: 0`. As sete linhas de hoje têm exatamente os três vazios legítimos do dicionário, uma única `cli_version` (2.1.272), o transcript de `T1-P2-O1-mue3d690` com o plugin no init, quatro eventos `result` em `T1-P0-O2-mue3ic8e` e um em cada O1, e nenhum `is_error`.

**Se alguma reprovar, pare e reporte antes de consertar o auditor.** Uma reprovação aqui é uma de duas coisas: um defeito no auditor, ou um defeito real no dado já coletado. As duas importam e a segunda importa mais.

Run: `node tools/collect/check-dataset.mjs --dataset resultados-piloto.csv; echo "saída: $?"`
Esperado: `saída: 1`, reprovando em **duas** verificações — a 2, porque a linha piloto tem `violacoes` vazia (ela é anterior ao script de convenções), e a 3, porque nunca passou pelo avaliador cego e tem `qualidade` vazia. É a confirmação de que o portão fecha, e de que ele fecha pelo motivo certo: o piloto não é sessão de coleta e vive em arquivo separado justamente por isso.

Run: `git status --porcelain`
Esperado: só os arquivos novos da tarefa. O auditor não escreve nada.

- [ ] **Passo 6: commit**

```bash
git add tools/collect/check-dataset.mjs tools/collect/test/checks.test.mjs
git commit -m "feat: turn the eight checks into a command that can be a gate"
```

---
### Tarefa 9: a skill de verificação de lote

**Arquivos:**
- Criar: `.claude/skills/verificar-lote/SKILL.md`

**Interfaces:**
- Consome: `node tools/collect/check-dataset.mjs` (Tarefa 8) e os registros em `sessions/lotes/` (Tarefa 4).
- Produz: nada em disco. A saída é uma resposta em duas palavras e uma linha de motivo.

A skill **não é um segundo auditor**. Ela é o procurador do orientando entre lotes: consome a saída do auditor e faz o olhar que ele faria, para que ele não precise fazê-lo cinco vezes ao longo da coleta. Fica versionada porque o roteiro que ela define determina o que é pego.

A divisão de trabalho está fechada e não deve ser reaberta na implementação: **o auditor confere todos os transcripts, mecanicamente; a skill lê um, inteiro e com atenção.** Não é amostragem por economia — é que conferir formalmente todos é mecânico e o auditor faz isso melhor, e ler *com atenção* não escala: dez transcripts passam de um megabyte, e passar o olho neles produz a ilusão de atenção, não atenção.

- [ ] **Passo 1: escrever a skill**

Crie `.claude/skills/verificar-lote/SKILL.md`:

````markdown
---
name: verificar-lote
description: Use entre lotes da coleta de sessões, depois de rodar tools/collect/run-grid.mjs, para responder "all clear" ou "parar" sobre a integridade do que foi coletado.
---

# Verificar lote

Você é o procurador do orientando entre dois lotes da coleta. O trabalho é
responder **uma coisa**: o lote que acabou de rodar pode ser seguido de mais
um, ou a coleta precisa parar para conserto?

Quatro passos. Faça os quatro, na ordem, e responda.

## 1. Rode o auditor

```
node tools/collect/check-dataset.mjs
```

Se ele sair com código diferente de zero, **reporte qual verificação
reprovou e quais sessões ela nomeou, e pare por aqui.** Não tente
consertar, não tente interpretar, não recolete nada: a decisão de
re-executar é humana.

As notas da verificação 4 (sessões anteriores ao regime de imagem única)
não são reprovação. Repasse-as e siga.

## 2. Confira que o lote entregou o que prometeu

Esta é a única coisa aqui que o auditor **não consegue fazer**: ele só
enxerga o dataset, e sete sessões íntegras num lote de dez parecem, ali,
exatamente sete sessões íntegras.

Abra o registro mais recente em `sessions/lotes/` e compare:

- Se não existe registro para o lote que acabou de rodar, **pare**: o
  driver morreu antes de terminar de escrever, e ninguém sabe onde.
- Se `stopped` não é nulo, o driver parou e disse por quê. **Reporte a
  sessão e o motivo e pare.**
- Se `stopped` é nulo, `executed.length` tem que ser igual a
  `promised.length`. Se for menor, **pare** e diga quantas faltaram.

## 3. Leia um transcript do lote, inteiro e com atenção

Pegue a primeira sessão listada em `executed` no registro do lote e leia
`sessions/<id>/transcript.jsonl` do começo ao fim.

Você está procurando qualquer coisa que sugira que **a medição não
aconteceu como desenhada**: o enunciado chegando cortado ou duplicado,
uma etapa de O2 que claramente não recebeu o contexto da anterior, o
agente encontrando arquivos do estudo dentro da cópia de trabalho, erro
de ferramenta repetido que indique ambiente quebrado, sinal de que a
sessão rodou com outro contexto que não o rotulado.

Se nada disso aparecer, esse passo passou.

## 4. Responda

Uma de duas palavras, e o motivo em uma linha:

- `all clear` — os três passos passaram; pode rodar o próximo lote.
- `parar` — e qual passo falhou, com os nomes que ele deu.

---

## Proibição: não julgue resultado

`taxa_aceitacao` baixa, `qualidade` baixa, convergência baixa, diff muito
maior ou menor que os outros, custo fora do padrão do conjunto, célula que
não se comporta como a hipótese previa — **nada disso é problema a
reportar.** É dado. Medição fora do padrão é dado desde que a regra tenha
sido seguida.

Uma sessão em que o agente não fez nada **é dado, não defeito**:
`travou_sem_diff` existe para registrá-la e o protocolo manda preservá-la
com nota zero. Conferir se houve "trabalho de verdade" é julgar resultado
pela porta dos fundos, e não é o seu trabalho.

Esta proibição está escrita com estas palavras de propósito. Um agente
encarregado de "ver se está tudo bem" tem tendência natural a encontrar
alguma coisa, e o que ele encontraria primeiro seria justamente o
resultado desfavorável — empurrando a coleta na direção da hipótese, que é
o viés que o avaliador cego e a ordem randomizada existem para evitar.
````

- [ ] **Passo 2: conferir que a proibição está lá com as palavras da spec**

Run:
```
grep -c "não julgue resultado\|É dado\|travou_sem_diff" .claude/skills/verificar-lote/SKILL.md
```
Esperado: 3 ou mais.

- [ ] **Passo 3: verificar o passo 2 contra um lote que parou antes do limite**

Este é o critério de aceite "a skill detecta um lote que parou antes do
limite pedido — o caso que o auditor aprova por só enxergar o dataset".
Monte o registro sintético e confira que a regra do passo 2 o pega:

```
mkdir -p /tmp/lote-teste && cat > /tmp/lote-teste/registro.json <<'JSON'
{ "seed": "abc123", "promised": [1,2,3,4,5,6,7,8,9,10], "executed": [1,2,3,4,5,6,7], "stopped": null }
JSON
node -e "
const r = require('/tmp/lote-teste/registro.json');
console.log(r.stopped === null && r.executed.length < r.promised.length
  ? 'parar: ' + (r.promised.length - r.executed.length) + ' sessões prometidas não foram executadas'
  : 'all clear');
"
```
Esperado: `parar: 3 sessões prometidas não foram executadas`. Se o comando
disser `all clear`, a regra do passo 2 está escrita errada na skill.

- [ ] **Passo 4: commit**

```bash
git add .claude/skills/verificar-lote/SKILL.md
git commit -m "docs: add the batch-check skill, with an explicit ban on judging results"
```

---

### Tarefa 10: README e validação de ponta a ponta

**Arquivos:**
- Criar: `tools/collect/README.md`
- Modificar: `docs/06-dicionario-de-dados.md`

**Interfaces:** nenhuma nova. Esta tarefa fecha as pontas.

`tools/convention-check/` e `tools/blind-evaluator/` têm README; este segue a
mesma regra da casa. E o dicionário de dados precisa ganhar duas frases: o
`run_number` deixou de ser digitado por quem dispara, e o dicionário registra
isso hoje como risco.

- [ ] **Passo 1: escrever o README**

Crie `tools/collect/README.md`:

```markdown
# tools/collect — coleta em lotes

Duas ferramentas. O driver gasta dinheiro; o auditor não.

## Driver

```
node tools/collect/run-grid.mjs [--limite N] [--seed S] [--dataset <caminho>] [--dry-run]
```

Descobre o que falta comparando a grade (`grid.mjs`) com as linhas `valid`
do dataset, embaralha com uma semente que imprime, e executa até `--limite`
sessões. Sem `--limite`, executa tudo que falta.

É **retomável por construção**: o que falta é sempre relido do dataset, então
rodar o mesmo comando de novo continua de onde parou, sem repetir nada e sem
ninguém precisar dizer onde estava.

- `--dry-run` imprime o plano e não gasta nada. É como se confere o que vai
  rodar antes de autorizar.
- `--seed` reproduz uma ordem anterior. A semente vai impressa em toda
  execução e gravada no registro do lote.
- O número de repetição é derivado do dataset, nunca digitado.
- Uma sessão que falhe duas vezes seguidas para o lote: continuar gastaria
  crédito produzindo mais do mesmo.
- Ao fim do lote, chama o avaliador cego sobre tudo que ainda não tem
  `evaluation.json`.
- Cada lote deixa um registro em `sessions/lotes/<instante>.json` com o que
  foi prometido, o que executou e onde parou.

## Auditor

```
node tools/collect/check-dataset.mjs [--dataset <caminho>]
```

Oito verificações de integridade, cada uma nomeando as sessões que falham.
Sai com código diferente de zero se qualquer uma reprovar, para poder virar
portão. **Não escreve nada, em lugar nenhum**, e pode rodar quantas vezes
quiser.

Ele decide se o dado é **íntegro**, nunca se é **bom**. Nenhuma verificação
olha para o valor de `taxa_aceitacao`, `qualidade` ou convergência: um
auditor que reprovasse resultado ruim estaria filtrando o dataset pela
hipótese.

Duas verificações foram consideradas e cortadas, e o motivo fica registrado
para que ninguém as restaure por parecerem lacuna: "modelo reportado
compatível com o pedido" é redundante, porque `assertModelMatches` já recusa
a sessão em tempo de execução; "custo por sessão em faixa plausível"
dependeria de um limiar escolhido no chute.

## Entre lotes

`/verificar-lote` — a skill que roda o auditor, confere que o lote entregou
o que prometeu, lê um transcript com atenção, e responde `all clear` ou
`parar`.

## Testes

```
node --test tools/collect/test/*.test.mjs
```

Nenhum teste sobe contêiner, chama a API, ou escreve no dataset real.
```

- [ ] **Passo 2: atualizar o dicionário de dados**

Em `docs/06-dicionario-de-dados.md`, na entrada de `run_number`, substitua a
observação de risco pela situação nova. Localize o trecho sobre `run_number`
ser responsabilidade de quem dispara e acrescente:

```markdown
A partir da coleta em lotes (23/09/2026) este número deixou de ser digitado:
`tools/collect/run-grid.mjs` conta quantas sessões válidas daquela célula já
existem no dataset e usa a próxima. Um número repetido deixou de ser
possível por construção. O risco anterior — quem dispara erra o número e o
dataset passa a ter duas sessões "run 1" na mesma célula — vale apenas para
as sete sessões coletadas antes dessa data, e nelas foi conferido à mão.
```

Leia a entrada existente antes de editar e encaixe o texto no estilo do
arquivo; não duplique o que já estiver dito.

- [ ] **Passo 3: rodar a suíte inteira do repositório**

Run:
```
node --test tools/collect/test/*.test.mjs
node --test tools/analysis/test/*.test.mjs
node --test tools/blind-evaluator/test/*.test.mjs
node --test tools/convention-check/test/*.test.mjs
cd runner && node --test && cd ..
```
Esperado: tudo PASS. Nada nesta entrega mudou comportamento do runner, então
uma falha lá é regressão e precisa ser reportada, não contornada.

- [ ] **Passo 4: conferir que nada escreveu no dataset**

Run:
```
node tools/collect/run-grid.mjs --dry-run
node tools/collect/check-dataset.mjs
git status --porcelain
```
Esperado: `git status` só mostra os arquivos novos desta entrega.
`resultados.csv` e `resultados-piloto.csv` não podem aparecer.

- [ ] **Passo 5: conferir os critérios de aceite da spec, um a um**

Passe pela seção 7 de `docs/superpowers/specs/2026-09-23-coleta-em-lotes-design.md`
e anote, para cada critério, o comando que o demonstra e o que ele imprimiu.
Os dois que não têm comando — "a skill contém a proibição com essas palavras"
e "a skill detecta um lote que parou antes do limite" — foram cobertos nos
passos 2 e 3 da Tarefa 9; repita-os aqui para o registro.

- [ ] **Passo 6: commit**

```bash
git add tools/collect/README.md docs/06-dicionario-de-dados.md
git commit -m "docs: document the collection tools and record that run numbers are now derived"
```

---

## Auto-revisão do plano contra a spec

**Cobertura.** Seção 1 (duas ferramentas) → Tarefas 3-4 e 5-8. Seção 2 (o alvo,
com a correção de 48 para 43) → Tarefa 1. Seção 3 (driver: dry-run, ordem com
semente, repetição derivada, permissão de imagem, duas tentativas, avaliador ao
fim, progresso e custo) → Tarefas 2, 3 e 4. Seção 4 (as oito verificações) →
Tarefas 5, 6 e 7; os dois cortes registrados → README, Tarefa 10. Seção 5 (o que
não faz) → restrições globais e comentário de cabeçalho de `check-dataset.mjs`.
Seção 6 (a skill) → Tarefa 9. Seção 7 (critérios de aceite) → Tarefa 10, passo 5.

**Sem lacunas de escopo.** Nada aqui acrescenta verificação, coluna, ou etapa
que a spec não peça, com uma exceção declarada e vetável no topo: o registro do
lote em `sessions/lotes/`, sem o qual o passo 2 da skill não tem como ser
executado nem verificado.

**Consistência de tipos.** `planBatch` devolve sessões com `run`; `sessionLabel`
consome `{task, pLevel, oLevel, model, run}`; `nextRunNumber` consome
`{task, pLevel, oLevel, model}` e devolve número; `cellKey` usa as mesmas
quatro chaves em camelCase, e `rowCellKey` faz a tradução das colunas do CSV
(`p_level`, `o_level`) uma única vez, dentro de `grid.mjs`. As verificações
todas devolvem `{ id, name, failures, notes }`, e `formatReport` não lê mais
nada além desses quatro campos. `loadTranscript` devolve `{ok:false, reason}`
ou `{ok:true, events, init, results}`, e as três verificações que o consomem
testam `ok` antes de qualquer outra coisa.
