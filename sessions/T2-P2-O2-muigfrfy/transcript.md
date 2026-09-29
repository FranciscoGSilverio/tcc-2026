# Transcrição da sessão

- Modelo: claude-opus-5
- Versão do CLI: 2.1.272
- Turnos: 36
- Motivo de parada: end_turn
- Chamadas de ferramenta: 31
- Custo em dólares: 2.58883475

---

## Resposta

I'll explore the repository to understand the architecture and identify what's relevant to this task.

## Ferramenta: Bash

```json
{
  "command": "find . -type f -not -path './node_modules/*' -not -path './.git/*' | head -100 && echo \"---\" && cat package.json",
  "description": "List project files and read package.json"
}
```

## Ferramenta: Bash

```json
{
  "command": "cat CLAUDE.md | head -5; echo \"=== Makefile ===\"; cat Makefile; echo \"=== prisma ===\"; cat prisma/schema.prisma 2>/dev/null",
  "description": "Read Makefile and Prisma schema"
}
```

## Ferramenta: Bash

```json
{
  "command": "for f in src/modules/bookings/routes.ts src/modules/bookings/service.ts src/modules/bookings/repository.ts src/modules/bookings/schema.ts; do echo \"=========== $f ===========\"; cat -n \"$f\"; done",
  "description": "Read bookings module"
}
```

## Ferramenta: Bash

```json
{
  "command": "for f in src/shared/errors.ts src/shared/time.ts src/shared/schema.ts src/shared/pagination.ts src/shared/http-reply.ts; do echo \"=========== $f ===========\"; cat -n \"$f\"; done",
  "description": "Read shared helpers"
}
```

## Ferramenta: Bash

```json
{
  "command": "for f in src/modules/rooms/routes.ts src/modules/rooms/service.ts src/modules/rooms/repository.ts src/modules/rooms/schema.ts; do echo \"=========== $f ===========\"; cat -n \"$f\"; done",
  "description": "Read rooms module"
}
```

## Ferramenta: Bash

```json
{
  "command": "for f in src/modules/users/routes.ts src/modules/users/service.ts src/modules/users/repository.ts src/modules/users/schema.ts src/modules/amenities/routes.ts src/modules/amenities/queries.ts; do echo \"=========== $f ===========\"; cat -n \"$f\"; done",
  "description": "Read users and amenities modules"
}
```

## Ferramenta: Bash

```json
{
  "command": "for f in src/app.ts src/server.ts src/config.ts src/db/client.ts src/plugins/error-handler.ts src/plugins/register-modules.ts src/plugins/request-id.ts; do echo \"=========== $f ===========\"; cat -n \"$f\"; done",
  "description": "Read app bootstrap and plugins"
}
```

## Ferramenta: Bash

```json
{
  "command": "echo \"=== README ===\"; cat README.md; echo \"=== CHANGELOG ===\"; cat CHANGELOG.md",
  "description": "Read README and CHANGELOG"
}
```

## Ferramenta: Bash

```json
{
  "command": "cat -n tests/bookings.test.ts",
  "description": "Read bookings tests"
}
```

## Ferramenta: Bash

```json
{
  "command": "echo \"=== helpers/app.ts ===\"; cat -n tests/helpers/app.ts; echo \"=== helpers/global-setup.ts ===\"; cat -n tests/helpers/global-setup.ts; echo \"=== vitest.config ===\"; cat vitest.config.ts; echo \"=== shared.test ===\"; cat -n tests/shared.test.ts",
  "description": "Read test helpers and shared tests"
}
```

## Ferramenta: Bash

```json
{
  "command": "echo \"=== tsconfig ===\"; cat tsconfig.json; echo \"=== eslint ===\"; cat eslint.config.js; echo \"=== prettier ===\"; cat .prettierrc; echo \"=== database.test ===\"; cat -n tests/database.test.ts; echo \"=== rooms.test (head) ===\"; head -40 tests/rooms.test.ts",
  "description": "Read config files and remaining tests"
}
```

## Ferramenta: Bash

```json
{
  "command": "ls ~/.claude/skills 2>/dev/null; find / -path /proc -prune -o -type d -name \"meeting-rooms-conventions\" -print 2>/dev/null | head",
  "description": "Locate project skill files"
}
```

## Ferramenta: Bash

```json
{
  "command": "find / -name \"*.md\" -path \"*skills*\" -not -path \"*/node_modules/*\" 2>/dev/null | head -20; echo \"--- plugins dir ---\"; ls -la .claude 2>/dev/null",
  "description": "Locate skill definition files"
}
```

## Ferramenta: Bash

```json
{
  "command": "cat /opt/plugin/skills/estender-modulo/SKILL.md; echo \"===========\"; cat /opt/plugin/skills/escrever-testes/SKILL.md; echo \"===========\"; cat /opt/plugin/skills/convencoes-do-projeto/SKILL.md",
  "description": "Read the three project skills"
}
```

## Resposta

Explorei o repositório inteiro (`src/`, `tests/`, configs, skills do plugin). Segue o mapa e o que importa para o RES-142. **Nenhum arquivo foi alterado.**

## Arquitetura

**Bootstrap** — `src/app.ts:12` monta o Fastify com `TypeBoxTypeProvider`. `requestIdPlugin` e `errorHandlerPlugin` são chamados direto na instância raiz (não via `register`), com um comentário explicando que `register()` encapsula e esconderia o hook/handler dos módulos irmãos; só `registerModules` entra por `app.register`. `src/plugins/register-modules.ts:7` declara `/health` e monta os prefixos `/rooms`, `/users`, `/bookings` e as rotas de amenities sem prefixo.

**Módulos** (`src/modules/<recurso>/`) — `rooms`, `users` e `bookings` seguem a divisão `routes.ts` (HTTP + schemas) → `service.ts` (regra de negócio, decide o erro de domínio) → `repository.ts` (único lugar que importa `prisma`) → `schema.ts` (Typebox). `amenities` é a exceção: só `routes.ts` + `queries.ts`, e responde erro pelos auxiliares de `src/shared/http-reply.ts` em vez de lançar `AppError`.

**Shared** — `errors.ts` (o `AppError` com `code`/`statusCode`/`details` e as fábricas `validationFailed`, `notFound`, `bookingConflict`), `time.ts` (`parseInstant`, `durationMinutes`, `isBefore`, `MINUTE_IN_MS`), `pagination.ts` (`normalizeLimit`/`normalizeOffset`/`paginated`), `schema.ts` (`DateString = Type.Unsafe<Date>(Type.String())`, o jeito do projeto de tipar data sem escape).

**Erro** — `src/plugins/error-handler.ts:9` converte `AppError` no envelope `{ error: { code, message, details } }`, traduz erro de validação do Fastify em `VALIDATION_ERROR` 400 e cai em `INTERNAL_ERROR` 500 para o resto. O `ErrorCode` é uma união fechada em `src/shared/errors.ts:1` — código novo exige entrada nova ali.

**Persistência** — SQLite via Prisma. `Booking` tem `roomId`, `userId`, `title`, `startsAt`, `endsAt`, `status` (default `"ACTIVE"`), FKs com `onDelete: Cascade` e `@@index([roomId, startsAt])` — o índice já favorece consulta por sala e janela de tempo.

**Testes** — Vitest, `tests/<recurso>.test.ts`, `pool: 'forks'` com `singleFork` e banco `data/test.db` recriado no `globalSetup`. Padrão: `createTestApp()` no `beforeAll`, `resetDb()` no `beforeEach`, requisição por `app.inject`, asserção sobre `statusCode` e `response.json()`.

