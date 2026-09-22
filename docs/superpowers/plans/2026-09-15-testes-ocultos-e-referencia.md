# Testes ocultos de T1 e implementação de referência — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a suíte que produz `taxa_aceitacao`, a variável-resposta principal de T1, e a implementação de referência que prova que cem por cento dela é alcançável.

**Architecture:** A suíte é um script Node sem dependências que exercita a aplicação por HTTP contra um servidor em execução e imprime um resumo em JSON. A referência é um patch aplicável a uma cópia limpa da semente, com roteiro próprio de verificação. Nenhum dos dois entra na árvore da semente.

**Tech Stack:** Node 22, biblioteca padrão apenas. `node:assert/strict` e `fetch` global. Nenhuma dependência nova em lugar nenhum.

**Spec:** `docs/superpowers/specs/2026-09-15-testes-ocultos-e-referencia-design.md`

## Global Constraints

- **Nada do que este plano cria pode ficar dentro de `seed/`.** A suíte vai em `hidden-tests/`, a referência em `reference/`, ambas na raiz do repositório.
- **Zero dependências.** Só biblioteca padrão do Node. Não crie `package.json` em `hidden-tests/` nem em `reference/`.
- **Todo instante vem do relógio**, derivado de `Date.now()`. Nenhuma data de calendário em lugar nenhum.
- **A suíte nunca importa módulo do projeto.** Só HTTP.
- **A suíte afirma código de status e forma do envelope.** A única string de código de erro que ela pode afirmar é `BOOKING_CONFLICT`, no 409 da regra 1, porque a semente já produz exatamente esse código nessa situação. Para todo o resto, inclusive o 404 da regra 6, afirma-se o status e nunca a string.
- **O código de saída não reflete o resultado da medição.** Zero sempre que a suíte rodou, inclusive com zero acertos. Diferente de zero apenas quando não conseguiu falar com o servidor.
- **A regra 8 do enunciado não entra na suíte.** Ela é medida por `regressoes`.
- Código, identificadores e mensagens de commit em **inglês**. Os documentos em português.
- O enunciado que define o contrato é `tasks/T1-validacao-de-reservas.md`. **Leia-o antes de escrever qualquer asserção.**

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `hidden-tests/T1/run.mjs` | A suíte inteira: apoio de HTTP, fixtures, registro de checagens, as 26 asserções e a emissão do JSON |
| `hidden-tests/README.md` | Regras de construção, estado de congelamento, como executar |
| `reference/T1/reference.patch` | A implementação mínima aceitável, como diff aplicável |
| `reference/T1/verify.sh` | Aplica o patch numa cópia limpa e confere os três números |
| `tools/seed-audit/check-no-leak.sh` | Ganha uma verificação: nada destes diretórios dentro da semente |
| `docs/05-log-de-implementacao.md` | Recebe o número da linha de base |

A suíte cabe num arquivo só porque é uma lista de checagens sobre um apoio pequeno. Dividi-la por regra criaria seis arquivos de vinte linhas e um índice, sem ganho.

---

## Como subir o servidor, que toda tarefa precisa

Sempre desta forma. **Nunca use `sleep` fixo**, e nunca use a porta 3000, que pode estar ocupada.

```bash
cd seed && make db-reset && make build
PORT=3310 make start &
for i in $(seq 1 40); do curl -fsS http://localhost:3310/health >/dev/null 2>&1 && break; sleep 0.25; done
curl -fsS http://localhost:3310/health   # deve devolver {"status":"ok"}
```

Ao terminar, derrube o servidor e confirme que a porta ficou livre.

---

### Task 1: Apoio da suíte, contrato de saída e a regra 1

**Files:**
- Create: `hidden-tests/T1/run.mjs`

**Interfaces:**
- Consumes: a API da semente em execução, nada mais
- Produces: `check(id, rule, name, fn)` onde `fn` devolve `{ expected, actual }`; `call(method, path, body)` devolvendo `{ status, body }`; `fixture()` devolvendo `{ roomId, userId }`; `hours(n)` devolvendo instante ISO deslocado de `n` horas a partir de agora; o objeto JSON da seção 5 da spec

