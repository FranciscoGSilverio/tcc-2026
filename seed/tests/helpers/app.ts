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