## Convenções que restringem a solução

Do `CLAUDE.md` e dos três skills do plugin (`estender-modulo`, `escrever-testes`, `convencoes-do-projeto`), as que pesam aqui:

- Arquivo de produção novo só em `src/modules/<recurso>/`, `src/shared/` ou `src/plugins/`.
- **Sem dependência nova** e **sem mexer em config** — inclusive o `prisma/schema.prisma`. Ou seja: nada de coluna nova, índice novo ou constraint de exclusão no banco; a solução tem que ser em consulta + regra de serviço, com aritmética de `Date` pura.
- Sem `any`/`as any`/`@ts-ignore`/`!` (ESLint trava `no-explicit-any` e `no-non-null-assertion` como `error`); sem `console.*` em `src/`; sem `.skip`/`.only`/`.todo`.
- Ordem de trabalho recomendada: schema → repositório → serviço → rota → teste.
- Teste novo entra em `tests/bookings.test.ts` (já existe); enfraquecer teste existente não é caminho.

## O que encontrei de relevante para o RES-142

O ticket descreve o sintoma (gente tentando horário atrás de horário até acertar) e pede que a API resolva. Investigando o módulo `bookings`, há dois problemas distintos, e o segundo é grave:

**1. Não existe nenhuma forma de perguntar "quando esta sala está livre".** As únicas ferramentas do cliente são `POST /bookings` (que responde 409 seco) e `GET /bookings?roomId=&from=&to=`, cujo filtro em `src/modules/bookings/repository.ts:47` é `startsAt >= from` **e** `endsAt <= to` — quem quiser derivar disponibilidade a partir dele perde justamente as reservas que atravessam a borda da janela. Daí a tentativa-e-erro relatada.

**2. A detecção de conflito está incompleta, e várias regras de domínio do `CLAUDE.md` não estão implementadas.** `repository.findConflictAtStart` (`src/modules/bookings/repository.ts:27`) só encontra reserva que cubra o **início** da nova (`startsAt <= novoInício < endsAt`). Consequências, todas reproduzíveis:

- Reserva que **começa antes** e invade uma existente passa. Com uma reserva 24h–25h, criar 23h–26h ou 23h–24h30 retorna 201 e gera sobreposição real — exatamente o "duas reservas ativas nunca ocupam o mesmo intervalo" sendo violado.
- `updateBooking` (`src/modules/bookings/service.ts:55`) **não checa conflito nenhum** e não valida nada: dá para mover uma reserva para cima de outra por `PATCH`. O `CLAUDE.md` é explícito que as regras valem para qualquer operação que altere sala ou horário.
- Nenhuma validação de `endsAt > startsAt`, de duração (30 min a 8 h) nem de início no passado. Hoje `startsAt` depois de `endsAt` é aceito.
- Nenhuma checagem de existência de sala/usuário: `roomId` inexistente estoura a FK do SQLite e sai como `INTERNAL_ERROR` 500 (o `tests/database.test.ts:31` documenta que o Prisma rejeita), quando o esperado é 404.

Isso importa para o ticket porque qualquer resposta de disponibilidade que eu construa em cima do predicado atual mentiria — a sala apareceria livre num horário já ocupado, ou vice-versa. O predicado correto de sobreposição, com fim exclusivo, é `existente.startsAt < novo.endsAt && existente.endsAt > novo.startsAt`, com `status = ACTIVE`.

## Arquivos que a tarefa toca

| Arquivo | Papel na mudança |
|---|---|
| `src/modules/bookings/schema.ts` | schemas da consulta de disponibilidade e da resposta de slots; constantes de duração mínima/máxima |
| `src/modules/bookings/repository.ts` | `findOverlapping(roomId, startsAt, endsAt, excludeId?)` no lugar do `findConflictAtStart`; consulta das reservas ativas dentro de uma janela |
| `src/modules/bookings/service.ts` | cálculo dos intervalos livres; asserções de janela (fim > início, duração, início futuro); existência de sala/usuário; aplicar tudo também no `updateBooking` |
| `src/modules/bookings/routes.ts` | rota nova de disponibilidade |
| `src/shared/time.ts` | se precisar de auxiliar de intervalo — é o lugar natural, já tem `isBefore`/`durationMinutes` |
| `tests/bookings.test.ts` | casos novos, no arquivo existente |
| `src/shared/errors.ts` | só se a resposta passar a carregar sugestão de horário no `details` (o `bookingConflict` já aceita detalhe) |

## Decisão de escopo que eu tomaria

Sem canal para dúvidas, leio "a API resolve isso" como: **parar de exigir adivinhação** — e não como "auto-remarcar a reserva do usuário", que mudaria silenciosamente o que a pessoa pediu.

1. **Consulta de disponibilidade**: `GET /bookings/availability?roomId=&from=&to=&durationMinutes=`, devolvendo os intervalos livres da sala na janela, derivados das reservas ativas. Fica no módulo `bookings` porque a regra é de reserva — `rooms/service.ts` hoje não sabe nada de agenda. (O caminho estático não colide com `/bookings/:id` no roteador do Fastify.) Isso atende diretamente quem organiza várias reservas de uma vez: uma chamada, todos os buracos da agenda.
2. **Corrigir o predicado de conflito** e aplicá-lo também no `PATCH`, mais as regras de duração, início futuro e existência de sala/usuário como 404. Sem isso o item 1 é uma resposta não confiável — e as regras já estão escritas no `CLAUDE.md` como válidas para qualquer operação.
3. **Enriquecer o 409** com o próximo horário livre nos `details`, reaproveitando o mesmo cálculo: quem esbarrar no conflito já recebe a saída junto do erro.

Os testes existentes de conflito (`tests/bookings.test.ts:152-182`, incluindo adjacência às 25h e slot liberado por cancelamento) continuam passando com o predicado corrigido — eles descrevem o comportamento certo, é a implementação que estava aquém.

**Não implementei nada**, conforme o pedido de não alterar arquivos. Se quiser que eu siga, o caminho é schema → repositório → serviço → rota → teste, fechando com `make verify`.

## Resposta

Plano de implementação do RES-142, na ordem recomendada pelo skill `estender-modulo` (schema → repositório → serviço → rota → teste). Nada foi escrito em disco.

---

## Passo 0 — Conferências antes de começar

1. `grep -rn "findConflictAtStart" src tests` — confirmar que o único chamador é `bookings/service.ts:18`, para poder substituí-lo em vez de deixar função morta.
2. Ler `prisma/demo-data.ts` para confirmar que ele insere via Prisma direto (não via HTTP); se passar pelas rotas, as validações novas podem quebrá-lo e ele precisa de datas futuras coerentes.
3. Reler `tests/shared.test.ts:14`: ele afirma `details` **exatamente** igual a `{ conflictingBookingId: 'abc' }`. Qualquer mudança em `bookingConflict` tem que manter esse resultado na chamada de um argumento.

---

## Passo 1 — `src/shared/errors.ts`

Estender `bookingConflict` com um segundo parâmetro opcional, sem alterar o comportamento da chamada de um argumento:

```ts
export function bookingConflict(
  conflictingBookingId: string,
  extra: Record<string, unknown> = {},
): AppError {
  return new AppError('BOOKING_CONFLICT', 409, 'Room is already booked for this period', {
    conflictingBookingId,
    ...extra,
  });
}
```

