import { prisma, disconnect } from '../src/db/client.js';

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

  await disconnect();
}

void main();
