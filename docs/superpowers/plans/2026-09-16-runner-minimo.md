# Runner mínimo — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Executar uma sessão de T1 de ponta a ponta, sem supervisão, e gravar uma linha de dataset.

**Architecture:** Um script Node no host orquestra um contêiner. A cópia de trabalho vive dentro dele, com uma única montagem de saída. O agente é o Claude Code em modo headless. A suíte oculta roda do host, por HTTP, e nunca entra no contêiner.

**Tech Stack:** Node 22, biblioteca padrão apenas, incluindo `node:test` para os testes do próprio runner. Docker. Claude Code CLI.

**Spec:** `docs/superpowers/specs/2026-09-16-runner-minimo-design.md`

## Global Constraints

- **Zero dependências.** Só a biblioteca padrão do Node. Não crie `package.json` em `runner/`.
- **O agente é o Claude Code em modo headless**, nunca um laço próprio sobre a API. O estudo mede efeito de arquivo de contexto e skills, que um laço próprio não leria.
- **Uma única montagem, de saída.** Nada do repositório de artefatos é montado no contêiner, em momento nenhum.
- **A chave de API entra só por variável de ambiente.** Nunca por arquivo dentro da cópia de trabalho, senão aparece no diff da sessão.
- **O enunciado chega como prompt**, nunca como arquivo. Um arquivo revelaria ao agente que existe mais de uma tarefa.
- **A suíte oculta nunca entra no contêiner.** Roda do host contra a porta publicada.
- **Escopo: T1, P0, O1.** Uma chamada ao agente, sem arquivo de contexto. Não implemente P1, P2, O2 nem T2.
- **A fronteira entre infraestrutura e dado é temporal.** Falha antes da entrega ao agente é ambiente; falha depois é o agente, e a sessão é registrada.
- Código, identificadores e mensagens de commit em **inglês**. Documentos em português.
- Nunca deixe contêiner ou servidor rodando. Nunca use `sleep` fixo para esperar prontidão: pergunte ao endpoint de saúde.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `runner/run-session.mjs` | Orquestra as cinco fases e decide válida ou inválida |
| `runner/lib/transcript.mjs` | Lê a saída estruturada do CLI: tokens, custo, turnos, chamadas de ferramenta, markdown |
| `runner/lib/dataset.mjs` | Esquema do CSV e acréscimo de linha |
| `runner/lib/container.mjs` | Subir, executar dentro, copiar para dentro e para fora, derrubar |
| `runner/lib/fakes.mjs` | Os três substitutos da chamada ao agente |
| `runner/Dockerfile.session` | Imagem derivada da imagem da semente, acrescenta o CLI |
| `runner/test/*.test.mjs` | Testes do próprio runner, com `node --test` |
| `runner/README.md` | Como executar, e os três substitutos |

**Não existe tabela de preços.** O CLI já devolve `total_cost_usd` calculado no evento final, e os tokens brutos vêm junto. Uma tabela nossa seria uma segunda fonte de verdade que poderia divergir da primeira.

---

## O que o CLI devolve, que foi verificado e não suposto

Uma amostra real foi capturada e está em `runner/test/fixtures/transcript-minimal.jsonl`. O formato é uma linha JSON por evento. Os tipos que importam:

- `system` com `subtype: "init"`: traz `model`, `claude_code_version`, `session_id`, `cwd`, `permissionMode`.
- `assistant`: cada turno do agente. As chamadas de ferramenta são blocos com `type: "tool_use"` dentro de `message.content`.
- `result`: o evento final, e é ele que carrega quase tudo que o dataset precisa.

O evento `result` traz, entre outros campos: `total_cost_usd`, `num_turns`, `stop_reason`, `is_error`, `duration_ms`, `duration_api_ms`, `usage` com `input_tokens`, `output_tokens`, `cache_creation_input_tokens` e `cache_read_input_tokens`, e `modelUsage` com chave igual ao identificador exato do modelo.

Existe também um tipo `rate_limit_event`, útil para detectar limite de API atingido.

**Observação de orçamento, medida na amostra:** um prompt trivial custou cerca de dezesseis centavos, quase tudo em criação de cache do prompt de sistema. Existe portanto um custo de piso por sessão, independente do tamanho da tarefa.

---

### Task 1: Leitura do transcript

**Files:**
- Create: `runner/lib/transcript.mjs`, `runner/test/transcript.test.mjs`
- Já existe: `runner/test/fixtures/transcript-minimal.jsonl`

**Interfaces:**
- Consumes: nada
- Produces: `readTranscript(text)` devolvendo `{ model, cliVersion, sessionId, numTurns, stopReason, isError, costUsd, durationMs, tokens: { input, output, cacheCreate, cacheRead }, toolCalls, rateLimited, events }`; e `toMarkdown(parsed)` devolvendo string

- [ ] **Step 1: Escrever o teste que falha**

