# Reavaliação de T1 — plano de implementação

> **Para executores:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development ou superpowers:executing-plans para executar tarefa a tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** dar ao fator de contexto um canal mensurável em T1, tirando a política de domínio do enunciado e passando-a para o arquivo de contexto, e construir o script de convenções que a seção 2.6 do protocolo já especifica.

**Arquitetura:** o enunciado de T1 encolhe para a necessidade de negócio; a política de domínio passa a viver em `contexts/P1/CLAUDE.md`, copiado para dentro do contêiner antes do commit inicial da cópia de trabalho; um script novo em `tools/convention-check/` conta as oito violações da seção 2.6, seis por análise do diff no host e duas rodando o ESLint congelado dentro do contêiner; o runner passa a preencher a coluna `violacoes`, que já existe no dataset.

**Stack:** Node 22, módulos ES, zero dependências fora da biblioteca padrão, `node --test` para os testes do runner e das ferramentas, Docker para o contêiner de sessão.

**Spec:** `docs/superpowers/specs/2026-09-17-reavaliacao-de-t1-design.md` — leia antes de começar. O plano argumenta a partir dela.

## Restrições globais

- Nenhuma dependência nova em nenhum `package.json` do repositório. Todo código novo usa apenas a biblioteca padrão do Node.
- A semente em `seed/` **não é alterada por nenhuma tarefa deste plano** (decisão D7 da spec).
- `hidden-tests/T1/run.mjs` **não é alterado por nenhuma tarefa deste plano.** A linha de base de 13/26 e a referência de 26/26 precisam continuar valendo sem remedição.
- Nenhuma coluna é acrescentada ou removida do dataset. O cabeçalho continua com as mesmas 41 colunas, e `runner/lib/dataset.mjs` tem uma guarda que lança se o cabeçalho divergir.
- Código e comentários de código em inglês; documentação do projeto em português.
- Nenhum arquivo dentro de `/app` pode conter os termos `TCC`, `INATEL`, `harness`, `semente`, `experimento`, `Claude` ou `Anthropic` — `runner/lib/prepare.mjs` aborta a sessão se encontrar qualquer um. Isso **inclui o `CLAUDE.md` de P1**, cujo conteúdo é copiado para dentro de `/app`.
- Os testes do runner nunca escrevem no dataset real. Use `--dataset` ou `RUNNER_DATASET_PATH` apontando para um arquivo temporário.

---

### Tarefa 1: Corrigir o modelo registrado no dataset

**Arquivos:**
- Modificar: `runner/lib/transcript.mjs`
- Testar: `runner/test/transcript.test.mjs`

**Interfaces:**
- Produz: `readTranscript(text)` continua devolvendo o mesmo objeto; apenas o campo `model` muda de critério.

O CLI reporta em `result.modelUsage` **todos** os modelos que tocou na sessão, incluindo auxiliares pequenos que ele usa para trabalho interno próprio. O leitor atual toma `Object.keys(...)[0]`, e na sessão piloto isso registrou `claude-haiku-4-5-20251001` numa sessão que rodou em Sonnet. O modelo da sessão é o que fez o trabalho, identificado pelo volume de tokens de saída: no piloto, Sonnet produziu 14.813 tokens de saída contra 17 do auxiliar.

- [ ] **Passo 1: escrever o teste que falha**

Acrescente a `runner/test/transcript.test.mjs`:

