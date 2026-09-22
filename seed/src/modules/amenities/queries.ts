import type { Amenity, Room } from '@prisma/client';
import { prisma } from '../../db/client.js';

export function listAmenities(): Promise<Amenity[]> {
  return prisma.amenity.findMany({ orderBy: { name: 'asc' } });
}

export function findAmenityById(id: string): Promise<Amenity | null> {
  return prisma.amenity.findUnique({ where: { id } });
}

export function findAmenityByName(name: string): Promise<Amenity | null> {
  return prisma.amenity.findUnique({ where: { name } });
}

export function insertAmenity(name: string, description?: string): Promise<Amenity> {
  return prisma.amenity.create({ data: { name, description } });
}

export function deleteAmenity(id: string): Promise<Amenity> {
  return prisma.amenity.delete({ where: { id } });
}

export function findRoom(id: string): Promise<Room | null> {
  return prisma.room.findUnique({ where: { id } });
}

export async function linkAmenity(roomId: string, amenityId: string): Promise<void> {
  await prisma.roomAmenity.upsert({
    where: { roomId_amenityId: { roomId, amenityId } },
    create: { roomId, amenityId },
    update: {},
  });
}

export async function unlinkAmenity(roomId: string, amenityId: string): Promise<void> {
  await prisma.roomAmenity.deleteMany({ where: { roomId, amenityId } });
}