Criar `runner/test/transcript.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readTranscript, toMarkdown } from '../lib/transcript.mjs';

const fixture = readFileSync(new URL('./fixtures/transcript-minimal.jsonl', import.meta.url), 'utf8');

test('reads the final result event', () => {
  const parsed = readTranscript(fixture);
  assert.equal(parsed.numTurns, 1);
  assert.equal(parsed.stopReason, 'end_turn');
  assert.equal(parsed.isError, false);
  assert.ok(parsed.costUsd > 0);
});

test('separates the four token counters', () => {
  const parsed = readTranscript(fixture);
  assert.equal(parsed.tokens.input, 2);
  assert.equal(parsed.tokens.output, 4);
  assert.equal(parsed.tokens.cacheCreate, 39696);
  assert.equal(parsed.tokens.cacheRead, 0);
});

test('reads the exact model identifier and the cli version', () => {
  const parsed = readTranscript(fixture);
  assert.match(parsed.model, /^claude-/);
  assert.ok(parsed.cliVersion.length > 0);
});

test('counts tool calls, which is zero in this fixture', () => {
  assert.equal(readTranscript(fixture).toolCalls, 0);
});

test('counts tool calls when the transcript has them', () => {
  const withTool = [
    JSON.stringify({ type: 'system', subtype: 'init', model: 'claude-sonnet-5', claude_code_version: '2.1.0', session_id: 'x' }),
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'ok' }, { type: 'tool_use', name: 'Bash' }] } }),
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read' }] } }),
    JSON.stringify({ type: 'result', subtype: 'success', num_turns: 2, stop_reason: 'end_turn', is_error: false, total_cost_usd: 1, duration_ms: 10, usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }, modelUsage: { 'claude-sonnet-5': {} } }),
  ].join('\n');
  assert.equal(readTranscript(withTool).toolCalls, 2);
});

test('fails loudly when there is no result event', () => {
  const noResult = JSON.stringify({ type: 'system', subtype: 'init', model: 'm', claude_code_version: 'v', session_id: 's' });
  assert.throws(() => readTranscript(noResult), /result/i);
});

test('survives a malformed line without losing the rest', () => {
  const broken = `not json\n${fixture}`;
  assert.equal(readTranscript(broken).numTurns, 1);
});

test('detects a rate limit event', () => {
  const limited = [
    JSON.stringify({ type: 'rate_limit_event', rate_limit_info: {} }),
    fixture.trim().split('\n').pop(),
  ].join('\n');
  assert.equal(readTranscript(limited).rateLimited, true);
});

test('renders markdown naming the model and the turn count', () => {
  const markdown = toMarkdown(readTranscript(fixture));
  assert.match(markdown, /claude-/);
  assert.match(markdown, /1/);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --test runner/test/transcript.test.mjs`
Expected: FAIL, o módulo não existe.

- [ ] **Step 3: Implementar**

Criar `runner/lib/transcript.mjs`:

```js
const parseLines = (text) => {
  const events = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      // A malformed line must not cost us the rest of the transcript.
    }
  }
  return events;
};

const countToolCalls = (events) =>
  events
    .filter((event) => event.type === 'assistant')
    .reduce((total, event) => {
      const content = event.message?.content;
      if (!Array.isArray(content)) return total;
      return total + content.filter((block) => block.type === 'tool_use').length;
    }, 0);

export function readTranscript(text) {
  const events = parseLines(text);
  const init = events.find((event) => event.type === 'system' && event.subtype === 'init');
  const result = events.find((event) => event.type === 'result');

  if (!result) {
    throw new Error('transcript has no result event: the session did not finish');
  }

  const usage = result.usage ?? {};
  const modelFromUsage = Object.keys(result.modelUsage ?? {})[0];

  return {
    model: modelFromUsage ?? init?.model ?? 'unknown',
    cliVersion: init?.claude_code_version ?? 'unknown',
    sessionId: result.session_id ?? init?.session_id ?? 'unknown',
    numTurns: result.num_turns ?? 0,
    stopReason: result.stop_reason ?? 'unknown',
    isError: Boolean(result.is_error),
    costUsd: result.total_cost_usd ?? 0,
    durationMs: result.duration_ms ?? 0,
    tokens: {
      input: usage.input_tokens ?? 0,
      output: usage.output_tokens ?? 0,
      cacheCreate: usage.cache_creation_input_tokens ?? 0,
      cacheRead: usage.cache_read_input_tokens ?? 0,
    },
    toolCalls: countToolCalls(events),
    rateLimited: events.some((event) => event.type === 'rate_limit_event'),
    events,
  };
}

export function toMarkdown(parsed) {
  const lines = [
    '# Transcrição da sessão',
    '',
    `- Modelo: ${parsed.model}`,
    `- Versão do CLI: ${parsed.cliVersion}`,
    `- Turnos: ${parsed.numTurns}`,
    `- Motivo de parada: ${parsed.stopReason}`,
    `- Chamadas de ferramenta: ${parsed.toolCalls}`,
    `- Custo em dólares: ${parsed.costUsd}`,
    '',
    '---',
    '',
  ];

  for (const event of parsed.events) {
    if (event.type !== 'assistant') continue;
    const content = event.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block.type === 'text' && block.text?.trim()) {
        lines.push('## Resposta', '', block.text.trim(), '');
      }
      if (block.type === 'tool_use') {
        lines.push(`## Ferramenta: ${block.name}`, '', '```json', JSON.stringify(block.input ?? {}, null, 2), '```', '');
      }
    }
  }

  return lines.join('\n');
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `node --test runner/test/transcript.test.mjs`
Expected: PASS, nove testes.

- [ ] **Step 5: Commit**

```bash
git add runner/lib/transcript.mjs runner/test/
git commit -m "feat: read the agent transcript into dataset fields"
```

---

### Task 2: Esquema do dataset

**Files:**
- Create: `runner/lib/dataset.mjs`, `runner/test/dataset.test.mjs`

**Interfaces:**
- Consumes: nada
- Produces: `COLUMNS` como array de strings na ordem do arquivo; `emptyRow()` devolvendo objeto com todas as colunas vazias; `appendRow(csvPath, row)` que cria o arquivo com cabeçalho se não existir e acrescenta uma linha

- [ ] **Step 1: Escrever o teste que falha**