Com `extra` vazio o objeto continua sendo `{ conflictingBookingId }` — `tests/shared.test.ts` segue passando. Nenhum `ErrorCode` novo é necessário: disponibilidade é 200, e o resto cai em `VALIDATION_ERROR`/`NOT_FOUND`/`BOOKING_CONFLICT`, que já existem.

---

## Passo 2 — `src/modules/bookings/schema.ts`

Acrescentar as constantes de domínio e os schemas da rota nova:

```ts
export const MIN_DURATION_MINUTES = 30;
export const MAX_DURATION_MINUTES = 480;

export const AvailabilityQuery = Type.Object({
  roomId: Type.String({ minLength: 1 }),
  from: Type.String({ minLength: 1 }),
  to: Type.String({ minLength: 1 }),
  durationMinutes: Type.Optional(Type.Integer({ minimum: 1 })),
});

const SlotResponse = Type.Object({ startsAt: DateString, endsAt: DateString });

export const AvailabilityResponse = Type.Object({
  roomId: Type.String(),
  from: DateString,
  to: DateString,
  slots: Type.Array(SlotResponse),
});

export type AvailabilityInput = Static<typeof AvailabilityQuery>;
```

`DateString` já é o jeito da casa de declarar data na resposta: o serviço devolve `Date` e o serializador do Fastify escreve ISO — mesmo mecanismo de `BookingResponse.startsAt`. Sem isso eu precisaria de `toISOString()` espalhado ou de escape de tipo.

---

## Passo 3 — `src/modules/bookings/repository.ts`

Trocar `findConflictAtStart` pelo predicado correto de sobreposição (fim exclusivo) e acrescentar a consulta da janela:

```ts
export function findOverlapping(
  roomId: string,
  startsAt: Date,
  endsAt: Date,
  excludeId?: string,
): Promise<Booking | null> {
  return prisma.booking.findFirst({
    where: {
      roomId,
      status: BOOKING_ACTIVE,
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    orderBy: { startsAt: 'asc' },
  });
}

export function listActiveBetween(roomId: string, from: Date, to: Date): Promise<Booking[]> {
  return prisma.booking.findMany({
    where: { roomId, status: BOOKING_ACTIVE, startsAt: { lt: to }, endsAt: { gt: from } },
    orderBy: { startsAt: 'asc' },
  });
}
```

`orderBy` no `findOverlapping` deixa o conflito reportado determinístico (o mais antigo), o que o teste `tests/bookings.test.ts:178` depende implicitamente. As duas consultas batem com o índice `@@index([roomId, startsAt])` que já existe — **o schema do Prisma não muda**.

Ainda aqui, as buscas de existência, espelhando o precedente de `amenities/queries.ts:24` (o módulo declara a própria consulta do recurso vizinho em vez de importar o repositório de outro módulo):

```ts
export function findRoomById(id: string): Promise<Room | null> { … }
export function findUserById(id: string): Promise<User | null> { … }
```

*Alternativa considerada:* chamar `roomsService.getRoom()` do serviço de bookings — reusaria o `notFound`, mas criaria acoplamento entre módulos que hoje não existe em lugar nenhum. Fico com o precedente do amenities.

---

## Passo 4 — `src/modules/bookings/service.ts`

**4.1 Asserções de domínio**, com os auxiliares que já existem em `shared/time.ts` (inclusive `isBefore`, hoje sem uso):

```ts
function assertWindow(startsAt: Date, endsAt: Date): void {
  if (!isBefore(startsAt, endsAt)) throw validationFailed('Booking must end after it starts');
  if (isBefore(startsAt, new Date())) throw validationFailed('Booking cannot start in the past');
  const minutes = durationMinutes(startsAt, endsAt);
  if (minutes < MIN_DURATION_MINUTES || minutes > MAX_DURATION_MINUTES) {
    throw validationFailed('Booking duration is out of range', {
      durationMinutes: minutes,
      minDurationMinutes: MIN_DURATION_MINUTES,
      maxDurationMinutes: MAX_DURATION_MINUTES,
    });
  }
}
```

Limites inclusivos nos dois extremos (30 min e 8 h valem), conforme o `CLAUDE.md`.

**4.2 Existência de sala e usuário** — `assertRoomExists` / `assertUserExists` lançando `notFound('Room')` / `notFound('User')`, chamados antes da criação. Isso tira do ar o 500 atual, em que a violação de FK do SQLite escapa como `INTERNAL_ERROR`.

**4.3 `createBooking`**: parse → `assertWindow` → existência → `findOverlapping` → `bookingConflict(conflito.id, { nextAvailableStart })` → `repository.create`.

**4.4 `updateBooking`** — hoje não valida nada. Passa a:

```ts
const booking = await getBooking(id);
const touchesSchedule =
  input.roomId !== undefined || input.startsAt !== undefined || input.endsAt !== undefined;
```

Se `touchesSchedule`, mesclar o pedido com o estado atual (`input.startsAt ?? booking.startsAt`, etc.), rodar `assertWindow` + existência sobre os valores efetivos e, **só se `booking.status === BOOKING_ACTIVE`**, rodar `findOverlapping(..., excludeId: id)` — reserva cancelada não ocupa horário, então não colide nem consigo mesma. Se só `title`/`userId` mudam, nada de checagem de janela: o `PATCH` de título do `tests/bookings.test.ts:115` continua funcionando mesmo para uma reserva cujo horário já passou.

**4.5 Cálculo dos intervalos livres** — função pura, sem tocar em Prisma:

```ts
function freeSlots(bookings: Booking[], from: Date, to: Date, minMinutes: number): Slot[]
```

Varredura linear: cursor em `from`; para cada reserva ordenada, se `booking.startsAt > cursor` há um buraco `[cursor, min(booking.startsAt, to)]`; cursor vira `max(cursor, booking.endsAt)`; no fim, se `cursor < to`, mais um buraco. Descarta buracos menores que `minMinutes`. O fim exclusivo cai naturalmente: sala liberada às 10:00 produz slot começando às 10:00.

**4.6 `listAvailability(query)`**: parse de `from`/`to`; `validationFailed` se `from >= to`; **clamp de `from` para agora** quando a janela começa no passado (horário passado não é reservável, oferecê-lo recriaria a adivinhação); guarda de janela máxima (31 dias) para não varrer o banco inteiro; `durationMinutes` default `MIN_DURATION_MINUTES`; chama `listActiveBetween` e devolve `{ roomId, from, to, slots }`. Antes disso, `assertRoomExists` — perguntar a agenda de sala inexistente é 404, não lista vazia.

**4.7 `nextAvailableStart`** para o 409: reusa `freeSlots` numa janela limitada (ex.: 7 dias a partir do início pedido) e devolve o começo do primeiro buraco que comporta a duração pedida, ou omite a chave se não achar. É o mesmo cálculo do item 4.5 — nenhuma lógica duplicada.

---

## Passo 5 — `src/modules/bookings/routes.ts`

```ts
app.get('/availability',
  { schema: { querystring: AvailabilityQuery, response: { 200: AvailabilityResponse } } },
  async (request) => service.listAvailability(request.query));
```

Declarada **antes** de `/:id` por legibilidade (o roteador do Fastify já prioriza segmento estático sobre paramétrico, então não há ambiguidade real). Caminho final: `GET /bookings/availability`. A rota não decide nada — repassa a query já validada.

---

## Passo 6 — `tests/bookings.test.ts` (arquivo existente, casos novos)

Regressão do bug de sobreposição:
- reserva 24–25 existente; criar 23–26 → **409** (envolve a existente)
- reserva 24–25 existente; criar 23–24.5 → **409** (começa antes e invade)

