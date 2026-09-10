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