Criar `runner/test/dataset.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { COLUMNS, emptyRow, appendRow } from '../lib/dataset.mjs';

test('the schema carries every group the spec lists', () => {
  for (const column of [
    'session_id', 'task', 'model', 'model_version', 'p_level', 'o_level', 'run_number',
    'started_at', 'ended_at', 'image_digest', 'cli_version', 'status', 'invalid_reason',
    'taxa_aceitacao', 'regressoes', 'violacoes', 'qualidade', 'custo_usd', 'duracao_s',
    'n_tool_calls', 'travou', 'n_turns', 'travou_turnos', 'travou_sem_diff', 'travou_build',
    'tokens_input', 'tokens_output', 'tokens_cache_create', 'tokens_cache_read',
    'diff_path', 'transcript_path',
  ]) {
    assert.ok(COLUMNS.includes(column), `missing column ${column}`);
  }
});

test('the ten decision columns of the ambiguous task exist', () => {
  for (let index = 1; index <= 10; index += 1) {
    assert.ok(COLUMNS.includes(`decisao_${index}`), `missing decisao_${index}`);
  }
});

test('an empty row has one key per column and no extras', () => {
  const row = emptyRow();
  assert.deepEqual(Object.keys(row).sort(), [...COLUMNS].sort());
  assert.equal(Object.values(row).every((value) => value === ''), true);
});

test('writes the header once and appends rows under it', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dataset-'));
  const path = join(directory, 'resultados.csv');

  appendRow(path, { ...emptyRow(), session_id: 'a', task: 'T1' });
  appendRow(path, { ...emptyRow(), session_id: 'b', task: 'T1' });

  const lines = readFileSync(path, 'utf8').trim().split('\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[0], COLUMNS.join(','));
  assert.match(lines[1], /^a,T1,/);
  assert.match(lines[2], /^b,T1,/);
});

test('quotes a value that carries a comma, so the row keeps its shape', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dataset-'));
  const path = join(directory, 'resultados.csv');

  appendRow(path, { ...emptyRow(), session_id: 'a', invalid_reason: 'broke, badly' });

  const row = readFileSync(path, 'utf8').trim().split('\n')[1];
  assert.match(row, /"broke, badly"/);
  assert.equal(row.split(',').length > COLUMNS.length - 1, true);
});

test('refuses a row carrying a column the schema does not know', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dataset-'));
  const path = join(directory, 'resultados.csv');
  assert.throws(() => appendRow(path, { ...emptyRow(), surpresa: 1 }), /surpresa/);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --test runner/test/dataset.test.mjs`
Expected: FAIL, o módulo não existe.

- [ ] **Step 3: Implementar**

Criar `runner/lib/dataset.mjs`:

```js
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';

const DECISION_COLUMNS = Array.from({ length: 10 }, (_, index) => `decisao_${index + 1}`);

export const COLUMNS = [
  'session_id', 'task', 'model', 'model_version', 'p_level', 'o_level', 'run_number',
  'started_at', 'ended_at',
  'image_digest', 'cli_version',
  'status', 'invalid_reason',
  'taxa_aceitacao', 'regressoes', 'violacoes', 'qualidade',
  'custo_usd', 'duracao_s', 'n_tool_calls', 'travou',
  ...DECISION_COLUMNS,
  'n_turns', 'travou_turnos', 'travou_sem_diff', 'travou_build',
  'tokens_input', 'tokens_output', 'tokens_cache_create', 'tokens_cache_read',
  'diff_path', 'transcript_path',
];

export function emptyRow() {
  return Object.fromEntries(COLUMNS.map((column) => [column, '']));
}

const escape = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export function appendRow(csvPath, row) {
  const unknown = Object.keys(row).filter((key) => !COLUMNS.includes(key));
  if (unknown.length > 0) {
    throw new Error(`row carries columns the schema does not know: ${unknown.join(', ')}`);
  }

  if (!existsSync(csvPath)) {
    writeFileSync(csvPath, `${COLUMNS.join(',')}\n`);
  }

  appendFileSync(csvPath, `${COLUMNS.map((column) => escape(row[column])).join(',')}\n`);
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `node --test runner/test/dataset.test.mjs`
Expected: PASS, seis testes.

- [ ] **Step 5: Commit**

```bash
git add runner/lib/dataset.mjs runner/test/dataset.test.mjs
git commit -m "feat: define the dataset schema and row append"
```

---

### Task 3: Imagem de sessão e ciclo de contêiner

**Files:**
- Create: `runner/Dockerfile.session`, `runner/lib/container.mjs`, `runner/test/container.test.mjs`

**Interfaces:**
- Consumes: a imagem `meeting-rooms-api:1.0.0`, produzida por `cd seed && make image`
- Produces: `buildImage()`, `imageId(image)`, `start({ name, outDir, hostPort, env })`, `exec(name, command, options)` devolvendo `{ status, stdout, stderr }`, `execDetached(name, command)`, `copyIn(name, hostPath, containerPath)`, `stop(name)`

- [ ] **Step 1: Criar `runner/Dockerfile.session`**

A versão do CLI é fixada de propósito: ela é constante do protocolo e é gravada em cada linha do dataset.

```dockerfile
FROM meeting-rooms-api:1.0.0

USER root
RUN npm install -g @anthropic-ai/claude-code@2.1.272

ENV CI=1
WORKDIR /app

CMD ["sleep", "infinity"]
```

O comando é uma espera indefinida porque o contêiner não serve a aplicação por padrão: ele é um ambiente onde o runner executa passos por vez.

- [ ] **Step 2: Escrever o teste que falha**

Criar `runner/test/container.test.mjs`. Ele toca Docker de verdade, porque o que precisa ser testado aqui é a integração e não a montagem da linha de comando.

```js
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildImage, imageId, start, exec, stop, copyIn } from '../lib/container.mjs';

const NAME = 'runner-selftest';
const outDir = mkdtempSync(join(tmpdir(), 'runner-out-'));

after(() => stop(NAME));

test('builds the session image and reports an id', () => {
  buildImage();
  assert.match(imageId('meeting-rooms-session:1.0.0'), /^sha256:/);
});

test('the image carries the pinned agent cli', () => {
  start({ name: NAME, outDir, hostPort: 3510, env: {} });
  const result = exec(NAME, ['claude', '--version']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /2\.1\.272/);
});

test('the application is inside the image at the working directory', () => {
  const result = exec(NAME, ['sh', '-c', 'test -f /app/package.json && echo present']);
  assert.match(result.stdout, /present/);
});

test('the output mount reaches the host', () => {
  exec(NAME, ['sh', '-c', 'echo hello > /out/probe.txt']);
  assert.equal(readFileSync(join(outDir, 'probe.txt'), 'utf8').trim(), 'hello');
});

