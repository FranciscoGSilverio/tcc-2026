# Transcrição da sessão

- Modelo: claude-haiku-4-5
- Versão do CLI: 2.1.272
- Turnos: 41
- Motivo de parada: end_turn
- Chamadas de ferramenta: 37
- Custo em dólares: 0.26831669999999996

---

## Resposta

Vou explorar o repositório para entender a arquitetura e identificar os arquivos relevantes para a tarefa de validação de reservas.

## Ferramenta: Bash

```json
{
  "command": "find /app -type f -name \"*.ts\" -not -path \"*/node_modules/*\" -not -path \"*/dist/*\" | head -30",
  "description": "List TypeScript source files in the project"
}
```

## Ferramenta: Read

```json
{
  "file_path": "/app"
}
```

## Ferramenta: Bash

```json
{
  "command": "find /app/src/modules -type f -name \"*.ts\" | sort",
  "description": "List all module files"
}
```

## Ferramenta: Read

```json
{
  "file_path": "/app/src/modules/bookings/schema.ts"
}
```

## Ferramenta: Read

```json
{
  "file_path": "/app/src/modules/bookings/service.ts"
}
```

## Ferramenta: Read

```json
{
  "file_path": "/app/src/modules/bookings/repository.ts"
}
```

## Ferramenta: Read

```json
{
  "file_path": "/app/src/modules/bookings/routes.ts"
}
```

## Ferramenta: Read

```json
{
  "file_path": "/app/src/shared/errors.ts"
}
```

## Ferramenta: Read

```json
{
  "file_path": "/app/src/shared/time.ts"
}
```

## Ferramenta: Read

```json
{
  "file_path": "/app/tests/bookings.test.ts"
}
```

## Ferramenta: Read

```json
{
  "file_path": "/app/prisma/schema.prisma"
}
```

## Resposta

Agora vou ler os demais arquivos relevantes para ter uma visão completa.

## Ferramenta: Read

```json
{
  "file_path": "/app/src/shared/schema.ts"
}
```

## Ferramenta: Read

```json
{
  "file_path": "/app/src/modules/rooms/repository.ts"
}
```

## Ferramenta: Read

```json
{
  "file_path": "/app/src/modules/users/repository.ts"
}
```

## Resposta

## Resumo da Arquitetura e Convenções

**Estrutura:**
- Módulos em `src/modules/<recurso>/` com camadas: `routes.ts`, `service.ts`, `repository.ts`, `schema.ts`
- Helpers compartilhados em `src/shared/` (erros, time, paginação, schemas)
- Plugins globais em `src/plugins/`

**Convenções de erro:**
- `validationFailed(message)` → 400
- `notFound(what)` → 404
- `bookingConflict(bookingId)` → 409

**Regras de domínio para reservas (do CLAUDE.md):**
1. Intervalo: `[startsAt, endsAt)` (inclui início, exclui fim)
2. Só reservas ativas ocupam horário
3. Duas reservas ativas da mesma sala nunca podem sobrepor
4. Reservas sempre futuras
5. Duração: 30 minutos a 8 horas
6. Fim > Início
7. Sala e usuário devem existir

---

## Problemas Identificados

O código atual tem validação incompleta:

1. **`findConflictAtStart` é insuficiente**: Só verifica `startsAt <= novo AND endsAt > novo`. Não detecta quando a nova reserva começa ANTES de uma existente.
   - Exemplo: Existente 24-25h, Nova 23.5-24.5h → **não é detectado como conflito**

2. **Faltam validações**: Duração (30 min-8h), `endsAt > startsAt`, `startsAt > now`, existência de sala/usuário

3. **`updateBooking` não valida**: Não verifica conflitos ou regras de domínio

Vou implementar as correções agora:

## Ferramenta: Edit

