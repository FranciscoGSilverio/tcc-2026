# Avaliador cego — plano de implementação

> **Para executores:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development ou superpowers:executing-plans para executar tarefa a tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** construir o terceiro instrumento de medida do experimento — checklist de qualidade e pontos de decisão de T2, respondidos por Sonnet 5 sobre diffs arquivados, cego à condição.

**Arquitetura:** ferramenta nova em `tools/blind-evaluator/`, no mesmo estilo de `tools/convention-check/` — módulos pequenos e puros, testáveis sem rede, mais um CLI fino que orquestra. Roda inteiramente no host, depois da sessão, nunca dentro do contêiner. Duas extensões pequenas em módulos já existentes do runner (`capabilities.mjs`, `dataset.mjs`) dão à ferramenta a mesma fonte de verdade que o resto do projeto já usa.

**Tech Stack:** Node 22, módulos ES, zero dependências novas — a chamada à API usa `fetch` global, não o SDK.

**Spec:** `docs/superpowers/specs/2026-09-21-avaliador-cego-design.md` — leia antes de começar. O plano argumenta a partir dela.

## Nota sobre uma correção feita depois da aprovação da spec

Ao planejar a implementação, uma chamada real à API mostrou que `temperature` é **rejeitada com erro 400** para Sonnet 5 (`'temperature' is deprecated for this model`), o mesmo valendo para `top_p`/`top_k`. A spec previa `temperature: 0` como a peça que tornaria a reexecução estável (decisão D2) — isso foi corrigido no próprio arquivo da spec em 21/09/2026, nas decisões D1, D2 e D6 e na seção 8. **Se você está lendo a spec e vendo menção a "temperatura zero" como algo a configurar, releia — o arquivo já foi corrigido; esta nota existe para o caso de você ter uma cópia em cache.** A decisão em si (uma passagem, sem votação) não mudou — só a justificativa, que agora repousa inteiramente em D3 (confiabilidade medida contra amostra humana, não contra si mesmo) e não em determinismo de amostragem, que não existe para este modelo.

Nenhum código deste plano passa `temperature`, `top_p` ou `top_k` na chamada à API.

## Global Constraints

- Nenhuma dependência nova em nenhum `package.json` do repositório. A chamada à API usa `fetch`, não o SDK da Anthropic.
- Modelo do avaliador fixo em `claude-sonnet-5`, sempre — nunca o modelo da sessão sendo avaliada (protocolo 2.7).
- Cegueira **à condição**: o avaliador nunca recebe P, O, modelo, ou identificação da sessão. Cegueira ao resto do código não é requisito — a pergunta 6 do checklist recebe material de referência constante (D9).
- O checklist tem **seis** perguntas, não sete — a sétima foi cortada (D8), texto preservado em `tools/blind-evaluator/prompts/checklist.md` como comentário HTML, nunca restaurada como pergunta ativa.
- Categoria ou resposta fora do formato esperado é erro que aborta a avaliação daquela sessão — nunca aproximação, nunca valor default (D7).
- `custo_usd` do dataset é o custo do agente na sessão; o custo da avaliação nunca entra nessa coluna (spec seção 6).
- A ferramenta roda inteiramente no host. Nenhum módulo aqui importa `runner/lib/container.mjs`.
- Código e comentários em inglês; documentação e prompts em português.
- Nenhum teste chama a API de verdade, exceto o passo final da Tarefa 10, que é deliberado e gasta dinheiro real.

---

### Tarefa 1: `capabilities.mjs` ganha o campo `decisionPoints`

**Arquivos:**
- Modificar: `runner/lib/capabilities.mjs`
- Modificar: `runner/test/capabilities.test.mjs`

**Interfaces:**
- Produz: `TASKS[task].decisionPoints` (booleano), ao lado de `statement` e `hiddenSuite` já existentes.

O avaliador precisa saber, por tarefa, se os pontos de decisão se aplicam. `TASKS` já é a fonte única para o que cada tarefa significa (spec seção 5.1); este campo é mais uma coluna na mesma tabela, não uma tabela nova.

- [ ] **Passo 1: escrever o teste que falha**

Acrescente a `runner/test/capabilities.test.mjs`:

```js
test('decision points apply to T2 and not to T1', () => {
  assert.equal(resolveSession({ task: 'T1', pLevel: 'P0', oLevel: 'O1' }).decisionPoints, false);
  assert.equal(resolveSession({ task: 'T2', pLevel: 'P0', oLevel: 'O1' }).decisionPoints, true);
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `node --test runner/test/capabilities.test.mjs`
Esperado: falha, `resolveSession(...).decisionPoints` é `undefined`.

- [ ] **Passo 3: implementar**

Em `runner/lib/capabilities.mjs`, altere `TASKS` e o retorno de `resolveSession`:

```js
export const TASKS = {
  T1: { statement: 'tasks/T1-validacao-de-reservas.md', hiddenSuite: true, decisionPoints: false },
  T2: { statement: 'tasks/T2-res-142.md', hiddenSuite: false, decisionPoints: true },
};
```

e, no `return` de `resolveSession`, acrescente `decisionPoints: TASKS[task].decisionPoints,`.

- [ ] **Passo 4: rodar e ver passar**

Run: `node --test runner/test/capabilities.test.mjs`
Esperado: todos passam.

- [ ] **Passo 5: commit**

```bash
git add runner/lib/capabilities.mjs runner/test/capabilities.test.mjs
git commit -m "feat: mark which task the decision points apply to"
```

---

### Tarefa 2: `dataset.mjs` ganha leitura e atualização de linha

**Arquivos:**
- Modificar: `runner/lib/dataset.mjs`
- Modificar: `runner/test/dataset.test.mjs`

**Interfaces:**
- Produz: `readRows(csvPath)` — devolve um array de objetos, um por linha de dado (sem o cabeçalho), com as mesmas chaves de `COLUMNS`. Devolve `[]` se o arquivo não existe.
- Produz: `updateRow(csvPath, sessionId, fields)` — mescla `fields` na linha cujo `session_id` é `sessionId` e reescreve o arquivo inteiro. Lança se o arquivo não existe, se o cabeçalho não bate com `COLUMNS`, se `sessionId` não é encontrado, ou se `fields` contém uma chave que não é coluna.

O avaliador roda depois da coleta, sobre linhas que já existem — `appendRow` não serve para isso. O parser de CSV precisa ser simétrico ao `escape()` que já existe (aspas dobradas, campo entre aspas quando contém vírgula, aspas ou quebra de linha), não um `split(',')` ingênuo, ou um `invalid_reason` com vírgula corromperia a leitura.

- [ ] **Passo 1: escrever o teste que falha**

Acrescente a `runner/test/dataset.test.mjs` (crie o arquivo se não existir; se existir, acrescente ao final, preservando os testes já presentes):

```js
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendRow, emptyRow, readRows, updateRow } from '../lib/dataset.mjs';

function tempCsv() {
  return join(mkdtempSync(join(tmpdir(), 'dataset-')), 'r.csv');
}

test('readRows round-trips a value containing a comma and a quote', () => {
  const path = tempCsv();
  const row = { ...emptyRow(), session_id: 'abc', invalid_reason: 'failed, said "why"' };
  appendRow(path, row);

  const [read] = readRows(path);
  assert.equal(read.session_id, 'abc');
  assert.equal(read.invalid_reason, 'failed, said "why"');
});

test('readRows returns an empty array for a missing file', () => {
  assert.deepEqual(readRows(join(tmpdir(), 'does-not-exist-xyz.csv')), []);
});