Regras de janela e referências:
- `endsAt` antes de `startsAt` → 400
- duração de 20 min → 400; de 9 h → 400
- duração de exatamente 30 min e de exatamente 8 h → **201** (limites inclusivos)
- `startsAt` no passado → 400
- `roomId` inexistente → **404**; `userId` inexistente → **404** (hoje são 500)

`PATCH`:
- mover reserva para cima de outra ativa → 409
- `PATCH` que muda só o título continua 200 (já coberto em `:115`, serve de guarda)

Disponibilidade:
- sala sem reserva → um único slot cobrindo a janela
- reserva no meio da janela → dois slots, e o segundo começa **exatamente** no fim da reserva
- reserva cancelada não recorta a janela
- `durationMinutes=60` elimina o buraco de 30 min
- `roomId` inexistente → 404

Conflito informativo:
- o 409 traz `details.nextAvailableStart` apontando para horário que, reenviado, dá 201 — é a asserção que prova que o ticket foi resolvido de ponta a ponta.

Todos com `createTestApp()`/`resetDb()` e `app.inject`, afirmando `statusCode` + `response.json()`. Os casos existentes de conflito (`:152`–`:182`) não mudam — os horários que eles usam (45 min, 1 h, sempre futuros) já respeitam as regras novas.

---

## Passo 7 — Fechamento

1. `make verify` (setup + typecheck + lint + build + test).
2. `grep -rn "\.only\|\.skip\|\.todo" tests` e `grep -rn "console\.\|as any\|@ts-" src` — os itens 4, 7 e 8 do checklist de convenções.
3. Confirmar que `package.json`, `prisma/schema.prisma` e os arquivos de configuração seguem intocados no `git diff` — nenhuma etapa acima pede mudança neles.
4. Uma linha no `CHANGELOG.md` (disponibilidade consultável + detecção de conflito completa nas operações de escrita). Opcional, mas o arquivo existe e não está na lista de configs congelados.

**Ordem de commit sugerida**, se valer separar: (a) correção do predicado de conflito + regras de domínio + testes, (b) rota de disponibilidade + testes, (c) `nextAvailableStart` no 409. O (b) depende do (a) para ser confiável.

## Ferramenta: Bash

```json
{
  "command": "grep -rn \"findConflictAtStart\" src tests; echo \"--- demo-data ---\"; cat -n prisma/demo-data.ts",
  "description": "Check callers and demo-data script"
}
```

## Resposta

Passo 0 confirmado: `findConflictAtStart` tem um único chamador e `demo-data.ts` insere via Prisma direto (não passa pelas validações novas). Seguindo.

## Ferramenta: Bash

```json
{
  "command": "python3 - <<'PY'\nimport re\np = 'src/shared/errors.ts'\ns = open(p).read()\nold = \"\"\"export function bookingConflict(conflictingBookingId: string): AppError {\n  return new AppError('BOOKING_CONFLICT', 409, 'Room is already booked for this period', {\n    conflictingBookingId,\n  });\n}\"\"\"\nnew = \"\"\"export function bookingConflict(\n  conflictingBookingId: string,\n  extra: Record<string, unknown> = {},\n): AppError {\n  return new AppError('BOOKING_CONFLICT', 409, 'Room is already booked for this period', {\n    conflictingBookingId,\n    ...extra,\n  });\n}\"\"\"\nassert old in s\nopen(p, 'w').write(s.replace(old, new))\nPY\ntail -12 src/shared/errors.ts",
  "description": "Extend bookingConflict with optional details"
}
```

## Ferramenta: Bash

```json
{
  "command": "head -n 56 src/shared/errors.ts > /tmp/errors.ts && cat >> /tmp/errors.ts <<'EOF'\nexport function bookingConflict(\n  conflictingBookingId: string,\n  extra: Record<string, unknown> = {},\n): AppError {\n  return new AppError('BOOKING_CONFLICT', 409, 'Room is already booked for this period', {\n    conflictingBookingId,\n    ...extra,\n  });\n}\nEOF\nmv /tmp/errors.ts src/shared/errors.ts && tail -14 src/shared/errors.ts",
  "description": "Rewrite bookingConflict helper"
}
```

## Ferramenta: Bash

```json
{
  "command": "cat > src/modules/bookings/schema.ts <<'EOF'\nimport { Type, type Static } from '@sinclair/typebox';\nimport { DateString } from '../../shared/schema.js';\n\nexport const BOOKING_ACTIVE = 'ACTIVE';\nexport const BOOKING_CANCELLED = 'CANCELLED';\n\nexport const MIN_DURATION_MINUTES = 30;\nexport const MAX_DURATION_MINUTES = 480;\n\nexport const BookingResponse = Type.Object({\n  id: Type.String(),\n  roomId: Type.String(),\n  userId: Type.String(),\n  title: Type.String(),\n  startsAt: DateString,\n  endsAt: DateString,\n  status: Type.String(),\n  createdAt: DateString,\n  updatedAt: DateString,\n});\n\nexport const CreateBookingBody = Type.Object(\n  {\n    roomId: Type.String({ minLength: 1 }),\n    userId: Type.String({ minLength: 1 }),\n    title: Type.String({ minLength: 1, maxLength: 200 }),\n    startsAt: Type.String({ minLength: 1 }),\n    endsAt: Type.String({ minLength: 1 }),\n  },\n  { additionalProperties: false },\n);\n\nexport const UpdateBookingBody = Type.Partial(CreateBookingBody);\n\nexport const BookingIdParams = Type.Object({ id: Type.String({ minLength: 1 }) });\n\nexport const ListBookingsQuery = Type.Object({\n  roomId: Type.Optional(Type.String()),\n  userId: Type.Optional(Type.String()),\n  status: Type.Optional(Type.String()),\n  from: Type.Optional(Type.String()),\n  to: Type.Optional(Type.String()),\n  limit: Type.Optional(Type.Integer({ minimum: 1 })),\n  offset: Type.Optional(Type.Integer({ minimum: 0 })),\n});\n\nexport const BookingPage = Type.Object({\n  data: Type.Array(BookingResponse),\n  pagination: Type.Object({\n    total: Type.Integer(),\n    limit: Type.Integer(),\n    offset: Type.Integer(),\n  }),\n});\n\nexport const AvailabilityQuery = Type.Object({\n  roomId: Type.String({ minLength: 1 }),\n  from: Type.String({ minLength: 1 }),\n  to: Type.String({ minLength: 1 }),\n  durationMinutes: Type.Optional(Type.Integer({ minimum: 1 })),\n});\n\nexport const AvailabilityResponse = Type.Object({\n  roomId: Type.String(),\n  from: DateString,\n  to: DateString,\n  slots: Type.Array(Type.Object({ startsAt: DateString, endsAt: DateString })),\n});\n\nexport type CreateBookingInput = Static<typeof CreateBookingBody>;\nexport type UpdateBookingInput = Static<typeof UpdateBookingBody>;\nexport type ListBookingsInput = Static<typeof ListBookingsQuery>;\nexport type AvailabilityInput = Static<typeof AvailabilityQuery>;\nEOF\ngit diff --stat src/modules/bookings/schema.ts",
  "description": "Add availability schemas and duration constants"
}
```

## Ferramenta: Bash