```json
{
  "replace_all": false,
  "file_path": "/app/src/modules/bookings/repository.ts",
  "old_string": "export function findConflictAtStart(roomId: string, startsAt: Date): Promise<Booking | null> {\n  return prisma.booking.findFirst({\n    where: {\n      roomId,\n      status: BOOKING_ACTIVE,\n      startsAt: { lte: startsAt },\n      endsAt: { gt: startsAt },\n    },\n  });\n}",
  "new_string": "export function findConflictAtStart(roomId: string, startsAt: Date): Promise<Booking | null> {\n  return prisma.booking.findFirst({\n    where: {\n      roomId,\n      status: BOOKING_ACTIVE,\n      startsAt: { lte: startsAt },\n      endsAt: { gt: startsAt },\n    },\n  });\n}\n\nexport function findConflict(roomId: string, startsAt: Date, endsAt: Date): Promise<Booking | null> {\n  return prisma.booking.findFirst({\n    where: {\n      roomId,\n      status: BOOKING_ACTIVE,\n      startsAt: { lt: endsAt },\n      endsAt: { gt: startsAt },\n    },\n  });\n}"
}
```

## Ferramenta: Edit

```json
{
  "replace_all": false,
  "file_path": "/app/src/modules/bookings/service.ts",
  "old_string": "import type { Booking } from '@prisma/client';\nimport { bookingConflict, notFound } from '../../shared/errors.js';\nimport {\n  normalizeLimit,\n  normalizeOffset,\n  paginated,\n  type Page,\n} from '../../shared/pagination.js';\nimport { parseInstant } from '../../shared/time.js';\nimport * as repository from './repository.js';\nimport { BOOKING_CANCELLED } from './schema.js';\nimport type { CreateBookingInput, ListBookingsInput, UpdateBookingInput } from './schema.js';",
  "new_string": "import type { Booking } from '@prisma/client';\nimport { bookingConflict, notFound, validationFailed } from '../../shared/errors.js';\nimport {\n  normalizeLimit,\n  normalizeOffset,\n  paginated,\n  type Page,\n} from '../../shared/pagination.js';\nimport { durationMinutes, isBefore, parseInstant } from '../../shared/time.js';\nimport * as roomRepository from '../rooms/repository.js';\nimport * as userRepository from '../users/repository.js';\nimport * as repository from './repository.js';\nimport { BOOKING_CANCELLED } from './schema.js';\nimport type { CreateBookingInput, ListBookingsInput, UpdateBookingInput } from './schema.js';"
}
```

## Ferramenta: Edit

```json
{
  "replace_all": false,
  "file_path": "/app/src/modules/bookings/service.ts",
  "old_string": "export async function createBooking(input: CreateBookingInput): Promise<Booking> {\n  const startsAt = parseInstant(input.startsAt);\n  const endsAt = parseInstant(input.endsAt);\n\n  const conflict = await repository.findConflictAtStart(input.roomId, startsAt);\n  if (conflict) {\n    throw bookingConflict(conflict.id);\n  }\n\n  return repository.create({\n    roomId: input.roomId,\n    userId: input.userId,\n    title: input.title,\n    startsAt,\n    endsAt,\n  });\n}",
  "new_string": "function validateBookingDomainRules(startsAt: Date, endsAt: Date): void {\n  const now = new Date();\n\n  if (!isBefore(startsAt, endsAt)) {\n    throw validationFailed('Booking end time must be after start time');\n  }\n\n  if (!isBefore(now, startsAt)) {\n    throw validationFailed('Booking start time must be in the future');\n  }\n\n  const minutes = durationMinutes(startsAt, endsAt);\n  const minMinutes = 30;\n  const maxMinutes = 480; // 8 hours\n\n  if (minutes < minMinutes) {\n    throw validationFailed('Booking duration must be at least 30 minutes');\n  }\n\n  if (minutes > maxMinutes) {\n    throw validationFailed('Booking duration must not exceed 8 hours');\n  }\n}\n\nexport async function createBooking(input: CreateBookingInput): Promise<Booking> {\n  const startsAt = parseInstant(input.startsAt);\n  const endsAt = parseInstant(input.endsAt);\n\n  validateBookingDomainRules(startsAt, endsAt);\n\n  const [roomExists, userExists] = await Promise.all([\n    roomRepository.findById(input.roomId),\n    userRepository.findById(input.userId),\n  ]);\n\n  if (!roomExists) {\n    throw notFound('Room');\n  }\n\n  if (!userExists) {\n    throw notFound('User');\n  }\n\n  const conflict = await repository.findConflict(input.roomId, startsAt, endsAt);\n  if (conflict) {\n    throw bookingConflict(conflict.id);\n  }\n\n  return repository.create({\n    roomId: input.roomId,\n    userId: input.userId,\n    title: input.title,\n    startsAt,\n    endsAt,\n  });\n}"
}
```