```js
test('picks the model that did the work, not the first key reported', () => {
  const result = {
    type: 'result',
    num_turns: 3,
    total_cost_usd: 0.42,
    modelUsage: {
      'claude-haiku-4-5-20251001': { inputTokens: 1260, outputTokens: 17, costUSD: 0.001345 },
      'claude-sonnet-5': { inputTokens: 34, outputTokens: 14813, costUSD: 0.4196 },
    },
  };
  const text = [
    JSON.stringify({ type: 'system', subtype: 'init', model: 'claude-sonnet-5' }),
    JSON.stringify(result),
  ].join('\n');

  assert.equal(readTranscript(text).model, 'claude-sonnet-5');
});

test('falls back to the requested model when no usage is reported', () => {
  const text = [
    JSON.stringify({ type: 'system', subtype: 'init', model: 'claude-opus-5' }),
    JSON.stringify({ type: 'result', num_turns: 1 }),
  ].join('\n');

  assert.equal(readTranscript(text).model, 'claude-opus-5');
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `cd /home/franciscogsilverio/myPrograms/tcc-2026 && node --test runner/test/transcript.test.mjs`
Esperado: o primeiro teste falha com `'claude-haiku-4-5-20251001' !== 'claude-sonnet-5'`.

- [ ] **Passo 3: implementar**

Em `runner/lib/transcript.mjs`, substitua a linha `const modelFromUsage = Object.keys(result.modelUsage ?? {})[0];` e o campo `model:` por:

```js
// The CLI reports every model the session touched, auxiliary ones
// included: the pilot session T1-P0-O1-mu4t4rvp ran on sonnet but also
// shows a haiku entry the CLI used for its own bookkeeping. Taking the
// first key recorded the auxiliary model in a column that is an
// experimental factor, so the session's model is identified by the one
// that produced the work -- output tokens, not key order.
function sessionModel(result, init) {
  const entries = Object.entries(result.modelUsage ?? {});
  if (entries.length === 0) return init?.model ?? 'unknown';
  const [name] = entries.reduce((best, entry) =>
    (entry[1]?.outputTokens ?? 0) > (best[1]?.outputTokens ?? 0) ? entry : best);
  return name;
}
```

e use `model: sessionModel(result, init),`.

- [ ] **Passo 4: rodar e ver passar**

Run: `node --test runner/test/transcript.test.mjs`
Esperado: todos passam.

- [ ] **Passo 5: conferir contra o transcript real do piloto**

Run:
```bash
node -e 'import("./runner/lib/transcript.mjs").then(m=>{
  const t=require("fs").readFileSync("sessions/T1-P0-O1-mu4t4rvp/transcript.jsonl","utf8");
  console.log(m.readTranscript(t).model);
})'
```
Esperado: imprime `claude-sonnet-5`.

- [ ] **Passo 6: commit**

```bash
git add runner/lib/transcript.mjs runner/test/transcript.test.mjs
git commit -m "fix: record the model that ran the session, not the first one reported"
```

---

### Tarefa 2: Enunciado de T1 versão 2

**Arquivos:**
- Modificar: `tasks/T1-validacao-de-reservas.md` (substituição integral)
- Modificar: `tasks/README.md`

O enunciado passa a conter necessidade de negócio e nada mais. Tudo que é política de domínio migra para o contexto na Tarefa 5; tudo que é disciplina de engenharia sai por completo, pela decisão D8 da spec.

- [ ] **Passo 1: substituir o enunciado**

Escreva em `tasks/T1-validacao-de-reservas.md`, exatamente este conteúdo e nada mais:

```markdown
**T1 — Regras de validação de reservas**

A API de reservas está aceitando pedidos que não deveria aceitar. A reclamação concreta é que duas pessoas conseguem reservar a mesma sala no mesmo horário. Há suspeita de que outros pedidos inválidos também estejam passando.

Faça a API de reservas recusar os pedidos inválidos.

Não há canal para dúvidas nesta execução. Decida e implemente.
```

- [ ] **Passo 2: verificar que nada proibido sobrou**

Run:
```bash
grep -nEi '409|404|400|30 min|oito horas|8 horas|borda|atualiza|cancelad|passado|formato' tasks/T1-validacao-de-reservas.md
```
Esperado: nenhuma linha. Qualquer resultado significa que política de domínio continua no enunciado, o que anula o objetivo do plano.

- [ ] **Passo 3: atualizar os metadados em `tasks/README.md`**

Localize a descrição de T1 e registre: que a política de domínio de reservas não está no enunciado e sim no arquivo de contexto de P1 e P2; que o contrato medido pela suíte oculta não mudou; e que a versão anterior do enunciado foi usada apenas na sessão piloto `T1-P0-O1-mu4t4rvp`, que por isso não é comparável com as sessões seguintes. Mantenha o estilo do arquivo.

- [ ] **Passo 4: confirmar que a suíte oculta continua válida**

Run:
```bash
git diff --stat HEAD -- hidden-tests/
```
Esperado: vazio. A suíte não pode ter sido tocada.

- [ ] **Passo 5: commit**

```bash
git add tasks/
git commit -m "feat: reduce the T1 statement to the business need"
```

---

### Tarefa 3: Regras de convenção detectáveis no diff

**Arquivos:**
- Criar: `tools/convention-check/diff-rules.mjs`
- Criar: `tools/convention-check/test/diff-rules.test.mjs`

**Interfaces:**
- Produz: `diffRules(diffText)` devolve `{ 1: {violated, detail}, 3: {...}, 5: {...}, 6: {...}, 8: {...} }`, onde `violated` é booleano e `detail` é uma string curta que nomeia o arquivo ou o achado. As regras 2, 4 e 7 não são calculadas aqui.

O diff vem de `git add -A && git diff --cached` executado dentro de `/app`, que é a raiz da semente no contêiner. Os caminhos aparecem portanto como `a/src/modules/bookings/service.ts`, **sem** o prefixo `seed/`.

Regras implementadas aqui, transcritas da seção 2.6 do protocolo:

- **Regra 1** — arquivo de código de produção **criado** fora de `src/modules/<recurso>/`, `src/shared/` ou `src/plugins/`. Só conta arquivo novo (`new file mode` no diff), só conta `.ts` sob `src/`.
- **Regra 3** — arquivo de configuração alterado: `tsconfig.json`, `eslint.config.js`, `.prettierrc`, `vitest.config.ts`, `Makefile`, `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `.editorconfig`, `.gitignore`, `prisma/schema.prisma`.
- **Regra 5** — nenhum teste escrito pelo agente: nenhuma linha acrescentada em arquivo sob `tests/`.
- **Regra 6** — teste pré-existente da semente alterado ou removido. Os sete arquivos são `tests/health.test.ts`, `tests/database.test.ts`, `tests/shared.test.ts`, `tests/rooms.test.ts`, `tests/users.test.ts`, `tests/bookings.test.ts`, `tests/amenities.test.ts`. **Acrescentar testes a esses arquivos não é violação** — a implementação de referência acrescentou quinze testes a `tests/bookings.test.ts` e foi auditada como conforme. Viola apenas se houver linha removida, isto é, linha começando com `-` que não seja o cabeçalho `---`.
- **Regra 8** — linha acrescentada contendo `.skip(`, `.only(` ou `.todo(`.