test('copying a file in lands where asked', () => {
  const source = join(outDir, 'probe.txt');
  copyIn(NAME, source, '/app/probe-copied.txt');
  assert.match(exec(NAME, ['cat', '/app/probe-copied.txt']).stdout, /hello/);
});

test('nothing of the artefacts repository is reachable from inside', () => {
  const result = exec(NAME, ['sh', '-c', 'ls /app | tr "\\n" " "']);
  for (const forbidden of ['hidden-tests', 'reference', 'tasks', 'docs', 'tools']) {
    assert.equal(result.stdout.includes(forbidden), false, `found ${forbidden} inside the container`);
  }
});

test('stopping removes the container', () => {
  stop(NAME);
  const result = exec(NAME, ['true']);
  assert.notEqual(result.status, 0);
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `node --test runner/test/container.test.mjs`
Expected: FAIL, o módulo não existe.

- [ ] **Step 4: Implementar**

Criar `runner/lib/container.mjs`:

```js
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');

export const SESSION_IMAGE = 'meeting-rooms-session:1.0.0';

const docker = (args, options = {}) =>
  spawnSync('docker', args, { encoding: 'utf8', ...options });

export function buildImage() {
  const result = docker([
    'build', '-f', resolve(REPO, 'runner', 'Dockerfile.session'),
    '-t', SESSION_IMAGE, resolve(REPO, 'runner'),
  ]);
  if (result.status !== 0) {
    throw new Error(`session image build failed: ${result.stderr}`);
  }
}

export function imageId(image) {
  const result = docker(['inspect', '--format', '{{.Id}}', image]);
  if (result.status !== 0) {
    throw new Error(`image not found: ${image}`);
  }
  return result.stdout.trim();
}

export function start({ name, outDir, hostPort, env }) {
  stop(name);
  const envArgs = Object.entries(env ?? {}).flatMap(([key, value]) => ['-e', `${key}=${value}`]);
  const result = docker([
    'run', '-d', '--name', name,
    '-v', `${outDir}:/out`,
    '-p', `${hostPort}:3000`,
    ...envArgs,
    SESSION_IMAGE,
  ]);
  if (result.status !== 0) {
    throw new Error(`container did not start: ${result.stderr}`);
  }
}

export function exec(name, command, options = {}) {
  return docker(['exec', ...(options.workdir ? ['-w', options.workdir] : []), name, ...command]);
}

export function execDetached(name, command) {
  return docker(['exec', '-d', name, ...command]);
}

export function copyIn(name, hostPath, containerPath) {
  const result = docker(['cp', hostPath, `${name}:${containerPath}`]);
  if (result.status !== 0) {
    throw new Error(`copy into the container failed: ${result.stderr}`);
  }
}

export function stop(name) {
  docker(['rm', '-f', name], { stdio: 'ignore' });
}
```

**A montagem é uma só, e é de saída.** Não acrescente outra por conveniência de depuração: é a única via de vazamento que nasce com o runner.

- [ ] **Step 5: Construir a imagem da semente e rodar o teste**

```bash
cd seed && make image && cd ..
node --test runner/test/container.test.mjs
```

Expected: PASS, sete testes. O sexto é o que importa: nada do repositório de artefatos aparece dentro do contêiner.

- [ ] **Step 6: Confirmar que não sobrou contêiner**

Run: `docker ps -a --filter name=runner-selftest --format '{{.Names}}'`
Expected: saída vazia.

- [ ] **Step 7: Commit**

```bash
git add runner/Dockerfile.session runner/lib/container.mjs runner/test/container.test.mjs
git commit -m "feat: add the session image and container lifecycle"
```

---

### Task 4: Fase de preparar, com as duas verificações

**Files:**
- Create: `runner/lib/prepare.mjs`, `runner/test/prepare.test.mjs`

**Interfaces:**
- Consumes: `start`, `exec`, `execDetached`, `stop`, `copyIn` de `lib/container.mjs`
- Produces: `prepare({ name, outDir, hostPort, env })` devolvendo `{ imageId, cliVersion }` ou lançando `InfrastructureError`; e a classe `InfrastructureError`

**Por que esta tarefa existe.** Os dois passos de verificação parecem redundantes com a auditoria da semente e não são. O primeiro fecha a única via de vazamento que nasce com o runner, que é montar o diretório errado. O segundo é o que torna implementável a regra de invalidação: sabendo que a aplicação respondia no instante da entrega, qualquer falha posterior do servidor é atribuível ao agente.

- [ ] **Step 1: Escrever o teste que falha**

Criar `runner/test/prepare.test.mjs`:

```js
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exec, stop } from '../lib/container.mjs';
import { prepare, InfrastructureError } from '../lib/prepare.mjs';

const NAME = 'runner-prepare-test';
const outDir = mkdtempSync(join(tmpdir(), 'runner-prep-'));

after(() => stop(NAME));

test('prepares a working copy and reports the reproducibility anchors', () => {
  const info = prepare({ name: NAME, outDir, hostPort: 3520, env: {} });
  assert.match(info.imageId, /^sha256:/);
  assert.match(info.cliVersion, /^\d+\./);
});

test('the working copy history holds exactly one neutral commit', () => {
  const log = exec(NAME, ['sh', '-c', 'cd /app && git log --oneline'], { workdir: '/app' });
  assert.equal(log.stdout.trim().split('\n').length, 1);
  assert.match(log.stdout, /Initial commit/);
  assert.equal(/claude|harness|TCC|INATEL|semente/i.test(log.stdout), false);
});

test('the working copy is clean, so any later diff belongs to the agent', () => {
  const status = exec(NAME, ['sh', '-c', 'cd /app && git status --short']);
  assert.equal(status.stdout.trim(), '');
});

test('aborts as infrastructure failure when an artefact is reachable', () => {
  exec(NAME, ['sh', '-c', 'mkdir -p /app/hidden-tests && touch /app/hidden-tests/run.mjs']);
  assert.throws(
    () => prepare({ name: NAME, outDir, hostPort: 3521, env: {}, skipStart: true }),
    InfrastructureError,
  );
});
```

Note que o último teste planta o artefato e espera aborto. **Um roteiro de verificação que não pode ser feito falhar não vale nada**, e isto vale em dobro para o que protege a integridade do experimento.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --test runner/test/prepare.test.mjs`
Expected: FAIL, o módulo não existe.

- [ ] **Step 3: Implementar**

Criar `runner/lib/prepare.mjs`:

```js
import { SESSION_IMAGE, buildImage, exec, execDetached, imageId, start } from './container.mjs';

export class InfrastructureError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InfrastructureError';
  }
}