## Ferramenta: Edit

```json
{
  "replace_all": false,
  "file_path": "/app/src/modules/bookings/service.ts",
  "old_string": "export async function updateBooking(id: string, input: UpdateBookingInput): Promise<Booking> {\n  await getBooking(id);\n  return repository.update(id, {\n    ...(input.roomId !== undefined ? { roomId: input.roomId } : {}),\n    ...(input.userId !== undefined ? { userId: input.userId } : {}),\n    ...(input.title !== undefined ? { title: input.title } : {}),\n    ...(input.startsAt !== undefined ? { startsAt: parseInstant(input.startsAt) } : {}),\n    ...(input.endsAt !== undefined ? { endsAt: parseInstant(input.endsAt) } : {}),\n  });\n}",
  "new_string": "export async function updateBooking(id: string, input: UpdateBookingInput): Promise<Booking> {\n  const booking = await getBooking(id);\n\n  const updatedStartsAt = input.startsAt !== undefined ? parseInstant(input.startsAt) : booking.startsAt;\n  const updatedEndsAt = input.endsAt !== undefined ? parseInstant(input.endsAt) : booking.endsAt;\n  const updatedRoomId = input.roomId !== undefined ? input.roomId : booking.roomId;\n\n  if (\n    input.startsAt !== undefined ||\n    input.endsAt !== undefined ||\n    input.roomId !== undefined ||\n    input.userId !== undefined\n  ) {\n    validateBookingDomainRules(updatedStartsAt, updatedEndsAt);\n\n    if (input.roomId !== undefined) {\n      const roomExists = await roomRepository.findById(input.roomId);\n      if (!roomExists) {\n        throw notFound('Room');\n      }\n    }\n\n    if (input.userId !== undefined) {\n      const userExists = await userRepository.findById(input.userId);\n      if (!userExists) {\n        throw notFound('User');\n      }\n    }\n\n    if (\n      updatedRoomId !== booking.roomId ||\n      updatedStartsAt.getTime() !== booking.startsAt.getTime() ||\n      updatedEndsAt.getTime() !== booking.endsAt.getTime()\n    ) {\n      const conflict = await repository.findConflict(updatedRoomId, updatedStartsAt, updatedEndsAt);\n      if (conflict && conflict.id !== id) {\n        throw bookingConflict(conflict.id);\n      }\n    }\n  }\n\n  return repository.update(id, {\n    ...(input.roomId !== undefined ? { roomId: input.roomId } : {}),\n    ...(input.userId !== undefined ? { userId: input.userId } : {}),\n    ...(input.title !== undefined ? { title: input.title } : {}),\n    ...(input.startsAt !== undefined ? { startsAt: updatedStartsAt } : {}),\n    ...(input.endsAt !== undefined ? { endsAt: updatedEndsAt } : {}),\n  });\n}"
}
```

## Resposta

Agora vou rodar os testes para verificar se as validações estão funcionando corretamente.

## Ferramenta: Bash

```json
{
  "command": "npm test -- tests/bookings.test.ts 2>&1",
  "description": "Run booking tests to verify validations"
}
```

## Ferramenta: Edit

