# Repositório-semente — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a API REST de reservas de salas que serve de ponto de partida idêntico para as 55 sessões do experimento, congelada na tag `seed-v1`.

**Architecture:** Fastify sobre Prisma com SQLite. Três módulos canônicos em quatro camadas, um módulo deliberadamente fora do padrão, uma camada de plugins e um núcleo compartilhado. Os defeitos do módulo de reservas são deliberados e obedecem à regra do falso negativo. O que verifica esses defeitos vive fora da árvore da semente.

**Tech Stack:** Node 22, TypeScript, Fastify 5, TypeBox, Prisma 6 com SQLite, Vitest 2, ESLint 9, Prettier 3, Make, Docker.

**Spec:** `docs/superpowers/specs/2026-09-09-repositorio-semente-design.md`

## Global Constraints

Valem para toda tarefa deste plano. São copiadas da spec e não podem ser relaxadas por conveniência.

- **Localização.** Tudo é criado sob `seed/`. Caminhos neste plano são relativos a `seed/`, exceto onde disser explicitamente `tools/`, que fica na raiz do repositório de artefatos e **nunca** entra na semente.
- **Idioma.** Código, identificadores, mensagens de erro, comentários, README e mensagens de commit em inglês.
- **Sem biblioteca de data.** Aritmética de tempo com `Date` puro mais `src/shared/time.ts`. Nenhuma dependência de data pode entrar no `package.json`.
- **`src/shared/time.ts` não pode conter função de sobreposição de intervalos.** Ela entregaria a resposta de T1. Só conversão, comparação e duração.
- **TypeScript em modo estrito.** ESLint com `@typescript-eslint/no-explicit-any` como **erro**.
- **Nenhum arquivo dirigido a agente ou a contribuidor.** Sem `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `CONTRIBUTING.md`, `.claude/`.
- **README mínimo.** Uma linha de descrição e os comandos. Sem arquitetura, sem convenções, sem explicação de camadas.
- **Nenhuma ocorrência dos termos do estudo** em toda a árvore, lastro e changelog incluídos: TCC, INATEL, harness, experimento, agente, seed, semente, P0, P1, P2, O1, O2, T1, T2.
- **Regra do falso negativo.** Nenhum comportamento da semente pode recusar um pedido que o contrato de T1 aceitaria. Todos os defeitos deixam passar; nenhum recusa.
- **Nada no código declara qual padrão é o vigente.** Sem comentário de migração pendente, sem marcação de obsoleto, sem nome de arquivo que entregue o jogo.
- **Nenhuma data absoluta em teste.** Todo instante derivado de `Date.now()`.
- **Nenhum teste da semente pode afirmar** que uma sobreposição fora do caso detectado é criada, que uma reserva no passado é criada, que uma reserva fora da faixa de duração é criada, que uma reserva com fim anterior ou igual ao início é criada, que sala ou usuário inexistente produz 500, ou que uma atualização pode mover a reserva para cima de outra. Todas viram falsas depois de T1 e produziriam regressão falsa em toda sessão.
- **Orçamento de desvio fechado.** Exatamente um módulo desviante, um auxiliar substituído e duas imperfeições nomeadas no serviço de usuários. Nada além disso.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `package.json` `package-lock.json` | Dependências com versões exatas |
| `tsconfig.json` `eslint.config.js` `.prettierrc` `vitest.config.ts` | Tooling |
| `Makefile` | Interface única de operação, consumida pelo runner |
| `Dockerfile` `docker-compose.yml` `.dockerignore` | Imagem base reproduzível |
| `.gitignore` `.editorconfig` `.env.example` `LICENSE` `CHANGELOG.md` `README.md` | Arquivos de repositório |
| `prisma/schema.prisma` | Cinco modelos e o índice de reservas |
| `src/config.ts` | Leitura e validação de variáveis de ambiente |
| `src/db/client.ts` | Instância única do cliente Prisma |
| `src/shared/errors.ts` | Tipo de erro da aplicação, códigos e envelope |
| `src/shared/pagination.ts` | Normalização de limite e deslocamento, envelope de página |
| `src/shared/time.ts` | Conversão, comparação e duração. **Sem sobreposição** |
| `src/shared/http-reply.ts` | Caminho alternativo de resposta de erro, mesmo envelope externo |
| `src/plugins/request-id.ts` | Identificador de requisição |
| `src/plugins/error-handler.ts` | Tratador global, mapeia erro para o envelope |
| `src/plugins/register-modules.ts` | Registro dos módulos |
| `src/app.ts` `src/server.ts` | Montagem da aplicação e entrada do processo |
| `src/modules/rooms/{routes,service,repository,schema}.ts` | Módulo canônico |
| `src/modules/users/{routes,service,repository,schema}.ts` | Módulo canônico, com as duas imperfeições |
| `src/modules/bookings/{routes,service,repository,schema}.ts` | Módulo canônico, com os defeitos deliberados |
| `src/modules/amenities/{routes,queries}.ts` | Módulo desviante |
| `tests/helpers/{app,global-setup}.ts` | Apoio de teste |
| `tests/{health,rooms,users,bookings,amenities}.test.ts` | Suíte da semente |
| `infra/terraform/*.tf` `.github/workflows/ci.yml` | Lastro inerte |
| `tools/seed-audit/*` (fora da semente) | Auditoria de aceite e verificação dos falsos negativos |

**Por que a verificação dos falsos negativos vive fora da semente.** Um teste que afirma "uma reserva que engole outra é criada com sucesso" é exatamente uma das afirmações proibidas na suíte da semente, porque T1 a torna falsa. Mas é uma propriedade que precisa ser verificada antes do congelamento. A saída é verificá-la de fora, em `tools/seed-audit/`, que nunca é copiada para dentro de uma sessão.

---

### Task 1: Esqueleto, tooling e verificação mínima

**Files:**
- Create: `seed/package.json`, `seed/tsconfig.json`, `seed/eslint.config.js`, `seed/.prettierrc`, `seed/vitest.config.ts`, `seed/.gitignore`, `seed/.editorconfig`, `seed/.env.example`, `seed/README.md`, `seed/Makefile`
- Test: `seed/tests/smoke.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: os alvos `setup`, `verify`, `typecheck`, `lint`, `format`, `build`, `test`, `clean` do Makefile; a convenção de módulos ESM com extensão `.js` nos imports

- [ ] **Step 1: Escrever o teste que falha**

Criar `seed/tests/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('toolchain', () => {
  it('runs TypeScript under Vitest', () => {
    const value: string = 'ok';
    expect(value).toBe('ok');
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd seed && npx vitest run`
Expected: FAIL, porque não existe `package.json` nem dependências instaladas.

- [ ] **Step 3: Criar `package.json`**

Versões exatas, sem acento circunflexo nem til. Nenhuma biblioteca de data.

```json
{
  "name": "meeting-rooms-api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": { "node": "22.x" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "dev": "tsx watch src/server.ts",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "eslint .",
    "format": "prettier --write .",
    "test": "vitest run"
  },
  "dependencies": {
    "@fastify/type-provider-typebox": "5.1.0",
    "@prisma/client": "6.2.1",
    "@sinclair/typebox": "0.34.13",
    "fastify": "5.2.1"
  },
  "devDependencies": {
    "@eslint/js": "9.18.0",
    "@types/node": "22.10.5",
    "eslint": "9.18.0",
    "prettier": "3.4.2",
    "prisma": "6.2.1",
    "tsx": "4.19.2",
    "typescript": "5.7.3",
    "typescript-eslint": "8.20.0",
    "vitest": "2.1.8"
  }
}
```

- [ ] **Step 4: Criar `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2023"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "declaration": false
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 5: Criar `eslint.config.js`**

`no-explicit-any` é **erro**, por decisão registrada na spec seção 6.4.

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'data/**', '.cache/**', 'infra/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-console': 'error',
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
);
```

- [ ] **Step 6: Criar `.prettierrc`**

```json
{ "singleQuote": true, "semi": true, "printWidth": 100, "trailingComma": "all" }
```

- [ ] **Step 7: Criar `vitest.config.ts`**

Thread única, para o banco de arquivo não sofrer corrida.

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./tests/helpers/global-setup.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    env: { DATABASE_URL: 'file:./data/test.db', NODE_ENV: 'test' },
    include: ['tests/**/*.test.ts'],
  },
});
```

Nesta tarefa `tests/helpers/global-setup.ts` ainda não existe. Criar um arquivo temporário com o conteúdo abaixo; a Task 2 o substitui pela versão real.

```ts
export default function setup(): void {}
```

- [ ] **Step 8: Criar `.gitignore`**

Higiene do diff da sessão. Sem isto, o diff carrega ruído.

```
node_modules/
dist/
data/
.cache/
coverage/
.env
*.log
```

- [ ] **Step 9: Criar `.editorconfig` e `.env.example`**

`.editorconfig`:

```
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[Makefile]
indent_style = tab
```

`.env.example`:

```
PORT=3000
DATABASE_URL=file:./data/app.db
LOG_LEVEL=info
NODE_ENV=development
```

- [ ] **Step 10: Criar `README.md`**

Mínimo por decisão de projeto. **Não acrescentar seção de arquitetura nem de convenções.**

````markdown
# meeting-rooms-api

REST API for booking meeting rooms.

## Requirements

Node 22 and GNU Make.

## Commands

```bash
make setup      # install dependencies and prepare the database
make dev        # run in watch mode
make test       # run the test suite
make verify     # typecheck, lint, build and test
make demo-data  # load sample rows for local browsing
```

The API listens on the port given by `PORT`, default 3000.
````

- [ ] **Step 11: Criar `Makefile` com os alvos desta tarefa**

Linhas de receita começam com TAB. A auto-cura do cliente Prisma entra na Task 2.

```make
SHELL := /bin/bash

.PHONY: setup verify typecheck lint format build test clean

setup:
	@[ -d node_modules ] || npm ci

verify: setup typecheck lint build test

typecheck: setup
	@npm run typecheck

lint: setup
	@npm run lint

format: setup
	@npm run format

build: setup
	@npm run build

test: setup
	@npm test

clean:
	@rm -rf dist data .cache coverage
```

- [ ] **Step 12: Rodar e confirmar que passa**

Run: `cd seed && make verify`
Expected: PASS. O build compila sem fontes, o lint não acha violações, o teste de fumaça passa.

- [ ] **Step 13: Commit**

```bash
git add seed
git commit -m "chore: bootstrap project toolchain"
```

---

### Task 2: Prisma, banco e apoio de teste

**Files:**
- Create: `seed/prisma/schema.prisma`, `seed/src/db/client.ts`, `seed/tests/helpers/global-setup.ts`, `seed/tests/helpers/app.ts`
- Modify: `seed/Makefile`
- Test: `seed/tests/database.test.ts`
- Delete: `seed/tests/smoke.test.ts`

**Interfaces:**
- Consumes: alvos do Makefile da Task 1
- Produces: `prisma` exportado de `src/db/client.ts`; `resetDb()` de `tests/helpers/app.ts`; alvo `db-reset`; auto-cura de `setup` por hash do schema

- [ ] **Step 1: Escrever o teste que falha**

Criar `seed/tests/database.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client.js';
import { resetDb } from './helpers/app.js';