```json
{
  "command": "cat > src/modules/bookings/repository.ts <<'EOF'\nimport type { Booking, Prisma, Room, User } from '@prisma/client';\nimport { prisma } from '../../db/client.js';\nimport { BOOKING_ACTIVE } from './schema.js';\n\nexport interface BookingData {\n  roomId: string;\n  userId: string;\n  title: string;\n  startsAt: Date;\n  endsAt: Date;\n}\n\nexport interface BookingFilter {\n  roomId?: string;\n  userId?: string;\n  status?: string;\n  from?: Date;\n  to?: Date;\n  limit: number;\n  offset: number;\n}\n\nexport function create(data: BookingData): Promise<Booking> {\n  return prisma.booking.create({ data });\n}\n\nexport function findOverlapping(\n  roomId: string,\n  startsAt: Date,\n  endsAt: Date,\n  excludeId?: string,\n): Promise<Booking | null> {\n  return prisma.booking.findFirst({\n    where: {\n      roomId,\n      status: BOOKING_ACTIVE,\n      startsAt: { lt: endsAt },\n      endsAt: { gt: startsAt },\n      ...(excludeId ? { id: { not: excludeId } } : {}),\n    },\n    orderBy: { startsAt: 'asc' },\n  });\n}\n\nexport function listActiveBetween(roomId: string, from: Date, to: Date): Promise<Booking[]> {\n  return prisma.booking.findMany({\n    where: {\n      roomId,\n      status: BOOKING_ACTIVE,\n      startsAt: { lt: to },\n      endsAt: { gt: from },\n    },\n    orderBy: { startsAt: 'asc' },\n  });\n}\n\nexport function findById(id: string): Promise<Booking | null> {\n  return prisma.booking.findUnique({ where: { id } });\n}\n\nexport function findRoomById(id: string): Promise<Room | null> {\n  return prisma.room.findUnique({ where: { id } });\n}\n\nexport function findUserById(id: string): Promise<User | null> {\n  return prisma.user.findUnique({ where: { id } });\n}\n\nexport function list(filter: BookingFilter): Promise<[Booking[], number]> {\n  const where: Prisma.BookingWhereInput = {};\n  if (filter.roomId) where.roomId = filter.roomId;\n  if (filter.userId) where.userId = filter.userId;\n  if (filter.status) where.status = filter.status;\n  if (filter.from) where.startsAt = { gte: filter.from };\n  if (filter.to) where.endsAt = { lte: filter.to };\n\n  return prisma.$transaction([\n    prisma.booking.findMany({\n      where,\n      take: filter.limit,\n      skip: filter.offset,\n      orderBy: { startsAt: 'asc' },\n    }),\n    prisma.booking.count({ where }),\n  ]);\n}\n\nexport function update(id: string, data: Partial<BookingData>): Promise<Booking> {\n  return prisma.booking.update({ where: { id }, data });\n}\n\nexport function updateStatus(id: string, status: string): Promise<Booking> {\n  return prisma.booking.update({ where: { id }, data: { status } });\n}\n\nexport function remove(id: string): Promise<Booking> {\n  return prisma.booking.delete({ where: { id } });\n}\nEOF\ngit diff --stat src/modules/bookings/repository.ts",
  "description": "Replace conflict query and add window/existence queries"
}
```

## Ferramenta: Bash