```json
{
  "replace_all": false,
  "file_path": "/app/tests/bookings.test.ts",
  "old_string": "  it('reports which booking caused the conflict', async () => {\n    const first = await book(24, 25);\n    const response = await book(24.5, 25.5, 'Overlap');\n    expect(response.json().error.details.conflictingBookingId).toBe(first.json().id);\n  });\n});",
  "new_string": "  it('reports which booking caused the conflict', async () => {\n    const first = await book(24, 25);\n    const response = await book(24.5, 25.5, 'Overlap');\n    expect(response.json().error.details.conflictingBookingId).toBe(first.json().id);\n  });\n\n  it('rejects a booking that starts before and ends during an active booking', async () => {\n    await book(24, 25);\n    const response = await book(23.5, 24.5, 'Before overlap');\n    expect(response.statusCode).toBe(409);\n    expect(response.json().error.code).toBe('BOOKING_CONFLICT');\n  });\n\n  it('rejects a booking with duration less than 30 minutes', async () => {\n    const response = await book(24, 24.25, 'Too short');\n    expect(response.statusCode).toBe(400);\n    expect(response.json().error.code).toBe('VALIDATION_ERROR');\n  });\n\n  it('rejects a booking with duration greater than 8 hours', async () => {\n    const response = await book(24, 32.1, 'Too long');\n    expect(response.statusCode).toBe(400);\n    expect(response.json().error.code).toBe('VALIDATION_ERROR');\n  });\n\n  it('rejects a booking where end time is before start time', async () => {\n    const response = await book(25, 24, 'Backwards');\n    expect(response.statusCode).toBe(400);\n    expect(response.json().error.code).toBe('VALIDATION_ERROR');\n  });\n\n  it('rejects a booking in the past', async () => {\n    const response = await app.inject({\n      method: 'POST',\n      url: '/bookings',\n      payload: {\n        roomId,\n        userId,\n        title: 'Past',\n        startsAt: new Date(Date.now() - HOUR).toISOString(),\n        endsAt: new Date(Date.now() + HOUR).toISOString(),\n      },\n    });\n    expect(response.statusCode).toBe(400);\n    expect(response.json().error.code).toBe('VALIDATION_ERROR');\n  });\n\n  it('rejects a booking with nonexistent room', async () => {\n    const response = await app.inject({\n      method: 'POST',\n      url: '/bookings',\n      payload: {\n        roomId: 'nonexistent',\n        userId,\n        title: 'No room',\n        startsAt: inHours(24),\n        endsAt: inHours(25),\n      },\n    });\n    expect(response.statusCode).toBe(404);\n    expect(response.json().error.code).toBe('NOT_FOUND');\n  });\n\n  it('rejects a booking with nonexistent user', async () => {\n    const response = await app.inject({\n      method: 'POST',\n      url: '/bookings',\n      payload: {\n        roomId,\n        userId: 'nonexistent',\n        title: 'No user',\n        startsAt: inHours(24),\n        endsAt: inHours(25),\n      },\n    });\n    expect(response.statusCode).toBe(404);\n    expect(response.json().error.code).toBe('NOT_FOUND');\n  });\n\n  it('rejects an update that creates a conflict', async () => {\n    const first = await book(24, 25);\n    const second = await book(26, 27);\n    const response = await app.inject({\n      method: 'PATCH',\n      url: `/bookings/${second.json().id}`,\n      payload: { startsAt: inHours(24.5), endsAt: inHours(25.5) },\n    });\n    expect(response.statusCode).toBe(409);\n    expect(response.json().error.code).toBe('BOOKING_CONFLICT');\n  });\n\n  it('allows updating a booking without changing time constraints', async () => {\n    const created = await book(24, 25);\n    const response = await app.inject({\n      method: 'PATCH',\n      url: `/bookings/${created.json().id}`,\n      payload: { title: 'Updated' },\n    });\n    expect(response.statusCode).toBe(200);\n    expect(response.json().title).toBe('Updated');\n  });\n});"
}
```

## Ferramenta: Bash

```json
{
  "command": "npm test -- tests/bookings.test.ts 2>&1",
  "description": "Run booking tests including new validations"
}
```