const FORBIDDEN_PATHS = ['hidden-tests', 'reference', 'tasks', 'docs', 'tools'];
const FORBIDDEN_TERMS = 'TCC|INATEL|harness|semente|experimento|Claude|Anthropic';

function assertNoArtefacts(name) {
  const listing = exec(name, ['sh', '-c', 'ls -A /app']);
  for (const forbidden of FORBIDDEN_PATHS) {
    if (listing.stdout.split('\n').map((line) => line.trim()).includes(forbidden)) {
      throw new InfrastructureError(`artefact reachable inside the working copy: ${forbidden}`);
    }
  }

  const grep = exec(name, ['sh', '-c',
    `grep -rIlE '${FORBIDDEN_TERMS}' /app --exclude-dir=node_modules --exclude-dir=.git --exclude=package-lock.json || true`]);
  if (grep.stdout.trim()) {
    throw new InfrastructureError(`study terms reachable inside the working copy: ${grep.stdout.trim()}`);
  }
}

function initHistory(name) {
  const script = [
    'cd /app',
    'rm -rf .git',
    'git init -q .',
    'git config user.email dev@example.com',
    'git config user.name Developer',
    'git add -A',
    'git commit -q -m "Initial commit"',
  ].join(' && ');
  const result = exec(name, ['sh', '-c', script]);
  if (result.status !== 0) {
    throw new InfrastructureError(`could not initialise the working copy history: ${result.stderr}`);
  }
}

async function assertServesBeforeHandover(name, hostPort) {
  const reset = exec(name, ['sh', '-c', 'cd /app && make db-reset && make build']);
  if (reset.status !== 0) {
    throw new InfrastructureError(`the application does not build before handover: ${reset.stderr}`);
  }

  execDetached(name, ['sh', '-c', 'cd /app && PORT=3000 make start > /out/preflight.log 2>&1']);

  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://localhost:${hostPort}/health`);
      if (response.ok) {
        exec(name, ['sh', '-c', 'pkill -f "node dist/server.js" || true']);
        return;
      }
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new InfrastructureError('the application did not answer health before handover');
}

