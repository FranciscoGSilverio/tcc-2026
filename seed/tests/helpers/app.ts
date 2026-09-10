import { prisma } from '../../src/db/client.js';

export async function resetDb(): Promise<void> {
  await prisma.roomAmenity.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.amenity.deleteMany();
  await prisma.room.deleteMany();
  await prisma.user.deleteMany();
}