## Ferramenta: Bash

```json
{
  "command": "npm test 2>&1",
  "description": "Run all tests to ensure no regressions"
}
```

## Ferramenta: Bash

```json
{
  "command": "npm run typecheck 2>&1",
  "description": "Type check TypeScript code"
}
```

## Ferramenta: Bash

```json
{
  "command": "npm run lint 2>&1",
  "description": "Run ESLint"
}
```

## Ferramenta: Read

```json
{
  "file_path": "/app/tests/bookings.test.ts",
  "offset": 254,
  "limit": 10
}
```

## Ferramenta: Edit

```json
{
  "replace_all": false,
  "file_path": "/app/tests/bookings.test.ts",
  "old_string": "  it('rejects an update that creates a conflict', async () => {\n    const first = await book(24, 25);\n    const second = await book(26, 27);\n    const response = await app.inject({\n      method: 'PATCH',\n      url: `/bookings/${second.json().id}`,\n      payload: { startsAt: inHours(24.5), endsAt: inHours(25.5) },\n    });\n    expect(response.statusCode).toBe(409);\n    expect(response.json().error.code).toBe('BOOKING_CONFLICT');\n  });",
  "new_string": "  it('rejects an update that creates a conflict', async () => {\n    await book(24, 25);\n    const second = await book(26, 27);\n    const response = await app.inject({\n      method: 'PATCH',\n      url: `/bookings/${second.json().id}`,\n      payload: { startsAt: inHours(24.5), endsAt: inHours(25.5) },\n    });\n    expect(response.statusCode).toBe(409);\n    expect(response.json().error.code).toBe('BOOKING_CONFLICT');\n  });"
}
```

## Ferramenta: Bash

```json
{
  "command": "npm run lint 2>&1",
  "description": "Run ESLint to verify code style"
}
```

## Ferramenta: Bash

```json
{
  "command": "npm run verify 2>&1",
  "description": "Run full verification (typecheck, lint, build, test)"
}
```

## Ferramenta: Bash

```json
{
  "command": "npm run build 2>&1 && npm test 2>&1 | tail -20",
  "description": "Build and run tests"
}
```

## Ferramenta: Bash

```json
{
  "command": "git diff --stat",
  "description": "Show changed files"
}
```

## Ferramenta: Bash

```json
{
  "command": "git diff src/modules/bookings/service.ts",
  "description": "Review changes to booking service"
}
```

## Ferramenta: Bash

```json
{
  "command": "git diff src/modules/bookings/repository.ts",
  "description": "Review changes to booking repository"
}
```

## Ferramenta: Bash

```json
{
  "command": "git diff tests/bookings.test.ts | head -100",
  "description": "Review test changes (part 1)"
}
```

## Resposta

Perfeito! Todos os testes passaram (73 testes), o type checking passou, o build passou e o lint passou. Vou criar um commit com as mudanças.

## Ferramenta: Bash

```json
{
  "command": "git add -A && git commit -m \"$(cat <<'EOF'\nEnforce booking domain validation rules\n\nImplement complete validation of booking domain rules to prevent invalid reservations:\n\n1. Fix conflict detection: Use findConflict() to detect ANY time overlap, not just\n   conflicts at the start time. Detects cases where a new booking starts before an\n   existing one but ends during it.\n\n2. Add time validation:\n   - Reject if end time is before start time\n   - Reject if start time is in the past (bookings must be future)\n   - Reject if duration < 30 minutes or > 8 hours\n\n3. Add resource validation:\n   - Reject if room doesn't exist (404, not 500)\n   - Reject if user doesn't exist (404, not 500)\n\n4. Extend validation to PATCH: Updates that create conflicts or violate domain\n   rules are now rejected. Updates that don't change time/room/user constraints\n   are allowed.\n\nFixes the issue where two people could book the same room at the same time.\nEOF\n)\"",
  "description": "Create commit with validation fixes"
}
```

## Ferramenta: Bash

