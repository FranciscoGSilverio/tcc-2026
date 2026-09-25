# Transcrição da sessão

- Modelo: claude-sonnet-5
- Versão do CLI: 2.1.272
- Turnos: 44
- Motivo de parada: end_turn
- Chamadas de ferramenta: 43
- Custo em dólares: 0.7532165

---

## Resposta

I'll start by exploring the codebase to understand the current booking module structure and existing conventions before deciding on an approach.

## Ferramenta: Bash

```json
{
  "command": "find /app/src -type f -name \"*.ts\" | sort"
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
  "file_path": "/app/src/modules/bookings/schema.ts"
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

## Ferramenta: Bash

```json
{
  "command": "find /app -type d -name \"test*\" -o -type d -name \"__tests__\" | grep -v node_modules; find /app -path \"*/node_modules\" -prune -o -name \"*.test.ts\" -print -o -name \"*.spec.ts\" -print"
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
  "file_path": "/app/src/modules/rooms/routes.ts"
}
```

## Ferramenta: Read

```json
{
  "file_path": "/app/src/modules/rooms/service.ts"
}
```

## Ferramenta: Read

```json
{
  "file_path": "/app/src/modules/rooms/schema.ts"
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
  "file_path": "/app/src/shared/schema.ts"
}
```

## Ferramenta: Read

```json
{
  "file_path": "/app/src/shared/pagination.ts"
}
```

## Ferramenta: Read

```json
{
  "file_path": "/app/src/plugins/register-modules.ts"
}
```

## Ferramenta: Read

```json
{
  "file_path": "/app/src/plugins/error-handler.ts"
}
```

## Ferramenta: Bash

```json
{
  "command": "grep -n \"Room\\b\\|User\\b\\|P2003\\|P2025\\|foreign\" -r /app/src | grep -v node_modules"
}
```

## Ferramenta: Bash

```json
{
  "command": "cat /app/prisma/schema.prisma 2>/dev/null || find /app -iname \"*.prisma\" -not -path \"*/node_modules/*\""
}
```

## Ferramenta: Bash

```json
{
  "command": "grep -n \"roomId\\|userId\" -n /app/tests/bookings.test.ts | grep -i \"missing\\|invalid\\|not.*exist\" ; grep -rn \"P2003\\|foreign key\" /app/src /app/tests 2>/dev/null"
}
```

## Ferramenta: Read

```json
{
  "file_path": "/app/src/modules/amenities/routes.ts"
}
```

## Ferramenta: Read

```json
{
  "file_path": "/app/src/modules/amenities/queries.ts"
}
```

## Ferramenta: Bash

```json
{
  "command": "grep -rn \"from '\\.\\./\" /app/src/modules/*/service.ts; echo ---; grep -rn \"import\" /app/src/modules/bookings/*.ts"
}
```

## Ferramenta: Bash

```json
{
  "command": "grep -rn \"findConflictAtStart\" /app/src /app/tests 2>/dev/null"
}
```

## Resposta

Now let's implement. First, the repository change to fix overlap detection and support the new availability query.

## Ferramenta: Edit

```json
{
  "replace_all": false,
  "file_path": "/app/src/modules/bookings/repository.ts",
  "old_string": "export function findConflictAtStart(roomId: string, startsAt: Date): Promise<Booking | null> {\n  return prisma.booking.findFirst({\n    where: {\n      roomId,\n      status: BOOKING_ACTIVE,\n      startsAt: { lte: startsAt },\n      endsAt: { gt: startsAt },\n    },\n  });\n}",
  "new_string": "export function listOverlapping(\n  roomId: string,\n  startsAt: Date,\n  endsAt: Date,\n  excludeId?: string,\n): Promise<Booking[]> {\n  return prisma.booking.findMany({\n    where: {\n      roomId,\n      status: BOOKING_ACTIVE,\n      startsAt: { lt: endsAt },\n      endsAt: { gt: startsAt },\n      ...(excludeId ? { id: { not: excludeId } } : {}),\n    },\n    orderBy: { startsAt: 'asc' },\n  });\n}"
}
```

## Resposta

Now update the service layer: fix conflict checks on create/update, and add the new availability lookup.

## Ferramenta: Edit

```json
{
  "replace_all": false,
  "file_path": "/app/src/modules/bookings/service.ts",
  "old_string": "import type { Booking } from '@prisma/client';\nimport { bookingConflict, notFound } from '../../shared/errors.js';\nimport {\n  normalizeLimit,\n  normalizeOffset,\n  paginated,\n  type Page,\n} from '../../shared/pagination.js';\nimport { parseInstant } from '../../shared/time.js';\nimport * as repository from './repository.js';\nimport { BOOKING_CANCELLED } from './schema.js';\nimport type { CreateBookingInput, ListBookingsInput, UpdateBookingInput } from './schema.js';\n\nexport async function createBooking(input: CreateBookingInput): Promise<Booking> {\n  const startsAt = parseInstant(input.startsAt);\n  const endsAt = parseInstant(input.endsAt);\n\n  const conflict = await repository.findConflictAtStart(input.roomId, startsAt);\n  if (conflict) {\n    throw bookingConflict(conflict.id);\n  }\n\n  return repository.create({\n    roomId: input.roomId,\n    userId: input.userId,\n    title: input.title,\n    startsAt,\n    endsAt,\n  });\n}",
  "new_string": "import type { Booking } from '@prisma/client';\nimport { bookingConflict, notFound, validationFailed } from '../../shared/errors.js';\nimport {\n  normalizeLimit,\n  normalizeOffset,\n  paginated,\n  type Page,\n} from '../../shared/pagination.js';\nimport { getRoom } from '../rooms/service.js';\nimport { isBefore, parseInstant } from '../../shared/time.js';\nimport * as repository from './repository.js';\nimport { BOOKING_CANCELLED } from './schema.js';\nimport type {\n  AvailabilityInput,\n  AvailabilityResult,\n  CreateBookingInput,\n  ListBookingsInput,\n  UpdateBookingInput,\n} from './schema.js';\n\nexport async function createBooking(input: CreateBookingInput): Promise<Booking> {\n  const startsAt = parseInstant(input.startsAt);\n  const endsAt = parseInstant(input.endsAt);\n\n  const overlapping = await repository.listOverlapping(input.roomId, startsAt, endsAt);\n  if (overlapping.length > 0) {\n    throw bookingConflict(overlapping[0].id);\n  }\n\n  return repository.create({\n    roomId: input.roomId,\n    userId: input.userId,\n    title: input.title,\n    startsAt,\n    endsAt,\n  });\n}"
}
```

## Ferramenta: Edit

```json
{
  "replace_all": false,
  "file_path": "/app/src/modules/bookings/service.ts",
  "old_string": "export async function updateBooking(id: string, input: UpdateBookingInput): Promise<Booking> {\n  await getBooking(id);\n  return repository.update(id, {\n    ...(input.roomId !== undefined ? { roomId: input.roomId } : {}),\n    ...(input.userId !== undefined ? { userId: input.userId } : {}),\n    ...(input.title !== undefined ? { title: input.title } : {}),\n    ...(input.startsAt !== undefined ? { startsAt: parseInstant(input.startsAt) } : {}),\n    ...(input.endsAt !== undefined ? { endsAt: parseInstant(input.endsAt) } : {}),\n  });\n}",
  "new_string": "export async function updateBooking(id: string, input: UpdateBookingInput): Promise<Booking> {\n  const current = await getBooking(id);\n  const roomId = input.roomId ?? current.roomId;\n  const startsAt = input.startsAt !== undefined ? parseInstant(input.startsAt) : current.startsAt;\n  const endsAt = input.endsAt !== undefined ? parseInstant(input.endsAt) : current.endsAt;\n\n  if (input.roomId !== undefined || input.startsAt !== undefined || input.endsAt !== undefined) {\n    const overlapping = await repository.listOverlapping(roomId, startsAt, endsAt, id);\n    if (overlapping.length > 0) {\n      throw bookingConflict(overlapping[0].id);\n    }\n  }\n\n  return repository.update(id, {\n    ...(input.roomId !== undefined ? { roomId } : {}),\n    ...(input.userId !== undefined ? { userId: input.userId } : {}),\n    ...(input.title !== undefined ? { title: input.title } : {}),\n    ...(input.startsAt !== undefined ? { startsAt } : {}),\n    ...(input.endsAt !== undefined ? { endsAt } : {}),\n  });\n}"
}
```

## Resposta

Now add the `getAvailability` function at the end of the service file.

## Ferramenta: Read

```json
{
  "file_path": "/app/src/modules/bookings/service.ts"
}
```

## Ferramenta: Edit

```json
{
  "replace_all": false,
  "file_path": "/app/src/modules/bookings/service.ts",
  "old_string": "export async function deleteBooking(id: string): Promise<void> {\n  await getBooking(id);\n  await repository.remove(id);\n}",
  "new_string": "export async function deleteBooking(id: string): Promise<void> {\n  await getBooking(id);\n  await repository.remove(id);\n}\n\nexport async function getAvailability(query: AvailabilityInput): Promise<AvailabilityResult> {\n  await getRoom(query.roomId);\n\n  const from = parseInstant(query.from);\n  const to = parseInstant(query.to);\n  if (!isBefore(from, to)) {\n    throw validationFailed('\"from\" must be before \"to\"', { from: query.from, to: query.to });\n  }\n\n  const overlapping = await repository.listOverlapping(query.roomId, from, to);\n\n  const slots: AvailabilityResult['slots'] = [];\n  let cursor = from;\n  for (const booking of overlapping) {\n    if (isBefore(cursor, booking.startsAt)) {\n      slots.push({ startsAt: cursor, endsAt: booking.startsAt });\n    }\n    if (isBefore(cursor, booking.endsAt)) {\n      cursor = booking.endsAt;\n    }\n  }\n  if (isBefore(cursor, to)) {\n    slots.push({ startsAt: cursor, endsAt: to });\n  }\n\n  return { roomId: query.roomId, from, to, slots };\n}"
}
```

## Resposta

Now let's add the schema definitions for the availability query/response.

## Ferramenta: Edit

```json
{
  "replace_all": false,
  "file_path": "/app/src/modules/bookings/schema.ts",
  "old_string": "export type CreateBookingInput = Static<typeof CreateBookingBody>;\nexport type UpdateBookingInput = Static<typeof UpdateBookingBody>;\nexport type ListBookingsInput = Static<typeof ListBookingsQuery>;",
  "new_string": "export const AvailabilityQuery = Type.Object({\n  roomId: Type.String({ minLength: 1 }),\n  from: Type.String({ minLength: 1 }),\n  to: Type.String({ minLength: 1 }),\n});\n\nexport const AvailabilitySlot = Type.Object({\n  startsAt: DateString,\n  endsAt: DateString,\n});\n\nexport const AvailabilityResponse = Type.Object({\n  roomId: Type.String(),\n  from: DateString,\n  to: DateString,\n  slots: Type.Array(AvailabilitySlot),\n});\n\nexport type CreateBookingInput = Static<typeof CreateBookingBody>;\nexport type UpdateBookingInput = Static<typeof UpdateBookingBody>;\nexport type ListBookingsInput = Static<typeof ListBookingsQuery>;\nexport type AvailabilityInput = Static<typeof AvailabilityQuery>;\n\nexport interface AvailabilityResult {\n  roomId: string;\n  from: Date;\n  to: Date;\n  slots: { startsAt: Date; endsAt: Date }[];\n}"
}
```

## Resposta

Now let's wire the route.

## Ferramenta: Edit

```json
{
  "replace_all": false,
  "file_path": "/app/src/modules/bookings/routes.ts",
  "old_string": "import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';\nimport {\n  BookingIdParams,\n  BookingPage,\n  BookingResponse,\n  CreateBookingBody,\n  ListBookingsQuery,\n  UpdateBookingBody,\n} from './schema.js';\nimport * as service from './service.js';\n\nexport const bookingsRoutes: FastifyPluginAsyncTypebox = async (app) => {\n  app.post('/', { schema: { body: CreateBookingBody, response: { 201: BookingResponse } } },\n    async (request, reply) => reply.code(201).send(await service.createBooking(request.body)));\n\n  app.get('/', { schema: { querystring: ListBookingsQuery, response: { 200: BookingPage } } },\n    async (request) => service.listBookings(request.query));\n\n  app.get('/:id', { schema: { params: BookingIdParams, response: { 200: BookingResponse } } },",
  "new_string": "import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';\nimport {\n  AvailabilityQuery,\n  AvailabilityResponse,\n  BookingIdParams,\n  BookingPage,\n  BookingResponse,\n  CreateBookingBody,\n  ListBookingsQuery,\n  UpdateBookingBody,\n} from './schema.js';\nimport * as service from './service.js';\n\nexport const bookingsRoutes: FastifyPluginAsyncTypebox = async (app) => {\n  app.post('/', { schema: { body: CreateBookingBody, response: { 201: BookingResponse } } },\n    async (request, reply) => reply.code(201).send(await service.createBooking(request.body)));\n\n  app.get('/', { schema: { querystring: ListBookingsQuery, response: { 200: BookingPage } } },\n    async (request) => service.listBookings(request.query));\n\n  app.get('/availability',\n    { schema: { querystring: AvailabilityQuery, response: { 200: AvailabilityResponse } } },\n    async (request) => service.getAvailability(request.query));\n\n  app.get('/:id', { schema: { params: BookingIdParams, response: { 200: BookingResponse } } },"
}
```

## Resposta

Now let's typecheck and lint.

## Ferramenta: Bash

```json
{
  "command": "npm run typecheck 2>&1 | tail -60"
}
```

## Ferramenta: Read

```json
{
  "file_path": "/app/src/modules/bookings/service.ts",
  "offset": 21,
  "limit": 10
}
```

## Ferramenta: Edit

```json
{
  "replace_all": false,
  "file_path": "/app/src/modules/bookings/service.ts",
  "old_string": "  const overlapping = await repository.listOverlapping(input.roomId, startsAt, endsAt);\n  if (overlapping.length > 0) {\n    throw bookingConflict(overlapping[0].id);\n  }",
  "new_string": "  const [conflict] = await repository.listOverlapping(input.roomId, startsAt, endsAt);\n  if (conflict) {\n    throw bookingConflict(conflict.id);\n  }"
}
```

## Ferramenta: Edit

```json
{
  "replace_all": false,
  "file_path": "/app/src/modules/bookings/service.ts",
  "old_string": "    const overlapping = await repository.listOverlapping(roomId, startsAt, endsAt, id);\n    if (overlapping.length > 0) {\n      throw bookingConflict(overlapping[0].id);\n    }",
  "new_string": "    const [conflict] = await repository.listOverlapping(roomId, startsAt, endsAt, id);\n    if (conflict) {\n      throw bookingConflict(conflict.id);\n    }"
}
```

## Ferramenta: Bash

```json
{
  "command": "npm run typecheck 2>&1 | tail -60 && npm run lint 2>&1 | tail -80"
}
```

## Resposta

Both pass. Now let's run the existing test suite to check nothing broke.

## Ferramenta: Bash

```json
{
  "command": "npm test 2>&1 | tail -100"
}
```

## Resposta

All existing tests pass. Now let's add tests for the new behavior (fixed overlap detection, update-time conflict check, and the availability endpoint).

## Ferramenta: Edit

```json
{
  "replace_all": false,
  "file_path": "/app/tests/bookings.test.ts",
  "old_string": "  it('reports which booking caused the conflict', async () => {\n    const first = await book(24, 25);\n    const response = await book(24.5, 25.5, 'Overlap');\n    expect(response.json().error.details.conflictingBookingId).toBe(first.json().id);\n  });\n});",
  "new_string": "  it('reports which booking caused the conflict', async () => {\n    const first = await book(24, 25);\n    const response = await book(24.5, 25.5, 'Overlap');\n    expect(response.json().error.details.conflictingBookingId).toBe(first.json().id);\n  });\n\n  it('rejects a booking that fully engulfs an active booking', async () => {\n    await book(24, 25);\n    const response = await book(23.5, 25.5, 'Engulfing');\n    expect(response.statusCode).toBe(409);\n    expect(response.json().error.code).toBe('BOOKING_CONFLICT');\n  });\n\n  it('rejects an update that would overlap another active booking', async () => {\n    await book(24, 25);\n    const second = await book(26, 27, 'Later');\n    const response = await app.inject({\n      method: 'PATCH',\n      url: `/bookings/${second.json().id}`,\n      payload: { startsAt: inHours(24.5), endsAt: inHours(25.5) },\n    });\n    expect(response.statusCode).toBe(409);\n    expect(response.json().error.code).toBe('BOOKING_CONFLICT');\n  });\n\n  it('allows an update that keeps the same booking in place', async () => {\n    const created = await book(24, 25);\n    const response = await app.inject({\n      method: 'PATCH',\n      url: `/bookings/${created.json().id}`,\n      payload: { startsAt: inHours(24), endsAt: inHours(25.5) },\n    });\n    expect(response.statusCode).toBe(200);\n  });\n\n  describe('availability', () => {\n    it('answers 404 when the room does not exist', async () => {\n      const response = await app.inject({\n        method: 'GET',\n        url: `/bookings/availability?roomId=missing&from=${inHours(0)}&to=${inHours(10)}`,\n      });\n      expect(response.statusCode).toBe(404);\n    });\n\n    it('rejects a window where \"from\" is not before \"to\"', async () => {\n      const response = await app.inject({\n        method: 'GET',\n        url: `/bookings/availability?roomId=${roomId}&from=${inHours(10)}&to=${inHours(0)}`,\n      });\n      expect(response.statusCode).toBe(400);\n    });\n\n    it('reports the whole window as free when there are no bookings', async () => {\n      const response = await app.inject({\n        method: 'GET',\n        url: `/bookings/availability?roomId=${roomId}&from=${inHours(0)}&to=${inHours(10)}`,\n      });\n      expect(response.statusCode).toBe(200);\n      const body = response.json();\n      expect(body.slots).toHaveLength(1);\n      expect(body.slots[0].startsAt).toBe(inHours(0));\n      expect(body.slots[0].endsAt).toBe(inHours(10));\n    });\n\n    it('lists the gaps left between active bookings', async () => {\n      await book(2, 3);\n      await book(5, 6);\n      const response = await app.inject({\n        method: 'GET',\n        url: `/bookings/availability?roomId=${roomId}&from=${inHours(0)}&to=${inHours(10)}`,\n      });\n      const slots = response.json().slots;\n      expect(slots).toEqual([\n        { startsAt: inHours(0), endsAt: inHours(2) },\n        { startsAt: inHours(3), endsAt: inHours(5) },\n        { startsAt: inHours(6), endsAt: inHours(10) },\n      ]);\n    });\n\n    it('does not count a cancelled booking as occupying its slot', async () => {\n      const created = await book(2, 3);\n      await app.inject({ method: 'POST', url: `/bookings/${created.json().id}/cancel` });\n      const response = await app.inject({\n        method: 'GET',\n        url: `/bookings/availability?roomId=${roomId}&from=${inHours(0)}&to=${inHours(10)}`,\n      });\n      expect(response.json().slots).toEqual([{ startsAt: inHours(0), endsAt: inHours(10) }]);\n    });\n  });\n});"
}
```

## Ferramenta: Bash

```json
{
  "command": "npm test 2>&1 | tail -100"
}
```

## Ferramenta: Read

```json
{
  "file_path": "/app/tests/bookings.test.ts",
  "offset": 208,
  "limit": 60
}
```

## Ferramenta: Edit

```json
{
  "replace_all": false,
  "file_path": "/app/tests/bookings.test.ts",
  "old_string": "    it('reports the whole window as free when there are no bookings', async () => {\n      const response = await app.inject({\n        method: 'GET',\n        url: `/bookings/availability?roomId=${roomId}&from=${inHours(0)}&to=${inHours(10)}`,\n      });\n      expect(response.statusCode).toBe(200);\n      const body = response.json();\n      expect(body.slots).toHaveLength(1);\n      expect(body.slots[0].startsAt).toBe(inHours(0));\n      expect(body.slots[0].endsAt).toBe(inHours(10));\n    });\n\n    it('lists the gaps left between active bookings', async () => {\n      await book(2, 3);\n      await book(5, 6);\n      const response = await app.inject({\n        method: 'GET',\n        url: `/bookings/availability?roomId=${roomId}&from=${inHours(0)}&to=${inHours(10)}`,\n      });\n      const slots = response.json().slots;\n      expect(slots).toEqual([\n        { startsAt: inHours(0), endsAt: inHours(2) },\n        { startsAt: inHours(3), endsAt: inHours(5) },\n        { startsAt: inHours(6), endsAt: inHours(10) },\n      ]);\n    });\n\n    it('does not count a cancelled booking as occupying its slot', async () => {\n      const created = await book(2, 3);\n      await app.inject({ method: 'POST', url: `/bookings/${created.json().id}/cancel` });\n      const response = await app.inject({\n        method: 'GET',\n        url: `/bookings/availability?roomId=${roomId}&from=${inHours(0)}&to=${inHours(10)}`,\n      });\n      expect(response.json().slots).toEqual([{ startsAt: inHours(0), endsAt: inHours(10) }]);\n    });",
  "new_string": "    it('reports the whole window as free when there are no bookings', async () => {\n      const from = inHours(0);\n      const to = inHours(10);\n      const response = await app.inject({\n        method: 'GET',\n        url: `/bookings/availability?roomId=${roomId}&from=${from}&to=${to}`,\n      });\n      expect(response.statusCode).toBe(200);\n      expect(response.json().slots).toEqual([{ startsAt: from, endsAt: to }]);\n    });\n\n    it('lists the gaps left between active bookings', async () => {\n      const from = inHours(0);\n      const to = inHours(10);\n      const first = await book(2, 3);\n      const second = await book(5, 6);\n      const response = await app.inject({\n        method: 'GET',\n        url: `/bookings/availability?roomId=${roomId}&from=${from}&to=${to}`,\n      });\n      expect(response.json().slots).toEqual([\n        { startsAt: from, endsAt: first.json().startsAt },\n        { startsAt: first.json().endsAt, endsAt: second.json().startsAt },\n        { startsAt: second.json().endsAt, endsAt: to },\n      ]);\n    });\n\n    it('does not count a cancelled booking as occupying its slot', async () => {\n      const from = inHours(0);\n      const to = inHours(10);\n      const created = await book(2, 3);\n      await app.inject({ method: 'POST', url: `/bookings/${created.json().id}/cancel` });\n      const response = await app.inject({\n        method: 'GET',\n        url: `/bookings/availability?roomId=${roomId}&from=${from}&to=${to}`,\n      });\n      expect(response.json().slots).toEqual([{ startsAt: from, endsAt: to }]);\n    });"
}
```

## Ferramenta: Bash

```json
{
  "command": "npm test 2>&1 | tail -60"
}
```

## Resposta

All 72 tests pass. Let's run the full `make verify` sequence to confirm everything's clean end-to-end.

## Ferramenta: Bash

```json
{
  "command": "make verify 2>&1 | tail -100"
}
```

## Resposta

`make verify` passes clean (typecheck, lint, build, test).

## Summary

RES-142's real pain point is that users have no way to know a room's free slots — they can only find out by guessing a time and getting a `409 BOOKING_CONFLICT`, repeating that for each meeting they need to schedule. I added a way to ask upfront instead of guessing:

**New: `GET /bookings/availability?roomId=&from=&to=`** (`src/modules/bookings/{routes,service,schema}.ts`) — returns the free gaps for a room within a time window, computed from its active bookings:
```json
{ "roomId": "...", "from": "...", "to": "...", "slots": [{ "startsAt": "...", "endsAt": "..." }] }
```
404 if the room doesn't exist, 400 if `from`/`to` isn't a valid instant or `from` isn't before `to`. Someone booking several meetings can fetch one window and pick multiple free slots in a single round trip, instead of trial-and-error POSTs.

**Correctness fix underneath it:** the existing conflict check (`findConflictAtStart`) only looked at whether an existing booking covered the *start instant* of the new one — a booking that fully enclosed an existing one (e.g. existing 24h–25h, new 23:30h–25:30h) slipped through as no conflict. I replaced it with `listOverlapping`, a proper interval-overlap query (`start < otherEnd && end > otherStart`), reused by both booking creation and the new availability endpoint so both agree on what "occupied" means. I also wired the same check into `updateBooking`, since CLAUDE.md's domain rules state the no-overlap rule applies to any operation that changes a booking's room or time, and that path previously ran no conflict check at all.

Added 8 tests in `tests/bookings.test.ts` covering the engulfing-overlap fix, conflict-on-update, and the availability endpoint's 404/400/empty/gaps/cancelled-booking cases. `make verify` is clean.