describe('database schema', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('stores a room and reads it back', async () => {
    const room = await prisma.room.create({ data: { name: 'Aurora', capacity: 8 } });
    const found = await prisma.room.findUnique({ where: { id: room.id } });
    expect(found?.name).toBe('Aurora');
  });

  it('defaults a booking to the active status', async () => {
    const room = await prisma.room.create({ data: { name: 'Borealis', capacity: 4 } });
    const user = await prisma.user.create({ data: { name: 'Ada', email: 'ada@example.com' } });
    const booking = await prisma.booking.create({
      data: {
        roomId: room.id,
        userId: user.id,
        title: 'Sync',
        startsAt: new Date(Date.now() + 3_600_000),
        endsAt: new Date(Date.now() + 7_200_000),
      },
    });
    expect(booking.status).toBe('ACTIVE');
  });

  it('rejects a booking that points at a room that does not exist', async () => {
    const user = await prisma.user.create({ data: { name: 'Grace', email: 'grace@example.com' } });
    await expect(
      prisma.booking.create({
        data: {
          roomId: 'missing-room',
          userId: user.id,
          title: 'Sync',
          startsAt: new Date(Date.now() + 3_600_000),
          endsAt: new Date(Date.now() + 7_200_000),
        },
      }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd seed && npx vitest run tests/database.test.ts`
Expected: FAIL, porque `src/db/client.ts` não existe.

- [ ] **Step 3: Criar `prisma/schema.prisma`**

O conector SQLite do Prisma não suporta enumerações, por isso `status` é texto.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Room {
  id        String        @id @default(cuid())
  name      String        @unique
  capacity  Int
  floor     String?
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  bookings  Booking[]
  amenities RoomAmenity[]
}

model User {
  id        String    @id @default(cuid())
  name      String
  email     String    @unique
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  bookings  Booking[]
}

model Booking {
  id        String   @id @default(cuid())
  roomId    String
  userId    String
  title     String
  startsAt  DateTime
  endsAt    DateTime
  status    String   @default("ACTIVE")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  room      Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([roomId, startsAt])
}

model Amenity {
  id          String        @id @default(cuid())
  name        String        @unique
  description String?
  rooms       RoomAmenity[]
}

model RoomAmenity {
  roomId    String
  amenityId String
  room      Room    @relation(fields: [roomId], references: [id], onDelete: Cascade)
  amenity   Amenity @relation(fields: [amenityId], references: [id], onDelete: Cascade)

  @@id([roomId, amenityId])
}
```

- [ ] **Step 4: Criar `src/db/client.ts`**

```ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}
```

- [ ] **Step 5: Substituir `tests/helpers/global-setup.ts`**

```ts
import { execFileSync } from 'node:child_process';

export default function setup(): void {
  execFileSync(
    'npx',
    ['prisma', 'db', 'push', '--skip-generate', '--force-reset', '--accept-data-loss'],
    {
      env: { ...process.env, DATABASE_URL: 'file:./data/test.db' },
      stdio: 'ignore',
    },
  );
}
```

- [ ] **Step 6: Criar `tests/helpers/app.ts`**

A ordem de remoção respeita as chaves estrangeiras.

```ts
import { prisma } from '../../src/db/client.js';

export async function resetDb(): Promise<void> {
  await prisma.roomAmenity.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.amenity.deleteMany();
  await prisma.room.deleteMany();
  await prisma.user.deleteMany();
}
```

- [ ] **Step 7: Tornar `setup` auto-curativo no `Makefile`**

Substituir o alvo `setup` e acrescentar `db-reset`. A regeneração do cliente só acontece quando o hash do schema muda ou quando o banco sumiu, o que anula a única fraqueza estrutural do Prisma.

```make
CACHE  := .cache
SCHEMA := prisma/schema.prisma
STAMP  := $(CACHE)/schema.sha
DB     := data/app.db

.PHONY: setup db-reset

setup:
	@[ -d node_modules ] || npm ci
	@mkdir -p $(CACHE) data
	@current=$$(sha256sum $(SCHEMA) | cut -d' ' -f1); \
	if [ ! -f "$(STAMP)" ] || [ ! -f "$(DB)" ] || [ "$$current" != "$$(cat $(STAMP))" ]; then \
	  npx prisma generate >/dev/null; \
	  npx prisma db push --skip-generate --accept-data-loss >/dev/null; \
	  echo "$$current" > $(STAMP); \
	fi

db-reset:
	@rm -f $(DB) $(STAMP)
	@$(MAKE) --no-print-directory setup
```

Acrescentar `db-reset` à lista `.PHONY` do topo.

- [ ] **Step 8: Apagar o teste de fumaça**

```bash
rm seed/tests/smoke.test.ts
```

- [ ] **Step 9: Rodar e confirmar que passa**

Run: `cd seed && make verify`
Expected: PASS, com os três testes de banco verdes.

- [ ] **Step 10: Commit**

```bash
git add seed
git commit -m "feat: add database schema and test harness"
```

---

### Task 3: Núcleo compartilhado

**Files:**
- Create: `seed/src/shared/errors.ts`, `seed/src/shared/pagination.ts`, `seed/src/shared/time.ts`, `seed/src/shared/http-reply.ts`
- Test: `seed/tests/shared.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `AppError` com `code`, `statusCode`, `message`, `details`
  - `notFound(what: string): AppError`, `roomNameTaken(name: string): AppError`, `emailTaken(email: string): AppError`, `bookingConflict(conflictingBookingId: string): AppError`
  - `errorBody(code: string, message: string, details?: Record<string, unknown>): ErrorBody`
  - `normalizeLimit(limit?: number): number`, `normalizeOffset(offset?: number): number`, `paginated<T>(data: T[], total: number, limit: number, offset: number): Page<T>`
  - `parseInstant(value: string): Date`, `durationMinutes(start: Date, end: Date): number`
  - `replyNotFound(reply, what)`, `replyConflict(reply, code, message)`

- [ ] **Step 1: Escrever o teste que falha**

Criar `seed/tests/shared.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AppError, bookingConflict, errorBody, notFound } from '../src/shared/errors.js';
import { normalizeLimit, normalizeOffset, paginated } from '../src/shared/pagination.js';
import { durationMinutes, parseInstant } from '../src/shared/time.js';

describe('errors', () => {
  it('builds a not found error', () => {
    const error = notFound('Room');
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.statusCode).toBe(404);
  });

  it('carries the conflicting booking in the details', () => {
    const error = bookingConflict('abc');
    expect(error.statusCode).toBe(409);
    expect(error.details).toEqual({ conflictingBookingId: 'abc' });
  });

  it('wraps a payload in the error envelope', () => {
    expect(errorBody('NOT_FOUND', 'Room not found')).toEqual({
      error: { code: 'NOT_FOUND', message: 'Room not found', details: {} },
    });
  });
});

describe('pagination', () => {
  it('falls back to the default limit', () => {
    expect(normalizeLimit(undefined)).toBe(20);
  });

  it('caps the limit at the maximum', () => {
    expect(normalizeLimit(500)).toBe(100);
  });

  it('never returns a negative offset', () => {
    expect(normalizeOffset(-5)).toBe(0);
  });

  it('builds the page envelope', () => {
    expect(paginated([1, 2], 7, 20, 0)).toEqual({
      data: [1, 2],
      pagination: { total: 7, limit: 20, offset: 0 },
    });
  });
});

describe('time', () => {
  it('parses an ISO instant', () => {
    expect(parseInstant('2030-01-01T10:00:00.000Z').getTime()).toBe(
      Date.UTC(2030, 0, 1, 10, 0, 0),
    );
  });

  it('rejects a value that is not an instant', () => {
    expect(() => parseInstant('not-a-date')).toThrowError(AppError);
  });

  it('measures the duration in minutes', () => {
    const start = new Date(Date.now());
    const end = new Date(start.getTime() + 90 * 60_000);
    expect(durationMinutes(start, end)).toBe(90);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd seed && npx vitest run tests/shared.test.ts`
Expected: FAIL, nenhum dos módulos existe.

- [ ] **Step 3: Criar `src/shared/errors.ts`**

```ts
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'ROOM_NAME_TAKEN'
  | 'EMAIL_TAKEN'
  | 'BOOKING_CONFLICT'
  | 'INTERNAL_ERROR';

export interface ErrorBody {
  error: { code: ErrorCode; message: string; details: Record<string, unknown> };
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    statusCode: number,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function errorBody(
  code: ErrorCode,
  message: string,
  details: Record<string, unknown> = {},
): ErrorBody {
  return { error: { code, message, details } };
}

export function validationFailed(message: string, details: Record<string, unknown> = {}): AppError {
  return new AppError('VALIDATION_ERROR', 400, message, details);
}

export function notFound(what: string): AppError {
  return new AppError('NOT_FOUND', 404, `${what} not found`);
}

export function roomNameTaken(name: string): AppError {
  return new AppError('ROOM_NAME_TAKEN', 409, 'Room name is already in use', { name });
}

export function emailTaken(email: string): AppError {
  return new AppError('EMAIL_TAKEN', 409, 'Email is already in use', { email });
}

export function bookingConflict(conflictingBookingId: string): AppError {
  return new AppError('BOOKING_CONFLICT', 409, 'Room is already booked for this period', {
    conflictingBookingId,
  });
}
```

- [ ] **Step 4: Criar `src/shared/pagination.ts`**

```ts
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export interface Page<T> {
  data: T[];
  pagination: { total: number; limit: number; offset: number };
}

export function normalizeLimit(limit?: number): number {
  if (limit === undefined || Number.isNaN(limit)) return DEFAULT_LIMIT;
  if (limit < 1) return DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
}

export function normalizeOffset(offset?: number): number {
  if (offset === undefined || Number.isNaN(offset) || offset < 0) return 0;
  return offset;
}

export function paginated<T>(data: T[], total: number, limit: number, offset: number): Page<T> {
  return { data, pagination: { total, limit, offset } };
}
```

- [ ] **Step 5: Criar `src/shared/time.ts`**

**Não acrescentar função de sobreposição de intervalos.** Ela entregaria a resposta de T1.

```ts
import { validationFailed } from './errors.js';

export const MINUTE_IN_MS = 60_000;

export function parseInstant(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw validationFailed('Value is not a valid instant', { value });
  }
  return parsed;
}

export function durationMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / MINUTE_IN_MS);
}

export function isBefore(a: Date, b: Date): boolean {
  return a.getTime() < b.getTime();
}
```

- [ ] **Step 6: Criar `src/shared/http-reply.ts`**

Mesmo envelope externo, caminho de código diferente. **Nenhuma marcação de obsoleto no nome nem em comentário.**

```ts
import type { FastifyReply } from 'fastify';
import { errorBody, type ErrorCode } from './errors.js';

export function replyNotFound(reply: FastifyReply, what: string): FastifyReply {
  return reply.code(404).send(errorBody('NOT_FOUND', `${what} not found`));
}

export function replyConflict(reply: FastifyReply, code: ErrorCode, message: string): FastifyReply {
  return reply.code(409).send(errorBody(code, message));
}
```

- [ ] **Step 7: Rodar e confirmar que passa**

Run: `cd seed && make verify`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add seed
git commit -m "feat: add shared error, pagination and time helpers"
```

---

### Task 4: Bootstrap, plugins e endpoint de saúde

**Files:**
- Create: `seed/src/config.ts`, `seed/src/plugins/request-id.ts`, `seed/src/plugins/error-handler.ts`, `seed/src/plugins/register-modules.ts`, `seed/src/app.ts`, `seed/src/server.ts`
- Modify: `seed/tests/helpers/app.ts`, `seed/Makefile`
- Test: `seed/tests/health.test.ts`

**Interfaces:**
- Consumes: `AppError`, `errorBody` de `src/shared/errors.ts`
- Produces: `buildApp(): Promise<FastifyInstance>` de `src/app.ts`; `createTestApp(): Promise<FastifyInstance>` de `tests/helpers/app.ts`; alvos `start` e `dev`

- [ ] **Step 1: Escrever o teste que falha**

Criar `seed/tests/health.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from './helpers/app.js';

describe('health and error envelope', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports that the service is up', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('answers an unknown route with the error envelope', async () => {
    const response = await app.inject({ method: 'GET', url: '/nowhere' });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });

  it('puts a request id on every response', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.headers['x-request-id']).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd seed && npx vitest run tests/health.test.ts`
Expected: FAIL, `createTestApp` não existe.

- [ ] **Step 3: Criar `src/config.ts`**

```ts
export interface Config {
  port: number;
  logLevel: string;
  nodeEnv: string;
}

export function loadConfig(): Config {
  const port = Number(process.env.PORT ?? 3000);
  if (Number.isNaN(port)) {
    throw new Error('PORT must be a number');
  }
  return {
    port,
    logLevel: process.env.LOG_LEVEL ?? 'info',
    nodeEnv: process.env.NODE_ENV ?? 'development',
  };
}
```

- [ ] **Step 4: Criar `src/plugins/request-id.ts`**

```ts
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

export async function requestIdPlugin(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (request, reply) => {
    const incoming = request.headers['x-request-id'];
    const id = typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();
    reply.header('x-request-id', id);
  });
}
```

- [ ] **Step 5: Criar `src/plugins/error-handler.ts`**

Erros desconhecidos, inclusive violação de chave estrangeira do Prisma, saem como 500. Isso é deliberado e é um dos defeitos que T1 corrige.

```ts
import type { FastifyInstance } from 'fastify';
import { AppError, errorBody } from '../shared/errors.js';

export async function errorHandlerPlugin(app: FastifyInstance): Promise<void> {
  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send(errorBody('NOT_FOUND', 'Route not found'));
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      reply.code(error.statusCode).send(errorBody(error.code, error.message, error.details));
      return;
    }

    if (error.validation) {
      reply
        .code(400)
        .send(errorBody('VALIDATION_ERROR', 'Request payload is invalid', {
          issues: error.validation.map((issue) => issue.message ?? 'invalid'),
        }));
      return;
    }

    request.log.error({ err: error }, 'unhandled error');
    reply.code(500).send(errorBody('INTERNAL_ERROR', 'Unexpected error'));
  });
}
```

- [ ] **Step 6: Criar `src/plugins/register-modules.ts`**

Placeholder por ora; cada tarefa de módulo acrescenta o seu registro.

```ts
import type { FastifyInstance } from 'fastify';

export async function registerModules(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({ status: 'ok' }));
}
```

- [ ] **Step 7: Criar `src/app.ts` e `src/server.ts`**

`src/app.ts`:

```ts
import Fastify, { type FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { loadConfig } from './config.js';
import { errorHandlerPlugin } from './plugins/error-handler.js';
import { registerModules } from './plugins/register-modules.js';
import { requestIdPlugin } from './plugins/request-id.js';

export interface BuildOptions {
  logger?: boolean;
}

export async function buildApp(options: BuildOptions = {}): Promise<FastifyInstance> {
  const config = loadConfig();
  const app = Fastify({
    logger: options.logger === false ? false : { level: config.logLevel },
  }).withTypeProvider<TypeBoxTypeProvider>();

  await app.register(requestIdPlugin);
  await app.register(errorHandlerPlugin);
  await app.register(registerModules);

  return app;
}
```

`src/server.ts`:

```ts
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { disconnect } from './db/client.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp();

  const shutdown = async (): Promise<void> => {
    await app.close();
    await disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());

  await app.listen({ port: config.port, host: '0.0.0.0' });
}

void main();
```

- [ ] **Step 8: Acrescentar `createTestApp` a `tests/helpers/app.ts`**

Arquivo completo depois da mudança:

```ts
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/db/client.js';

export async function createTestApp(): Promise<FastifyInstance> {
  const app = await buildApp({ logger: false });
  await app.ready();
  return app;
}

export async function resetDb(): Promise<void> {
  await prisma.roomAmenity.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.amenity.deleteMany();
  await prisma.room.deleteMany();
  await prisma.user.deleteMany();
}
```

- [ ] **Step 9: Acrescentar `start` e `dev` ao `Makefile`**

```make
.PHONY: start dev

start: build
	@npm start

dev: setup
	@npm run dev
```

Acrescentar `start` e `dev` à lista `.PHONY` do topo.

- [ ] **Step 10: Rodar e confirmar que passa**

Run: `cd seed && make verify`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add seed
git commit -m "feat: add application bootstrap, plugins and health endpoint"
```

---

### Task 5: Módulo rooms, o padrão canônico

**Files:**
- Create: `seed/src/modules/rooms/schema.ts`, `seed/src/modules/rooms/repository.ts`, `seed/src/modules/rooms/service.ts`, `seed/src/modules/rooms/routes.ts`
- Modify: `seed/src/plugins/register-modules.ts`
- Test: `seed/tests/rooms.test.ts`

**Interfaces:**
- Consumes: `notFound`, `roomNameTaken` de `shared/errors.ts`; `normalizeLimit`, `normalizeOffset`, `paginated` de `shared/pagination.ts`
- Produces: `roomsRoutes: FastifyPluginAsyncTypebox`; o formato de quatro camadas que `users` e `bookings` repetem

Este módulo é a referência do padrão do projeto. Rotas validam e delegam, serviço tem a regra, repositório é o único que fala com o banco, schema declara requisição e resposta.

- [ ] **Step 1: Escrever o teste que falha**

Criar `seed/tests/rooms.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, resetDb } from './helpers/app.js';

describe('rooms', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb();
  });

  async function createRoom(name: string, capacity = 6) {
    return app.inject({ method: 'POST', url: '/rooms', payload: { name, capacity } });
  }

  it('creates a room', async () => {
    const response = await createRoom('Aurora');
    expect(response.statusCode).toBe(201);
    expect(response.json().name).toBe('Aurora');
  });

  it('rejects a payload without a name', async () => {
    const response = await app.inject({ method: 'POST', url: '/rooms', payload: { capacity: 4 } });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a duplicate name', async () => {
    await createRoom('Aurora');
    const response = await createRoom('Aurora');
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('ROOM_NAME_TAKEN');
  });

  it('reads a room back', async () => {
    const created = await createRoom('Borealis');
    const response = await app.inject({ method: 'GET', url: `/rooms/${created.json().id}` });
    expect(response.statusCode).toBe(200);
    expect(response.json().capacity).toBe(6);
  });

  it('answers 404 for a room that does not exist', async () => {
    const response = await app.inject({ method: 'GET', url: '/rooms/missing' });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });

  it('lists rooms inside the page envelope', async () => {
    await createRoom('Aurora');
    await createRoom('Borealis');
    const response = await app.inject({ method: 'GET', url: '/rooms' });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toHaveLength(2);
    expect(response.json().pagination).toEqual({ total: 2, limit: 20, offset: 0 });
  });

  it('honours limit and offset', async () => {
    await createRoom('Aurora');
    await createRoom('Borealis');
    await createRoom('Cirrus');
    const response = await app.inject({ method: 'GET', url: '/rooms?limit=1&offset=1' });
    expect(response.json().data).toHaveLength(1);
    expect(response.json().pagination.total).toBe(3);
  });

  it('filters by name', async () => {
    await createRoom('Aurora');
    await createRoom('Borealis');
    const response = await app.inject({ method: 'GET', url: '/rooms?name=Bore' });
    expect(response.json().data).toHaveLength(1);
  });

  it('updates a room', async () => {
    const created = await createRoom('Aurora');
    const response = await app.inject({
      method: 'PATCH',
      url: `/rooms/${created.json().id}`,
      payload: { capacity: 12 },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().capacity).toBe(12);
  });

  it('deletes a room', async () => {
    const created = await createRoom('Aurora');
    const id = created.json().id;
    const response = await app.inject({ method: 'DELETE', url: `/rooms/${id}` });
    expect(response.statusCode).toBe(204);
    const after = await app.inject({ method: 'GET', url: `/rooms/${id}` });
    expect(after.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd seed && npx vitest run tests/rooms.test.ts`
Expected: FAIL, todas as rotas respondem 404 de rota inexistente.

- [ ] **Step 3: Criar `src/modules/rooms/schema.ts`**

```ts
import { Type, type Static } from '@sinclair/typebox';

export const RoomResponse = Type.Object({
  id: Type.String(),
  name: Type.String(),
  capacity: Type.Integer(),
  floor: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const CreateRoomBody = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 120 }),
    capacity: Type.Integer({ minimum: 1, maximum: 1000 }),
    floor: Type.Optional(Type.String({ maxLength: 40 })),
  },
  { additionalProperties: false },
);

export const UpdateRoomBody = Type.Partial(CreateRoomBody);

export const RoomIdParams = Type.Object({ id: Type.String({ minLength: 1 }) });

export const ListRoomsQuery = Type.Object({
  name: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Integer({ minimum: 1 })),
  offset: Type.Optional(Type.Integer({ minimum: 0 })),
});

export const RoomPage = Type.Object({
  data: Type.Array(RoomResponse),
  pagination: Type.Object({
    total: Type.Integer(),
    limit: Type.Integer(),
    offset: Type.Integer(),
  }),
});

export type CreateRoomInput = Static<typeof CreateRoomBody>;
export type UpdateRoomInput = Static<typeof UpdateRoomBody>;
export type ListRoomsInput = Static<typeof ListRoomsQuery>;
```

- [ ] **Step 4: Criar `src/modules/rooms/repository.ts`**

```ts
import type { Room } from '@prisma/client';
import { prisma } from '../../db/client.js';
import type { CreateRoomInput, UpdateRoomInput } from './schema.js';

export interface RoomFilter {
  name?: string;
  limit: number;
  offset: number;
}

export function create(input: CreateRoomInput): Promise<Room> {
  return prisma.room.create({ data: input });
}

export function findById(id: string): Promise<Room | null> {
  return prisma.room.findUnique({ where: { id } });
}

export function findByName(name: string): Promise<Room | null> {
  return prisma.room.findUnique({ where: { name } });
}

export function list(filter: RoomFilter): Promise<[Room[], number]> {
  const where = filter.name ? { name: { contains: filter.name } } : {};
  return prisma.$transaction([
    prisma.room.findMany({
      where,
      take: filter.limit,
      skip: filter.offset,
      orderBy: { name: 'asc' },
    }),
    prisma.room.count({ where }),
  ]);
}

export function update(id: string, input: UpdateRoomInput): Promise<Room> {
  return prisma.room.update({ where: { id }, data: input });
}

export function remove(id: string): Promise<Room> {
  return prisma.room.delete({ where: { id } });
}
```

- [ ] **Step 5: Criar `src/modules/rooms/service.ts`**

```ts
import type { Room } from '@prisma/client';
import { notFound, roomNameTaken } from '../../shared/errors.js';
import {
  normalizeLimit,
  normalizeOffset,
  paginated,
  type Page,
} from '../../shared/pagination.js';
import * as repository from './repository.js';
import type { CreateRoomInput, ListRoomsInput, UpdateRoomInput } from './schema.js';

export async function createRoom(input: CreateRoomInput): Promise<Room> {
  const existing = await repository.findByName(input.name);
  if (existing) {
    throw roomNameTaken(input.name);
  }
  return repository.create(input);
}

export async function getRoom(id: string): Promise<Room> {
  const room = await repository.findById(id);
  if (!room) {
    throw notFound('Room');
  }
  return room;
}

export async function listRooms(query: ListRoomsInput): Promise<Page<Room>> {
  const limit = normalizeLimit(query.limit);
  const offset = normalizeOffset(query.offset);
  const [data, total] = await repository.list({ name: query.name, limit, offset });
  return paginated(data, total, limit, offset);
}

export async function updateRoom(id: string, input: UpdateRoomInput): Promise<Room> {
  await getRoom(id);
  if (input.name !== undefined) {
    const existing = await repository.findByName(input.name);
    if (existing && existing.id !== id) {
      throw roomNameTaken(input.name);
    }
  }
  return repository.update(id, input);
}

export async function deleteRoom(id: string): Promise<void> {
  await getRoom(id);
  await repository.remove(id);
}
```

- [ ] **Step 6: Criar `src/modules/rooms/routes.ts`**

```ts
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  CreateRoomBody,
  ListRoomsQuery,
  RoomIdParams,
  RoomPage,
  RoomResponse,
  UpdateRoomBody,
} from './schema.js';
import * as service from './service.js';

export const roomsRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.post('/', { schema: { body: CreateRoomBody, response: { 201: RoomResponse } } },
    async (request, reply) => reply.code(201).send(await service.createRoom(request.body)));

  app.get('/', { schema: { querystring: ListRoomsQuery, response: { 200: RoomPage } } },
    async (request) => service.listRooms(request.query));

  app.get('/:id', { schema: { params: RoomIdParams, response: { 200: RoomResponse } } },
    async (request) => service.getRoom(request.params.id));

  app.patch('/:id',
    { schema: { params: RoomIdParams, body: UpdateRoomBody, response: { 200: RoomResponse } } },
    async (request) => service.updateRoom(request.params.id, request.body));

  app.delete('/:id', { schema: { params: RoomIdParams } }, async (request, reply) => {
    await service.deleteRoom(request.params.id);
    return reply.code(204).send();
  });
};
```

- [ ] **Step 7: Substituir `src/plugins/register-modules.ts`**

Arquivo completo:

```ts
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { roomsRoutes } from '../modules/rooms/routes.js';

export const registerModules: FastifyPluginAsyncTypebox = async (app) => {
  app.get('/health', async () => ({ status: 'ok' }));
  await app.register(roomsRoutes, { prefix: '/rooms' });
};
```

- [ ] **Step 8: Rodar e confirmar que passa**

Run: `cd seed && make verify`
Expected: PASS, com os dez testes de salas verdes.

- [ ] **Step 9: Commit**

```bash
git add seed
git commit -m "feat: add rooms module"
```

---

### Task 6: Módulo users, com as duas imperfeições nomeadas

**Files:**
- Create: `seed/src/modules/users/schema.ts`, `seed/src/modules/users/repository.ts`, `seed/src/modules/users/service.ts`, `seed/src/modules/users/routes.ts`
- Modify: `seed/src/plugins/register-modules.ts`
- Test: `seed/tests/users.test.ts`

**Interfaces:**
- Consumes: `notFound`, `emailTaken`, `validationFailed` de `shared/errors.ts`; auxiliares de paginação
- Produces: `usersRoutes: FastifyPluginAsyncTypebox`

**As duas imperfeições são deliberadas e são exatamente estas, nenhuma além:**

1. `assertValidEmail` no serviço repete uma validação que o schema já faz.
2. `MAX_NAME_LENGTH` é literal no serviço em vez de vir da configuração, e o schema já impõe o mesmo limite.

Ambas são redundantes por construção, então **nenhuma delas recusa sozinha um pedido**, o que preserva a regra do falso negativo. As camadas permanecem intactas: o serviço nunca fala com o banco.

- [ ] **Step 1: Escrever o teste que falha**

Criar `seed/tests/users.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, resetDb } from './helpers/app.js';

describe('users', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb();
  });

  async function createUser(email: string, name = 'Ada Lovelace') {
    return app.inject({ method: 'POST', url: '/users', payload: { name, email } });
  }

  it('creates a user', async () => {
    const response = await createUser('ada@example.com');
    expect(response.statusCode).toBe(201);
    expect(response.json().email).toBe('ada@example.com');
  });

  it('rejects a malformed email', async () => {
    const response = await createUser('not-an-email');
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a duplicate email', async () => {
    await createUser('ada@example.com');
    const response = await createUser('ada@example.com');
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('EMAIL_TAKEN');
  });

  it('answers 404 for a user that does not exist', async () => {
    const response = await app.inject({ method: 'GET', url: '/users/missing' });
    expect(response.statusCode).toBe(404);
  });

  it('lists users inside the page envelope', async () => {
    await createUser('ada@example.com');
    await createUser('grace@example.com', 'Grace Hopper');
    const response = await app.inject({ method: 'GET', url: '/users' });
    expect(response.json().data).toHaveLength(2);
    expect(response.json().pagination.total).toBe(2);
  });

  it('filters by email', async () => {
    await createUser('ada@example.com');
    await createUser('grace@example.com', 'Grace Hopper');
    const response = await app.inject({ method: 'GET', url: '/users?email=grace' });
    expect(response.json().data).toHaveLength(1);
  });

  it('updates a user', async () => {
    const created = await createUser('ada@example.com');
    const response = await app.inject({
      method: 'PATCH',
      url: `/users/${created.json().id}`,
      payload: { name: 'Ada B. Lovelace' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().name).toBe('Ada B. Lovelace');
  });

  it('deletes a user', async () => {
    const created = await createUser('ada@example.com');
    const id = created.json().id;
    expect((await app.inject({ method: 'DELETE', url: `/users/${id}` })).statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: `/users/${id}` })).statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd seed && npx vitest run tests/users.test.ts`
Expected: FAIL, rotas inexistentes.

- [ ] **Step 3: Criar `src/modules/users/schema.ts`**

O padrão de e-mail evita depender de uma biblioteca de formatos.

```ts
import { Type, type Static } from '@sinclair/typebox';

export const EMAIL_PATTERN = '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$';

export const UserResponse = Type.Object({
  id: Type.String(),
  name: Type.String(),
  email: Type.String(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const CreateUserBody = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 120 }),
    email: Type.String({ minLength: 3, maxLength: 160, pattern: EMAIL_PATTERN }),
  },
  { additionalProperties: false },
);

export const UpdateUserBody = Type.Partial(CreateUserBody);

export const UserIdParams = Type.Object({ id: Type.String({ minLength: 1 }) });

export const ListUsersQuery = Type.Object({
  email: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Integer({ minimum: 1 })),
  offset: Type.Optional(Type.Integer({ minimum: 0 })),
});