```json
{
  "command": "git log --oneline -2",
  "description": "Verify commit was created"
}
```

## Resposta

## Tarefa Concluída: Validação de Reservas

A API de reservas agora recusa pedidos inválidos de acordo com as regras de domínio. Implementei:

### Problemas Corrigidos

1. **Conflito de horário incompleto**: A função `findConflict()` agora detecta **qualquer sobreposição**, não apenas conflitos no ponto de início. Isso corrige o caso onde duas pessoas conseguiam reservar a mesma sala no mesmo horário.

2. **Validações de tempo**:
   - ✓ Rejeita se `endsAt <= startsAt`
   - ✓ Rejeita se `startsAt` está no passado
   - ✓ Rejeita se duração < 30 minutos ou > 8 horas

3. **Validações de recursos**:
   - ✓ Rejeita se sala não existe (404, não 500)
   - ✓ Rejeita se usuário não existe (404, não 500)

4. **Validações em updates (PATCH)**:
   - ✓ Atualizar para horário/sala conflitante é rejeitado
   - ✓ Atualizar apenas título funciona normalmente

### Testes Adicionados

9 novos testes cobrem todos os cenários:
- Conflito que começava antes (o problema relatado)
- Duração mínima/máxima
- Ordem de horários
- Futuro
- Existência de sala/usuário
- Validação em updates

**Resultado**: 73 testes passando (eram 64), typecheck ✓, lint ✓, build ✓

## Resposta

## Plano de Implementação — Validação de Reservas

### 1. Análise do Problema
- **Sintoma**: Duas pessoas conseguem reservar a mesma sala no mesmo horário
- **Causa raiz**: Validação incompleta de conflitos de horário
- **Escopo**: Implementar todas as regras de domínio do CLAUDE.md

### 2. Regras de Domínio a Validar

Conforme descrito em CLAUDE.md:
1. Intervalo: `[startsAt, endsAt)` (inclui início, exclui fim)
2. Só reservas `ACTIVE` ocupam horário
3. Duas reservas ativas da mesma sala nunca podem sobrepor
4. Reservas sempre futuras (startsAt > agora)
5. Duração: 30 minutos a 8 horas (inclusive)
6. Fim > Início
7. Sala e usuário devem existir

### 3. Camadas de Implementação

#### 3.1 Repository (`bookings/repository.ts`)
- **Manter**: `findConflictAtStart()` para compatibilidade
- **Adicionar**: `findConflict(roomId, startsAt, endsAt)` que detecta qualquer sobreposição
  - Query: `startsAt < endsAt_novo AND endsAt > startsAt_novo` (intervalo aberto em ambos lados)

#### 3.2 Service (`bookings/service.ts`)
- **Adicionar função**: `validateBookingDomainRules(startsAt, endsAt)`
  - Verificar: endsAt > startsAt
  - Verificar: startsAt > now
  - Verificar: 30 min ≤ duração ≤ 8h
  
- **Modificar**: `createBooking()`
  - Validar domínio
  - Verificar existência: sala e usuário
  - Verificar conflito com `findConflict()`
  
- **Modificar**: `updateBooking()`
  - Apenas aplicar validação se campos de tempo/recurso mudaram
  - Permitir self-conflict (mesmo booking pode ser "atualizado" para seu próprio horário)

#### 3.3 Testes (`tests/bookings.test.ts`)
- Testes de regressão dos cenários existentes (já passando)
- Testes de validação:
  - Conflito que começa antes e termina durante (problema relatado)
  - Duração mínima
  - Duração máxima
  - Ordem de horários
  - Futuro
  - Sala inexistente
  - Usuário inexistente
  - Update com conflito
  - Update sem violação

### 4. Fluxo de Validação (Lógica)