test('updateRow merges fields into the matching row and leaves others untouched', () => {
  const path = tempCsv();
  appendRow(path, { ...emptyRow(), session_id: 'a', qualidade: '' });
  appendRow(path, { ...emptyRow(), session_id: 'b', qualidade: '' });

  updateRow(path, 'a', { qualidade: 5 });

  const rows = readRows(path);
  assert.equal(rows.find((r) => r.session_id === 'a').qualidade, '5');
  assert.equal(rows.find((r) => r.session_id === 'b').qualidade, '');
});

test('updateRow rejects a session_id that does not exist', () => {
  const path = tempCsv();
  appendRow(path, { ...emptyRow(), session_id: 'a' });
  assert.throws(() => updateRow(path, 'nonexistent', { qualidade: 1 }), /no row/);
});

test('updateRow rejects a field that is not a declared column', () => {
  const path = tempCsv();
  appendRow(path, { ...emptyRow(), session_id: 'a' });
  assert.throws(() => updateRow(path, 'a', { not_a_column: 1 }), /unknown column/);
});

test('updateRow rejects a file whose header does not match the current schema', () => {
  const path = tempCsv();
  const { writeFileSync } = require('node:fs');
  writeFileSync(path, 'session_id,old_column\na,1\n');
  assert.throws(() => updateRow(path, 'a', { qualidade: 1 }), /does not match/);
});
```

Se o arquivo `runner/test/dataset.test.mjs` ainda não existir, crie-o com este conteúdo, usando `import { writeFileSync } from 'node:fs';` no topo em vez do `require` inline acima (ajuste esse último teste para usar o import).

- [ ] **Passo 2: rodar e ver falhar**

Run: `node --test runner/test/dataset.test.mjs`
Esperado: falha, `readRows`/`updateRow` não existem.

- [ ] **Passo 3: implementar**

Em `runner/lib/dataset.mjs`, acrescente:

```js
// Symmetric to escape(): a field is quoted when it contains a comma, a
// quote or a newline, and a doubled quote inside a quoted field means one
// literal quote. A naive split(',') would corrupt any invalid_reason or
// detail string that happens to contain a comma.
function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i += 1; continue;
      }
      field += char; i += 1; continue;
    }
    if (char === '"') { inQuotes = true; i += 1; continue; }
    if (char === ',') { row.push(field); field = ''; i += 1; continue; }
    if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; i += 1; continue; }
    if (char === '\r') { i += 1; continue; }
    field += char; i += 1;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

export function readRows(csvPath) {
  if (!existsSync(csvPath)) return [];
  const text = readFileSync(csvPath, 'utf8');
  const parsed = parseCsv(text).filter((cells) => cells.length > 1 || cells[0] !== '');
  const [header, ...dataRows] = parsed;
  if (!header) return [];
  return dataRows.map((cells) => Object.fromEntries(header.map((column, index) => [column, cells[index] ?? ''])));
}

// Rewrites one session's row in place. The dataset is append-only for
// collection, but the blind evaluator runs afterwards over archived
// diffs, so it has to fill columns on rows that already exist. The whole
// file is small (dozens of rows for this project), so read-patch-rewrite
// is simpler than an in-place seek and is exactly as correct.
export function updateRow(csvPath, sessionId, fields) {
  const unknown = Object.keys(fields).filter((key) => !COLUMNS.includes(key));
  if (unknown.length > 0) {
    throw new Error(`updateRow: unknown column(s): ${unknown.join(', ')}`);
  }
  if (!existsSync(csvPath)) {
    throw new Error(`updateRow: ${csvPath} does not exist`);
  }

  const existingHeader = readFileSync(csvPath, 'utf8').split('\n', 1)[0];
  const expectedHeader = COLUMNS.join(',');
  if (existingHeader !== expectedHeader) {
    throw new Error(
      `${csvPath} has a header that does not match the current schema; ` +
      `refusing to update a row that would misalign silently`,
    );
  }

  const rows = readRows(csvPath);
  const index = rows.findIndex((row) => row.session_id === sessionId);
  if (index === -1) {
    throw new Error(`updateRow: no row with session_id ${sessionId} in ${csvPath}`);
  }
  rows[index] = { ...rows[index], ...fields };

  const lines = [expectedHeader, ...rows.map((row) => COLUMNS.map((column) => escape(row[column])).join(','))];
  writeFileSync(csvPath, `${lines.join('\n')}\n`);
}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `node --test runner/test/dataset.test.mjs`
Esperado: todos passam.

- [ ] **Passo 5: confirmar que o dataset real não foi tocado**

Run: `git diff --stat -- resultados.csv`
Esperado: vazio.

- [ ] **Passo 6: commit**

```bash
git add runner/lib/dataset.mjs runner/test/dataset.test.mjs
git commit -m "feat: let the dataset be read and patched in place"
```

---

### Tarefa 3: `pontos.mjs` — os dez pontos de decisão como dado

**Arquivos:**
- Criar: `tools/blind-evaluator/lib/pontos.mjs`
- Criar: `tools/blind-evaluator/test/pontos.test.mjs`

**Interfaces:**
- Produz: `PONTOS` (array de `{ n, nome, categorias }`), `AUSENTE` (string `'ausente'`).

Transcrito da spec seção 5, que por sua vez transcreve a seção 2.4 do protocolo. O teste compara contra uma **cópia independente**, transcrita separadamente — comparar `PONTOS` contra ele mesmo não pegaria um erro de transcrição.

- [ ] **Passo 1: escrever o teste que falha**

Crie `tools/blind-evaluator/test/pontos.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUSENTE, PONTOS } from '../lib/pontos.mjs';

// Transcribed independently from protocol section 2.4, not derived from
// PONTOS — comparing the module against itself would never catch a
// transcription error in the module.
const PROTOCOLO_2_4 = [
  { n: 1, nome: 'Forma da solução', categorias: ['endpoint novo', 'altera listagem existente', 'enriquece o erro 409', 'combinação'] },
  { n: 2, nome: 'Semântica do retorno', categorias: ['horários livres', 'horários ocupados', 'ambos'] },
  { n: 3, nome: 'Granularidade dos intervalos', categorias: ['fixa', 'derivada das reservas', 'parametrizável'] },
  { n: 4, nome: 'Janela temporal padrão', categorias: ['dia', 'semana', 'obrigatória no parâmetro'] },
  { n: 5, nome: 'Limite de horário', categorias: ['comercial', '24 horas', 'configurável'] },
  { n: 6, nome: 'Escopo de salas', categorias: ['uma sala', 'várias por parâmetro', 'todas'] },
  { n: 7, nome: 'Fuso horário', categorias: ['UTC', 'local', 'explícito no contrato'] },
  { n: 8, nome: 'Sala sem reservas', categorias: ['tudo livre', 'lista vazia', '404'] },
  { n: 9, nome: 'Tratamento do passado', categorias: ['filtrado', 'incluído'] },
  { n: 10, nome: 'Contrato do POST de reserva', categorias: ['inalterado', 'passa a sugerir alternativas no 409'] },
];

test('PONTOS matches protocol section 2.4 exactly, point by point', () => {
  assert.equal(PONTOS.length, 10);
  for (const expected of PROTOCOLO_2_4) {
    const actual = PONTOS.find((p) => p.n === expected.n);
    assert.ok(actual, `missing point ${expected.n}`);
    assert.equal(actual.nome, expected.nome);
    assert.deepEqual(actual.categorias, expected.categorias);
  }
});

test('AUSENTE is the literal string used by the protocol', () => {
  assert.equal(AUSENTE, 'ausente');
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `node --test tools/blind-evaluator/test/pontos.test.mjs`
Esperado: falha, o módulo não existe.

- [ ] **Passo 3: implementar**

Crie `tools/blind-evaluator/lib/pontos.mjs`:

```js
// Transcribed verbatim from protocol section 2.4. The prompt is built
// from this list and the response is validated against it (see
// prompts.mjs and parse.mjs), so the question and the check can never
// silently diverge from each other -- only from this file, which the
// test in this directory guards against.
export const PONTOS = [
  { n: 1, nome: 'Forma da solução', categorias: ['endpoint novo', 'altera listagem existente', 'enriquece o erro 409', 'combinação'] },
  { n: 2, nome: 'Semântica do retorno', categorias: ['horários livres', 'horários ocupados', 'ambos'] },
  { n: 3, nome: 'Granularidade dos intervalos', categorias: ['fixa', 'derivada das reservas', 'parametrizável'] },
  { n: 4, nome: 'Janela temporal padrão', categorias: ['dia', 'semana', 'obrigatória no parâmetro'] },
  { n: 5, nome: 'Limite de horário', categorias: ['comercial', '24 horas', 'configurável'] },
  { n: 6, nome: 'Escopo de salas', categorias: ['uma sala', 'várias por parâmetro', 'todas'] },
  { n: 7, nome: 'Fuso horário', categorias: ['UTC', 'local', 'explícito no contrato'] },
  { n: 8, nome: 'Sala sem reservas', categorias: ['tudo livre', 'lista vazia', '404'] },
  { n: 9, nome: 'Tratamento do passado', categorias: ['filtrado', 'incluído'] },
  { n: 10, nome: 'Contrato do POST de reserva', categorias: ['inalterado', 'passa a sugerir alternativas no 409'] },
];