export const UserPage = Type.Object({
  data: Type.Array(UserResponse),
  pagination: Type.Object({
    total: Type.Integer(),
    limit: Type.Integer(),
    offset: Type.Integer(),
  }),
});

export type CreateUserInput = Static<typeof CreateUserBody>;
export type UpdateUserInput = Static<typeof UpdateUserBody>;
export type ListUsersInput = Static<typeof ListUsersQuery>;
```

- [ ] **Step 4: Criar `src/modules/users/repository.ts`**

```ts
import type { User } from '@prisma/client';
import { prisma } from '../../db/client.js';
import type { CreateUserInput, UpdateUserInput } from './schema.js';

export interface UserFilter {
  email?: string;
  limit: number;
  offset: number;
}

export function create(input: CreateUserInput): Promise<User> {
  return prisma.user.create({ data: input });
}

export function findById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

export function findByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
}

export function list(filter: UserFilter): Promise<[User[], number]> {
  const where = filter.email ? { email: { contains: filter.email } } : {};
  return prisma.$transaction([
    prisma.user.findMany({
      where,
      take: filter.limit,
      skip: filter.offset,
      orderBy: { name: 'asc' },
    }),
    prisma.user.count({ where }),
  ]);
}

export function update(id: string, input: UpdateUserInput): Promise<User> {
  return prisma.user.update({ where: { id }, data: input });
}

