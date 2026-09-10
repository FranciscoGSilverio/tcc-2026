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