export const AUSENTE = 'ausente';
```

- [ ] **Passo 4: rodar e ver passar**

Run: `node --test tools/blind-evaluator/test/pontos.test.mjs`
Esperado: todos passam.

- [ ] **Passo 5: commit**

```bash
git add tools/blind-evaluator/lib/pontos.mjs tools/blind-evaluator/test/pontos.test.mjs
git commit -m "feat: declare the ten T2 decision points as data"
```

---

### Tarefa 4: material de referência de `src/shared/` e `src/plugins/`

**Arquivos:**
- Criar: `tools/blind-evaluator/lib/reference-material.mjs`
- Criar: `tools/blind-evaluator/test/reference-material.test.mjs`

**Interfaces:**
- Produz: `readReferenceMaterial(repoRoot)` — string.

Spec D9: o conteúdo congelado de `src/shared/` e `src/plugins/`, idêntico em toda sessão porque vem do commit da semente, não do contêiner. Listagem **dinâmica** via `git ls-tree`, não uma lista de arquivos hardcoded — se um arquivo for acrescentado à semente, o material de referência o inclui sem precisar editar este módulo. Ordenação explícita garante bytes idênticos entre chamadas.

- [ ] **Passo 1: escrever o teste que falha**

Crie `tools/blind-evaluator/test/reference-material.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readReferenceMaterial } from '../lib/reference-material.mjs';

const REPO = resolve(import.meta.dirname, '..', '..', '..');

test('returns identical bytes across two independent calls', () => {
  const first = readReferenceMaterial(REPO);
  const second = readReferenceMaterial(REPO);
  assert.equal(first, second);
});

test('contains a known shared utility name', () => {
  const material = readReferenceMaterial(REPO);
  assert.match(material, /validationFailed/);
  assert.match(material, /bookingConflict|notFound/);
});