- [ ] **Passo 1: escrever os testes que falham**

Crie `tools/convention-check/test/diff-rules.test.mjs`:

```js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { diffRules } from '../diff-rules.mjs';

const diff = (body) => body.join('\n');

test('rule 1 fires for a production file created outside the allowed folders', () => {
  const text = diff([
    'diff --git a/src/helpers/overlap.ts b/src/helpers/overlap.ts',
    'new file mode 100644',
    '--- /dev/null',
    '+++ b/src/helpers/overlap.ts',
    '+export const x = 1;',
  ]);
  assert.equal(diffRules(text)[1].violated, true);
});

test('rule 1 does not fire for a new file inside a module', () => {
  const text = diff([
    'diff --git a/src/modules/bookings/rules.ts b/src/modules/bookings/rules.ts',
    'new file mode 100644',
    '--- /dev/null',
    '+++ b/src/modules/bookings/rules.ts',
    '+export const x = 1;',
  ]);
  assert.equal(diffRules(text)[1].violated, false);
});

test('rule 3 fires when a config file changes', () => {
  const text = diff([
    'diff --git a/tsconfig.json b/tsconfig.json',
    '--- a/tsconfig.json',
    '+++ b/tsconfig.json',
    '+  "strict": false,',
  ]);
  assert.equal(diffRules(text)[3].violated, true);
});

test('rule 5 fires when the agent wrote no test', () => {
  const text = diff([
    'diff --git a/src/modules/bookings/service.ts b/src/modules/bookings/service.ts',
    '--- a/src/modules/bookings/service.ts',
    '+++ b/src/modules/bookings/service.ts',
    '+const a = 1;',
  ]);
  assert.equal(diffRules(text)[5].violated, true);
});

test('rule 5 does not fire when a test file gains lines', () => {
  const text = diff([
    'diff --git a/tests/bookings.test.ts b/tests/bookings.test.ts',
    '--- a/tests/bookings.test.ts',
    '+++ b/tests/bookings.test.ts',
    '+it("rejects overlap", () => {});',
  ]);
  assert.equal(diffRules(text)[5].violated, false);
});

test('rule 6 tolerates additions to a seed test file', () => {
  const text = diff([
    'diff --git a/tests/bookings.test.ts b/tests/bookings.test.ts',
    '--- a/tests/bookings.test.ts',
    '+++ b/tests/bookings.test.ts',
    '+it("rejects overlap", () => {});',
  ]);
  assert.equal(diffRules(text)[6].violated, false);
});

test('rule 6 fires when a seed test line is removed', () => {
  const text = diff([
    'diff --git a/tests/rooms.test.ts b/tests/rooms.test.ts',
    '--- a/tests/rooms.test.ts',
    '+++ b/tests/rooms.test.ts',
    '-it("lists rooms", () => {});',
  ]);
  assert.equal(diffRules(text)[6].violated, true);
});

test('rule 8 fires for a skipped test', () => {
  const text = diff([
    'diff --git a/tests/bookings.test.ts b/tests/bookings.test.ts',
    '--- a/tests/bookings.test.ts',
    '+++ b/tests/bookings.test.ts',
    '+it.skip("later", () => {});',
  ]);
  assert.equal(diffRules(text)[8].violated, true);
});

test('a clean diff violates nothing', () => {
  const text = diff([
    'diff --git a/src/modules/bookings/service.ts b/src/modules/bookings/service.ts',
    '--- a/src/modules/bookings/service.ts',
    '+++ b/src/modules/bookings/service.ts',
    '+const a = 1;',
    'diff --git a/tests/bookings.test.ts b/tests/bookings.test.ts',
    '--- a/tests/bookings.test.ts',
    '+++ b/tests/bookings.test.ts',
    '+it("rejects overlap", () => {});',
  ]);
  const rules = diffRules(text);
  for (const id of [1, 3, 5, 6, 8]) assert.equal(rules[id].violated, false, `rule ${id}`);
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `node --test tools/convention-check/test/diff-rules.test.mjs`
Esperado: falha por não existir `diff-rules.mjs`.

- [ ] **Passo 3: implementar `diff-rules.mjs`**

Escreva um parser que percorra o diff uma vez, agrupando por arquivo, registrando para cada arquivo se é novo (`new file mode`), quais linhas foram acrescentadas e se houve linha removida. Depois aplique as cinco regras sobre essa estrutura. Não use expressão regular sobre o diff inteiro: agrupe por arquivo primeiro, porque as regras 6 e 8 dependem de saber **em qual arquivo** a linha caiu.

Constantes obrigatórias no arquivo:

```js
const ALLOWED_NEW_PRODUCTION = [/^src\/modules\/[^/]+\//, /^src\/shared\//, /^src\/plugins\//];
const CONFIG_FILES = [
  'tsconfig.json', 'eslint.config.js', '.prettierrc', 'vitest.config.ts',
  'Makefile', 'Dockerfile', '.dockerignore', 'docker-compose.yml',
  '.editorconfig', '.gitignore', 'prisma/schema.prisma',
];
const SEED_TEST_FILES = [
  'tests/health.test.ts', 'tests/database.test.ts', 'tests/shared.test.ts',
  'tests/rooms.test.ts', 'tests/users.test.ts', 'tests/bookings.test.ts',
  'tests/amenities.test.ts',
];
const SKIP_MARKERS = ['.skip(', '.only(', '.todo('];
```

- [ ] **Passo 4: rodar e ver passar**

Run: `node --test tools/convention-check/test/diff-rules.test.mjs`
Esperado: todos passam.

- [ ] **Passo 5: conferir contra o diff real do piloto**

Run:
```bash
node -e 'import("./tools/convention-check/diff-rules.mjs").then(m=>
  console.log(JSON.stringify(m.diffRules(require("fs").readFileSync("sessions/T1-P0-O1-mu4t4rvp/session.diff","utf8")),null,2)))'