export function remove(id: string): Promise<User> {
  return prisma.user.delete({ where: { id } });
}
```

- [ ] **Step 5: Criar `src/modules/users/service.ts`**

As duas imperfeições estão aqui e em nenhum outro lugar do projeto.

```ts
import type { User } from '@prisma/client';
import { emailTaken, notFound, validationFailed } from '../../shared/errors.js';
import {
  normalizeLimit,
  normalizeOffset,
  paginated,
  type Page,
} from '../../shared/pagination.js';
import * as repository from './repository.js';
import type { CreateUserInput, ListUsersInput, UpdateUserInput } from './schema.js';

const MAX_NAME_LENGTH = 120;

function assertValidEmail(email: string): void {
  if (!email.includes('@') || !email.includes('.')) {
    throw validationFailed('Email is not valid', { email });
  }
}

function assertValidName(name: string): void {
  if (name.length > MAX_NAME_LENGTH) {
    throw validationFailed('Name is too long', { maxLength: MAX_NAME_LENGTH });
  }
}

export async function createUser(input: CreateUserInput): Promise<User> {
  assertValidEmail(input.email);
  assertValidName(input.name);
  const existing = await repository.findByEmail(input.email);
  if (existing) {
    throw emailTaken(input.email);
  }
  return repository.create(input);
}

export async function getUser(id: string): Promise<User> {
  const user = await repository.findById(id);
  if (!user) {
    throw notFound('User');
  }
  return user;
}

export async function listUsers(query: ListUsersInput): Promise<Page<User>> {
  const limit = normalizeLimit(query.limit);
  const offset = normalizeOffset(query.offset);
  const [data, total] = await repository.list({ email: query.email, limit, offset });
  return paginated(data, total, limit, offset);
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  await getUser(id);
  if (input.email !== undefined) {
    assertValidEmail(input.email);
    const existing = await repository.findByEmail(input.email);
    if (existing && existing.id !== id) {
      throw emailTaken(input.email);
    }
  }
  if (input.name !== undefined) {
    assertValidName(input.name);
  }
  return repository.update(id, input);
}

export async function deleteUser(id: string): Promise<void> {
  await getUser(id);
  await repository.remove(id);
}
```

- [ ] **Step 6: Criar `src/modules/users/routes.ts`**

```ts
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  CreateUserBody,
  ListUsersQuery,
  UpdateUserBody,
  UserIdParams,
  UserPage,
  UserResponse,
} from './schema.js';
import * as service from './service.js';

export const usersRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.post('/', { schema: { body: CreateUserBody, response: { 201: UserResponse } } },
    async (request, reply) => reply.code(201).send(await service.createUser(request.body)));

  app.get('/', { schema: { querystring: ListUsersQuery, response: { 200: UserPage } } },
    async (request) => service.listUsers(request.query));

  app.get('/:id', { schema: { params: UserIdParams, response: { 200: UserResponse } } },
    async (request) => service.getUser(request.params.id));

  app.patch('/:id',
    { schema: { params: UserIdParams, body: UpdateUserBody, response: { 200: UserResponse } } },
    async (request) => service.updateUser(request.params.id, request.body));

  app.delete('/:id', { schema: { params: UserIdParams } }, async (request, reply) => {
    await service.deleteUser(request.params.id);
    return reply.code(204).send();
  });
};
```

- [ ] **Step 7: Substituir `src/plugins/register-modules.ts`**

Arquivo completo:

```ts
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { roomsRoutes } from '../modules/rooms/routes.js';
import { usersRoutes } from '../modules/users/routes.js';

export const registerModules: FastifyPluginAsyncTypebox = async (app) => {
  app.get('/health', async () => ({ status: 'ok' }));
  await app.register(roomsRoutes, { prefix: '/rooms' });
  await app.register(usersRoutes, { prefix: '/users' });
};
```

- [ ] **Step 8: Rodar e confirmar que passa**

Run: `cd seed && make verify`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add seed
git commit -m "feat: add users module"
```

---

### Task 7: Módulo bookings sem checagem de conflito

**Files:**
- Create: `seed/src/modules/bookings/schema.ts`, `seed/src/modules/bookings/repository.ts`, `seed/src/modules/bookings/service.ts`, `seed/src/modules/bookings/routes.ts`
- Modify: `seed/src/plugins/register-modules.ts`
- Test: `seed/tests/bookings.test.ts`

**Interfaces:**
- Consumes: `notFound` de `shared/errors.ts`; `parseInstant` de `shared/time.ts`; auxiliares de paginação
- Produces: `bookingsRoutes: FastifyPluginAsyncTypebox`; `repository.findConflictAtStart` entra só na Task 8

**Nesta tarefa não existe nenhuma validação de conflito, de passado, de duração ou de existência de sala e usuário.** A checagem parcial entra na Task 8. Referência a sala ou usuário inexistente estoura na chave estrangeira e sai como 500 pelo tratador global, o que é o defeito deliberado da spec seção 5.2.

- [ ] **Step 1: Escrever o teste que falha**

Criar `seed/tests/bookings.test.ts`. **Todo instante é derivado de `Date.now()`, nunca absoluto.**

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, resetDb } from './helpers/app.js';

const HOUR = 3_600_000;