export async function prepare({ name, outDir, hostPort, env, skipStart = false }) {
  if (!skipStart) {
    buildImage();
    start({ name, outDir, hostPort, env });
  }

  assertNoArtefacts(name);
  initHistory(name);
  await assertServesBeforeHandover(name, hostPort);

  const version = exec(name, ['claude', '--version']);
  return {
    imageId: imageId(SESSION_IMAGE),
    cliVersion: version.stdout.trim().split(' ')[0],
  };
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `node --test runner/test/prepare.test.mjs`
Expected: PASS, quatro testes.

- [ ] **Step 5: Commit**

```bash
git add runner/lib/prepare.mjs runner/test/prepare.test.mjs
git commit -m "feat: prepare a session and prove the application served before handover"
```

---

### Task 5: Fase de medir

**Files:**
- Create: `runner/lib/measure.mjs`, `runner/test/measure.test.mjs`

**Interfaces:**
- Consumes: `exec`, `execDetached`, `copyIn` de `lib/container.mjs`; `prepare` e `InfrastructureError` de `lib/prepare.mjs`
- Produces: `measure({ name, outDir, hostPort, repoRoot })` devolvendo `{ hasDiff, regressoes, buildOk, serverUp, hidden }`, onde `hidden` é o objeto JSON da suíte oculta ou `null` quando o servidor não subiu

**A ordem dos passos é carregada.** O diff é capturado **antes** de restaurar os testes congelados, porque é dele que sai a informação de se o agente escreveu teste. Restaurar antes destruiria essa informação para sempre.

- [ ] **Step 1: Escrever o teste que falha**

Criar `runner/test/measure.test.mjs`. Ele exercita os três desfechos que o runner precisa distinguir.

```js
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { exec, stop } from '../lib/container.mjs';
import { prepare } from '../lib/prepare.mjs';
import { measure } from '../lib/measure.mjs';

const REPO = resolve(import.meta.dirname, '..', '..');
const NAME = 'runner-measure-test';
const outDir = mkdtempSync(join(tmpdir(), 'runner-meas-'));

after(() => stop(NAME));

test('an untouched working copy scores the documented baseline', async () => {
  await prepare({ name: NAME, outDir, hostPort: 3530, env: {} });
  const result = await measure({ name: NAME, outDir, hostPort: 3530, repoRoot: REPO });

  assert.equal(result.hasDiff, false);
  assert.equal(result.regressoes, 0);
  assert.equal(result.buildOk, true);
  assert.equal(result.serverUp, true);
  assert.equal(result.hidden.passed, 13);
  assert.equal(result.hidden.total, 26);
});

test('a broken application reports the server down and no measurement', async () => {
  exec(NAME, ['sh', '-c', 'rm -f /app/src/modules/bookings/service.ts']);
  const result = await measure({ name: NAME, outDir, hostPort: 3530, repoRoot: REPO });

  assert.equal(result.hasDiff, true);
  assert.equal(result.buildOk, false);
  assert.equal(result.serverUp, false);
  assert.equal(result.hidden, null);
});
```

O segundo teste é o que mais importa: **ele prova que quebrar a aplicação produz uma medição ausente e não uma exceção**, que é o que permite ao runner registrar a sessão como dado em vez de descartá-la.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --test runner/test/measure.test.mjs`
Expected: FAIL, o módulo não existe.

- [ ] **Step 3: Implementar**

Criar `runner/lib/measure.mjs`:

```js
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { copyIn, exec, execDetached } from './container.mjs';

const SEED_TEST_FILES = [
  'tests/health.test.ts',
  'tests/database.test.ts',
  'tests/shared.test.ts',
  'tests/rooms.test.ts',
  'tests/users.test.ts',
  'tests/bookings.test.ts',
  'tests/amenities.test.ts',
];

function captureDiff(name, outDir) {
  exec(name, ['sh', '-c', 'cd /app && git add -A && git diff --cached > /out/session.diff']);
  const path = join(outDir, 'session.diff');
  return existsSync(path) && statSync(path).size > 0;
}

function restoreFrozenTests(name, repoRoot) {
  const staging = mkdtempSync(join(tmpdir(), 'frozen-tests-'));
  execFileSync('sh', ['-c',
    `git -C ${repoRoot} archive HEAD seed/tests | tar -x -C ${staging}`]);
  for (const file of SEED_TEST_FILES) {
    copyIn(name, join(staging, 'seed', file), `/app/${file}`);
  }
}

function countRegressions(name) {
  const result = exec(name, ['sh', '-c',
    `cd /app && npx vitest run ${SEED_TEST_FILES.join(' ')} --reporter=json --outputFile=/out/regressions.json`]);
  return result;
}

function readRegressions(outDir) {
  const path = join(outDir, 'regressions.json');
  if (!existsSync(path)) return null;
  try {
    const report = JSON.parse(readFileSync(path, 'utf8'));
    return report.numFailedTests ?? null;
  } catch {
    return null;
  }
}

async function serverAnswers(hostPort, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(`http://localhost:${hostPort}/health`);
      if (response.ok) return true;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function runHiddenSuite(repoRoot, hostPort) {
  const result = spawnSync('node', [resolve(repoRoot, 'hidden-tests', 'T1', 'run.mjs')], {
    encoding: 'utf8',
    env: { ...process.env, BASE_URL: `http://localhost:${hostPort}` },
  });
  if (result.status !== 0) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

export async function measure({ name, outDir, hostPort, repoRoot }) {
  const hasDiff = captureDiff(name, outDir);

  restoreFrozenTests(name, repoRoot);
  countRegressions(name);
  const failed = readRegressions(outDir);

  const build = exec(name, ['sh', '-c', 'cd /app && npm run typecheck && npm run build']);
  const buildOk = build.status === 0;

  exec(name, ['sh', '-c', 'cd /app && make db-reset']);
  execDetached(name, ['sh', '-c', 'cd /app && PORT=3000 make start > /out/server.log 2>&1']);
  const serverUp = await serverAnswers(hostPort);

  const hidden = serverUp ? runHiddenSuite(repoRoot, hostPort) : null;
  exec(name, ['sh', '-c', 'pkill -f "node dist/server.js" || true']);

  return {
    hasDiff,
    regressoes: failed ?? (buildOk ? 0 : SEED_TEST_FILES.length),
    buildOk,
    serverUp,
    hidden,
  };
}
```

**Sobre o valor de regressões quando a suíte nem roda.** Se o build quebrou, nenhum teste executa e o relatório não existe. Nesse caso o runner registra o número de arquivos de teste da semente, não zero. Zero significaria "nada quebrou", que é o oposto da verdade.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `node --test runner/test/measure.test.mjs`
Expected: PASS, dois testes. Este é o teste mais lento do conjunto, porque sobe o servidor duas vezes.

- [ ] **Step 5: Commit**

```bash
git add runner/lib/measure.mjs runner/test/measure.test.mjs
git commit -m "feat: measure a finished session from outside the container"
```

---

### Task 6: Orquestração e os três substitutos

**Files:**
- Create: `runner/lib/fakes.mjs`, `runner/run-session.mjs`, `runner/README.md`, `runner/test/end-to-end.test.mjs`

**Interfaces:**
- Consumes: tudo das tarefas 1 a 5
- Produces: o executável `runner/run-session.mjs`, aceitando `--task`, `--p`, `--o`, `--model`, `--run` e `--fake`

**Esta tarefa é o coração do plano.** Os três substitutos são o que permite provar o pipeline inteiro sem gastar orçamento de API, e o terceiro é o único jeito de provar a regra de invalidação antes de ela custar dinheiro.

- [ ] **Step 1: Escrever os substitutos**

Criar `runner/lib/fakes.mjs`:

```js
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { copyIn, exec } from './container.mjs';

const cannedTranscript = (turns, toolCalls) => {
  const lines = [
    JSON.stringify({
      type: 'system', subtype: 'init', model: 'fake-model',
      claude_code_version: '0.0.0-fake', session_id: 'fake-session', cwd: '/app',
    }),
  ];
  for (let index = 0; index < toolCalls; index += 1) {
    lines.push(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: {} }] } }));
  }
  lines.push(JSON.stringify({
    type: 'result', subtype: 'success', num_turns: turns, stop_reason: 'end_turn',
    is_error: false, total_cost_usd: 0, duration_ms: 0,
    usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    modelUsage: { 'fake-model': {} },
  }));
  return `${lines.join('\n')}\n`;
};

