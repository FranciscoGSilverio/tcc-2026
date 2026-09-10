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
});