test('labels each file so the model can tell them apart', () => {
  const material = readReferenceMaterial(REPO);
  assert.match(material, /errors\.ts/);
  assert.match(material, /error-handler\.ts/);
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `node --test tools/blind-evaluator/test/reference-material.test.mjs`
Esperado: falha, o módulo não existe.

- [ ] **Passo 3: implementar**

Crie `tools/blind-evaluator/lib/reference-material.mjs`:

```js
// Reads the frozen contents of src/shared/ and src/plugins/ straight
// from the research repository's own commit -- the same git-show pattern
// tools/convention-check/check.mjs already uses for the frozen ESLint
// config -- never from a session container. This is what makes the
// content identical across every session regardless of P, O or model
// (D9): it does not depend on anything a session did.
//
// The file list comes from `git ls-tree`, not a hardcoded array, so a
// file added to the seed later is picked up without editing this module.
// Explicit sorting makes the byte-identical guarantee independent of
// whatever order git happens to return.
import { execFileSync } from 'node:child_process';

export function readReferenceMaterial(repoRoot) {
  const listing = execFileSync('git', [
    '-C', repoRoot, 'ls-tree', '-r', '--name-only', 'HEAD',
    '--', 'seed/src/shared', 'seed/src/plugins',
  ]).toString().trim();

  const paths = listing.split('\n').filter(Boolean).sort();

  return paths.map((path) => {
    const content = execFileSync('git', ['-C', repoRoot, 'show', `HEAD:${path}`]).toString();
    const label = path.replace(/^seed\/src\//, '');
    return `--- ${label} ---\n${content}`;
  }).join('\n\n');
}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `node --test tools/blind-evaluator/test/reference-material.test.mjs`
Esperado: todos passam.

- [ ] **Passo 5: commit**

```bash
git add tools/blind-evaluator/lib/reference-material.mjs tools/blind-evaluator/test/reference-material.test.mjs
git commit -m "feat: read the frozen shared/plugins content as evaluator reference material"
```

---

### Tarefa 5: os prompts congelados e a montagem

**Arquivos:**
- Criar: `tools/blind-evaluator/prompts/checklist.md`
- Criar: `tools/blind-evaluator/prompts/pontos-de-decisao.md`
- Criar: `tools/blind-evaluator/lib/prompts.mjs`
- Criar: `tools/blind-evaluator/test/prompts.test.mjs`

**Interfaces:**
- Consome: `PONTOS`, `AUSENTE` de `pontos.mjs` (Tarefa 3).
- Produz: `buildChecklistPrompt({ statement, diff, referenceMaterial })` — string.
- Produz: `buildDecisionPointsPrompt({ statement, diff })` — string.

Texto congelado conforme a spec seção 4.1 e 4.2, com marcadores de substituição. A pergunta 7 antiga fica preservada em comentário HTML no próprio arquivo, para que ninguém a restaure por parecer lacuna (spec D8).

- [ ] **Passo 1: criar os arquivos de prompt**

Crie `tools/blind-evaluator/prompts/checklist.md`:

```markdown
Você recebe o enunciado de uma tarefa de programação, o conteúdo de referência de dois diretórios do projeto (`src/shared/` e `src/plugins/`, que não mudam entre sessões) e o diff unificado com as mudanças que alguém fez para atender ao enunciado, num projeto de API em TypeScript.

Responda às seis perguntas abaixo **apenas sobre o que o diff contém**, usando o material de referência só para reconhecer reúso — nunca para avaliar o material de referência em si, que não faz parte do que está sendo julgado. Não avalie se a solução é boa, não sugira melhorias, não julgue estilo. Cada resposta é `sim` ou `nao`, mais uma justificativa de uma linha citando o trecho do diff que sustenta a resposta.

Se o diff não contém informação suficiente para decidir uma pergunta, responda `nao` e diga na justificativa que o diff não mostra isso. Não deduza o que provavelmente existe fora do diff e do material de referência.

1. A lógica de negócio nova está na camada de serviço, e não nas rotas?
2. As entradas novas são validadas por schema?
3. Os caminhos de erro têm resposta explícita com código de status apropriado?
4. Valores fixos (durações, limites, janelas) estão nomeados, em vez de literais espalhados?
5. Há testes escritos que verificam comportamento observável, e não implementação interna?
6. O código novo reusa utilitários do material de referência quando um deles se aplica, em vez de reimplementar?

<!--
Pergunta 7 retirada em 21/09/2026 (protocolo, decisão D8): "Os contratos
HTTP pré-existentes seguem compatíveis, sem quebra não solicitada?"
Não restaure: a propriedade já é medida, de forma estritamente melhor,
por `regressoes`, que executa a suíte pré-existente em vez de pedir a um
avaliador que só vê o diff para adivinhar o que não mudou.
-->

Responda **somente** com um objeto JSON, sem texto antes ou depois, nesta forma:

{"1": {"resposta": "sim", "justificativa": "..."}, "2": {...}, ..., "6": {...}}

## Enunciado da tarefa

{{STATEMENT}}

## Material de referência

{{REFERENCE_MATERIAL}}

## Diff

{{DIFF}}
```

Crie `tools/blind-evaluator/prompts/pontos-de-decisao.md`:

```markdown
Você recebe o enunciado de um chamado de suporte e o diff unificado com as mudanças que alguém fez para atendê-lo, num projeto de API em TypeScript.

O chamado é deliberadamente ambíguo: ele descreve um sintoma e não determina a solução. Quem implementou precisou tomar uma série de decisões que o texto não decide. Sua tarefa é identificar qual decisão foi tomada em cada ponto, a partir do diff.

Para cada ponto abaixo, escolha exatamente uma das categorias listadas. Se o diff não toma posição sobre aquele ponto, escolha `ausente`. Não escolha a categoria que parece melhor nem a que você escolheria: escolha a que o diff mostra.

Não invente categoria. Use exatamente uma das palavras oferecidas para aquele ponto, ou `ausente`.

{{PONTOS}}

Responda **somente** com um objeto JSON, sem texto antes ou depois, nesta forma:

{"1": {"categoria": "...", "justificativa": "..."}, ..., "10": {...}}

## Enunciado da tarefa

{{STATEMENT}}

## Diff

{{DIFF}}
```

- [ ] **Passo 2: escrever o teste que falha**

Crie `tools/blind-evaluator/test/prompts.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildChecklistPrompt, buildDecisionPointsPrompt } from '../lib/prompts.mjs';

test('checklist prompt embeds statement, reference material and diff', () => {
  const prompt = buildChecklistPrompt({
    statement: 'ENUNCIADO_MARCADOR',
    diff: 'DIFF_MARCADOR',
    referenceMaterial: 'REFERENCIA_MARCADOR',
  });
  assert.match(prompt, /ENUNCIADO_MARCADOR/);
  assert.match(prompt, /DIFF_MARCADOR/);
  assert.match(prompt, /REFERENCIA_MARCADOR/);
  assert.match(prompt, /seis perguntas/);
});

test('checklist prompt has six numbered questions, not seven', () => {
  const prompt = buildChecklistPrompt({ statement: 's', diff: 'd', referenceMaterial: 'r' });
  assert.match(prompt, /^6\. /m);
  assert.doesNotMatch(prompt, /^7\. /m);
  assert.doesNotMatch(prompt, /contratos HTTP pré-existentes seguem compatíveis, sem quebra não solicitada\?/);
});

test('decision points prompt lists all ten points with their categories', () => {
  const prompt = buildDecisionPointsPrompt({ statement: 'ENUNCIADO_MARCADOR', diff: 'DIFF_MARCADOR' });
  assert.match(prompt, /ENUNCIADO_MARCADOR/);
  assert.match(prompt, /DIFF_MARCADOR/);
  for (let n = 1; n <= 10; n += 1) {
    assert.match(prompt, new RegExp(`^${n}\\. `, 'm'));
  }
  assert.match(prompt, /ausente/);
});

// The blindness guarantee from protocol section 2.7 and spec section 3:
// neither prompt may ever carry P/O/model/session-id, regardless of what
// the caller happens to have lying around. This session id is used only
// as a local string here -- it is never passed into statement or diff --
// which is exactly the property being tested: even a condition-looking
// string never leaks in through those two fields.
test('built prompts never contain condition-looking strings', () => {
  const contaminatedLookingId = 'T2-P2-O2-abc123';
  const checklist = buildChecklistPrompt({
    statement: 'plain statement text',
    diff: 'plain diff text',
    referenceMaterial: 'plain reference text',
  });
  const decision = buildDecisionPointsPrompt({ statement: 'plain statement text', diff: 'plain diff text' });

  for (const text of [checklist, decision]) {
    assert.doesNotMatch(text, /P0|P1|P2|O1|O2/);
    assert.doesNotMatch(text, /claude-(sonnet|opus|haiku)/);
    assert.doesNotMatch(text, new RegExp(contaminatedLookingId));
  }
});
```

- [ ] **Passo 3: rodar e ver falhar**

Run: `node --test tools/blind-evaluator/test/prompts.test.mjs`
Esperado: falha, o módulo não existe.

- [ ] **Passo 4: implementar**

Crie `tools/blind-evaluator/lib/prompts.mjs`:

```js
import { readFileSync } from 'node:fs';
import { AUSENTE, PONTOS } from './pontos.mjs';

const CHECKLIST_TEMPLATE = readFileSync(new URL('../prompts/checklist.md', import.meta.url), 'utf8');
const DECISION_POINTS_TEMPLATE = readFileSync(new URL('../prompts/pontos-de-decisao.md', import.meta.url), 'utf8');

export function buildChecklistPrompt({ statement, diff, referenceMaterial }) {
  return CHECKLIST_TEMPLATE
    .replace('{{STATEMENT}}', statement)
    .replace('{{REFERENCE_MATERIAL}}', referenceMaterial)
    .replace('{{DIFF}}', diff);
}

// Built from PONTOS, not typed out separately, so the prompt and the
// validation in parse.mjs read the exact same list and can never diverge
// from each other (only from pontos.mjs, which its own test guards).
export function buildDecisionPointsPrompt({ statement, diff }) {
  const pointsBlock = PONTOS
    .map((point) => `${point.n}. ${point.nome}: ${point.categorias.map((c) => `\`${c}\``).join(', ')}, ou \`${AUSENTE}\`.`)
    .join('\n');

  return DECISION_POINTS_TEMPLATE
    .replace('{{PONTOS}}', pointsBlock)
    .replace('{{STATEMENT}}', statement)
    .replace('{{DIFF}}', diff);
}
```

- [ ] **Passo 5: rodar e ver passar**

Run: `node --test tools/blind-evaluator/test/prompts.test.mjs`
Esperado: todos passam.

- [ ] **Passo 6: commit**

```bash
git add tools/blind-evaluator/prompts/ tools/blind-evaluator/lib/prompts.mjs tools/blind-evaluator/test/prompts.test.mjs
git commit -m "feat: build the frozen checklist and decision-points prompts"
```

---

### Tarefa 6: validar a resposta do modelo, sem aproximação

**Arquivos:**
- Criar: `tools/blind-evaluator/lib/parse.mjs`
- Criar: `tools/blind-evaluator/test/parse.test.mjs`

**Interfaces:**
- Consome: `PONTOS`, `AUSENTE` de `pontos.mjs`.
- Produz: `parseChecklistResponse(text)` — devolve `{ answers, qualidade }`; lança se malformado.
- Produz: `parseDecisionPointsResponse(text)` — devolve `{ answers }`; lança se malformado.

Spec D7: categoria ou resposta fora do formato é erro, nunca aproximação. `answers` é indexado por número (`1`..`6` ou `1`..`10`), cada entrada com a resposta/categoria e a justificativa.

- [ ] **Passo 1: escrever o teste que falha**

Crie `tools/blind-evaluator/test/parse.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChecklistResponse, parseDecisionPointsResponse } from '../lib/parse.mjs';

const validChecklistJson = JSON.stringify({
  1: { resposta: 'sim', justificativa: 'a' },
  2: { resposta: 'nao', justificativa: 'b' },
  3: { resposta: 'sim', justificativa: 'c' },
  4: { resposta: 'nao', justificativa: 'd' },
  5: { resposta: 'sim', justificativa: 'e' },
  6: { resposta: 'nao', justificativa: 'f' },
});