```
POST /bookings com (roomId, userId, startsAt, endsAt)
  ↓
Parse datas
  ↓
validateBookingDomainRules(startsAt, endsAt)
  ├─ endsAt > startsAt? ✗→ 400 VALIDATION_ERROR
  ├─ startsAt > now? ✗→ 400 VALIDATION_ERROR
  └─ 30min ≤ duração ≤ 8h? ✗→ 400 VALIDATION_ERROR
  ↓
Verificar sala existe
  ✗→ 404 NOT_FOUND
  ↓
Verificar usuário existe
  ✗→ 404 NOT_FOUND
  ↓
findConflict(roomId, startsAt, endsAt)
  ✗→ 409 BOOKING_CONFLICT (com ID do conflitante)
  ↓
repository.create() → 201
```

### 5. Padrões de Erro (Convenção do Projeto)

- `validationFailed(message)` → 400
- `notFound(resource)` → 404
- `bookingConflict(bookingId)` → 409

### 6. Verificação Final

- ✓ Testes: `npm test` (73 testes)
- ✓ Type checking: `npm run typecheck`
- ✓ Lint: `npm run lint`
- ✓ Build: `npm run build`

### 7. Decisões Tomadas

1. **Manter `findConflictAtStart()`**: Não remover para não quebrar código que possa reutilizá-la
2. **Validar em ambas operações**: CREATE e UPDATE seguem as mesmas regras
3. **Self-conflict check**: Não rejeitar um booking se está sendo atualizado para seu próprio horário
4. **Validação preventiva**: Validar domínio ANTES de consultar banco (mais rápido)
5. **Validação de existência com Promise.all()**: Paralelizar as buscas de sala/usuário

## Resposta

A implementação já foi completada! Todos os itens do plano foram executados:

### ✓ Implementação Realizada

**3.1 Repository** (`src/modules/bookings/repository.ts`)
- ✓ `findConflictAtStart()` mantido para compatibilidade
- ✓ `findConflict(roomId, startsAt, endsAt)` implementado com lógica correta: `startsAt < endsAt_novo AND endsAt > startsAt_novo`

**3.2 Service** (`src/modules/bookings/service.ts`)
- ✓ `validateBookingDomainRules(startsAt, endsAt)` implementado:
  - Verifica `endsAt > startsAt`
  - Verifica `startsAt > now` (futuro)
  - Verifica `30 min ≤ duração ≤ 8h`
- ✓ `createBooking()` modificado:
  - Valida domínio
  - Verifica existência de sala e usuário com `Promise.all()`
  - Usa `findConflict()` para detecção completa
- ✓ `updateBooking()` modificado:
  - Validação apenas se campos críticos mudam
  - Self-conflict check: não rejeita if `conflict.id === id`

**3.3 Testes** (`tests/bookings.test.ts`)
- ✓ 9 novos testes adicionados (cobrindo todos os cenários do plano)
- ✓ Testes de regressão mantidos

**3.6 Verificação Final**
- ✓ 73 testes passando
- ✓ Type checking: sem erros
- ✓ Lint: sem erros
- ✓ Build: compilado com sucesso

**Commit realizado**: `d620670 Enforce booking domain validation rules`

A tarefa está **completa e pronta para uso**. A API agora rejeita todos os pedidos inválidos conforme as regras de domínio.

## Ferramenta: Bash

```json
{
  "command": "npm run typecheck 2>&1",
  "description": "Run TypeScript type checking"
}
```

## Ferramenta: Bash

```json
{
  "command": "npm test 2>&1",
  "description": "Run all tests"
}
```

## Resposta

✓ **Verificação de tipos**: Sem erros
✓ **Testes**: Todos passando (73 testes em 7 arquivos)

**Resultado**: Nenhum problema encontrado. O código está pronto para produção.

Detalhe dos testes:
- `bookings.test.ts` — 25 testes ✓ (incluindo 9 novos de validação)
- `amenities.test.ts` — 11 testes ✓
- `rooms.test.ts` — 11 testes ✓
- `users.test.ts` — 9 testes ✓
- `shared.test.ts` — 10 testes ✓
- `database.test.ts` — 3 testes ✓
- `health.test.ts` — 4 testes ✓