```
Esperado: imprime as cinco regras. Registre o resultado na saída da tarefa; um diff de 247 linhas que acrescentou testes não deve violar as regras 5 nem 6.

- [ ] **Passo 6: commit**

```bash
git add tools/convention-check/
git commit -m "feat: add the diff-based convention rules"
```

---

### Tarefa 4: Script de convenções completo

**Arquivos:**
- Criar: `tools/convention-check/check.mjs`
- Criar: `tools/convention-check/README.md`
- Modificar: `tools/convention-check/test/diff-rules.test.mjs` não muda; crie `tools/convention-check/test/manifest-rules.test.mjs`

**Interfaces:**
- Consome: `diffRules(diffText)` da Tarefa 3.
- Produz: `checkConventions({ diffText, frozenManifest, sessionManifest, eslint })` devolve `{ violacoes: <inteiro>, rules: { 1..8: {violated, detail} } }`. `frozenManifest` e `sessionManifest` são objetos já parseados do `package.json`; `eslint` é `{ 4: boolean, 7: boolean }` já apurado por quem chamou, ou `null` quando o ESLint não pôde rodar.
- Produz: CLI `node tools/convention-check/check.mjs --session <dir> --container <name>` que imprime o JSON em stdout.

Regras que faltam:

- **Regra 2** — dependência acrescentada. Apurada por diferença entre as listas de chaves de `dependencies` e `devDependencies` do manifesto congelado e do manifesto da sessão, como manda a seção 2.6, e não pelo diff. Chave removida não é violação desta regra.
- **Regra 3 (complemento)** — a seção `scripts` do `package.json` alterada também viola a regra 3. Combine com o resultado vindo do diff usando OU.
- **Regras 4 e 7** — ESLint da semente com a **configuração congelada**, sobre os arquivos que o agente alterou. `any`, `as any`, `@ts-ignore`, `@ts-expect-error` e asserção não-nula caem na regra 4; `console.*` cai na regra 7. O reúso do auxiliar `DateString` de `src/shared/schema.ts` **não é violação** — ele usa `Type.Unsafe` dentro da semente, que não é código do agente e não aparece no diff.

Quando `eslint` vier `null`, as regras 4 e 7 são reportadas com `violated: false` e `detail: 'eslint unavailable'`, e o fato precisa aparecer no `detail` para que ninguém leia ausência de violação como conformidade.

- [ ] **Passo 1: escrever os testes que falham**

Crie `tools/convention-check/test/manifest-rules.test.mjs`:

```js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkConventions } from '../check.mjs';

const base = {
  diffText: '',
  frozenManifest: { dependencies: { fastify: '5' }, devDependencies: { vitest: '3' }, scripts: { build: 'tsc' } },
  sessionManifest: { dependencies: { fastify: '5' }, devDependencies: { vitest: '3' }, scripts: { build: 'tsc' } },
  eslint: { 4: false, 7: false },
};

test('rule 2 fires when a dependency is added', () => {
  const result = checkConventions({
    ...base,
    sessionManifest: { ...base.sessionManifest, dependencies: { fastify: '5', dayjs: '1' } },
  });
  assert.equal(result.rules[2].violated, true);
  assert.match(result.rules[2].detail, /dayjs/);
});