test('parses a well-formed checklist response and counts sim', () => {
  const result = parseChecklistResponse(validChecklistJson);
  assert.equal(result.qualidade, 3);
  assert.equal(result.answers[1].resposta, 'sim');
});

test('strips a markdown code fence around the JSON', () => {
  const fenced = `\`\`\`json\n${validChecklistJson}\n\`\`\``;
  const result = parseChecklistResponse(fenced);
  assert.equal(result.qualidade, 3);
});

test('throws, does not default, when a checklist answer is missing', () => {
  const incomplete = JSON.stringify({ 1: { resposta: 'sim', justificativa: 'a' } });
  assert.throws(() => parseChecklistResponse(incomplete));
});

test('throws when a checklist answer is neither sim nor nao', () => {
  const bad = validChecklistJson.replace('"sim"', '"talvez"');
  assert.throws(() => parseChecklistResponse(bad));
});

test('parses a well-formed decision points response', () => {
  const json = JSON.stringify({
    1: { categoria: 'endpoint novo', justificativa: 'a' },
    2: { categoria: 'horários livres', justificativa: 'b' },
    3: { categoria: 'fixa', justificativa: 'c' },
    4: { categoria: 'dia', justificativa: 'd' },
    5: { categoria: 'comercial', justificativa: 'e' },
    6: { categoria: 'uma sala', justificativa: 'f' },
    7: { categoria: 'UTC', justificativa: 'g' },
    8: { categoria: 'tudo livre', justificativa: 'h' },
    9: { categoria: 'filtrado', justificativa: 'i' },
    10: { categoria: 'ausente', justificativa: 'j' },
  });
  const result = parseDecisionPointsResponse(json);
  assert.equal(result.answers[1].categoria, 'endpoint novo');
  assert.equal(result.answers[10].categoria, 'ausente');
});

test('throws, does not approximate, when a category is outside the closed list', () => {
  const json = JSON.stringify({
    1: { categoria: 'algo que o modelo inventou', justificativa: 'a' },
    2: { categoria: 'horários livres', justificativa: 'b' },
    3: { categoria: 'fixa', justificativa: 'c' },
    4: { categoria: 'dia', justificativa: 'd' },
    5: { categoria: 'comercial', justificativa: 'e' },
    6: { categoria: 'uma sala', justificativa: 'f' },
    7: { categoria: 'UTC', justificativa: 'g' },
    8: { categoria: 'tudo livre', justificativa: 'h' },
    9: { categoria: 'filtrado', justificativa: 'i' },
    10: { categoria: 'ausente', justificativa: 'j' },
  });
  assert.throws(() => parseDecisionPointsResponse(json));
});

test('throws on text that is not JSON at all', () => {
  assert.throws(() => parseChecklistResponse('desculpe, não posso ajudar com isso'));
  assert.throws(() => parseDecisionPointsResponse('desculpe, não posso ajudar com isso'));
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `node --test tools/blind-evaluator/test/parse.test.mjs`
Esperado: falha, o módulo não existe.

- [ ] **Passo 3: implementar**

Crie `tools/blind-evaluator/lib/parse.mjs`:

```js
import { AUSENTE, PONTOS } from './pontos.mjs';

// Models sometimes wrap JSON in a markdown fence despite being told not
// to. Stripping it here is tolerance for formatting, not for content --
// the JSON itself is still validated strictly below.
function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  return JSON.parse(candidate.trim());
}

const CHECKLIST_SIZE = 6;

export function parseChecklistResponse(text) {
  const parsed = extractJson(text);
  const answers = {};
  for (let n = 1; n <= CHECKLIST_SIZE; n += 1) {
    const entry = parsed[String(n)];
    if (!entry || (entry.resposta !== 'sim' && entry.resposta !== 'nao')) {
      throw new Error(`checklist answer ${n} is missing or is not exactly sim/nao`);
    }
    answers[n] = { resposta: entry.resposta, justificativa: String(entry.justificativa ?? '') };
  }
  const qualidade = Object.values(answers).filter((answer) => answer.resposta === 'sim').length;
  return { answers, qualidade };
}

// D7: a category outside the closed list fails the whole evaluation for
// that session rather than being coerced to the nearest option or to
// ausente -- an instrument does not substitute in silence.
export function parseDecisionPointsResponse(text) {
  const parsed = extractJson(text);
  const answers = {};
  for (const point of PONTOS) {
    const entry = parsed[String(point.n)];
    const allowed = [...point.categorias, AUSENTE];
    if (!entry || !allowed.includes(entry.categoria)) {
      throw new Error(`decision point ${point.n} category is missing or outside the closed list`);
    }
    answers[point.n] = { categoria: entry.categoria, justificativa: String(entry.justificativa ?? '') };
  }
  return { answers };
}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `node --test tools/blind-evaluator/test/parse.test.mjs`
Esperado: todos passam.

- [ ] **Passo 5: commit**

```bash
git add tools/blind-evaluator/lib/parse.mjs tools/blind-evaluator/test/parse.test.mjs
git commit -m "feat: validate the evaluator's response, erroring on anything outside the closed lists"
```

---

### Tarefa 7: o cliente HTTP

**Arquivos:**
- Criar: `tools/blind-evaluator/lib/client.mjs`
- Criar: `tools/blind-evaluator/test/client.test.mjs`

**Interfaces:**
- Produz: `callModel({ apiKey, prompt, fetchImpl, maxTokens })` — assíncrona, devolve `{ text, costUsd, usage }`. `fetchImpl` é injetável (padrão: `fetch` global) para testar sem rede, mesmo padrão de `copy` em `applyContext`.

D2 (corrigida): **nenhum parâmetro de amostragem é enviado** — nem `temperature`, nem `top_p`, nem `top_k`. Confirme isso você mesmo antes de escrever o teste, para não repetir o engano que a spec tinha: uma chamada real à API com `temperature: 0` para `claude-sonnet-5` devolve erro 400, `'temperature' is deprecated for this model`.

Preço de Sonnet 5, verificado em 21/09/2026: **US$ 2,00 por milhão de tokens de entrada, US$ 10,00 por milhão de saída.** A API de mensagens não devolve custo em dólares — só contagem de tokens (`usage.input_tokens`, `usage.output_tokens`) — então o custo é calculado aqui, não lido de um campo pronto.

- [ ] **Passo 1: confirmar o comportamento real da API, antes de escrever qualquer código**

Run (usa a chave de `.env`; não imprime a chave):

```bash
set -a && . ./.env && set +a
curl -s https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2023-06-01" -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-5","max_tokens":16,"messages":[{"role":"user","content":"reply with exactly: ok"}]}' \
  | python3 -m json.tool
```

Esperado: `content[0].text` é `"ok"`, e o objeto `usage` tem `input_tokens` e `output_tokens`. Confirme que **não há** campo de custo em dólares na resposta — é por isso que este passo calcula o custo.

- [ ] **Passo 2: escrever o teste que falha**

Crie `tools/blind-evaluator/test/client.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callModel } from '../lib/client.mjs';

function fakeFetch(responseBody, { status = 200 } = {}) {
  return async (url, options) => ({
    ok: status < 400,
    status,
    statusText: 'test',
    json: async () => responseBody,
    // Exposed so a test can inspect what was actually sent.
    _requestBody: JSON.parse(options.body),
  });
}

test('sends no sampling parameters at all', async () => {
  let captured;
  const fetchImpl = async (url, options) => {
    captured = JSON.parse(options.body);
    return { ok: true, json: async () => ({ content: [{ text: 'ok' }], usage: { input_tokens: 1, output_tokens: 1 } }) };
  };
  await callModel({ apiKey: 'x', prompt: 'hello', fetchImpl });
  assert.equal('temperature' in captured, false);
  assert.equal('top_p' in captured, false);
  assert.equal('top_k' in captured, false);
  assert.equal(captured.model, 'claude-sonnet-5');
});