```json
{
  "command": "cat > src/modules/bookings/service.ts <<'EOF'\nimport type { Booking } from '@prisma/client';\nimport { AppError, bookingConflict, notFound, validationFailed } from '../../shared/errors.js';\nimport {\n  normalizeLimit,\n  normalizeOffset,\n  paginated,\n  type Page,\n} from '../../shared/pagination.js';\nimport { MINUTE_IN_MS, durationMinutes, isBefore, parseInstant } from '../../shared/time.js';\nimport * as repository from './repository.js';\nimport {\n  BOOKING_ACTIVE,\n  BOOKING_CANCELLED,\n  MAX_DURATION_MINUTES,\n  MIN_DURATION_MINUTES,\n} from './schema.js';\nimport type {\n  AvailabilityInput,\n  CreateBookingInput,\n  ListBookingsInput,\n  UpdateBookingInput,\n} from './schema.js';\n\nconst MINUTES_IN_DAY = 1440;\nconst MAX_WINDOW_MINUTES = 31 * MINUTES_IN_DAY;\nconst SUGGESTION_WINDOW_MINUTES = 7 * MINUTES_IN_DAY;\n\nexport interface Slot {\n  startsAt: Date;\n  endsAt: Date;\n}\n\nexport interface Availability {\n  roomId: string;\n  from: Date;\n  to: Date;\n  slots: Slot[];\n}\n\nfunction earliest(a: Date, b: Date): Date {\n  return isBefore(a, b) ? a : b;\n}\n\nfunction latest(a: Date, b: Date): Date {\n  return isBefore(a, b) ? b : a;\n}\n\nfunction addMinutes(instant: Date, minutes: number): Date {\n  return new Date(instant.getTime() + minutes * MINUTE_IN_MS);\n}\n\nfunction assertWindow(startsAt: Date, endsAt: Date): void {\n  if (!isBefore(startsAt, endsAt)) {\n    throw validationFailed('Booking must end after it starts');\n  }\n  if (isBefore(startsAt, new Date())) {\n    throw validationFailed('Booking cannot start in the past', { startsAt });\n  }\n  const minutes = durationMinutes(startsAt, endsAt);\n  if (minutes < MIN_DURATION_MINUTES || minutes > MAX_DURATION_MINUTES) {\n    throw validationFailed('Booking duration is out of range', {\n      durationMinutes: minutes,\n      minDurationMinutes: MIN_DURATION_MINUTES,\n      maxDurationMinutes: MAX_DURATION_MINUTES,\n    });\n  }\n}\n\nasync function assertRoomExists(roomId: string): Promise<void> {\n  const room = await repository.findRoomById(roomId);\n  if (!room) {\n    throw notFound('Room');\n  }\n}\n\nasync function assertUserExists(userId: string): Promise<void> {\n  const user = await repository.findUserById(userId);\n  if (!user) {\n    throw notFound('User');\n  }\n}\n\n// Sweeps the active bookings of a room in chronological order and returns the\n// gaps left between them. The interval of a booking includes its start and\n// excludes its end, so a gap may begin at the exact instant a booking ends.\nfunction freeSlots(bookings: Booking[], from: Date, to: Date, minMinutes: number): Slot[] {\n  const slots: Slot[] = [];\n  let cursor = from;\n\n  for (const booking of bookings) {\n    if (isBefore(cursor, booking.startsAt)) {\n      const slotEnd = earliest(booking.startsAt, to);\n      if (durationMinutes(cursor, slotEnd) >= minMinutes) {\n        slots.push({ startsAt: cursor, endsAt: slotEnd });\n      }\n    }\n    cursor = latest(cursor, booking.endsAt);\n    if (!isBefore(cursor, to)) {\n      return slots;\n    }\n  }\n\n  if (durationMinutes(cursor, to) >= minMinutes) {\n    slots.push({ startsAt: cursor, endsAt: to });\n  }\n  return slots;\n}\n\nasync function nextAvailableStart(\n  roomId: string,\n  startsAt: Date,\n  endsAt: Date,\n): Promise<Date | undefined> {\n  const horizon = addMinutes(startsAt, SUGGESTION_WINDOW_MINUTES);\n  const bookings = await repository.listActiveBetween(roomId, startsAt, horizon);\n  const [slot] = freeSlots(bookings, startsAt, horizon, durationMinutes(startsAt, endsAt));\n  return slot?.startsAt;\n}\n\nasync function conflictFor(\n  conflict: Booking,\n  roomId: string,\n  startsAt: Date,\n  endsAt: Date,\n): Promise<AppError> {\n  const suggestion = await nextAvailableStart(roomId, startsAt, endsAt);\n  return bookingConflict(conflict.id, suggestion ? { nextAvailableStart: suggestion } : {});\n}\n\nexport async function createBooking(input: CreateBookingInput): Promise<Booking> {\n  const startsAt = parseInstant(input.startsAt);\n  const endsAt = parseInstant(input.endsAt);\n  assertWindow(startsAt, endsAt);\n  await assertRoomExists(input.roomId);\n  await assertUserExists(input.userId);\n\n  const conflict = await repository.findOverlapping(input.roomId, startsAt, endsAt);\n  if (conflict) {\n    throw await conflictFor(conflict, input.roomId, startsAt, endsAt);\n  }\n\n  return repository.create({\n    roomId: input.roomId,\n    userId: input.userId,\n    title: input.title,\n    startsAt,\n    endsAt,\n  });\n}\n\nexport async function getBooking(id: string): Promise<Booking> {\n  const booking = await repository.findById(id);\n  if (!booking) {\n    throw notFound('Booking');\n  }\n  return booking;\n}\n\nexport async function listBookings(query: ListBookingsInput): Promise<Page<Booking>> {\n  const limit = normalizeLimit(query.limit);\n  const offset = normalizeOffset(query.offset);\n  const [data, total] = await repository.list({\n    roomId: query.roomId,\n    userId: query.userId,\n    status: query.status,\n    from: query.from ? parseInstant(query.from) : undefined,\n    to: query.to ? parseInstant(query.to) : undefined,\n    limit,\n    offset,\n  });\n  return paginated(data, total, limit, offset);\n}\n\nexport async function listAvailability(query: AvailabilityInput): Promise<Availability> {\n  const requestedFrom = parseInstant(query.from);\n  const to = parseInstant(query.to);\n  if (!isBefore(requestedFrom, to)) {\n    throw validationFailed('Availability window must end after it starts');\n  }\n  if (durationMinutes(requestedFrom, to) > MAX_WINDOW_MINUTES) {\n    throw validationFailed('Availability window is too long', {\n      maxWindowMinutes: MAX_WINDOW_MINUTES,\n    });\n  }\n  await assertRoomExists(query.roomId);\n\n  // A booking can never start in the past, so a window that reaches back is\n  // searched from now on.\n  const from = earliest(latest(requestedFrom, new Date()), to);\n  const minMinutes = query.durationMinutes ?? MIN_DURATION_MINUTES;\n  const bookings = await repository.listActiveBetween(query.roomId, from, to);\n\n  return { roomId: query.roomId, from, to, slots: freeSlots(bookings, from, to, minMinutes) };\n}\n\nexport async function updateBooking(id: string, input: UpdateBookingInput): Promise<Booking> {\n  const booking = await getBooking(id);\n  const roomId = input.roomId ?? booking.roomId;\n  const startsAt = input.startsAt !== undefined ? parseInstant(input.startsAt) : booking.startsAt;\n  const endsAt = input.endsAt !== undefined ? parseInstant(input.endsAt) : booking.endsAt;\n  const reschedules =\n    input.roomId !== undefined || input.startsAt !== undefined || input.endsAt !== undefined;\n\n  if (input.userId !== undefined) {\n    await assertUserExists(input.userId);\n  }\n\n  if (reschedules) {\n    assertWindow(startsAt, endsAt);\n    if (input.roomId !== undefined) {\n      await assertRoomExists(roomId);\n    }\n    // Only an active booking occupies its interval, so only an active booking\n    // can be moved into a conflict.\n    if (booking.status === BOOKING_ACTIVE) {\n      const conflict = await repository.findOverlapping(roomId, startsAt, endsAt, id);\n      if (conflict) {\n        throw await conflictFor(conflict, roomId, startsAt, endsAt);\n      }\n    }\n  }\n\n  return repository.update(id, {\n    ...(input.roomId !== undefined ? { roomId: input.roomId } : {}),\n    ...(input.userId !== undefined ? { userId: input.userId } : {}),\n    ...(input.title !== undefined ? { title: input.title } : {}),\n    ...(input.startsAt !== undefined ? { startsAt } : {}),\n    ...(input.endsAt !== undefined ? { endsAt } : {}),\n  });\n}\n\nexport async function cancelBooking(id: string): Promise<Booking> {\n  const booking = await getBooking(id);\n  if (booking.status === BOOKING_CANCELLED) {\n    return booking;\n  }\n  return repository.updateStatus(id, BOOKING_CANCELLED);\n}\n\nexport async function deleteBooking(id: string): Promise<void> {\n  await getBooking(id);\n  await repository.remove(id);\n}\nEOF\nnpx tsc -p tsconfig.json --noEmit 2>&1 | head -20",
  "description": "Rewrite bookings service with domain rules and availability"
}
```

## Ferramenta: Bash

```json
{
  "command": "cat > src/modules/bookings/routes.ts <<'EOF'\nimport type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';\nimport {\n  AvailabilityQuery,\n  AvailabilityResponse,\n  BookingIdParams,\n  BookingPage,\n  BookingResponse,\n  CreateBookingBody,\n  ListBookingsQuery,\n  UpdateBookingBody,\n} from './schema.js';\nimport * as service from './service.js';\n\nexport const bookingsRoutes: FastifyPluginAsyncTypebox = async (app) => {\n  app.post('/', { schema: { body: CreateBookingBody, response: { 201: BookingResponse } } },\n    async (request, reply) => reply.code(201).send(await service.createBooking(request.body)));\n\n  app.get('/', { schema: { querystring: ListBookingsQuery, response: { 200: BookingPage } } },\n    async (request) => service.listBookings(request.query));\n\n  app.get('/availability',\n    { schema: { querystring: AvailabilityQuery, response: { 200: AvailabilityResponse } } },\n    async (request) => service.listAvailability(request.query));\n\n  app.get('/:id', { schema: { params: BookingIdParams, response: { 200: BookingResponse } } },\n    async (request) => service.getBooking(request.params.id));\n\n  app.patch('/:id',\n    { schema: { params: BookingIdParams, body: UpdateBookingBody, response: { 200: BookingResponse } } },\n    async (request) => service.updateBooking(request.params.id, request.body));\n\n  app.post('/:id/cancel',\n    { schema: { params: BookingIdParams, response: { 200: BookingResponse } } },\n    async (request) => service.cancelBooking(request.params.id));\n\n  app.delete('/:id', { schema: { params: BookingIdParams } }, async (request, reply) => {\n    await service.deleteBooking(request.params.id);\n    return reply.code(204).send();\n  });\n};\nEOF\nnpx tsc -p tsconfig.json --noEmit && npx eslint src 2>&1 | tail -5",
  "description": "Add availability route"
}
```

## Ferramenta: Bash