function inHours(hours: number): string {
  return new Date(Date.now() + hours * HOUR).toISOString();
}

describe('bookings', () => {
  let app: FastifyInstance;
  let roomId: string;
  let userId: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb();
    const room = await app.inject({
      method: 'POST',
      url: '/rooms',
      payload: { name: 'Aurora', capacity: 6 },
    });
    roomId = room.json().id;
    const user = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 'Ada Lovelace', email: 'ada@example.com' },
    });
    userId = user.json().id;
  });

  async function book(startHours: number, endHours: number, title = 'Sync') {
    return app.inject({
      method: 'POST',
      url: '/bookings',
      payload: { roomId, userId, title, startsAt: inHours(startHours), endsAt: inHours(endHours) },
    });
  }

  it('creates a booking', async () => {
    const response = await book(24, 25);
    expect(response.statusCode).toBe(201);
    expect(response.json().status).toBe('ACTIVE');
  });

  it('rejects a payload without a title', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/bookings',
      payload: { roomId, userId, startsAt: inHours(24), endsAt: inHours(25) },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an instant that cannot be parsed', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/bookings',
      payload: { roomId, userId, title: 'Sync', startsAt: 'yesterday', endsAt: inHours(25) },
    });
    expect(response.statusCode).toBe(400);
  });

  it('reads a booking back', async () => {
    const created = await book(24, 25);
    const response = await app.inject({ method: 'GET', url: `/bookings/${created.json().id}` });
    expect(response.statusCode).toBe(200);
    expect(response.json().title).toBe('Sync');
  });

  it('answers 404 for a booking that does not exist', async () => {
    const response = await app.inject({ method: 'GET', url: '/bookings/missing' });
    expect(response.statusCode).toBe(404);
  });

  it('lists bookings inside the page envelope', async () => {
    await book(24, 25);
    await book(30, 31, 'Retro');
    const response = await app.inject({ method: 'GET', url: '/bookings' });
    expect(response.json().data).toHaveLength(2);
    expect(response.json().pagination.total).toBe(2);
  });

  it('filters bookings by room', async () => {
    await book(24, 25);
    const other = await app.inject({
      method: 'POST',
      url: '/rooms',
      payload: { name: 'Borealis', capacity: 4 },
    });
    await app.inject({
      method: 'POST',
      url: '/bookings',
      payload: {
        roomId: other.json().id,
        userId,
        title: 'Elsewhere',
        startsAt: inHours(24),
        endsAt: inHours(25),
      },
    });
    const response = await app.inject({ method: 'GET', url: `/bookings?roomId=${roomId}` });
    expect(response.json().data).toHaveLength(1);
  });

  it('updates the title of a booking', async () => {
    const created = await book(24, 25);
    const response = await app.inject({
      method: 'PATCH',
      url: `/bookings/${created.json().id}`,
      payload: { title: 'Renamed' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().title).toBe('Renamed');
  });

  it('cancels a booking', async () => {
    const created = await book(24, 25);
    const response = await app.inject({
      method: 'POST',
      url: `/bookings/${created.json().id}/cancel`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('CANCELLED');
  });

  it('cancelling twice is idempotent', async () => {
    const created = await book(24, 25);
    const url = `/bookings/${created.json().id}/cancel`;
    await app.inject({ method: 'POST', url });
    const response = await app.inject({ method: 'POST', url });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('CANCELLED');
  });

  it('deletes a booking', async () => {
    const created = await book(24, 25);
    const id = created.json().id;
    expect((await app.inject({ method: 'DELETE', url: `/bookings/${id}` })).statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: `/bookings/${id}` })).statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd seed && npx vitest run tests/bookings.test.ts`
Expected: FAIL, rotas inexistentes.

- [ ] **Step 3: Criar `src/modules/bookings/schema.ts`**

`startsAt` e `endsAt` são texto simples, não instante validado por formato. A conversão fica no serviço, via `parseInstant`.

```ts
import { Type, type Static } from '@sinclair/typebox';

export const BOOKING_ACTIVE = 'ACTIVE';
export const BOOKING_CANCELLED = 'CANCELLED';

export const BookingResponse = Type.Object({
  id: Type.String(),
  roomId: Type.String(),
  userId: Type.String(),
  title: Type.String(),
  startsAt: Type.String(),
  endsAt: Type.String(),
  status: Type.String(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const CreateBookingBody = Type.Object(
  {
    roomId: Type.String({ minLength: 1 }),
    userId: Type.String({ minLength: 1 }),
    title: Type.String({ minLength: 1, maxLength: 200 }),
    startsAt: Type.String({ minLength: 1 }),
    endsAt: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const UpdateBookingBody = Type.Partial(CreateBookingBody);

export const BookingIdParams = Type.Object({ id: Type.String({ minLength: 1 }) });

export const ListBookingsQuery = Type.Object({
  roomId: Type.Optional(Type.String()),
  userId: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
  from: Type.Optional(Type.String()),
  to: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Integer({ minimum: 1 })),
  offset: Type.Optional(Type.Integer({ minimum: 0 })),
});

export const BookingPage = Type.Object({
  data: Type.Array(BookingResponse),
  pagination: Type.Object({
    total: Type.Integer(),
    limit: Type.Integer(),
    offset: Type.Integer(),
  }),
});

export type CreateBookingInput = Static<typeof CreateBookingBody>;
export type UpdateBookingInput = Static<typeof UpdateBookingBody>;
export type ListBookingsInput = Static<typeof ListBookingsQuery>;
```

- [ ] **Step 4: Criar `src/modules/bookings/repository.ts`**

```ts
import type { Booking, Prisma } from '@prisma/client';
import { prisma } from '../../db/client.js';

export interface BookingData {
  roomId: string;
  userId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
}

export interface BookingFilter {
  roomId?: string;
  userId?: string;
  status?: string;
  from?: Date;
  to?: Date;
  limit: number;
  offset: number;
}

export function create(data: BookingData): Promise<Booking> {
  return prisma.booking.create({ data });
}

export function findById(id: string): Promise<Booking | null> {
  return prisma.booking.findUnique({ where: { id } });
}

export function list(filter: BookingFilter): Promise<[Booking[], number]> {
  const where: Prisma.BookingWhereInput = {};
  if (filter.roomId) where.roomId = filter.roomId;
  if (filter.userId) where.userId = filter.userId;
  if (filter.status) where.status = filter.status;
  if (filter.from) where.startsAt = { gte: filter.from };
  if (filter.to) where.endsAt = { lte: filter.to };

  return prisma.$transaction([
    prisma.booking.findMany({
      where,
      take: filter.limit,
      skip: filter.offset,
      orderBy: { startsAt: 'asc' },
    }),
    prisma.booking.count({ where }),
  ]);
}

export function update(id: string, data: Partial<BookingData>): Promise<Booking> {
  return prisma.booking.update({ where: { id }, data });
}

export function updateStatus(id: string, status: string): Promise<Booking> {
  return prisma.booking.update({ where: { id }, data: { status } });
}

export function remove(id: string): Promise<Booking> {
  return prisma.booking.delete({ where: { id } });
}
```

- [ ] **Step 5: Criar `src/modules/bookings/service.ts`**

```ts
import type { Booking } from '@prisma/client';
import { notFound } from '../../shared/errors.js';
import {
  normalizeLimit,
  normalizeOffset,
  paginated,
  type Page,
} from '../../shared/pagination.js';
import { parseInstant } from '../../shared/time.js';
import * as repository from './repository.js';
import { BOOKING_CANCELLED } from './schema.js';
import type { CreateBookingInput, ListBookingsInput, UpdateBookingInput } from './schema.js';

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const startsAt = parseInstant(input.startsAt);
  const endsAt = parseInstant(input.endsAt);
  return repository.create({
    roomId: input.roomId,
    userId: input.userId,
    title: input.title,
    startsAt,
    endsAt,
  });
}

export async function getBooking(id: string): Promise<Booking> {
  const booking = await repository.findById(id);
  if (!booking) {
    throw notFound('Booking');
  }
  return booking;
}

export async function listBookings(query: ListBookingsInput): Promise<Page<Booking>> {
  const limit = normalizeLimit(query.limit);
  const offset = normalizeOffset(query.offset);
  const [data, total] = await repository.list({
    roomId: query.roomId,
    userId: query.userId,
    status: query.status,
    from: query.from ? parseInstant(query.from) : undefined,
    to: query.to ? parseInstant(query.to) : undefined,
    limit,
    offset,
  });
  return paginated(data, total, limit, offset);
}

export async function updateBooking(id: string, input: UpdateBookingInput): Promise<Booking> {
  await getBooking(id);
  return repository.update(id, {
    ...(input.roomId !== undefined ? { roomId: input.roomId } : {}),
    ...(input.userId !== undefined ? { userId: input.userId } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.startsAt !== undefined ? { startsAt: parseInstant(input.startsAt) } : {}),
    ...(input.endsAt !== undefined ? { endsAt: parseInstant(input.endsAt) } : {}),
  });
}

export async function cancelBooking(id: string): Promise<Booking> {
  const booking = await getBooking(id);
  if (booking.status === BOOKING_CANCELLED) {
    return booking;
  }
  return repository.updateStatus(id, BOOKING_CANCELLED);
}

export async function deleteBooking(id: string): Promise<void> {
  await getBooking(id);
  await repository.remove(id);
}
```

- [ ] **Step 6: Criar `src/modules/bookings/routes.ts`**

```ts
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  BookingIdParams,
  BookingPage,
  BookingResponse,
  CreateBookingBody,
  ListBookingsQuery,
  UpdateBookingBody,
} from './schema.js';
import * as service from './service.js';

export const bookingsRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.post('/', { schema: { body: CreateBookingBody, response: { 201: BookingResponse } } },
    async (request, reply) => reply.code(201).send(await service.createBooking(request.body)));

  app.get('/', { schema: { querystring: ListBookingsQuery, response: { 200: BookingPage } } },
    async (request) => service.listBookings(request.query));

  app.get('/:id', { schema: { params: BookingIdParams, response: { 200: BookingResponse } } },
    async (request) => service.getBooking(request.params.id));

  app.patch('/:id',
    { schema: { params: BookingIdParams, body: UpdateBookingBody, response: { 200: BookingResponse } } },
    async (request) => service.updateBooking(request.params.id, request.body));

  app.post('/:id/cancel',
    { schema: { params: BookingIdParams, response: { 200: BookingResponse } } },
    async (request) => service.cancelBooking(request.params.id));

  app.delete('/:id', { schema: { params: BookingIdParams } }, async (request, reply) => {
    await service.deleteBooking(request.params.id);
    return reply.code(204).send();
  });
};
```

- [ ] **Step 7: Substituir `src/plugins/register-modules.ts`**

Arquivo completo:

```ts
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { bookingsRoutes } from '../modules/bookings/routes.js';
import { roomsRoutes } from '../modules/rooms/routes.js';
import { usersRoutes } from '../modules/users/routes.js';

export const registerModules: FastifyPluginAsyncTypebox = async (app) => {
  app.get('/health', async () => ({ status: 'ok' }));
  await app.register(roomsRoutes, { prefix: '/rooms' });
  await app.register(usersRoutes, { prefix: '/users' });
  await app.register(bookingsRoutes, { prefix: '/bookings' });
};
```

- [ ] **Step 8: Rodar e confirmar que passa**

Run: `cd seed && make verify`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add seed
git commit -m "feat: add bookings module"
```

---

### Task 8: Checagem de conflito parcial e verificação dos falsos negativos

**Files:**
- Modify: `seed/src/modules/bookings/repository.ts`, `seed/src/modules/bookings/service.ts`, `seed/tests/bookings.test.ts`
- Create (fora da semente): `tools/seed-audit/false-negatives.mjs`, `tools/seed-audit/README.md`

**Interfaces:**
- Consumes: `bookingConflict` de `shared/errors.ts`
- Produces: `repository.findConflictAtStart(roomId: string, startsAt: Date): Promise<Booking | null>`

Esta é a tarefa mais sensível do plano. A checagem detecta **um** dos quatro casos de sobreposição e deixa os outros dois passarem. A borda é estrita e reservas canceladas são ignoradas, e isso não é generosidade: é a regra do falso negativo, que impede o ticket de T2 de ser explicado por um defeito da semente.

A suíte da semente só pode afirmar o que continua verdadeiro depois de T1. As afirmações sobre os falsos negativos vivem em `tools/seed-audit/`, fora da árvore, e nunca são copiadas para dentro de uma sessão.

- [ ] **Step 1: Escrever os testes que falham, na suíte da semente**

Acrescentar ao final de `seed/tests/bookings.test.ts`, dentro do mesmo `describe`, antes do fechamento:

```ts
  it('rejects a booking whose start falls inside an active booking', async () => {
    await book(24, 25);
    const response = await book(24.5, 25.5, 'Overlap');
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('BOOKING_CONFLICT');
  });

  it('rejects a booking fully contained in an active booking', async () => {
    await book(24, 25);
    const response = await book(24.25, 24.75, 'Inside');
    expect(response.statusCode).toBe(409);
  });

  it('accepts a booking that starts exactly when another ends', async () => {
    await book(24, 25);
    const response = await book(25, 26, 'Adjacent');
    expect(response.statusCode).toBe(201);
  });

  it('accepts a booking in a slot released by a cancellation', async () => {
    const first = await book(24, 25);
    await app.inject({ method: 'POST', url: `/bookings/${first.json().id}/cancel` });
    const response = await book(24.5, 25.5, 'Reused slot');
    expect(response.statusCode).toBe(201);
  });

  it('reports which booking caused the conflict', async () => {
    const first = await book(24, 25);
    const response = await book(24.5, 25.5, 'Overlap');
    expect(response.json().error.details.conflictingBookingId).toBe(first.json().id);
  });
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd seed && npx vitest run tests/bookings.test.ts`
Expected: FAIL nos cinco testes novos. Os dois primeiros esperam 409 e recebem 201.

- [ ] **Step 3: Acrescentar a consulta ao repositório**

Acrescentar a `seed/src/modules/bookings/repository.ts`, depois de `create`:

```ts
export function findConflictAtStart(roomId: string, startsAt: Date): Promise<Booking | null> {
  return prisma.booking.findFirst({
    where: {
      roomId,
      status: BOOKING_ACTIVE,
      startsAt: { lte: startsAt },
      endsAt: { gt: startsAt },
    },
  });
}
```

E acrescentar o import no topo do arquivo:

```ts
import { BOOKING_ACTIVE } from './schema.js';
```

- [ ] **Step 4: Chamar a consulta na criação**

Em `seed/src/modules/bookings/service.ts`, substituir `createBooking` por:

```ts
export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const startsAt = parseInstant(input.startsAt);
  const endsAt = parseInstant(input.endsAt);

  const conflict = await repository.findConflictAtStart(input.roomId, startsAt);
  if (conflict) {
    throw bookingConflict(conflict.id);
  }

  return repository.create({
    roomId: input.roomId,
    userId: input.userId,
    title: input.title,
    startsAt,
    endsAt,
  });
}
```

E ajustar o import de erros no topo do arquivo:

```ts
import { bookingConflict, notFound } from '../../shared/errors.js';
```

**Não tocar em `updateBooking`.** A ausência de checagem na atualização é deliberada.

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `cd seed && make verify`
Expected: PASS, com os cinco testes novos verdes.

- [ ] **Step 6: Criar o verificador dos falsos negativos, fora da semente**

Criar `tools/seed-audit/false-negatives.mjs`. Roda contra um servidor já no ar e usa apenas a biblioteca padrão do Node.

```js
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const HOUR = 3_600_000;

const at = (hours) => new Date(Date.now() + hours * HOUR).toISOString();

async function call(method, path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

const unique = () => Math.random().toString(36).slice(2, 10);

async function fixture() {
  const room = await call('POST', '/rooms', { name: `Room-${unique()}`, capacity: 6 });
  const user = await call('POST', '/users', {
    name: 'Audit',
    email: `audit-${unique()}@example.com`,
  });
  return { roomId: room.body.id, userId: user.body.id };
}

const book = (ids, from, to) =>
  call('POST', '/bookings', {
    roomId: ids.roomId,
    userId: ids.userId,
    title: 'Audit',
    startsAt: at(from),
    endsAt: at(to),
  });

const checks = [
  ['end falls inside an existing booking and start is before it', async () => {
    const ids = await fixture();
    await book(ids, 24, 25);
    assert.equal((await book(ids, 23.5, 24.5)).status, 201);
  }],
  ['new booking engulfs an existing one', async () => {
    const ids = await fixture();
    await book(ids, 24, 25);
    assert.equal((await book(ids, 23, 26)).status, 201);
  }],
  ['update moves a booking on top of another', async () => {
    const ids = await fixture();
    await book(ids, 24, 25);
    const moved = await book(ids, 30, 31);
    const response = await call('PATCH', `/bookings/${moved.body.id}`, {
      startsAt: at(24.25),
      endsAt: at(24.75),
    });
    assert.equal(response.status, 200);
  }],
  ['booking that starts in the past', async () => {
    const ids = await fixture();
    assert.equal((await book(ids, -48, -47)).status, 201);
  }],
  ['booking shorter than thirty minutes', async () => {
    const ids = await fixture();
    assert.equal((await book(ids, 24, 24.1)).status, 201);
  }],
  ['booking longer than eight hours', async () => {
    const ids = await fixture();
    assert.equal((await book(ids, 24, 34)).status, 201);
  }],
  ['booking whose end is before its start', async () => {
    const ids = await fixture();
    assert.equal((await book(ids, 25, 24)).status, 201);
  }],
  ['booking that points at a room that does not exist', async () => {
    const ids = await fixture();
    const response = await call('POST', '/bookings', {
      roomId: 'missing-room',
      userId: ids.userId,
      title: 'Audit',
      startsAt: at(24),
      endsAt: at(25),
    });
    assert.equal(response.status, 500);
  }],
];

let failed = 0;
for (const [name, run] of checks) {
  try {
    await run();
    console.log(`ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL ${name}: ${error.message}`);
  }
}

console.log(failed === 0 ? '\nall expected gaps are present' : `\n${failed} expected gaps missing`);
process.exit(failed === 0 ? 0 : 1);
```

- [ ] **Step 7: Criar `tools/seed-audit/README.md`**

````markdown
# seed-audit

Verificações de aceite executadas contra o repositório-semente antes do congelamento.
Nada aqui pode ser copiado para dentro de `seed/`.

## false-negatives.mjs

Confirma que os defeitos deliberados da semente continuam presentes. Cada verificação
afirma que um pedido que o contrato de T1 recusaria é aceito pela semente. Essas
afirmações são proibidas na suíte da própria semente, porque T1 as torna falsas e elas
produziriam regressão falsa em toda sessão.

```bash
cd seed && make db-reset && make start &
# aguarde GET /health responder 200
node tools/seed-audit/false-negatives.mjs
```
````

- [ ] **Step 8: Rodar o verificador**

```bash
cd seed && make db-reset && (make start &) && sleep 5
curl -fsS http://localhost:3000/health
node ../tools/seed-audit/false-negatives.mjs
```

Expected: as oito verificações passam, e a última linha diz que todas as lacunas esperadas estão presentes. Encerrar o servidor depois.

- [ ] **Step 9: Commit**

```bash
git add seed tools
git commit -m "feat: reject a booking whose start falls inside an active booking"
```

---

### Task 9: Módulo amenities, deliberadamente fora do padrão

**Files:**
- Create: `seed/src/modules/amenities/queries.ts`, `seed/src/modules/amenities/routes.ts`
- Modify: `seed/src/shared/errors.ts`, `seed/src/plugins/register-modules.ts`
- Test: `seed/tests/amenities.test.ts`

**Interfaces:**
- Consumes: `replyNotFound`, `replyConflict` de `shared/http-reply.ts`
- Produces: `amenitiesRoutes: FastifyPluginAsyncTypebox`, registrado **sem prefixo**

**Os quatro desvios deste módulo são deliberados e formam o orçamento de desvio inteiro da semente:**

1. Dois arquivos em vez de quatro. Sem separação em serviço e repositório.
2. A listagem devolve array puro, sem o envelope de paginação.
3. É o único módulo que responde erro por `http-reply.ts` em vez de lançar `AppError`.
4. Registra rotas sob o caminho de salas, e não apenas sob o próprio.

**Nenhum comentário pode explicar que este módulo foge do padrão.** Se explicasse, entregaria de graça o que o arquivo de contexto deveria acrescentar.

- [ ] **Step 1: Escrever o teste que falha**

Criar `seed/tests/amenities.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, resetDb } from './helpers/app.js';

describe('amenities', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb();
  });

  async function createAmenity(name: string) {
    return app.inject({ method: 'POST', url: '/amenities', payload: { name } });
  }

  async function createRoom(name: string) {
    return app.inject({ method: 'POST', url: '/rooms', payload: { name, capacity: 6 } });
  }

  it('creates an amenity', async () => {
    const response = await createAmenity('Projector');
    expect(response.statusCode).toBe(201);
    expect(response.json().name).toBe('Projector');
  });

  it('rejects a duplicate amenity name', async () => {
    await createAmenity('Projector');
    const response = await createAmenity('Projector');
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('AMENITY_NAME_TAKEN');
  });

  it('returns a bare array when listing', async () => {
    await createAmenity('Projector');
    await createAmenity('Whiteboard');
    const response = await app.inject({ method: 'GET', url: '/amenities' });
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.json())).toBe(true);
    expect(response.json()).toHaveLength(2);
  });

  it('links an amenity to a room', async () => {
    const room = await createRoom('Aurora');
    const amenity = await createAmenity('Projector');
    const response = await app.inject({
      method: 'PUT',
      url: `/rooms/${room.json().id}/amenities/${amenity.json().id}`,
    });
    expect(response.statusCode).toBe(204);
  });

  it('unlinks an amenity from a room', async () => {
    const room = await createRoom('Aurora');
    const amenity = await createAmenity('Projector');
    const path = `/rooms/${room.json().id}/amenities/${amenity.json().id}`;
    await app.inject({ method: 'PUT', url: path });
    const response = await app.inject({ method: 'DELETE', url: path });
    expect(response.statusCode).toBe(204);
  });

  it('answers 404 when linking to a room that does not exist', async () => {
    const amenity = await createAmenity('Projector');
    const response = await app.inject({
      method: 'PUT',
      url: `/rooms/missing/amenities/${amenity.json().id}`,
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });

  it('deletes an amenity', async () => {
    const amenity = await createAmenity('Projector');
    const response = await app.inject({
      method: 'DELETE',
      url: `/amenities/${amenity.json().id}`,
    });
    expect(response.statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: '/amenities' })).json()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd seed && npx vitest run tests/amenities.test.ts`
Expected: FAIL, rotas inexistentes.

- [ ] **Step 3: Acrescentar o código de erro em `src/shared/errors.ts`**

Substituir a união `ErrorCode` por:

```ts
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'ROOM_NAME_TAKEN'
  | 'EMAIL_TAKEN'
  | 'AMENITY_NAME_TAKEN'
  | 'BOOKING_CONFLICT'
  | 'INTERNAL_ERROR';
```

- [ ] **Step 4: Criar `src/modules/amenities/queries.ts`**

```ts
import type { Amenity, Room } from '@prisma/client';
import { prisma } from '../../db/client.js';

export function listAmenities(): Promise<Amenity[]> {
  return prisma.amenity.findMany({ orderBy: { name: 'asc' } });
}

export function findAmenityById(id: string): Promise<Amenity | null> {
  return prisma.amenity.findUnique({ where: { id } });
}

export function findAmenityByName(name: string): Promise<Amenity | null> {
  return prisma.amenity.findUnique({ where: { name } });
}

export function insertAmenity(name: string, description?: string): Promise<Amenity> {
  return prisma.amenity.create({ data: { name, description } });
}

export function deleteAmenity(id: string): Promise<Amenity> {
  return prisma.amenity.delete({ where: { id } });
}

export function findRoom(id: string): Promise<Room | null> {
  return prisma.room.findUnique({ where: { id } });
}

export async function linkAmenity(roomId: string, amenityId: string): Promise<void> {
  await prisma.roomAmenity.upsert({
    where: { roomId_amenityId: { roomId, amenityId } },
    create: { roomId, amenityId },
    update: {},
  });
}

export async function unlinkAmenity(roomId: string, amenityId: string): Promise<void> {
  await prisma.roomAmenity.deleteMany({ where: { roomId, amenityId } });
}
```

- [ ] **Step 5: Criar `src/modules/amenities/routes.ts`**

Os schemas ficam neste arquivo, e não em um arquivo próprio. É parte do desvio.

```ts
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { replyConflict, replyNotFound } from '../../shared/http-reply.js';
import * as queries from './queries.js';

const AmenityResponse = Type.Object({
  id: Type.String(),
  name: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
});

const CreateAmenityBody = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 80 }),
    description: Type.Optional(Type.String({ maxLength: 200 })),
  },
  { additionalProperties: false },
);

const AmenityIdParams = Type.Object({ id: Type.String({ minLength: 1 }) });

const RoomAmenityParams = Type.Object({
  roomId: Type.String({ minLength: 1 }),
  amenityId: Type.String({ minLength: 1 }),
});

export const amenitiesRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.post('/amenities', { schema: { body: CreateAmenityBody, response: { 201: AmenityResponse } } },
    async (request, reply) => {
      const existing = await queries.findAmenityByName(request.body.name);
      if (existing) {
        return replyConflict(reply, 'AMENITY_NAME_TAKEN', 'Amenity name is already in use');
      }
      const created = await queries.insertAmenity(request.body.name, request.body.description);
      return reply.code(201).send(created);
    });

  app.get('/amenities', { schema: { response: { 200: Type.Array(AmenityResponse) } } },
    async () => queries.listAmenities());

  app.delete('/amenities/:id', { schema: { params: AmenityIdParams } },
    async (request, reply) => {
      const amenity = await queries.findAmenityById(request.params.id);
      if (!amenity) {
        return replyNotFound(reply, 'Amenity');
      }
      await queries.deleteAmenity(amenity.id);
      return reply.code(204).send();
    });

  app.put('/rooms/:roomId/amenities/:amenityId', { schema: { params: RoomAmenityParams } },
    async (request, reply) => {
      const room = await queries.findRoom(request.params.roomId);
      if (!room) {
        return replyNotFound(reply, 'Room');
      }
      const amenity = await queries.findAmenityById(request.params.amenityId);
      if (!amenity) {
        return replyNotFound(reply, 'Amenity');
      }
      await queries.linkAmenity(room.id, amenity.id);
      return reply.code(204).send();
    });

  app.delete('/rooms/:roomId/amenities/:amenityId', { schema: { params: RoomAmenityParams } },
    async (request, reply) => {
      const room = await queries.findRoom(request.params.roomId);
      if (!room) {
        return replyNotFound(reply, 'Room');
      }
      await queries.unlinkAmenity(room.id, request.params.amenityId);
      return reply.code(204).send();
    });
};
```

- [ ] **Step 6: Substituir `src/plugins/register-modules.ts`**

Arquivo completo. O módulo desviante é registrado sem prefixo.

```ts
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { amenitiesRoutes } from '../modules/amenities/routes.js';
import { bookingsRoutes } from '../modules/bookings/routes.js';
import { roomsRoutes } from '../modules/rooms/routes.js';
import { usersRoutes } from '../modules/users/routes.js';

export const registerModules: FastifyPluginAsyncTypebox = async (app) => {
  app.get('/health', async () => ({ status: 'ok' }));
  await app.register(roomsRoutes, { prefix: '/rooms' });
  await app.register(usersRoutes, { prefix: '/users' });
  await app.register(bookingsRoutes, { prefix: '/bookings' });
  await app.register(amenitiesRoutes);
};
```

- [ ] **Step 7: Rodar e confirmar que passa**

Run: `cd seed && make verify`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add seed
git commit -m "feat: add amenities endpoints"
```

---

### Task 10: Lastro inerte e prova de inércia

**Files:**
- Create: `seed/infra/terraform/versions.tf`, `seed/infra/terraform/variables.tf`, `seed/infra/terraform/main.tf`, `seed/infra/terraform/outputs.tf`, `seed/.github/workflows/ci.yml`, `seed/CHANGELOG.md`, `seed/LICENSE`
- Create (fora da semente): `tools/seed-audit/check-ballast-inert.sh`

**Interfaces:**
- Consumes: alvo `verify` do Makefile
- Produces: nada que o código consuma. É essa a questão.

O lastro compra validade aparente, não efeito de medida. Por isso a única exigência real é que ele seja **comprovadamente inerte**. Nada no Makefile e nada no Dockerfile pode depender dele.

- [ ] **Step 1: Escrever a prova de inércia, que falha**

Criar `tools/seed-audit/check-ballast-inert.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

SEED_DIR="$(cd "$(dirname "$0")/../../seed" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cp -a "$SEED_DIR" "$TMP/seed"
cd "$TMP/seed"
rm -rf data .cache dist
rm -rf infra .github CHANGELOG.md LICENSE .editorconfig

echo "running verification without the ballast"
make verify

echo "ballast is inert"
```

Tornar executável:

```bash
chmod +x tools/seed-audit/check-ballast-inert.sh
```

- [ ] **Step 2: Rodar uma vez, para provar que o roteiro executa**

Run: `./tools/seed-audit/check-ballast-inert.sh`
Expected: PASS, e o resultado ainda não significa nada, porque o lastro não existe. Este roteiro é um portão, não um teste que dirige o código: ele só passa a ter valor no Step 6, depois que houver lastro para apagar. Rodar agora serve apenas para confirmar que a cópia temporária e a verificação funcionam.

- [ ] **Step 3: Criar o lastro de infraestrutura**

`seed/infra/terraform/versions.tf`:

```hcl
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}
```

`seed/infra/terraform/variables.tf`:

```hcl
variable "region" {
  description = "AWS region for the service"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "staging"
}

variable "service_name" {
  description = "Name used to tag every resource"
  type        = string
  default     = "meeting-rooms-api"
}

variable "container_port" {
  description = "Port the container listens on"
  type        = number
  default     = 3000
}

variable "desired_count" {
  description = "Number of tasks to keep running"
  type        = number
  default     = 2
}
```

`seed/infra/terraform/main.tf`:

```hcl
locals {
  tags = {
    Service     = var.service_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_ecr_repository" "api" {
  name                 = var.service_name
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.tags
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${var.service_name}-${var.environment}"
  retention_in_days = 30
  tags              = local.tags
}

resource "aws_ecs_cluster" "api" {
  name = "${var.service_name}-${var.environment}"
  tags = local.tags
}
```

`seed/infra/terraform/outputs.tf`:

```hcl
output "repository_url" {
  description = "ECR repository that holds the service image"
  value       = aws_ecr_repository.api.repository_url
}

output "cluster_name" {
  description = "ECS cluster that runs the service"
  value       = aws_ecs_cluster.api.name
}

output "log_group" {
  description = "CloudWatch log group for the service"
  value       = aws_cloudwatch_log_group.api.name
}
```

- [ ] **Step 4: Criar `seed/.github/workflows/ci.yml`**

Chama o mesmo alvo que o README já expõe, então não acrescenta informação nova.

```yaml
name: ci

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm
      - run: make verify
```

- [ ] **Step 5: Criar `seed/CHANGELOG.md` e `seed/LICENSE`**

`CHANGELOG.md`. **Nenhuma menção ao estudo.**

```markdown
# Changelog

## 1.0.0

- Rooms, users, bookings and amenities endpoints.
- Pagination on list endpoints.
- Conflict detection when creating a booking.
```

`LICENSE`: texto padrão da licença MIT, com o ano corrente e o titular `meeting-rooms-api contributors`.

- [ ] **Step 6: Rodar a prova de inércia e confirmar que passa**

Run: `./tools/seed-audit/check-ballast-inert.sh`
Expected: PASS, com a última linha dizendo que o lastro é inerte.

- [ ] **Step 7: Confirmar que nada depende do lastro**

Run: `grep -rn "infra/\|\.github/\|CHANGELOG\|LICENSE" seed/Makefile seed/package.json seed/vitest.config.ts seed/tsconfig.json`
Expected: nenhuma ocorrência.

- [ ] **Step 8: Commit**

```bash
git add seed tools
git commit -m "chore: add deployment scaffolding, changelog and license"
```

---

### Task 11: Docker, dados de demonstração e Makefile completo

**Files:**
- Create: `seed/Dockerfile`, `seed/.dockerignore`, `seed/docker-compose.yml`, `seed/prisma/demo-data.ts`
- Modify: `seed/Makefile`

**Interfaces:**
- Consumes: alvos `setup`, `verify`, `build`, `start`
- Produces: imagem `meeting-rooms-api:1.0.0`; alvos `image` e `demo-data`

A semente entrega a **imagem base**. O runner constrói uma imagem derivada acrescentando o CLI do agente, e essa parte não pertence a este plano.

- [ ] **Step 1: Criar `.dockerignore`**

```
node_modules
dist
data
.cache
coverage
.git
.env
infra
.github
```

- [ ] **Step 2: Criar `Dockerfile`**

```dockerfile
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl git make openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN make setup && npm run build

ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=file:./data/app.db \
    LOG_LEVEL=info

EXPOSE 3000

CMD ["node", "dist/server.js"]
```

- [ ] **Step 3: Fixar a imagem base por digest**

A reprodutibilidade ao longo de meses depende disso. Resolver o digest e substituir a primeira linha.

```bash
docker pull node:22-bookworm-slim
docker inspect --format='{{index .RepoDigests 0}}' node:22-bookworm-slim
```

Substituir `FROM node:22-bookworm-slim` pelo valor retornado, no formato `FROM node:22-bookworm-slim@sha256:...`.

- [ ] **Step 4: Criar `docker-compose.yml`**

```yaml
services:
  api:
    build: .
    image: meeting-rooms-api:1.0.0
    ports:
      - '3000:3000'
    environment:
      PORT: '3000'
      DATABASE_URL: 'file:./data/app.db'
      LOG_LEVEL: 'info'
```

- [ ] **Step 5: Criar `prisma/demo-data.ts`**

Datas relativas ao instante da execução, nunca absolutas.

```ts
import { prisma } from '../src/db/client.js';

const HOUR = 3_600_000;

async function main(): Promise<void> {
  const room = await prisma.room.upsert({
    where: { name: 'Aurora' },
    update: {},
    create: { name: 'Aurora', capacity: 8, floor: '3' },
  });

  await prisma.room.upsert({
    where: { name: 'Borealis' },
    update: {},
    create: { name: 'Borealis', capacity: 4, floor: '3' },
  });

  const user = await prisma.user.upsert({
    where: { email: 'ada@example.com' },
    update: {},
    create: { name: 'Ada Lovelace', email: 'ada@example.com' },
  });

  await prisma.booking.create({
    data: {
      roomId: room.id,
      userId: user.id,
      title: 'Weekly sync',
      startsAt: new Date(Date.now() + 24 * HOUR),
      endsAt: new Date(Date.now() + 25 * HOUR),
    },
  });

  await prisma.$disconnect();
}

void main();
```

- [ ] **Step 6: Acrescentar `image` e `demo-data` ao `Makefile`**

```make
IMAGE := meeting-rooms-api:1.0.0

.PHONY: image demo-data

image:
	@docker build -t $(IMAGE) .

demo-data: setup
	@npx tsx prisma/demo-data.ts
```

Acrescentar `image` e `demo-data` à lista `.PHONY` do topo.

- [ ] **Step 7: Construir a imagem e verificar dentro dela**

```bash
cd seed && make image
docker run --rm meeting-rooms-api:1.0.0 make verify
```

Expected: a verificação passa inteira dentro do contêiner.

- [ ] **Step 8: Confirmar que o servidor sobe e responde**

```bash
docker run --rm -d -p 3000:3000 --name rooms-check meeting-rooms-api:1.0.0
sleep 5
curl -fsS http://localhost:3000/health
docker rm -f rooms-check
```

Expected: a resposta é `{"status":"ok"}`.

- [ ] **Step 9: Medir e registrar o tempo de verificação**

```bash
cd seed && make clean && time make verify
```

Registrar o tempo em `tools/seed-audit/CHECKLIST.md`, criado na Task 12. Não há alvo fixado. Se o tempo dominar a sessão durante o piloto, a suíte é reduzida antes do congelamento.

- [ ] **Step 10: Commit**

```bash
git add seed
git commit -m "chore: add container image, compose file and demo data"
```

---

### Task 12: Auditoria da semente e congelamento

**Files:**
- Create (fora da semente): `tools/seed-audit/check-no-leak.sh`, `tools/seed-audit/check-structure.sh`, `tools/seed-audit/CHECKLIST.md`
- Modify: `tools/seed-audit/README.md`

**Interfaces:**
- Consumes: a árvore completa da semente
- Produces: a tag `seed-v1`, que é o pré-requisito do runner, dos testes ocultos, do script de convenções e das configurações de contexto

- [ ] **Step 1: Criar `tools/seed-audit/check-no-leak.sh`**

O arquivo de lock é excluído porque hashes produzem falso positivo.

```bash
#!/usr/bin/env bash
set -uo pipefail

SEED_DIR="$(cd "$(dirname "$0")/../../seed" && pwd)"

TERMS='TCC|INATEL|harness|semente|repositório-semente|experimento|experimental|Claude|Anthropic|LLM|modelo de linguagem|prompt|avaliador cego|teste oculto|ponto de decisão'
FILES='CLAUDE.md|AGENTS.md|.cursorrules|CONTRIBUTING.md'

status=0

echo "== forbidden terms =="
if grep -rInE "$TERMS" "$SEED_DIR" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist \
  --exclude-dir=data --exclude-dir=.cache --exclude=package-lock.json; then
  echo "FAIL: forbidden terms found"
  status=1
else
  echo "ok"
fi

echo "== files addressed to agents or contributors =="
if find "$SEED_DIR" -not -path '*/node_modules/*' -not -path '*/.git/*' \
  \( -name 'CLAUDE.md' -o -name 'AGENTS.md' -o -name '.cursorrules' \
     -o -name 'CONTRIBUTING.md' -o -name '.claude' \) -print | grep .; then
  echo "FAIL: files addressed to agents found"
  status=1
else
  echo "ok"
fi

echo "== README stays minimal =="
if grep -qiE '^#+ *(architecture|conventions|layers|design)' "$SEED_DIR/README.md"; then
  echo "FAIL: README documents architecture or conventions"
  status=1
else
  echo "ok"
fi

exit $status
```

Tornar executável e rodar:

```bash
chmod +x tools/seed-audit/check-no-leak.sh
./tools/seed-audit/check-no-leak.sh
```

Expected: as três seções em `ok`. Se qualquer termo aparecer, corrigir na semente antes de seguir.

- [ ] **Step 2: Criar `tools/seed-audit/check-structure.sh`**

```bash
#!/usr/bin/env bash
set -uo pipefail

SEED_DIR="$(cd "$(dirname "$0")/../../seed" && pwd)"
status=0

check() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "ok   $label"
  else
    echo "FAIL $label: expected $expected, found $actual"
    status=1
  fi
}

for module in rooms users bookings; do
  count=$(find "$SEED_DIR/src/modules/$module" -maxdepth 1 -name '*.ts' | wc -l | tr -d ' ')
  check "$module has four layers" 4 "$count"
done

count=$(find "$SEED_DIR/src/modules/amenities" -maxdepth 1 -name '*.ts' | wc -l | tr -d ' ')
check "amenities has two files" 2 "$count"

users_of_reply=$(grep -rl "http-reply" "$SEED_DIR/src/modules" | wc -l | tr -d ' ')
check "only one module uses the alternate reply helper" 1 "$users_of_reply"

overlap=$(grep -ciE 'overlap|intersect' "$SEED_DIR/src/shared/time.ts" | tr -d ' ')
check "the time helper has no interval overlap function" 0 "$overlap"

date_libs=$(grep -cE '"(date-fns|dayjs|luxon|moment|temporal-polyfill)"' "$SEED_DIR/package.json" | tr -d ' ')
check "no date library in the manifest" 0 "$date_libs"

markers=$(grep -rciE 'deprecated|legacy|migrate to|old pattern' "$SEED_DIR/src" | grep -v ':0$' | wc -l | tr -d ' ')
check "nothing in the source declares which pattern is current" 0 "$markers"

exit $status
```

Tornar executável e rodar:

```bash
chmod +x tools/seed-audit/check-structure.sh
./tools/seed-audit/check-structure.sh
```

Expected: todas as linhas em `ok`.

- [ ] **Step 3: Criar `tools/seed-audit/CHECKLIST.md`**

Os itens automatizados apontam para o roteiro que os cobre. Os demais são revisão humana, exigida porque a semente foi escrita com assistência de um agente.

```markdown
# Aceite do repositório-semente

Referência: `docs/superpowers/specs/2026-09-09-repositorio-semente-design.md`, seção 11.

## A. Contrato funcional
- [ ] Todas as rotas da seção 4.2 respondem com os códigos listados — `cd seed && make verify`
- [ ] O envelope de erro é idêntico em todos os caminhos, inclusive no módulo desviante
- [ ] Listagens canônicas usam o auxiliar de paginação; a do desviante devolve array puro
- [ ] `GET /health` responde 200
- [ ] O cancelamento é idempotente

## B. Regra do falso negativo
- [ ] As oito lacunas esperadas estão presentes — `node tools/seed-audit/false-negatives.mjs`
- [ ] **Fecho, revisão humana:** lendo o contrato de T1 contra o código, não existe nenhum caminho que recuse um pedido que T1 aceitaria

## C. Estrutura e convenções
- [ ] Contagens de arquivos e ausência de marcações — `./tools/seed-audit/check-structure.sh`
- [ ] O serviço de usuários carrega exatamente as duas imperfeições nomeadas, e nenhuma outra
- [ ] A regra de negócio nunca está nas rotas dos módulos canônicos

## D. Ausência de vazamento
- [ ] Termos, arquivos dirigidos a agente e README — `./tools/seed-audit/check-no-leak.sh`
- [ ] Nenhum teste oculto, enunciado, ponto de decisão ou implementação de referência na árvore ou no histórico
- [ ] O runner materializa a cópia com um único commit de mensagem neutra

## E. Testes da semente
- [ ] Nenhuma data absoluta — `grep -rnE '[12][0-9]{3}-[01][0-9]-[0-3][0-9]' seed/tests`
- [ ] **Revisão humana:** nenhuma das seis afirmações proibidas da spec seção 8 aparece
- [ ] A suíte passa em execuções repetidas — rodar `make test` três vezes

## F. Inércia do lastro
- [ ] `./tools/seed-audit/check-ballast-inert.sh`
- [ ] Nenhum alvo do Makefile e nenhuma etapa do Dockerfile dependem do lastro

## G. Reprodutibilidade e operação
- [ ] De um clone limpo, `make verify` passa
- [ ] Versões exatas e lockfile versionado
- [ ] `docker run --rm meeting-rooms-api:1.0.0 make verify` passa
- [ ] Tempo de verificação medido e registrado aqui: `______`

## H. Revisão humana
- [ ] Integrante que revisou a árvore inteira: `______`  Data: `______`
```

- [ ] **Step 4: Atualizar `tools/seed-audit/README.md`**

Acrescentar ao final:

````markdown
## Ordem de execução do aceite

```bash
./tools/seed-audit/check-no-leak.sh
./tools/seed-audit/check-structure.sh
./tools/seed-audit/check-ballast-inert.sh
cd seed && make db-reset && (make start &) && sleep 5
node ../tools/seed-audit/false-negatives.mjs
```

Depois, percorrer `CHECKLIST.md` e preencher os itens de revisão humana.
````

- [ ] **Step 5: Rodar o aceite inteiro**

```bash
./tools/seed-audit/check-no-leak.sh \
  && ./tools/seed-audit/check-structure.sh \
  && ./tools/seed-audit/check-ballast-inert.sh
```

Expected: os três roteiros terminam com código zero.

- [ ] **Step 6: Commit da auditoria**

```bash
git add tools
git commit -m "chore: add seed acceptance checks"
```

- [ ] **Step 7: Preencher o checklist e obter a revisão humana**

Um integrante da equipe percorre `tools/seed-audit/CHECKLIST.md`, executa os itens automatizados, lê a árvore inteira e preenche os itens de revisão humana. **Este passo não pode ser executado por um agente**, porque ele existe justamente para compensar o fato de a semente ter sido escrita por um.

- [ ] **Step 8: Congelar**

Só depois de o checklist estar inteiramente marcado.

```bash
git add tools/seed-audit/CHECKLIST.md
git commit -m "chore: record seed acceptance review"
git tag -a seed-v1 -m "Frozen seed repository"
```

- [ ] **Step 9: Confirmar que a materialização funciona**

Simula o que o runner faz a cada sessão.

```bash
TMP=$(mktemp -d)
git archive seed-v1 seed | tar -x -C "$TMP"
cd "$TMP/seed" && git init -q . && git add -A && git commit -q -m "Initial commit"
git log --oneline
make verify
```

Expected: o histórico tem um único commit de mensagem neutra, e a verificação passa.

---

## Auto-revisão do plano

**Cobertura da spec.** Seção 3, modelo de dados, Task 2. Seção 4, contrato HTTP, Tasks 4 a 9. Seção 5, regra do falso negativo, Tasks 7 e 8, com verificação na Task 8 e fecho humano na Task 12. Seção 6, estrutura e convenções, Tasks 1, 3, 5, 6, 9. Seção 7, lastro, Task 10. Seção 8, testes da semente, Tasks 5 a 9, com a lista de afirmações proibidas nas restrições globais. Seção 9, ambiente, Tasks 1, 2, 4, 11. Seção 10, contrato com o runner, Tasks 1, 2, 4, 11 e a verificação da Task 12 passo 9. Seção 11, critérios de aceite, Task 12. Seção 12, o que a semente não contém, restrições globais. Seção 13, ameaças, Task 12 passo 7.

**Consistência de tipos.** `AppError`, `errorBody`, `notFound`, `roomNameTaken`, `emailTaken`, `bookingConflict`, `validationFailed` são definidos na Task 3 e usados com essas assinaturas nas Tasks 4 a 9. `ErrorCode` ganha `AMENITY_NAME_TAKEN` na Task 9. `normalizeLimit`, `normalizeOffset`, `paginated`, `Page` vêm da Task 3. `parseInstant` e `durationMinutes` vêm da Task 3; `durationMinutes` e `isBefore` ficam sem uso na semente de propósito, porque quem vai precisar deles é quem completar o contrato. `findConflictAtStart` é introduzido só na Task 8. `registerModules` é reescrito por inteiro em cada tarefa de módulo, e o import em `app.ts` não muda.

**Ponto de atenção para quem executa.** Os testes que afirmam os falsos negativos **não podem** ser movidos para dentro de `seed/tests/`. Eles vivem em `tools/seed-audit/false-negatives.mjs` porque T1 os tornará falsos, e um teste falso dentro da semente produziria regressão em toda sessão de T1.