test('computes cost from usage at Sonnet 5 list price', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ content: [{ text: 'ok' }], usage: { input_tokens: 1_000_000, output_tokens: 1_000_000 } }),
  });
  const result = await callModel({ apiKey: 'x', prompt: 'hello', fetchImpl });
  // $2.00 input + $10.00 output per 1M tokens.
  assert.equal(result.costUsd, 12);
});

test('returns the response text', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ content: [{ text: 'the answer' }], usage: { input_tokens: 1, output_tokens: 1 } }),
  });
  const result = await callModel({ apiKey: 'x', prompt: 'hello', fetchImpl });
  assert.equal(result.text, 'the answer');
});

test('throws with the API error message when the call fails', async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 400,
    statusText: 'Bad Request',
    json: async () => ({ error: { message: 'something specific went wrong' } }),
  });
  await assert.rejects(
    () => callModel({ apiKey: 'x', prompt: 'hello', fetchImpl }),
    /something specific went wrong/,
  );
});
```

- [ ] **Passo 3: rodar e ver falhar**

Run: `node --test tools/blind-evaluator/test/client.test.mjs`
Esperado: falha, o módulo não existe.

- [ ] **Passo 4: implementar**

Crie `tools/blind-evaluator/lib/client.mjs`:

```js
// Direct fetch, not the CLI (spec D6): the CLI is an interactive coding
// harness, the wrong tool for a single classification call. No sampling
// parameter is sent -- temperature/top_p/top_k are all rejected with a
// 400 on claude-sonnet-5 (verified empirically 2026-09-21, spec D2). The
// model runs its default sampling; there is no determinism lever to
// pull here, so none is attempted.
const MODEL = 'claude-sonnet-5';

// USD per 1M tokens, Sonnet 5 list price verified 2026-09-21. The
// Messages API returns token counts, never a dollar figure, so cost is
// computed here rather than read from a ready-made field.
const PRICE_PER_MILLION = { input: 2.0, output: 10.0 };

function estimateCostUsd(usage) {
  const inputCost = (usage?.input_tokens ?? 0) * PRICE_PER_MILLION.input / 1_000_000;
  const outputCost = (usage?.output_tokens ?? 0) * PRICE_PER_MILLION.output / 1_000_000;
  return inputCost + outputCost;
}

export async function callModel({ apiKey, prompt, fetchImpl = fetch, maxTokens = 2048 }) {
  const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(`evaluator call failed: ${body.error?.message ?? response.statusText}`);
  }

  return {
    text: body.content?.[0]?.text ?? '',
    costUsd: estimateCostUsd(body.usage),
    usage: body.usage,
  };
}
```

- [ ] **Passo 5: rodar e ver passar**

Run: `node --test tools/blind-evaluator/test/client.test.mjs`
Esperado: todos passam.

- [ ] **Passo 6: commit**

```bash
git add tools/blind-evaluator/lib/client.mjs tools/blind-evaluator/test/client.test.mjs
git commit -m "feat: add the direct Messages API client, no sampling parameters"
```

---

### Tarefa 8: o CLI — `evaluate.mjs`

**Arquivos:**
- Criar: `tools/blind-evaluator/evaluate.mjs`
- Criar: `tools/blind-evaluator/test/evaluate.test.mjs`

**Interfaces:**
- Consome: `resolveSession`/`TASKS` de `runner/lib/capabilities.mjs`; `readRows`/`updateRow` de `runner/lib/dataset.mjs`; tudo de `lib/` desta ferramenta.
- Produz: `evaluateSession({ row, repoRoot, apiKey, dryRun, callModelImpl })` — assíncrona, exportada para o teste; e o CLI `node tools/blind-evaluator/evaluate.mjs --session <id> | --all [--dry-run] [--dataset <path>]`.

`callModelImpl` é injetável (padrão: `callModel` de `client.mjs`), pelo mesmo motivo de sempre: os testes deste arquivo não podem gastar dinheiro nem depender de rede.

- [ ] **Passo 1: escrever o teste que falha**

Crie `tools/blind-evaluator/test/evaluate.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { appendRow, emptyRow, readRows } from '../../../runner/lib/dataset.mjs';
import { evaluateSession, runAll } from '../evaluate.mjs';

const REPO = resolve(import.meta.dirname, '..', '..', '..');

function fakeRepo() {
  const repoRoot = mkdtempSync(join(tmpdir(), 'blind-eval-repo-'));
  mkdirSync(join(repoRoot, 'tasks'), { recursive: true });
  writeFileSync(join(repoRoot, 'tasks', 'T1-validacao-de-reservas.md'), 'enunciado de T1');
  writeFileSync(join(repoRoot, 'tasks', 'T2-res-142.md'), 'enunciado de T2');
  return repoRoot;
}

function sessionDir(repoRoot, sessionId, diffText) {
  const dir = join(repoRoot, 'sessions', sessionId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'session.diff'), diffText);
  return dir;
}

const checklistJson = JSON.stringify({
  1: { resposta: 'sim', justificativa: 'a' }, 2: { resposta: 'sim', justificativa: 'b' },
  3: { resposta: 'nao', justificativa: 'c' }, 4: { resposta: 'nao', justificativa: 'd' },
  5: { resposta: 'sim', justificativa: 'e' }, 6: { resposta: 'nao', justificativa: 'f' },
});
const decisionJson = JSON.stringify({
  1: { categoria: 'endpoint novo', justificativa: 'a' }, 2: { categoria: 'horários livres', justificativa: 'b' },
  3: { categoria: 'fixa', justificativa: 'c' }, 4: { categoria: 'dia', justificativa: 'd' },
  5: { categoria: 'comercial', justificativa: 'e' }, 6: { categoria: 'uma sala', justificativa: 'f' },
  7: { categoria: 'UTC', justificativa: 'g' }, 8: { categoria: 'tudo livre', justificativa: 'h' },
  9: { categoria: 'filtrado', justificativa: 'i' }, 10: { categoria: 'ausente', justificativa: 'j' },
});

test('T1 session: only the checklist runs, decision points stay absent', async () => {
  const repoRoot = fakeRepo();
  sessionDir(repoRoot, 's1', 'diff text');
  let calls = 0;
  const callModelImpl = async () => { calls += 1; return { text: checklistJson, costUsd: 0.01, usage: {} }; };

  const result = await evaluateSession({
    row: { session_id: 's1', task: 'T1', diff_path: 'sessions/s1/session.diff' },
    repoRoot, apiKey: 'x', dryRun: false, callModelImpl,
  });

  assert.equal(calls, 1);
  assert.equal(result.evaluation.checklist.qualidade, 3);
  assert.equal(result.evaluation.decisionPoints, null);
});

test('T2 session: checklist and decision points both run', async () => {
  const repoRoot = fakeRepo();
  sessionDir(repoRoot, 's2', 'diff text');
  const responses = [checklistJson, decisionJson];
  const callModelImpl = async () => ({ text: responses.shift(), costUsd: 0.01, usage: {} });

  const result = await evaluateSession({
    row: { session_id: 's2', task: 'T2', diff_path: 'sessions/s2/session.diff' },
    repoRoot, apiKey: 'x', dryRun: false, callModelImpl,
  });

  assert.equal(result.evaluation.checklist.qualidade, 3);
  assert.equal(result.evaluation.decisionPoints.answers[1].categoria, 'endpoint novo');
  assert.equal(result.evaluation.totalCostUsd, 0.02);
});