```json
{
  "command": "head -n 182 tests/bookings.test.ts > /tmp/bookings.test.ts && cat >> /tmp/bookings.test.ts <<'EOF'\n\n  it('rejects a booking that swallows an active booking', async () => {\n    await book(24, 25);\n    const response = await book(23, 26, 'Envelope');\n    expect(response.statusCode).toBe(409);\n    expect(response.json().error.code).toBe('BOOKING_CONFLICT');\n  });\n\n  it('rejects a booking that starts earlier and runs into an active booking', async () => {\n    await book(24, 25);\n    const response = await book(23, 24.5, 'Runs into');\n    expect(response.statusCode).toBe(409);\n  });\n\n  it('suggests the next free start when the slot is taken', async () => {\n    const first = await book(24, 25);\n    const response = await book(24.5, 25.5, 'Overlap');\n    const suggested = response.json().error.details.nextAvailableStart;\n    expect(new Date(suggested).getTime()).toBe(new Date(first.json().endsAt).getTime());\n\n    const retry = await app.inject({\n      method: 'POST',\n      url: '/bookings',\n      payload: {\n        roomId,\n        userId,\n        title: 'Retry',\n        startsAt: suggested,\n        endsAt: new Date(new Date(suggested).getTime() + HOUR).toISOString(),\n      },\n    });\n    expect(retry.statusCode).toBe(201);\n  });\n\n  it('rejects a booking that ends before it starts', async () => {\n    const response = await book(25, 24, 'Backwards');\n    expect(response.statusCode).toBe(400);\n    expect(response.json().error.code).toBe('VALIDATION_ERROR');\n  });\n\n  it('rejects a booking shorter than thirty minutes', async () => {\n    const response = await book(24, 24.25, 'Too short');\n    expect(response.statusCode).toBe(400);\n  });\n\n  it('accepts a booking of exactly thirty minutes', async () => {\n    expect((await book(24, 24.5, 'Half hour')).statusCode).toBe(201);\n  });\n\n  it('accepts a booking of exactly eight hours', async () => {\n    expect((await book(24, 32, 'Full day')).statusCode).toBe(201);\n  });\n\n  it('rejects a booking longer than eight hours', async () => {\n    const response = await book(24, 32.5, 'Too long');\n    expect(response.statusCode).toBe(400);\n  });\n\n  it('rejects a booking that starts in the past', async () => {\n    const response = await book(-1, 1, 'Yesterday');\n    expect(response.statusCode).toBe(400);\n  });\n\n  it('answers 404 when the room does not exist', async () => {\n    const response = await app.inject({\n      method: 'POST',\n      url: '/bookings',\n      payload: {\n        roomId: 'missing-room',\n        userId,\n        title: 'Sync',\n        startsAt: inHours(24),\n        endsAt: inHours(25),\n      },\n    });\n    expect(response.statusCode).toBe(404);\n    expect(response.json().error.code).toBe('NOT_FOUND');\n  });\n\n  it('answers 404 when the user does not exist', async () => {\n    const response = await app.inject({\n      method: 'POST',\n      url: '/bookings',\n      payload: {\n        roomId,\n        userId: 'missing-user',\n        title: 'Sync',\n        startsAt: inHours(24),\n        endsAt: inHours(25),\n      },\n    });\n    expect(response.statusCode).toBe(404);\n  });\n\n  it('rejects a reschedule onto an occupied slot', async () => {\n    const first = await book(24, 25);\n    const second = await book(26, 27, 'Later');\n    const response = await app.inject({\n      method: 'PATCH',\n      url: `/bookings/${second.json().id}`,\n      payload: { startsAt: inHours(24.5), endsAt: inHours(25.5) },\n    });\n    expect(response.statusCode).toBe(409);\n    expect(response.json().error.details.conflictingBookingId).toBe(first.json().id);\n  });\n\n  it('accepts a reschedule onto a free slot', async () => {\n    const created = await book(24, 25);\n    const response = await app.inject({\n      method: 'PATCH',\n      url: `/bookings/${created.json().id}`,\n      payload: { startsAt: inHours(26), endsAt: inHours(27) },\n    });\n    expect(response.statusCode).toBe(200);\n  });\n\n  it('does not treat a booking as a conflict with itself', async () => {\n    const created = await book(24, 25);\n    const response = await app.inject({\n      method: 'PATCH',\n      url: `/bookings/${created.json().id}`,\n      payload: { endsAt: inHours(25.5) },\n    });\n    expect(response.statusCode).toBe(200);\n  });\n\n  it('rejects a reschedule that breaks the duration range', async () => {\n    const created = await book(24, 25);\n    const response = await app.inject({\n      method: 'PATCH',\n      url: `/bookings/${created.json().id}`,\n      payload: { endsAt: inHours(24.25) },\n    });\n    expect(response.statusCode).toBe(400);\n  });\n\n  it('reports the whole window as free when the room has no booking', async () => {\n    const from = inHours(24);\n    const to = inHours(32);\n    const response = await availability({ from, to });\n    expect(response.statusCode).toBe(200);\n    expect(response.json().slots).toEqual([{ startsAt: from, endsAt: to }]);\n  });\n\n  it('splits the window around an active booking', async () => {\n    const from = inHours(24);\n    const to = inHours(32);\n    const startsAt = inHours(26);\n    const endsAt = inHours(27);\n    await app.inject({\n      method: 'POST',\n      url: '/bookings',\n      payload: { roomId, userId, title: 'Sync', startsAt, endsAt },\n    });\n    const response = await availability({ from, to });\n    expect(response.json().slots).toEqual([\n      { startsAt: from, endsAt: startsAt },\n      { startsAt: endsAt, endsAt: to },\n    ]);\n  });\n\n  it('ignores a cancelled booking when reporting availability', async () => {\n    const from = inHours(24);\n    const to = inHours(32);\n    const created = await book(26, 27);\n    await app.inject({ method: 'POST', url: `/bookings/${created.json().id}/cancel` });\n    const response = await availability({ from, to });\n    expect(response.json().slots).toEqual([{ startsAt: from, endsAt: to }]);\n  });\n\n  it('leaves out gaps shorter than the requested duration', async () => {\n    const from = inHours(24);\n    const to = inHours(32);\n    await book(24.5, 25.5, 'Mid morning');\n    expect((await availability({ from, to })).json().slots).toHaveLength(2);\n    const filtered = await availability({ from, to, durationMinutes: '60' });\n    expect(filtered.json().slots).toHaveLength(1);\n  });\n\n  it('never offers a slot that starts in the past', async () => {\n    const from = inHours(-5);\n    const to = inHours(5);\n    const body = (await availability({ from, to })).json();\n    expect(new Date(body.from).getTime()).toBeGreaterThan(new Date(from).getTime());\n    expect(body.slots[0].startsAt).toBe(body.from);\n  });\n\n  it('answers 404 for the availability of a room that does not exist', async () => {\n    const response = await app.inject({\n      method: 'GET',\n      url: `/bookings/availability?roomId=missing-room&from=${inHours(24)}&to=${inHours(32)}`,\n    });\n    expect(response.statusCode).toBe(404);\n  });\n\n  it('rejects an availability window that ends before it starts', async () => {\n    const response = await availability({ from: inHours(32), to: inHours(24) });\n    expect(response.statusCode).toBe(400);\n  });\n});\nEOF\nmv /tmp/bookings.test.ts tests/bookings.test.ts && wc -l tests/bookings.test.ts",
  "description": "Append new booking and availability tests"
}
```

## Ferramenta: Bash

```json
{
  "command": "head -n 46 tests/bookings.test.ts > /tmp/b.ts && cat >> /tmp/b.ts <<'EOF'\n\n  async function availability(params: Record<string, string>) {\n    const query = new URLSearchParams({ roomId, ...params }).toString();\n    return app.inject({ method: 'GET', url: `/bookings/availability?${query}` });\n  }\nEOF\ntail -n +47 tests/bookings.test.ts >> /tmp/b.ts && mv /tmp/b.ts tests/bookings.test.ts && sed -n '38,56p' tests/bookings.test.ts",
  "description": "Add availability test helper"
}
```

## Ferramenta: Bash

```json
{
  "command": "make test 2>&1 | tail -45",
  "description": "Run the test suite"
}
```

## Ferramenta: Bash

