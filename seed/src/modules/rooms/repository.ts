import type { Room } from '@prisma/client';
import { prisma } from '../../db/client.js';
import type { CreateRoomInput, UpdateRoomInput } from './schema.js';

export interface RoomFilter {
  name?: string;
  limit: number;
  offset: number;
}

export function create(input: CreateRoomInput): Promise<Room> {
  return prisma.room.create({ data: input });
}

export function findById(id: string): Promise<Room | null> {
  return prisma.room.findUnique({ where: { id } });
}

export function findByName(name: string): Promise<Room | null> {
  return prisma.room.findUnique({ where: { name } });
}

export function list(filter: RoomFilter): Promise<[Room[], number]> {
  const where = filter.name ? { name: { contains: filter.name } } : {};
  return prisma.$transaction([
    prisma.room.findMany({
      where,
      take: filter.limit,
      skip: filter.offset,
      orderBy: { name: 'asc' },
    }),
    prisma.room.count({ where }),
  ]);
}

export function update(id: string, input: UpdateRoomInput): Promise<Room> {
  return prisma.room.update({ where: { id }, data: input });
}

export function remove(id: string): Promise<Room> {
  return prisma.room.delete({ where: { id } });
}