test('writes evaluation.json under sessions/<id>/', async () => {
  const repoRoot = fakeRepo();
  sessionDir(repoRoot, 's3', 'diff text');
  const callModelImpl = async () => ({ text: checklistJson, costUsd: 0.01, usage: {} });

  await evaluateSession({
    row: { session_id: 's3', task: 'T1', diff_path: 'sessions/s3/session.diff' },
    repoRoot, apiKey: 'x', dryRun: false, callModelImpl,
  });

  const path = join(repoRoot, 'sessions', 's3', 'evaluation.json');
  assert.equal(existsSync(path), true);
  const written = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(written.sessionId, 's3');
});

test('dry-run builds the prompts and never calls the model', async () => {
  const repoRoot = fakeRepo();
  sessionDir(repoRoot, 's4', 'diff text');
  let calls = 0;
  const callModelImpl = async () => { calls += 1; return { text: checklistJson, costUsd: 0, usage: {} }; };

  const result = await evaluateSession({
    row: { session_id: 's4', task: 'T1', diff_path: 'sessions/s4/session.diff' },
    repoRoot, apiKey: 'x', dryRun: true, callModelImpl,
  });

  assert.equal(calls, 0);
  assert.match(result.checklistPrompt, /diff text/);
  assert.equal(existsSync(join(repoRoot, 'sessions', 's4', 'evaluation.json')), false);
});

test('a category outside the closed list fails the session without writing anything', async () => {
  const repoRoot = fakeRepo();
  sessionDir(repoRoot, 's5', 'diff text');
  const callModelImpl = async () => ({ text: '{"garbage": true}', costUsd: 0.01, usage: {} });

  await assert.rejects(() => evaluateSession({
    row: { session_id: 's5', task: 'T1', diff_path: 'sessions/s5/session.diff' },
    repoRoot, apiKey: 'x', dryRun: false, callModelImpl,
  }));
  assert.equal(existsSync(join(repoRoot, 'sessions', 's5', 'evaluation.json')), false);
});

test('CLI: --all skips a row whose status is not valid and one already evaluated', async () => {
  const repoRoot = fakeRepo();
  const datasetPath = join(repoRoot, 'r.csv');
  appendRow(datasetPath, { ...emptyRow(), session_id: 'skip-invalid', task: 'T1', status: 'invalid', diff_path: 'sessions/skip-invalid/session.diff' });
  appendRow(datasetPath, { ...emptyRow(), session_id: 'already-done', task: 'T1', status: 'valid', diff_path: 'sessions/already-done/session.diff' });
  sessionDir(repoRoot, 'already-done', 'diff text');
  writeFileSync(join(repoRoot, 'sessions', 'already-done', 'evaluation.json'), '{}');

  let calls = 0;
  await runAll({ datasetPath, repoRoot, apiKey: 'x', dryRun: false, callModelImpl: async () => { calls += 1; return { text: checklistJson, costUsd: 0, usage: {} }; } });

  assert.equal(calls, 0);
});

// Acceptance criterion from the design spec, section 10: no T1 session
// ever writes a decisao_* column, at the dataset level -- not just in
// evaluation.json, which evaluateSession's own tests above already cover.
test('CLI: a T1 row never gets a decisao_* column written', async () => {
  const repoRoot = fakeRepo();
  const datasetPath = join(repoRoot, 'r.csv');
  appendRow(datasetPath, { ...emptyRow(), session_id: 't1-row', task: 'T1', status: 'valid', diff_path: 'sessions/t1-row/session.diff' });
  sessionDir(repoRoot, 't1-row', 'diff text');

  await runAll({ datasetPath, repoRoot, apiKey: 'x', dryRun: false, callModelImpl: async () => ({ text: checklistJson, costUsd: 0.01, usage: {} }) });

  const [row] = readRows(datasetPath);
  assert.equal(row.qualidade, '3');
  assert.equal(row.decisao_1, '');
  assert.equal(row.decisao_10, '');
});

// Acceptance criterion: a category-outside-the-list failure must not
// touch the dataset at all -- checked here at the CLI level, not just
// that evaluateSession throws (already covered above).
test('CLI: a failed evaluation during --all leaves the dataset row untouched', async () => {
  const repoRoot = fakeRepo();
  const datasetPath = join(repoRoot, 'r.csv');
  appendRow(datasetPath, { ...emptyRow(), session_id: 'will-fail', task: 'T1', status: 'valid', diff_path: 'sessions/will-fail/session.diff' });
  sessionDir(repoRoot, 'will-fail', 'diff text');

  await runAll({ datasetPath, repoRoot, apiKey: 'x', dryRun: false, callModelImpl: async () => ({ text: '{"garbage": true}', costUsd: 0.01, usage: {} }) });

  const [row] = readRows(datasetPath);
  assert.equal(row.qualidade, '');
  assert.equal(existsSync(join(repoRoot, 'sessions', 'will-fail', 'evaluation.json')), false);
});

```

- [ ] **Passo 2: rodar e ver falhar**

Run: `node --test tools/blind-evaluator/test/evaluate.test.mjs`
Esperado: falha, o módulo não existe.

- [ ] **Passo 3: implementar**

Crie `tools/blind-evaluator/evaluate.mjs`:

```js
#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readRows, updateRow } from '../../runner/lib/dataset.mjs';
import { TASKS } from '../../runner/lib/capabilities.mjs';
import { callModel } from './lib/client.mjs';
import { buildChecklistPrompt, buildDecisionPointsPrompt } from './lib/prompts.mjs';
import { parseChecklistResponse, parseDecisionPointsResponse } from './lib/parse.mjs';
import { readReferenceMaterial } from './lib/reference-material.mjs';
import { PONTOS } from './lib/pontos.mjs';

const REPO = resolve(import.meta.dirname, '..', '..');

export async function evaluateSession({ row, repoRoot, apiKey, dryRun, callModelImpl = callModel }) {
  const task = TASKS[row.task];
  if (!task) throw new Error(`evaluateSession: unknown task in row: ${row.task}`);

  const diffPath = resolve(repoRoot, row.diff_path);
  const diffText = existsSync(diffPath) ? readFileSync(diffPath, 'utf8') : '';
  const statement = readFileSync(resolve(repoRoot, task.statement), 'utf8');
  const referenceMaterial = readReferenceMaterial(repoRoot);

  const checklistPrompt = buildChecklistPrompt({ statement, diff: diffText, referenceMaterial });
  const decisionPointsPrompt = task.decisionPoints
    ? buildDecisionPointsPrompt({ statement, diff: diffText })
    : null;

  if (dryRun) {
    return { dryRun: true, checklistPrompt, decisionPointsPrompt };
  }

  const checklistCall = await callModelImpl({ apiKey, prompt: checklistPrompt });
  const checklist = parseChecklistResponse(checklistCall.text);

  let decisionPoints = null;
  if (task.decisionPoints) {
    const decisionCall = await callModelImpl({ apiKey, prompt: decisionPointsPrompt });
    const parsed = parseDecisionPointsResponse(decisionCall.text);
    decisionPoints = { ...parsed, costUsd: decisionCall.costUsd };
  }

  const evaluation = {
    sessionId: row.session_id,
    evaluatedAt: new Date().toISOString(),
    model: 'claude-sonnet-5',
    checklist: { ...checklist, costUsd: checklistCall.costUsd },
    decisionPoints,
    totalCostUsd: checklistCall.costUsd + (decisionPoints?.costUsd ?? 0),
  };

  const outDir = join(repoRoot, 'sessions', row.session_id);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'evaluation.json'), JSON.stringify(evaluation, null, 2));

  return { dryRun: false, evaluation };
}

function applyToDataset(datasetPath, row, evaluation) {
  const fields = { qualidade: evaluation.checklist.qualidade };
  if (evaluation.decisionPoints) {
    for (const point of PONTOS) {
      fields[`decisao_${point.n}`] = evaluation.decisionPoints.answers[point.n].categoria;
    }
  }
  updateRow(datasetPath, row.session_id, fields);
}

