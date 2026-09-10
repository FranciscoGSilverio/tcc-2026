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

  it('updates a user while keeping its own email', async () => {
    const created = await createUser('ada@example.com');
    const response = await app.inject({
      method: 'PATCH',
      url: `/users/${created.json().id}`,
      payload: { email: 'ada@example.com', name: 'Ada B. Lovelace' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.statusCode).not.toBe(409);
  });

  it('deletes a user', async () => {
    const created = await createUser('ada@example.com');
    const id = created.json().id;
    expect((await app.inject({ method: 'DELETE', url: `/users/${id}` })).statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: `/users/${id}` })).statusCode).toBe(404);
  });
});
