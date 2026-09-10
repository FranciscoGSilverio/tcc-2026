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