**A disciplina de teste desta tarefa, e ela vale para as três primeiras.** Não há suíte que teste a suíte. O que faz as vezes de teste é o comportamento **conhecido da semente intocada**: para cada asserção sabemos, pela seção 5 da spec da semente, se a semente cumpre ou não aquela regra. Cada passo declara o resultado esperado contra a semente, e rodar a suíte confirma. **Uma asserção que caia no balde errado significa que a asserção está errada ou que nosso entendimento da semente está errado, e as duas coisas precisam ser descobertas agora.**

- [ ] **Step 1: Criar o apoio e a emissão do JSON**

Criar `hidden-tests/T1/run.mjs`:

```js
#!/usr/bin/env node
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

const HOUR = 3_600_000;
const MINUTE = 60_000;

const at = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();
const hours = (h) => at(h * HOUR);
const minutes = (m) => at(m * MINUTE);

let sequence = 0;
const unique = () =>
  `${Date.now().toString(36)}-${(sequence++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

async function call(method, path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }
  return { status: response.status, body: parsed };
}

async function fixture() {
  const room = await call('POST', '/rooms', { name: `room-${unique()}`, capacity: 6 });
  const user = await call('POST', '/users', {
    name: 'Audit',
    email: `audit-${unique()}@example.com`,
  });
  return { roomId: room.body?.id, userId: user.body?.id };
}

async function book(ids, fromHours, toHours, title = 'Audit') {
  return call('POST', '/bookings', {
    roomId: ids.roomId,
    userId: ids.userId,
    title,
    startsAt: hours(fromHours),
    endsAt: hours(toHours),
  });
}

const checks = [];
const check = (id, rule, name, fn) => checks.push({ id, rule, name, fn });

const hasErrorEnvelope = (body) =>
  Boolean(
    body &&
      typeof body === 'object' &&
      body.error &&
      typeof body.error.code === 'string' &&
      typeof body.error.message === 'string' &&
      body.error.details !== undefined,
  );

async function main() {
  try {
    await fetch(`${BASE}/health`);
  } catch (error) {
    process.stderr.write(`cannot reach ${BASE}: ${error.message}\n`);
    process.exit(2);
  }

  const results = [];
  for (const { id, rule, name, fn } of checks) {
    let expected = null;
    let actual = null;
    try {
      ({ expected, actual } = await fn());
    } catch (error) {
      actual = `threw: ${error.message}`;
    }
    const passed = JSON.stringify(expected) === JSON.stringify(actual);
    results.push({ id, rule, name, expected, actual, passed });
  }

  const byRule = {};
  for (const result of results) {
    byRule[result.rule] ??= { passed: 0, total: 0 };
    byRule[result.rule].total += 1;
    if (result.passed) byRule[result.rule].passed += 1;
  }

  const passed = results.filter((result) => result.passed).length;
  const summary = {
    task: 'T1',
    total: results.length,
    passed,
    rate: results.length === 0 ? 0 : Number((passed / results.length).toFixed(4)),
    byRule,
    failures: results
      .filter((result) => !result.passed)
      .map(({ id, rule, name, expected, actual }) => ({ id, rule, name, expected, actual })),
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  process.exit(0);
}

await main();
```

Note que `fixture` **não** lança quando a criação falha. Se o agente tiver quebrado a criação de salas, as asserções falham e a sessão tira nota baixa, o que é dado. Só a impossibilidade de falar com o servidor é falha de infraestrutura.

- [ ] **Step 2: Rodar e confirmar o contrato de saída com zero checagens**

Suba o servidor conforme a seção acima e rode:

```bash
BASE_URL=http://localhost:3310 node hidden-tests/T1/run.mjs
```

Expected: JSON com `"total": 0`, `"passed": 0`, `"rate": 0`, `byRule` vazio, `failures` vazio, e código de saída 0.

Depois, com o servidor derrubado:

```bash
BASE_URL=http://localhost:9999 node hidden-tests/T1/run.mjs; echo "exit=$?"
```

Expected: mensagem em stderr e `exit=2`. **Esta é a distinção mais importante do arquivo.**

- [ ] **Step 3: Acrescentar as dez asserções da regra 1**

Inserir antes de `async function main()`:

```js
check('1.1', 1, 'new start falls inside an existing booking', async () => {
  const ids = await fixture();
  await book(ids, 24, 25);
  const response = await book(ids, 24.5, 25.5);
  return { expected: 409, actual: response.status };
});

check('1.2', 1, 'new end falls inside an existing booking', async () => {
  const ids = await fixture();
  await book(ids, 24, 25);
  const response = await book(ids, 23.5, 24.5);
  return { expected: 409, actual: response.status };
});

check('1.3', 1, 'new booking engulfs an existing one', async () => {
  const ids = await fixture();
  await book(ids, 24, 25);
  const response = await book(ids, 23, 26);
  return { expected: 409, actual: response.status };
});

check('1.4', 1, 'new booking contained in an existing one', async () => {
  const ids = await fixture();
  await book(ids, 24, 25);
  const response = await book(ids, 24.1, 24.85);
  return { expected: 409, actual: response.status };
});

check('1.5', 1, 'new booking starts exactly when another ends', async () => {
  const ids = await fixture();
  await book(ids, 24, 25);
  const response = await book(ids, 25, 26);
  return { expected: 201, actual: response.status };
});

check('1.6', 1, 'new booking ends exactly when another starts', async () => {
  const ids = await fixture();
  await book(ids, 24, 25);
  const response = await book(ids, 23, 24);
  return { expected: 201, actual: response.status };
});

check('1.7', 1, 'same period in a different room', async () => {
  const ids = await fixture();
  await book(ids, 24, 25);
  const other = await call('POST', '/rooms', { name: `room-${unique()}`, capacity: 4 });
  const response = await call('POST', '/bookings', {
    roomId: other.body?.id,
    userId: ids.userId,
    title: 'Audit',
    startsAt: hours(24),
    endsAt: hours(25),
  });
  return { expected: 201, actual: response.status };
});

check('1.8', 1, 'update moves a booking on top of another', async () => {
  const ids = await fixture();
  await book(ids, 24, 25);
  const moved = await book(ids, 30, 31);
  const response = await call('PATCH', `/bookings/${moved.body?.id}`, {
    startsAt: hours(24.1),
    endsAt: hours(24.85),
  });
  return { expected: 409, actual: response.status };
});

check('1.9', 1, 'update that does not move the times', async () => {
  const ids = await fixture();
  const created = await book(ids, 24, 25);
  const response = await call('PATCH', `/bookings/${created.body?.id}`, { title: 'Renamed' });
  return { expected: 200, actual: response.status };
});

check('1.10', 1, 'update moves a booking to a free slot', async () => {
  const ids = await fixture();
  const created = await book(ids, 24, 25);
  const response = await call('PATCH', `/bookings/${created.body?.id}`, {
    startsAt: hours(40),
    endsAt: hours(41),
  });
  return { expected: 200, actual: response.status };
});
```

- [ ] **Step 4: Rodar contra a semente intocada e conferir contra a previsão**

Suba o servidor e rode a suíte. O resultado esperado é **7 aprovadas de 10**, com estas três falhando:

| Asserção | Por quê falha na semente |
|---|---|
| 1.2 | A checagem da semente só detecta início dentro de reserva existente |
| 1.3 | Mesmo motivo |
| 1.8 | A atualização não faz checagem de conflito nenhuma |

Se o resultado divergir disso, **pare**: ou uma asserção está errada, ou o entendimento da semente está errado. Investigue antes de seguir. Registre a saída real no relatório.

- [ ] **Step 5: Commit**

```bash
git add hidden-tests/T1/run.mjs
git commit -m "feat: add hidden test harness and rule 1 assertions"
```

---

### Task 2: Regras 2 a 5

**Files:**
- Modify: `hidden-tests/T1/run.mjs`

**Interfaces:**
- Consumes: `check`, `call`, `fixture`, `book`, `hours`, `minutes`, `unique` da Task 1
- Produces: mais onze asserções no mesmo registro

- [ ] **Step 1: Acrescentar as asserções das regras 2 a 5**

Inserir depois das asserções da regra 1, antes de `async function main()`:

```js
check('2.1', 2, 'create over the range of a cancelled booking', async () => {
  const ids = await fixture();
  const first = await book(ids, 24, 25);
  await call('POST', `/bookings/${first.body?.id}/cancel`);
  const response = await book(ids, 24.5, 25.5);
  return { expected: 201, actual: response.status };
});

check('2.2', 2, 'update into the range of a cancelled booking', async () => {
  const ids = await fixture();
  const first = await book(ids, 24, 25);
  await call('POST', `/bookings/${first.body?.id}/cancel`);
  const moved = await book(ids, 40, 41);
  const response = await call('PATCH', `/bookings/${moved.body?.id}`, {
    startsAt: hours(24.1),
    endsAt: hours(24.85),
  });
  return { expected: 200, actual: response.status };
});

check('3.1', 3, 'create a booking that starts in the past', async () => {
  const ids = await fixture();
  const response = await book(ids, -48, -47);
  return { expected: 400, actual: response.status };
});

check('3.2', 3, 'update a booking to start in the past', async () => {
  const ids = await fixture();
  const created = await book(ids, 24, 25);
  const response = await call('PATCH', `/bookings/${created.body?.id}`, {
    startsAt: hours(-48),
    endsAt: hours(-47),
  });
  return { expected: 400, actual: response.status };
});

check('3.3', 3, 'create a booking that starts in the future', async () => {
  const ids = await fixture();
  const response = await book(ids, 24, 25);
  return { expected: 201, actual: response.status };
});

check('4.1', 4, 'exactly thirty minutes is accepted', async () => {
  const ids = await fixture();
  const response = await call('POST', '/bookings', {
    roomId: ids.roomId,
    userId: ids.userId,
    title: 'Audit',
    startsAt: minutes(24 * 60),
    endsAt: minutes(24 * 60 + 30),
  });
  return { expected: 201, actual: response.status };
});

check('4.2', 4, 'twenty-nine minutes is rejected', async () => {
  const ids = await fixture();
  const response = await call('POST', '/bookings', {
    roomId: ids.roomId,
    userId: ids.userId,
    title: 'Audit',
    startsAt: minutes(24 * 60),
    endsAt: minutes(24 * 60 + 29),
  });
  return { expected: 400, actual: response.status };
});

check('4.3', 4, 'exactly eight hours is accepted', async () => {
  const ids = await fixture();
  const response = await call('POST', '/bookings', {
    roomId: ids.roomId,
    userId: ids.userId,
    title: 'Audit',
    startsAt: minutes(24 * 60),
    endsAt: minutes(24 * 60 + 8 * 60),
  });
  return { expected: 201, actual: response.status };
});

check('4.4', 4, 'eight hours and one minute is rejected', async () => {
  const ids = await fixture();
  const response = await call('POST', '/bookings', {
    roomId: ids.roomId,
    userId: ids.userId,
    title: 'Audit',
    startsAt: minutes(24 * 60),
    endsAt: minutes(24 * 60 + 8 * 60 + 1),
  });
  return { expected: 400, actual: response.status };
});

check('5.1', 5, 'end before start is rejected', async () => {
  const ids = await fixture();
  const response = await book(ids, 25, 24);
  return { expected: 400, actual: response.status };
});

check('5.2', 5, 'end equal to start is rejected', async () => {
  const ids = await fixture();
  const response = await book(ids, 24, 24);
  return { expected: 400, actual: response.status };
});
```

- [ ] **Step 2: Rodar contra a semente intocada e conferir contra a previsão**

Esperado agora: **12 aprovadas de 21**. Por regra:

| Regra | Aprovadas | Falhas e por quê |
|---|---|---|
| 1 | 7 de 10 | 1.2, 1.3 e 1.8, como na Task 1 |
| 2 | 2 de 2 | Nenhuma. A semente já ignora canceladas e não valida a atualização |
| 3 | 1 de 3 | 3.1 e 3.2: a semente não valida passado |
| 4 | 2 de 4 | 4.2 e 4.4: a semente não tem limites de duração |
| 5 | 0 de 2 | 5.1 e 5.2: a semente não exige fim posterior ao início |

Divergência significa asserção errada ou entendimento errado da semente. Pare e investigue.

- [ ] **Step 3: Confirmar que nenhuma asserção depende de estado deixado por outra**

Rode a suíte **duas vezes seguidas sem resetar o banco** entre elas e confirme que o resultado é idêntico:

```bash
BASE_URL=http://localhost:3310 node hidden-tests/T1/run.mjs > /tmp/first.json
BASE_URL=http://localhost:3310 node hidden-tests/T1/run.mjs > /tmp/second.json
diff /tmp/first.json /tmp/second.json && echo "identico"
```

Expected: saídas idênticas. Cada checagem cria os próprios dados com nomes aleatórios, então acúmulo no banco não pode mudar resultado. Se divergir, alguma checagem está presumindo banco vazio.

- [ ] **Step 4: Commit**

```bash
git add hidden-tests/T1/run.mjs
git commit -m "feat: add assertions for rules 2 to 5"
```

---

### Task 3: Regras 6 e 7, e a medição da linha de base

**Files:**
- Modify: `hidden-tests/T1/run.mjs`, `docs/05-log-de-implementacao.md`

**Interfaces:**
- Consumes: `check`, `call`, `fixture`, `book`, `hours`, `unique`, `hasErrorEnvelope` da Task 1
- Produces: a suíte completa com 26 asserções, e o número da linha de base registrado

- [ ] **Step 1: Acrescentar as asserções das regras 6 e 7**

A regra 6 afirma **apenas o status**, nunca a string do código. Um agente que crie um código próprio para sala inexistente pode estar decidindo melhor, e o instrumento não pode puni-lo por isso.

A regra 7 é a única que afirma uma string, e só no conflito, porque `BOOKING_CONFLICT` já é contrato existente da semente.

```js
check('6.1', 6, 'create referencing a room that does not exist', async () => {
  const ids = await fixture();
  const response = await call('POST', '/bookings', {
    roomId: `missing-${unique()}`,
    userId: ids.userId,
    title: 'Audit',
    startsAt: hours(24),
    endsAt: hours(25),
  });
  return { expected: 404, actual: response.status };
});

check('6.2', 6, 'create referencing a user that does not exist', async () => {
  const ids = await fixture();
  const response = await call('POST', '/bookings', {
    roomId: ids.roomId,
    userId: `missing-${unique()}`,
    title: 'Audit',
    startsAt: hours(24),
    endsAt: hours(25),
  });
  return { expected: 404, actual: response.status };
});

check('6.3', 6, 'update referencing a room that does not exist', async () => {
  const ids = await fixture();
  const created = await book(ids, 24, 25);
  const response = await call('PATCH', `/bookings/${created.body?.id}`, {
    roomId: `missing-${unique()}`,
  });
  return { expected: 404, actual: response.status };
});

check('7.1', 7, 'the conflict error keeps the existing envelope and code', async () => {
  const ids = await fixture();
  await book(ids, 24, 25);
  const response = await book(ids, 24.5, 25.5);
  return {
    expected: { status: 409, envelope: true, code: 'BOOKING_CONFLICT' },
    actual: {
      status: response.status,
      envelope: hasErrorEnvelope(response.body),
      code: response.body?.error?.code ?? null,
    },
  };
});

check('7.2', 7, 'a rule 3 or 4 rejection keeps the existing envelope', async () => {
  const ids = await fixture();
  const response = await book(ids, -48, -47);
  return {
    expected: { status: 400, envelope: true },
    actual: { status: response.status, envelope: hasErrorEnvelope(response.body) },
  };
});
```

- [ ] **Step 2: Rodar contra a semente intocada e conferir contra a previsão**

Esperado: **13 aprovadas de 26**, exatamente metade. Por regra:

| Regra | Aprovadas | Falhas |
|---|---|---|
| 1 | 7 de 10 | 1.2, 1.3, 1.8 |
| 2 | 2 de 2 | nenhuma |
| 3 | 1 de 3 | 3.1, 3.2 |
| 4 | 2 de 4 | 4.2, 4.4 |
| 5 | 0 de 2 | 5.1, 5.2 |
| 6 | 0 de 3 | 6.1, 6.2, 6.3, todas por a semente responder 500 |
| 7 | 1 de 2 | 7.2, porque a semente não produz o 400 da regra 3 |

Se divergir, pare e investigue antes de seguir.

- [ ] **Step 3: Verificar que o total é 26 e a soma por regra fecha**

```bash
BASE_URL=http://localhost:3310 node hidden-tests/T1/run.mjs \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const soma=Object.values(j.byRule).reduce((a,r)=>a+r.total,0);console.log("total",j.total,"soma por regra",soma,"aprovadas",j.passed);})'
```

Expected: `total 26 soma por regra 26 aprovadas 13`.

- [ ] **Step 4: Registrar a linha de base no log de implementação**

Acrescentar ao final de `docs/05-log-de-implementacao.md`, na lista de marcos pequenos, uma linha com a data, o número medido e a frase que explica por que ele importa: a faixa real de `taxa_aceitacao` começa nesse valor e não em zero, então uma sessão que pontue a linha de base não fez nada.

Use o número que você **mediu**, não o previsto, mesmo que coincidam.

- [ ] **Step 5: Commit**

```bash
git add hidden-tests/T1/run.mjs docs/05-log-de-implementacao.md
git commit -m "feat: complete the hidden suite and record the baseline"
```

---

### Task 4: Implementação de referência

**Files:**
- Create: `reference/T1/reference.patch`, `reference/T1/verify.sh`

**Interfaces:**
- Consumes: `hidden-tests/T1/run.mjs` da Task 3, o enunciado em `tasks/T1-validacao-de-reservas.md`, a semente em `seed/`
- Produces: um patch aplicável a uma cópia limpa da semente, e um roteiro que confere os três números do critério de aceite

**O que esta tarefa é, e o que ela não é.** Você está escrevendo a implementação **mínima aceitável** de T1. Você tem acesso à suíte oculta e pode usá-la para verificar seu trabalho. Você não está sendo avaliado, e não está competindo com ninguém: o objetivo é fixar o piso do aceitável, não produzir a solução mais elegante.

**"Mínimo" tem definição operacional. Todas as quatro valem:**
- Implementa as regras 1 a 7 do enunciado e nada além.
- Não refatora código que não precisa tocar.
- Não cria endpoint novo nem dependência nova.
- Segue o padrão canônico da semente, **incluindo escrever testes para o comportamento novo**. Não escrever teste é violação de convenção declarada ao agente nos níveis de contexto do experimento, e uma referência que viola as convenções do próprio projeto é um artefato confuso.

A regra 8 do enunciado, que proíbe mudar comportamento existente não citado, é verificada pelos testes da semente continuarem passando, não pela suíte oculta.

- [ ] **Step 1: Trabalhar numa cópia descartável, nunca na árvore**

Fixe o caminho do repositório numa variável logo no começo e use-a em todos os passos desta tarefa:

```bash
REPO=$(git rev-parse --show-toplevel)
WORK=$(mktemp -d)
git -C "$REPO" archive HEAD seed | tar -x -C "$WORK"
cd "$WORK/seed" && make setup
```

**Nada do que você escrever nesta tarefa pode ser commitado dentro de `seed/`.** A semente está pronta e congelada na prática; o produto desta tarefa é um patch.

- [ ] **Step 2: Ler o enunciado e listar o que falta**

Leia `tasks/T1-validacao-de-reservas.md` e, na cópia, leia `src/modules/bookings/`. Escreva, antes de tocar em código, a lista do que precisa mudar por regra. Ela vai para o relatório.

Por orientação, e sem que isso substitua sua própria leitura: a semente detecta um dos quatro casos de sobreposição na criação, não valida nada na atualização, não valida passado, não tem limites de duração, não exige fim posterior ao início, e responde erro interno em vez de 404 para sala ou usuário inexistente.

- [ ] **Step 3: Implementar, rodando a suíte oculta como guia**

Suba o servidor da cópia e rode a suíte contra ela, iterando até chegar a 26 de 26:

```bash
cd "$WORK/seed" && make db-reset && make build
PORT=3310 make start &
for _ in $(seq 1 40); do curl -fsS http://localhost:3310/health >/dev/null 2>&1 && break; sleep 0.25; done
BASE_URL=http://localhost:3310 node "$REPO/hidden-tests/T1/run.mjs"
```

Comece em 13 de 26 e termine em 26 de 26. Derrube o servidor entre iterações que mexam em código, porque `make start` serve o build e não recompila sozinho.

- [ ] **Step 4: Conferir os outros dois números do critério de aceite**

```bash
cd "$WORK/seed" && make verify
```

Expected: exit 0, com os 63 testes da semente passando mais os que você escreveu. **Zero regressões** significa que nenhum dos 63 originais falhou.

O terceiro número, zero violações de convenção, não pode ser medido ainda porque o script não existe. Em vez disso, confira à mão e registre no relatório: nenhum arquivo de produção criado fora de `src/modules/<recurso>/`, `src/shared/` ou `src/plugins/`; nenhuma dependência nova; nenhum arquivo de configuração alterado; nenhum `any` ou asserção não-nula; testes escritos; nenhum teste da semente alterado; nenhum `console`; nenhum teste pulado.

- [ ] **Step 5: Gerar o patch**

O patch precisa ter caminhos **relativos**, começando em `a/seed/` e `b/seed/`, para que o roteiro de verificação consiga aplicá-lo com `patch -p1`. Caminhos absolutos não aplicam. Monte as duas árvores lado a lado num diretório comum e gere o diff de dentro dele:

```bash
STAGE=$(mktemp -d)
mkdir -p "$STAGE/a" "$STAGE/b"
git -C "$REPO" archive HEAD seed | tar -x -C "$STAGE/a"
tar -C "$WORK" -cf - seed | tar -C "$STAGE/b" -xf -

mkdir -p "$REPO/reference/T1"
cd "$STAGE"
diff -ruN \
  --exclude=node_modules --exclude=dist --exclude=data --exclude=.cache --exclude=.git \
  a b > "$REPO/reference/T1/reference.patch" || true
```

O `|| true` existe porque `diff` sai com código 1 quando encontra diferenças, que é justamente o caso esperado.

Confira três coisas antes de seguir:

```bash
grep -c '^diff -ruN' "$REPO/reference/T1/reference.patch"                    # quantos arquivos o patch toca
grep -E '^(diff|\+\+\+|---)' "$REPO/reference/T1/reference.patch" | grep -E 'node_modules|dist/|data/|\.cache' || echo "sem ruido"
grep -E '^\+\+\+ b/' "$REPO/reference/T1/reference.patch"                      # todos devem estar sob seed/src/ ou seed/tests/
```

Expected: nenhum ruído, e todos os arquivos tocados sob `seed/src/` ou `seed/tests/`.

- [ ] **Step 6: Escrever o roteiro de verificação**

Criar `reference/T1/verify.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
PORT="${PORT:-3311}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"; kill %1 2>/dev/null || true' EXIT

echo "== extracting a clean seed =="
git -C "$REPO" archive HEAD seed | tar -x -C "$TMP"

echo "== applying the reference patch =="
patch -p1 -d "$TMP" < "$REPO/reference/T1/reference.patch"

cd "$TMP/seed"
echo "== seed suite must still pass, meaning zero regressions =="
make verify

echo "== hidden suite must score 100% =="
make db-reset
PORT="$PORT" make start &
for _ in $(seq 1 40); do
  curl -fsS "http://localhost:$PORT/health" >/dev/null 2>&1 && break
  sleep 0.25
done

BASE_URL="http://localhost:$PORT" node "$REPO/hidden-tests/T1/run.mjs" > "$TMP/result.json"
node -e '
  const fs = require("node:fs");
  const summary = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  console.log(`hidden suite: ${summary.passed}/${summary.total}`);
  if (summary.passed !== summary.total) {
    console.error(JSON.stringify(summary.failures, null, 2));
    process.exit(1);
  }
' "$TMP/result.json"

echo "reference is valid"
```

Torná-lo executável com `chmod +x`.

- [ ] **Step 7: Rodar o roteiro do zero**

```bash
./reference/T1/verify.sh
```

Expected: aplica o patch, a suíte da semente passa, a suíte oculta marca 26 de 26, e a última linha diz que a referência é válida. **Este é o teste da tarefa.**

- [ ] **Step 8: Commit**

```bash
git add reference/
git commit -m "feat: add the T1 reference implementation and its verifier"
```

---

### Task 5: Proteção contra vazamento e documentação

**Files:**
- Create: `hidden-tests/README.md`
- Modify: `tools/seed-audit/check-no-leak.sh`

**Interfaces:**
- Consumes: os diretórios criados nas tarefas anteriores
- Produces: uma verificação a mais no roteiro de vazamento, e o documento que explica as regras de construção da suíte

**Por que isto importa.** A suíte e a referência contêm a resposta de T1. Se qualquer parte delas acabar dentro de `seed/`, ou se um arquivo da semente passar a referenciar esses caminhos, o agente as encontra durante a sessão e o experimento inteiro é invalidado pela verificação 5 do portão do piloto. O roteiro que já existe cobre termos proibidos e arquivos dirigidos a agente, mas não conhece estes dois diretórios.

- [ ] **Step 1: Acrescentar a verificação ao roteiro de vazamento**

Em `tools/seed-audit/check-no-leak.sh`, antes do `exit $status` final:

```bash
echo "== research artefacts must stay outside the seed =="
leaked=0
for name in hidden-tests reference run.mjs reference.patch; do
  if find "$SEED_DIR" -not -path '*/node_modules/*' -not -path '*/.git/*' -name "$name" -print | grep .; then
    leaked=1
  fi
done
if grep -rInE 'hidden-tests|reference/T1' "$SEED_DIR" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist \
  --exclude-dir=data --exclude-dir=.cache --exclude=package-lock.json; then
  leaked=1
fi
if [ "$leaked" -eq 1 ]; then
  echo "FAIL: research artefacts reachable from the seed"
  status=1
else
  echo "ok"
fi
```

- [ ] **Step 2: Provar que a verificação nova falha quando deve**

```bash
cp hidden-tests/T1/run.mjs seed/src/run.mjs
./tools/seed-audit/check-no-leak.sh; echo "exit=$?"
rm seed/src/run.mjs
./tools/seed-audit/check-no-leak.sh; echo "exit=$?"
git status --short
```

Expected: a primeira execução falha nomeando o arquivo e sai com código diferente de zero; a segunda passa; e a árvore fica limpa. **Um roteiro de auditoria que não pode ser feito falhar não vale nada**, então este passo não é opcional.

Repita a prova pela segunda via, escrevendo `hidden-tests` dentro de um arquivo qualquer da semente, e restaurando depois.

- [ ] **Step 3: Escrever `hidden-tests/README.md`**

Em português, contendo: o que a suíte mede e para que serve; as cinco regras de construção da seção 4 da spec, com a explicação de por que só `BOOKING_CONFLICT` pode ser afirmado como string; o contrato de saída e, com destaque, a semântica do código de saída, que separa sessão que foi mal de suíte que não rodou; como executar, incluindo a subida do servidor com espera pela saúde em vez de `sleep`; a linha de base medida; e o estado de congelamento, que é M3 junto com o protocolo e os enunciados.

- [ ] **Step 4: Rodar a auditoria inteira**

```bash
./tools/seed-audit/check-no-leak.sh \
  && ./tools/seed-audit/check-structure.sh \
  && ./tools/seed-audit/check-ballast-inert.sh \
  && ./reference/T1/verify.sh
```

Expected: os quatro terminam com código zero.

- [ ] **Step 5: Commit**

```bash
git add hidden-tests/README.md tools/seed-audit/check-no-leak.sh
git commit -m "chore: keep research artefacts out of the seed"
```

---

## Auto-revisão do plano

**Cobertura da spec.** Seção 3, as 26 asserções: Tasks 1 a 3, com a contagem conferida no passo 3 da Task 3. Seção 4, regras de construção: embutidas nas asserções e documentadas na Task 5. Seção 5, contrato de saída: Task 1, com a semântica do código de saída verificada nos dois sentidos no passo 2. Seção 6, referência: Task 4, com o critério triplo no passo 4 e no roteiro. Seção 7, linha de base: Task 3, passos 2 e 4. Seção 8, colocação e proteção: Task 5. Seção 9, riscos: o de efeito chão e o de peso desigual entre regras ficam visíveis na tabela de previsão da Task 3; o de a suíte medir a si mesma é endereçado pela regra de não afirmar strings de código, que aparece no passo 1 da Task 3.

**Consistência de nomes.** `check(id, rule, name, fn)`, `call(method, path, body)`, `fixture()`, `book(ids, fromHours, toHours, title)`, `hours(h)`, `minutes(m)`, `unique()` e `hasErrorEnvelope(body)` são definidos na Task 1 e usados com essas assinaturas nas Tasks 2 e 3. `book` usa horas e as asserções de duração usam `minutes` diretamente, porque precisam de precisão de minuto.

**Ponto de atenção para quem executa.** A previsão de resultado contra a semente intocada, nas Tasks 1, 2 e 3, **não é decoração**. Ela é o único mecanismo que distingue uma asserção correta de uma asserção que escreveu errado o que o enunciado pede. Divergir da previsão e seguir adiante é o jeito mais fácil de produzir um instrumento que mede a si mesmo.