export const FAKES = {
  noop: {
    describe: 'does nothing, so the session has no diff',
    run: () => cannedTranscript(1, 0),
  },

  reference: {
    describe: 'applies the reference implementation patch',
    run: (name, repoRoot) => {
      const staging = mkdtempSync(join(tmpdir(), 'ref-'));
      const patch = resolve(repoRoot, 'reference', 'T1', 'reference.patch');
      execFileSync('cp', [patch, join(staging, 'reference.patch')]);
      copyIn(name, join(staging, 'reference.patch'), '/tmp/reference.patch');
      const applied = exec(name, ['sh', '-c',
        'mkdir -p /tmp/apply/seed && cp -a /app/. /tmp/apply/seed/ && cd /tmp/apply && patch -p2 -d seed < /tmp/reference.patch && cp -a /tmp/apply/seed/. /app/']);
      if (applied.status !== 0) {
        throw new Error(`the reference patch did not apply: ${applied.stderr}`);
      }
      return cannedTranscript(12, 20);
    },
  },

  break: {
    describe: 'deletes a source file, so the application stops building',
    run: (name) => {
      exec(name, ['sh', '-c', 'rm -f /app/src/modules/bookings/service.ts']);
      return cannedTranscript(3, 4);
    },
  },
};
```

**Sobre o nível de tira-caminho do patch.** O patch foi gerado com caminhos começando em `a/seed/` e `b/seed/`. Dentro do contêiner a aplicação está em `/app`, sem o segmento `seed`, por isso a aplicação usa dois níveis de tira-caminho a partir de um diretório onde a árvore foi recriada sob o nome `seed`. Se o comando falhar, verifique os caminhos do patch com `grep '^+++' reference/T1/reference.patch` antes de mexer em qualquer outra coisa.

- [ ] **Step 2: Escrever a orquestração**

Criar `runner/run-session.mjs`:

```js
#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { exec, stop } from './lib/container.mjs';
import { InfrastructureError, prepare } from './lib/prepare.mjs';
import { measure } from './lib/measure.mjs';
import { readTranscript, toMarkdown } from './lib/transcript.mjs';
import { appendRow, emptyRow } from './lib/dataset.mjs';
import { FAKES } from './lib/fakes.mjs';

const REPO = resolve(import.meta.dirname, '..');
const TIMEOUT_MS = 30 * 60 * 1000;

const argument = (flag, fallback) => {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
};

function runAgent({ name, outDir, model, statement }) {
  const script = [
    'cd /app',
    `claude -p "$(cat /tmp/statement.txt)" --output-format stream-json --verbose`,
    `--max-turns 40 --model ${model} --dangerously-skip-permissions > /out/transcript.jsonl 2>/out/agent.log`,
  ].join(' ');
  return exec(name, ['sh', '-c', script]);
}

async function main() {
  const task = argument('--task', 'T1');
  const pLevel = argument('--p', 'P0');
  const oLevel = argument('--o', 'O1');
  const model = argument('--model', 'claude-sonnet-5');
  const runNumber = argument('--run', '1');
  const fake = argument('--fake', null);

  const sessionId = `${task}-${pLevel}-${oLevel}-${Date.now().toString(36)}`;
  const outDir = join(REPO, 'sessions', sessionId);
  mkdirSync(outDir, { recursive: true });

  const name = `session-${sessionId}`;
  const hostPort = 3600 + Math.floor(Math.random() * 300);
  const row = { ...emptyRow(), session_id: sessionId, task, p_level: pLevel, o_level: oLevel, run_number: runNumber, model };
  row.started_at = new Date().toISOString();

  try {
    const anchors = await prepare({
      name, outDir, hostPort,
      env: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '' },
    });
    row.image_digest = anchors.imageId;
    row.cli_version = anchors.cliVersion;

    const statement = resolve(REPO, 'tasks', 'T1-validacao-de-reservas.md');
    exec(name, ['sh', '-c', `cat > /tmp/statement.txt << 'STATEMENT_EOF'\n${await import('node:fs/promises').then((fs) => fs.readFile(statement, 'utf8'))}\nSTATEMENT_EOF`]);

    const startedAt = Date.now();
    let transcriptText;
    if (fake) {
      if (!FAKES[fake]) throw new Error(`unknown fake: ${fake}`);
      transcriptText = FAKES[fake].run(name, REPO);
      writeFileSync(join(outDir, 'transcript.jsonl'), transcriptText);
    } else {
      const agent = runAgent({ name, outDir, model, statement });
      if (agent.status !== 0 && !agent.stdout) {
        throw new InfrastructureError(`the agent cli did not run: ${agent.stderr}`);
      }
      transcriptText = await import('node:fs/promises').then((fs) =>
        fs.readFile(join(outDir, 'transcript.jsonl'), 'utf8'));
    }
    const durationS = Math.round((Date.now() - startedAt) / 1000);

    const parsed = readTranscript(transcriptText);
    if (parsed.rateLimited) {
      throw new InfrastructureError('the api reported a rate limit during the session');
    }
    writeFileSync(join(outDir, 'transcript.md'), toMarkdown(parsed));

    const measured = await measure({ name, outDir, hostPort, repoRoot: REPO });

    const hitTurnLimit = parsed.stopReason !== 'end_turn' && parsed.numTurns >= 40;
    row.ended_at = new Date().toISOString();
    row.status = 'valid';
    row.model_version = parsed.model;
    row.duracao_s = durationS;
    row.custo_usd = parsed.costUsd;
    row.n_tool_calls = parsed.toolCalls;
    row.n_turns = parsed.numTurns;
    row.tokens_input = parsed.tokens.input;
    row.tokens_output = parsed.tokens.output;
    row.tokens_cache_create = parsed.tokens.cacheCreate;
    row.tokens_cache_read = parsed.tokens.cacheRead;
    row.regressoes = measured.regressoes;
    row.taxa_aceitacao = measured.hidden ? measured.hidden.rate : 0;
    row.travou_turnos = hitTurnLimit;
    row.travou_sem_diff = !measured.hasDiff;
    row.travou_build = !measured.buildOk || !measured.serverUp;
    row.travou = hitTurnLimit || !measured.hasDiff || !measured.buildOk || !measured.serverUp;
    row.diff_path = join('sessions', sessionId, 'session.diff');
    row.transcript_path = join('sessions', sessionId, 'transcript.jsonl');

    writeFileSync(join(outDir, 'result.json'), JSON.stringify({ row, hidden: measured.hidden }, null, 2));
  } catch (error) {
    row.ended_at = new Date().toISOString();
    row.status = 'invalid';
    row.invalid_reason = error instanceof InfrastructureError ? error.message : `runner error: ${error.message}`;
  } finally {
    stop(name);
  }

  appendRow(join(REPO, 'resultados.csv'), row);
  process.stdout.write(`${JSON.stringify(row, null, 2)}\n`);
}

