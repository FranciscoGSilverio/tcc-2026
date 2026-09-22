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

  it('answers a bodyless JSON request with the error envelope, not a crash', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/bookings/00000000-0000-0000-0000-000000000000/cancel',
      headers: { 'content-type': 'application/json' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });
});