export async function runAll({ datasetPath, repoRoot, apiKey, dryRun, callModelImpl = callModel, sessionId = null }) {
  const rows = readRows(datasetPath);
  const targets = sessionId ? rows.filter((row) => row.session_id === sessionId) : rows;

  for (const row of targets) {
    if (row.status !== 'valid') {
      process.stdout.write(`${row.session_id}: skipped, status is ${row.status || '(empty)'}\n`);
      continue;
    }
    const evalPath = join(repoRoot, 'sessions', row.session_id, 'evaluation.json');
    if (!dryRun && existsSync(evalPath)) {
      process.stdout.write(`${row.session_id}: already evaluated, skipping\n`);
      continue;
    }
    try {
      const result = await evaluateSession({ row, repoRoot, apiKey, dryRun, callModelImpl });
      if (dryRun) {
        process.stdout.write(`${row.session_id}: --- checklist prompt ---\n${result.checklistPrompt}\n`);
        if (result.decisionPointsPrompt) {
          process.stdout.write(`${row.session_id}: --- decision points prompt ---\n${result.decisionPointsPrompt}\n`);
        }
      } else {
        applyToDataset(datasetPath, row, result.evaluation);
        process.stdout.write(`${row.session_id}: evaluated, qualidade=${result.evaluation.checklist.qualidade}\n`);
      }
    } catch (error) {
      process.stderr.write(`${row.session_id}: evaluation failed: ${error.message}\n`);
    }
  }
}

const argument = (flag, fallback) => {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
};

async function main() {
  const sessionId = argument('--session', null);
  const all = process.argv.includes('--all');
  const dryRun = process.argv.includes('--dry-run');
  const datasetPath = resolve(
    argument('--dataset', process.env.RUNNER_DATASET_PATH ?? join(REPO, 'resultados.csv')),
  );

  if (!sessionId && !all) {
    process.stderr.write('usage: node evaluate.mjs --session <id> | --all [--dry-run] [--dataset <path>]\n');
    process.exit(1);
  }

  await runAll({
    datasetPath, repoRoot: REPO, apiKey: process.env.ANTHROPIC_API_KEY ?? '', dryRun, sessionId,
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  await main();
}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `node --test tools/blind-evaluator/test/evaluate.test.mjs`
Esperado: todos passam.

- [ ] **Passo 5: rodar a suíte inteira da ferramenta**

Run: `node --test tools/blind-evaluator/test/*.test.mjs tools/convention-check/test/*.test.mjs runner/test/capabilities.test.mjs runner/test/dataset.test.mjs`
Esperado: todos passam.

- [ ] **Passo 6: commit**

```bash
git add tools/blind-evaluator/evaluate.mjs tools/blind-evaluator/test/evaluate.test.mjs
git commit -m "feat: add the blind evaluator CLI"
```

---

### Tarefa 9: README, emendas ao protocolo, e a avaliação real das duas sessões coletadas

**Esta tarefa gasta dinheiro real de API no último passo. Não a inicie se qualquer tarefa anterior estiver incompleta, e rode o último passo você mesmo — não delegue a um subagente sem supervisão, no mesmo espírito de como as sessões P0/P1 anteriores foram rodadas com acompanhamento.**

**Arquivos:**
- Criar: `tools/blind-evaluator/README.md`
- Modificar: `docs/02-protocolo-experimental.md`
- Modificar: `docs/03-plano-de-execucao.md`
- Modificar: `docs/05-log-de-implementacao.md`
- Modificar: `resultados.csv` (duas linhas ganham `qualidade` preenchida)

- [ ] **Passo 1: escrever o README**

`tools/blind-evaluator/README.md`, em português: o que a ferramenta mede (checklist de qualidade, pontos de decisão de T2), a garantia de cegueira à condição e o que ela não é cega a (material de referência constante), como rodar `--dry-run` para inspecionar um prompt sem gastar, como rodar contra uma sessão ou todas, e que o conjunto rotulado para medir concordância com humano (D3) ainda não existe — é o próximo passo depois desta ferramenta, não parte dela.

- [ ] **Passo 2: emendar o protocolo**

Em `docs/02-protocolo-experimental.md`, aplique as quatro emendas da seção 8 da spec: seção 2.7 (votação por maioria substituída por passagem única, cegueira redefinida como cegueira à condição, checklist com seis perguntas, pergunta 6 com material de referência), seção 5.1 (`qualidade` de "0–7" para "0–6"), seção 6 (avaliador roda depois da sessão, sobre diffs arquivados, não como passo do runner), seção 6.4 (item 6 da análise vira concordância com amostra humana).

- [ ] **Passo 3: emendar o plano de execução**

Em `docs/03-plano-de-execucao.md`, a verificação 10 do portão de M3 deixa de exigir taxa de desacordo entre três chamadas e passa a exigir concordância aceitável com a amostra humana, avaliada junto da verificação 8.

- [ ] **Passo 4: reescrever o log de implementação**

Em `docs/05-log-de-implementacao.md`: marcar o avaliador cego como construído (checklist e pontos de decisão; conjunto rotulado ainda pendente); registrar a descoberta sobre `temperature` ser rejeitada por Sonnet 5, com data; atualizar os próximos passos — plugin de P2, sequência O2, conjunto rotulado, decisão de orçamento.

- [ ] **Passo 5: portão antes de gastar**

Run:
```bash
node --test tools/blind-evaluator/test/*.test.mjs tools/convention-check/test/*.test.mjs runner/test/*.test.mjs && git status --porcelain && echo "testes verdes, arvore limpa"
```
Esperado: tudo verde, árvore limpa antes do próximo passo.

- [ ] **Passo 6: `--dry-run` contra as duas sessões reais, para inspecionar antes de gastar**

Run:
```bash
node tools/blind-evaluator/evaluate.mjs --all --dry-run
```
Esperado: imprime os prompts para as duas sessões T1 já coletadas (`T1-P0-O1-mu69pgsx` e `T1-P1-O1-mu69tn5j`). Leia os dois prompts inteiros. Confirme à vista: nenhum menciona P0, P1, O1, `claude-sonnet-5` como modelo da sessão, nem o identificador da sessão; o material de referência aparece uma vez em cada; o enunciado é o de T1.

- [ ] **Passo 7: rodar de verdade — este passo gasta dinheiro**

Run:
```bash
node tools/blind-evaluator/evaluate.mjs --all
```
Esperado: as duas sessões são avaliadas (T1, então sem pontos de decisão), cada uma escreve `sessions/<id>/evaluation.json`, e `qualidade` é preenchida nas duas linhas de `resultados.csv`.

- [ ] **Passo 8: conferir o resultado**

Run:
```bash
git diff -- resultados.csv
cat sessions/T1-P0-O1-mu69pgsx/evaluation.json
cat sessions/T1-P1-O1-mu69tn5j/evaluation.json
```
Confirme: `custo_usd` das duas linhas **não mudou** (grep o valor antigo contra o diff — só `qualidade` deve aparecer como alterado); `decisao_1` a `decisao_10` continuam vazias nas duas, porque são T1.

- [ ] **Passo 9: rodar `--all` de novo e confirmar que não gasta**

Run:
```bash
node tools/blind-evaluator/evaluate.mjs --all
```
Esperado: as duas linhas imprimem "already evaluated, skipping" e nenhuma chamada de rede acontece — confira isso observando que o comando retorna em menos de um segundo, sem esperar por resposta de API.

- [ ] **Passo 10: commit**

```bash
git add tools/blind-evaluator/README.md docs/02-protocolo-experimental.md docs/03-plano-de-execucao.md docs/05-log-de-implementacao.md resultados.csv
git commit -m "feat: document the blind evaluator and run it against the collected T1 sessions"
```