test('rule 2 does not fire when a dependency is only removed', () => {
  const result = checkConventions({
    ...base,
    sessionManifest: { ...base.sessionManifest, dependencies: {} },
  });
  assert.equal(result.rules[2].violated, false);
});

test('rule 3 fires when the scripts section changes', () => {
  const result = checkConventions({
    ...base,
    sessionManifest: { ...base.sessionManifest, scripts: { build: 'tsc --noEmit' } },
  });
  assert.equal(result.rules[3].violated, true);
});

test('violacoes counts one per violated rule', () => {
  const result = checkConventions({
    ...base,
    sessionManifest: { ...base.sessionManifest, dependencies: { fastify: '5', dayjs: '1' }, scripts: { build: 'x' } },
    eslint: { 4: true, 7: false },
  });
  // rule 2, rule 3, rule 4, and rule 5 (no test written in an empty diff)
  assert.equal(result.violacoes, 4);
});

test('missing eslint is reported, never counted as clean', () => {
  const result = checkConventions({ ...base, eslint: null });
  assert.equal(result.rules[4].violated, false);
  assert.match(result.rules[4].detail, /unavailable/);
  assert.match(result.rules[7].detail, /unavailable/);
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `node --test tools/convention-check/test/manifest-rules.test.mjs`
Esperado: falha por não existir `check.mjs`.

- [ ] **Passo 3: implementar `check.mjs`**

A função pura `checkConventions` combina `diffRules`, as regras de manifesto e o resultado do ESLint, e devolve o objeto acima. `violacoes` é a contagem de regras com `violated: true`, entre as oito.

O CLI faz o trabalho sujo: lê `<session>/session.diff`; extrai `/app/package.json` do contêiner com `docker cp`; obtém o manifesto congelado com `git -C <repo> show HEAD:seed/package.json`; apura o ESLint chamando, **dentro do contêiner**, a configuração congelada sobre os arquivos alterados. Copie a configuração congelada para dentro com `docker cp`, do mesmo jeito que `runner/lib/measure.mjs` restaura os testes congelados, e rode o ESLint com `--no-eslintrc`/`--config` apontando para a cópia congelada, com saída JSON. Mapeie as regras do ESLint que correspondem a `any`, escapes de tipo e asserção não-nula para a regra 4, e a regra de `console` para a regra 7.

A configuração congelada em `seed/eslint.config.js` declara `@typescript-eslint/no-explicit-any`, `@typescript-eslint/no-non-null-assertion` e `no-console` como erro, sobre a base `tseslint.configs.recommended`, que traz `@typescript-eslint/ban-ts-comment` para `@ts-ignore` e `@ts-expect-error`. O mapeamento é:

```js
const RULE_4_ESLINT = [
  '@typescript-eslint/no-explicit-any',
  '@typescript-eslint/no-non-null-assertion',
  '@typescript-eslint/ban-ts-comment',
];
const RULE_7_ESLINT = ['no-console'];
```

Note que a configuração desliga `no-console` para `tests/**`, o que está correto: a regra 7 do protocolo fala de código de produção. Copie o padrão de execução dentro do contêiner de `runner/lib/measure.mjs`, que já roda o vitest lá dentro e já restaura arquivos congelados com `copyIn`.

**Confirme o mapeamento empiricamente em vez de confiar nele.** Antes de seguir, crie dentro do contêiner um arquivo de produção descartável contendo os quatro escapes e uma chamada de `console`, rode o ESLint congelado sobre ele, e confira quais identificadores de regra aparecem na saída JSON:

```bash
docker exec <container> sh -c 'cat > /tmp/probe.ts <<EOF
export function probe(x: any) {
  // @ts-ignore
  const y = x!;
  console.log(y);
  return y;
}
EOF
cd /app && npx eslint --no-ignore --format json /tmp/probe.ts'
```

Ajuste as duas listas ao que a saída realmente trouxer. Se `ban-ts-comment` não disparar, registre isso no README da ferramenta: significa que `@ts-ignore` não é detectável por esta via e que a regra 4 cobre apenas `any` e asserção não-nula.

- [ ] **Passo 4: rodar e ver passar**

Run: `node --test tools/convention-check/test/`
Esperado: todos os testes das duas suítes passam.

- [ ] **Passo 5: validar contra a referência, que é conforme por auditoria**

A implementação de referência foi auditada a mão e considerada conforme em todos os itens. Gere o diff dela e rode o script sobre ele:

```bash
node -e 'import("./tools/convention-check/check.mjs").then(async m=>{
  const fs=require("fs");
  const diffText=fs.readFileSync("reference/T1/reference.patch","utf8")
    .split("\n").map(l=>l.replace(/^(\+\+\+|---) ([ab])\/seed\//,"$1 $2/")).join("\n");
  const frozen=JSON.parse(require("child_process").execSync("git show HEAD:seed/package.json").toString());
  console.log(JSON.stringify(m.checkConventions({diffText,frozenManifest:frozen,sessionManifest:frozen,eslint:{4:false,7:false}}),null,2));
})'
```
Esperado: `violacoes` igual a zero. Se qualquer regra disparar, **é defeito do script, não da referência** — a referência foi auditada item a item e registrada como conforme em `docs/superpowers/2026-09-15-execucao-testes-ocultos.md`. Corrija o script.

- [ ] **Passo 6: escrever o README**

`tools/convention-check/README.md` explica, em português: o que o script mede, que ele implementa a seção 2.6 do protocolo sem acrescentar regra, quais seis regras rodam no host e quais duas rodam no contêiner e por quê, e como rodar o CLI à mão contra uma sessão arquivada.

- [ ] **Passo 7: commit**

```bash
git add tools/convention-check/
git commit -m "feat: add the convention script from protocol section 2.6"
```

---

### Tarefa 5: Contexto de P1 e sua aplicação no contêiner

**Arquivos:**
- Criar: `contexts/P1/CLAUDE.md`
- Modificar: `runner/lib/prepare.mjs`
- Testar: `runner/test/prepare.test.mjs`

**Interfaces:**
- Produz: `applyContext({ name, pLevel, repoRoot })`, exportada de `runner/lib/prepare.mjs`. Não faz nada em `P0`; em `P1` copia `contexts/P1/CLAUDE.md` para `/app/CLAUDE.md`; lança `InfrastructureError` se o nível não for reconhecido ou o arquivo não existir.

**Duas exigências de ordem, e errar qualquer uma invalida a sessão.** A cópia precisa acontecer **antes** de `initHistory`, senão o arquivo de contexto entra no diff da sessão como se o agente o tivesse criado, poluindo o diff e o script de convenções. E precisa acontecer **antes** de `assertNoArtefacts`, para que a verificação de termos proibidos também examine o arquivo de contexto — é de graça e impede que um `CLAUDE.md` mencionando `Claude` ou `harness` vaze a natureza do estudo para dentro da sessão.

Conteúdo de `contexts/P1/CLAUDE.md`: a seção de domínio da seção 5 da spec, mais as oito regras da seção 2.6 do protocolo em linguagem natural, mais arquitetura em camadas, convenções de nomenclatura e comandos de build, teste e lint, conforme a seção 3.2 do protocolo define P1. Restrição de redação da spec: **descreve a convenção para código novo e não encomenda padronização do repositório**, porque o módulo `amenities` é desviante de propósito e um texto que mande padronizar levaria o agente a quebrá-lo. O arquivo é escrito em português e **não pode conter** nenhum dos termos proibidos listados nas restrições globais.

- [ ] **Passo 1: escrever o teste que falha**

Acrescente a `runner/test/prepare.test.mjs`:

```js
test('applyContext does nothing for P0', () => {
  const calls = [];
  applyContext({ name: 'x', pLevel: 'P0', repoRoot: REPO, copy: (...a) => calls.push(a) });
  assert.equal(calls.length, 0);
});

test('applyContext copies the P1 context file into the working copy', () => {
  const calls = [];
  applyContext({ name: 'x', pLevel: 'P1', repoRoot: REPO, copy: (...a) => calls.push(a) });
  assert.equal(calls.length, 1);
  assert.match(calls[0][1], /contexts\/P1\/CLAUDE\.md$/);
  assert.equal(calls[0][2], '/app/CLAUDE.md');
});

test('applyContext rejects an unknown level', () => {
  assert.throws(() => applyContext({ name: 'x', pLevel: 'P9', repoRoot: REPO, copy: () => {} }));
});
```

Para tornar isso testável sem Docker, `applyContext` recebe `copy` como parâmetro opcional, cujo padrão é `copyIn` de `container.mjs`.

- [ ] **Passo 2: rodar e ver falhar**

Run: `node --test runner/test/prepare.test.mjs`
Esperado: falha por `applyContext` não existir.

- [ ] **Passo 3: implementar `applyContext` e ligá-la em `prepare`**

Exporte `applyContext` e chame-a dentro de `prepare`, **entre `start(...)` e `assertNoArtefacts(name)`**. `prepare` passa a receber `pLevel` e `repoRoot` no objeto de argumentos.

- [ ] **Passo 4: escrever o arquivo de contexto**

Crie `contexts/P1/CLAUDE.md` com o conteúdo descrito acima.

- [ ] **Passo 5: verificar que o contexto não vaza termos do estudo**

Run:
```bash
grep -nEi 'TCC|INATEL|harness|semente|experimento|Claude|Anthropic' contexts/P1/CLAUDE.md
```
Esperado: nenhuma linha. Qualquer resultado faria `assertNoArtefacts` abortar toda sessão P1.

- [ ] **Passo 6: verificar que o contexto cobre o que a suíte exige**

Confira à mão que o arquivo declara: semântica de borda com início incluído e fim excluído; que só reserva ativa ocupa e cancelar libera; proibição de passado; duração de 30 minutos a 8 horas com ambos permitidos; fim posterior ao início; exigência de existência de sala e usuário com tratamento de recurso não encontrado; e que as regras alcançam qualquer operação que crie ou altere sala ou horário. **Se qualquer um faltar, P1 não terá como chegar ao topo da escala e o gradiente medido será artefato de redação.**

- [ ] **Passo 7: rodar a suíte do runner**

Run: `node --test runner/test/`
Esperado: tudo passa.

- [ ] **Passo 8: commit**

```bash
git add contexts/ runner/lib/prepare.mjs runner/test/prepare.test.mjs
git commit -m "feat: apply the P1 context file to the working copy"
```

---

### Tarefa 6: Ligar o script de convenções ao runner

**Arquivos:**
- Modificar: `runner/lib/measure.mjs`
- Modificar: `runner/run-session.mjs`
- Testar: `runner/test/measure.test.mjs`

**Interfaces:**
- Consome: o CLI e `checkConventions` da Tarefa 4.
- Produz: `measure(...)` devolve, além do que já devolve, `conventions`, com a forma `{ violacoes, rules }` ou `null` quando não foi possível apurar.

`measure` já captura o diff em `<outDir>/session.diff` antes de restaurar os testes congelados, que é a ordem certa: o diff precisa refletir o que o agente fez, inclusive nos arquivos de teste, senão a regra 6 nunca dispara. Não altere essa ordem.

- [ ] **Passo 1: escrever o teste que falha**

`runner/test/measure.test.mjs` já tem um teste chamado `an untouched working copy scores the documented baseline`, que roda `prepare` e `measure` de verdade contra o contêiner e afirma `result.hidden.passed === 13`. Estenda **esse** teste, em vez de criar outro, acrescentando ao final:

```js
  assert.equal(result.conventions.violacoes, 1);
  assert.equal(result.conventions.rules[5].violated, true);
  for (const id of [1, 2, 3, 4, 6, 7, 8]) {
    assert.equal(result.conventions.rules[id].violated, false, `rule ${id}`);
  }
```

A contagem esperada é **um**, e não zero: numa cópia de trabalho intocada o agente não escreveu teste nenhum, que é exatamente o que a regra 5 mede. Se essa asserção parecer errada durante a execução, o erro está na leitura dela, não no número — uma sessão que não produziu diff nenhum violou a regra 5 por definição.

- [ ] **Passo 2: rodar e ver falhar**

Run: `node --test runner/test/measure.test.mjs`

- [ ] **Passo 3: implementar**

Em `measure.mjs`, depois de `captureDiff`, apure as convenções e inclua o resultado no retorno. Em `run-session.mjs`, grave `row.violacoes = measured.conventions?.violacoes ?? ''` e escreva o detalhamento regra a regra em `<outDir>/conventions.json`, do mesmo modo que o detalhamento da suíte oculta já é arquivado.

- [ ] **Passo 4: rodar a suíte inteira do runner com dataset temporário**

Run:
```bash
RUNNER_DATASET_PATH=$(mktemp -d)/r.csv node --test runner/test/
```
Esperado: tudo passa, e `resultados.csv` não é tocado.

- [ ] **Passo 5: confirmar que o dataset real não mudou**

Run: `git diff --stat -- resultados.csv`
Esperado: vazio.

- [ ] **Passo 6: commit**

```bash
git add runner/
git commit -m "feat: record convention violations in the dataset"
```

---

### Tarefa 7: Documentação e arquivamento do piloto

**Arquivos:**
- Criar: `resultados-piloto.csv`
- Modificar: `resultados.csv`
- Modificar: `docs/00-log-sessao-planejamento.md`
- Modificar: `docs/05-log-de-implementacao.md`
- Modificar: `docs/02-protocolo-experimental.md`

- [ ] **Passo 1: arquivar a linha do piloto**

Mova a única linha de dados de `resultados.csv` para `resultados-piloto.csv`, preservando o cabeçalho nos dois arquivos. `resultados.csv` fica só com o cabeçalho. A sessão piloto mediu o enunciado antigo e não é comparável; ela não é descartada, muda de arquivo.

Run para conferir:
```bash
wc -l resultados.csv resultados-piloto.csv && head -1 resultados.csv | diff - <(head -1 resultados-piloto.csv) && echo "cabecalhos identicos"
```
Esperado: `resultados.csv` com 1 linha, `resultados-piloto.csv` com 2, cabeçalhos idênticos.

- [ ] **Passo 2: registrar a rodada no log de planejamento**

Acrescente ao final de `docs/00-log-sessao-planejamento.md` uma rodada nova, no estilo append-only das anteriores, cobrindo: o que a sessão piloto mediu, com os números da seção 1 da spec; o diagnóstico das quatro causas da seção 2, incluindo a hipótese de volume que foi levantada e descartada com a evidência que a descartou; as decisões D1 a D8 com suas justificativas; e a decisão D3 nominalmente como decisão do orientando, com data. Não reescreva nada do que já está no arquivo.

- [ ] **Passo 3: reescrever o log de implementação**

`docs/05-log-de-implementacao.md` descreve estado atual e é reescrito a cada sessão. Atualize: a tabela de componentes, marcando o script de convenções e o contexto de P1 como construídos; o ambiente de execução registrado na seção 1 da spec, com repositório privado, chave em `.env` fora do versionamento, créditos comprados e versão do CLI; a projeção de custo medida, de quarenta e dois centavos por sessão contra vinte dólares disponíveis, que é insuficiente para as 55 sessões e precisa de decisão; e os próximos passos ordenados. Registre também que a coluna `model_version` guarda o que o CLI reporta, e que para modelos apelidados como `claude-sonnet-5` o CLI não expõe a versão datada — é limitação da fonte, não campo mal preenchido.

- [ ] **Passo 4: emendar o protocolo**

Em `docs/02-protocolo-experimental.md`, aplique as quatro emendas da seção 8 da spec: seção 2.2, com o enunciado novo e a justificativa de D3; seção 3.2, incluindo a política de domínio em P1 e P2, com a justificativa de D2 e o ajuste da descrição de tamanho de P1; seção 5.1, com a nota de que `taxa_aceitacao` e `violacoes` decompõem o efeito em conteúdo de negócio e conteúdo de engenharia em vez de medi-lo duas vezes; e seção 8, com as quatro ameaças à validade da seção 9 da spec.

- [ ] **Passo 5: conferir coerência**

Run:
```bash
grep -n "409\|30 minutos\|oito horas" docs/02-protocolo-experimental.md | head
```
Confirme que qualquer ocorrência restante está descrevendo o conteúdo do **contexto**, e não o do enunciado.

- [ ] **Passo 6: commit**

```bash
git add resultados.csv resultados-piloto.csv docs/
git commit -m "docs: record the pilot session and the T1 redesign"
```

---

### Tarefa 8: Executar a sessão P0 e a sessão P1

**Arquivos:**
- Cria: `sessions/T1-P0-O1-<id>/`, `sessions/T1-P1-O1-<id>/`, duas linhas em `resultados.csv`
- Cria: `docs/superpowers/2026-09-17-execucao-p0-p1.md`

Esta tarefa gasta dinheiro real. Não a inicie se qualquer tarefa anterior estiver incompleta.

- [ ] **Passo 1: conferir o portão antes de gastar**

Run:
```bash
node --test runner/test/ tools/convention-check/test/ && git status --porcelain && echo "arvore limpa e testes verdes"
```
Esperado: testes verdes, árvore limpa.

Isto também fecha o critério de aceite da spec sobre a suíte oculta continuar válida: `runner/test/measure.test.mjs` afirma `result.hidden.passed === 13` contra uma cópia de trabalho intocada, de modo que a linha de base é reconferida a cada execução da suíte do runner. Para a ponta de cima, rode a verificação da referência, que a reconstrói do zero:

```bash
bash reference/T1/verify.sh
```
Esperado: 26 de 26, zero regressões. As duas juntas confirmam que a faixa de medição não se moveu com a troca do enunciado.

- [ ] **Passo 2: rodar a sessão P0**

```bash
set -a; . ./.env; set +a
node runner/run-session.mjs --task T1 --p P0 --o O1 --model claude-sonnet-5 --run 1
```

- [ ] **Passo 3: rodar a sessão P1**

```bash
set -a; . ./.env; set +a
node runner/run-session.mjs --task T1 --p P1 --o O1 --model claude-sonnet-5 --run 1
```

- [ ] **Passo 4: confirmar que P1 de fato recebeu o contexto**

Run:
```bash
grep -c "CLAUDE.md" sessions/T1-P1-O1-*/session.diff || echo "contexto nao aparece no diff, correto"
```
Esperado: o arquivo de contexto **não** deve aparecer no diff. Se aparecer, a cópia ocorreu depois do commit inicial e a sessão está contaminada — corrija a ordem em `prepare` e refaça a sessão.

- [ ] **Passo 5: escrever o relatório**

Crie `docs/superpowers/2026-09-17-execucao-p0-p1.md` com: as duas linhas do dataset lado a lado; `taxa_aceitacao` e o detalhamento por regra das duas sessões; `violacoes` e o detalhamento das duas; turnos, custo e duração; e a comparação contra o gradiente **declarado antes da coleta** na seção 5 da spec, dizendo com todas as letras se a previsão se confirmou, se errou para mais ou se errou para menos. Não ajuste a previsão depois do fato: ela está registrada para ser confrontada.

- [ ] **Passo 6: commit**

```bash
git add resultados.csv docs/superpowers/2026-09-17-execucao-p0-p1.md
git commit -m "feat: collect the first P0 and P1 sessions of the new T1"
```