const timer = setTimeout(() => {
  process.stderr.write('session exceeded the wall clock ceiling\n');
  process.exit(3);
}, TIMEOUT_MS);
timer.unref();

await main();
```

- [ ] **Step 3: Escrever o teste de ponta a ponta dos três substitutos**

Criar `runner/test/end-to-end.test.mjs`:

```js
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
```

**O terceiro teste é o mais importante de todo o plano.** Ele prova que a regra de invalidação funciona antes de ela ser exercitada com dinheiro real. Se ele falhar afirmando que a sessão ficou inválida, o runner está removendo silenciosamente as piores sessões do dataset, que é o viés mais caro de descobrir depois.

- [ ] **Step 4: Rodar os três**

Run: `node --test runner/test/end-to-end.test.mjs`
Expected: PASS, três testes. Nenhuma chamada de API foi feita.

- [ ] **Step 5: Confirmar que o dataset ficou coerente**

```bash
head -1 resultados.csv | tr ',' '\n' | wc -l
wc -l resultados.csv
```

Expected: o número de colunas do esquema, e quatro linhas, sendo o cabeçalho mais as três sessões falsas.

- [ ] **Step 6: Escrever `runner/README.md`**

Em português, contendo: como construir a imagem de sessão; como rodar uma sessão real e o que ela exige de ambiente; os três substitutos e o resultado esperado de cada um; a regra de invalidação em uma tabela; e o aviso de que a chave de API entra por variável de ambiente e nunca por arquivo.

- [ ] **Step 7: Commit**

```bash
git add runner/ resultados.csv
git commit -m "feat: orchestrate a full session and prove the pipeline with three fakes"
```

---

### Task 7: A primeira sessão real

**Files:**
- Modify: `docs/05-log-de-implementacao.md`
- Create: `docs/superpowers/2026-09-16-primeira-sessao.md`

**Esta tarefa gasta orçamento de API e exige a chave do usuário.** Não a execute sem confirmação explícita. Ela é o objetivo de toda esta fase do projeto.

- [ ] **Step 1: Confirmar que tudo está verde antes de gastar**

```bash
node --test runner/test/
cd seed && make verify && cd ..
./reference/T1/verify.sh
```

Expected: tudo passa. Gastar dinheiro com o pipeline vermelho é desperdício garantido.

- [ ] **Step 2: Rodar a sessão**

```bash
ANTHROPIC_API_KEY=... node runner/run-session.mjs --task T1 --p P0 --o O1 --model claude-sonnet-5 --run 1
```

- [ ] **Step 3: Registrar os cinco números que só esta sessão fornece**

Ler a linha do CSV e anotar: taxa de aceitação, turnos consumidos contra o limite de quarenta, custo em dólares, duração, e chamadas de ferramenta.

- [ ] **Step 4: Ler a transcrição legível e anotar o comportamento**

Abrir `sessions/<id>/transcript.md` e responder por escrito: o agente explorou antes de escrever? Rodou os testes? Em que ordem atacou as regras? Alguma regra do enunciado passou despercebida?

- [ ] **Step 5: Escrever o relatório da primeira sessão**

Criar `docs/superpowers/2026-09-16-primeira-sessao.md`, respondendo as três perguntas que só esta sessão responde:

1. **O enunciado sozinho basta?** Compare a taxa obtida com a linha de base de treze sobre vinte e seis. Se a sessão ficou perto da linha de base, o enunciado ou o instrumento têm problema. Se chegou perto de vinte e seis, há sinal de efeito teto e T1 precisa endurecer antes do congelamento.
2. **As métricas fazem sentido?** Cada uma das seis preenchidas tem valor plausível? Alguma ficou vazia que não deveria?
3. **Qual o custo por sessão?** Multiplique por cinquenta e cinco e compare com o orçamento. Este número é a verificação de viabilidade do portão do piloto, e até agora o projeto nunca o teve.

- [ ] **Step 6: Atualizar o log de implementação**

Estado dos componentes, marco pequeno com a data, e os números da primeira sessão.

- [ ] **Step 7: Commit**

```bash
git add docs/ sessions/ resultados.csv
git commit -m "docs: record the first end-to-end session"
```

---

## Auto-revisão do plano

**Cobertura da spec.** Seção 3, fronteira do contêiner: Task 3, com o teste que confirma que nada do repositório de artefatos aparece dentro. Seção 4.1, preparar: Task 4, com as duas verificações e o teste que planta um artefato e espera aborto. Seção 4.2, executar: Task 6. Seção 4.3, medir: Task 5, com a ordem diff-antes-de-restaurar. Seção 4.4, registrar: Tasks 2 e 6. Seção 4.5, limpar: Task 6, no bloco final da orquestração. Seção 5, invalidação: Task 6, provada pelo terceiro substituto. Seção 6, métricas e esquema: Tasks 1 e 2. Seção 6.3, diagnóstico: Task 2, colunas de causa, e Task 6, preenchimento. Seção 7, substitutos: Task 6. Seção 9, riscos: o de regra de invalidação errada é coberto pelo terceiro substituto; o de vazamento por montagem, pela Task 4; o de formato do transcript mudar, pelo teste da Task 1 que exige falha ruidosa sem evento final.

**Consistência de nomes.** `readTranscript` e `toMarkdown` da Task 1; `COLUMNS`, `emptyRow` e `appendRow` da Task 2; `buildImage`, `imageId`, `start`, `exec`, `execDetached`, `copyIn` e `stop` da Task 3; `prepare` e `InfrastructureError` da Task 4; `measure` da Task 5; `FAKES` da Task 6. Todos usados com essas assinaturas nas tarefas seguintes.

**Ponto de atenção para quem executa.** A tabela de preços foi deliberadamente **não** implementada, porque o CLI já devolve o custo calculado no evento final e os tokens brutos vêm junto. Uma tabela nossa seria uma segunda fonte de verdade capaz de divergir da primeira. Se sentir falta dela, releia esta linha antes de acrescentá-la.