```json
{
  "command": "cat > /tmp/ch.md <<'EOF'\n# Changelog\n\n## Unreleased\n\n- Availability endpoint: `GET /bookings/availability` reports the free slots of\n  a room inside a window, so a client no longer has to guess a free time.\n- Conflict detection now covers any overlap, not only the start of the new\n  booking, and also runs when a booking is rescheduled.\n- Booking window rules enforced on create and update: end after start, duration\n  between 30 minutes and 8 hours, start in the future.\n- A booking that points at a room or a user that does not exist answers 404\n  instead of 500.\n- A conflict response carries `nextAvailableStart` in its details.\n\nEOF\ntail -n +2 CHANGELOG.md >> /tmp/ch.md && mv /tmp/ch.md CHANGELOG.md && cat CHANGELOG.md",
  "description": "Add changelog entry"
}
```

## Ferramenta: Bash

```json
{
  "command": "sed -i '14{/^$/d}' CHANGELOG.md && sed -n '10,17p' CHANGELOG.md && echo \"=== grep checks ===\" && grep -rn \"\\.only\\|\\.skip\\|\\.todo\" tests; grep -rn \"console\\.\\|as any\\|@ts-ignore\\|@ts-expect-error\" src; echo \"(sem ocorrências acima = ok)\"; echo \"=== git status ===\"; git status --short",
  "description": "Fix blank line and run convention checks"
}
```

## Ferramenta: Bash

```json
{
  "command": "make verify 2>&1 | tail -25",
  "description": "Run full verification"
}
```

## Resposta

`make verify` (typecheck + lint + build + test) passa: **86 testes, 7 arquivos, tudo verde** — 38 em `tests/bookings.test.ts`, 22 deles novos.

## O que foi implementado

**`src/shared/errors.ts`** — `bookingConflict` ganhou um segundo parâmetro opcional. Com um argumento, `details` continua sendo exatamente `{ conflictingBookingId }`, então `tests/shared.test.ts:14` segue valendo sem toque.

**`src/modules/bookings/schema.ts`** — `MIN_DURATION_MINUTES`/`MAX_DURATION_MINUTES` (30 e 480) e os schemas `AvailabilityQuery`/`AvailabilityResponse`, com `DateString` nos campos de data. Só adições.

**`src/modules/bookings/repository.ts`** — `findConflictAtStart` (que só olhava o início da nova reserva) deu lugar a `findOverlapping(roomId, startsAt, endsAt, excludeId?)` com o predicado correto de fim exclusivo, mais `listActiveBetween` para a janela e `findRoomById`/`findUserById` para existência — espelhando o precedente de `amenities/queries.ts:24`, sem acoplar módulos. As duas consultas de agenda usam o índice `[roomId, startsAt]` que já existia.

**`src/modules/bookings/service.ts`** — `assertWindow` (fim depois do início, início no futuro, 30 min a 8 h inclusive), checagem de sala e usuário como 404, `freeSlots` como varredura pura dos buracos entre reservas ativas, `listAvailability` (clampa a janela para começar em "agora", teto de 31 dias, filtro por duração mínima) e `nextAvailableStart`, que reusa o mesmo `freeSlots` para sugerir horário no 409. O `updateBooking`, que antes não validava nada, agora roda as mesmas regras quando sala ou horário mudam — com `excludeId` para a reserva não conflitar consigo mesma, e pulando a checagem de conflito quando a reserva está cancelada, já que reserva cancelada não ocupa intervalo.

**`src/modules/bookings/routes.ts`** — `GET /bookings/availability`, declarada antes de `/:id`.

**`tests/bookings.test.ts`** — casos novos no arquivo existente, nenhum teste antigo removido ou enfraquecido: sobreposição por envolvimento e por início anterior (o bug que deixava passar reserva dupla), limites de duração nos dois extremos, início no passado, 404 para sala/usuário inexistentes, remarcação por `PATCH` (para slot ocupado, para slot livre, e a que estende a própria reserva), e disponibilidade (janela inteira livre, janela partida pelas bordas exatas da reserva, reserva cancelada ignorada, filtro por duração, clamp do passado, 404 de sala inexistente). O teste da sugestão fecha o ciclo do ticket: pega o `nextAvailableStart` do 409 e reenvia a reserva nesse horário, esperando 201.

**`CHANGELOG.md`** — entrada `## Unreleased`.

## Efeito no RES-142

O cliente agora pergunta `GET /bookings/availability?roomId=…&from=…&to=…&durationMinutes=…` e recebe todos os intervalos livres de uma vez — é a resposta para quem organiza várias reservas de uma sentada. Quem ainda esbarrar no 409 recebe `details.nextAvailableStart`, que dá para reenviar direto. E, como efeito colateral necessário, a detecção de conflito parou de aceitar sobreposição real: sem isso a resposta de disponibilidade mentiria.

Nada de dependência nova, e `package.json`, `prisma/schema.prisma` e os arquivos de configuração seguem intocados — o `git status` lista só os seis arquivos de código/changelog acima.

## Ferramenta: Bash

```json
{
  "command": "echo \"=== typecheck ===\" && npm run typecheck 2>&1 | tail -5; echo \"exit=$?\"; echo \"=== lint ===\" && npm run lint 2>&1 | tail -10; echo \"exit=$?\"",
  "description": "Run typecheck and lint"
}
```

## Ferramenta: Bash

```json
{
  "command": "npm test 2>&1 | tail -20",
  "description": "Run test suite"
}
```

## Ferramenta: Bash

```json
{
  "command": "for i in 1 2 3; do npm test 2>&1 | grep -E \"Tests +[0-9]+ (passed|failed)|✗|×|FAIL\" ; done",
  "description": "Repeat test suite to check stability"
}
```

## Ferramenta: Bash

```json
{
  "command": "for i in 1 2 3; do npm test 2>&1 | sed 's/\\x1b\\[[0-9;]*m//g' | grep -E \"^ +(Tests|Test Files)\" ; echo \"--- run $i done\"; done",
  "description": "Repeat test suite three times"
}
```

## Resposta

Rodei as três verificações; **nada falhou, então não houve nada a corrigir**.

```
npm run typecheck   → exit 0 (tsc --noEmit, sem diagnósticos)
npm run lint        → exit 0 (eslint . sobre src e tests)
npm test            → 7 arquivos, 86 testes, todos passando
```

Como os testes novos de disponibilidade comparam instantes, rodei a suíte mais três vezes para descartar dependência de temporização: **86 passando nas três execuções**, sem variação.

Duas coisas que confirmei de propósito nessa rodada, porque eram as hipóteses de falha mais plausíveis do que implementei:

- A serialização `Date → ISO` via `DateString` na resposta de disponibilidade faz round-trip exato — os testes que comparam `slots` com `toEqual` contra as strings enviadas passam, o que prova que o serializador do Fastify usa `toISOString()` e que eu não precisei converter data na mão em lugar nenhum.
- Os casos de limite de duração (exatamente 30 min e exatamente 8 h) passam de forma estável. Eles dependem de `durationMinutes`, que arredonda, e as duas chamadas de `inHours` dentro do mesmo payload ficam a microssegundos uma da outra — a margem até virar 31 min ou 481 min é de ~30 segundos entre duas expressões da mesma linha, então não é fonte real de instabilidade.

O estado do repositório segue o mesmo do passo anterior: seis arquivos modificados (`src/shared/errors.ts`, os quatro de `src/modules/bookings/`, `tests/bookings.test.ts`) mais o `CHANGELOG.md`, sem toque em `package.json`, no schema do Prisma ou em configuração.
