import type { Booking, Prisma } from '@prisma/client';
import { prisma } from '../../db/client.js';

export interface BookingData {
  roomId: string;
  userId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
}

export interface BookingFilter {
  roomId?: string;
  userId?: string;
  status?: string;
  from?: Date;
  to?: Date;
  limit: number;
  offset: number;
}

export function create(data: BookingData): Promise<Booking> {
  return prisma.booking.create({ data });
}

export function findById(id: string): Promise<Booking | null> {
  return prisma.booking.findUnique({ where: { id } });
}

export function list(filter: BookingFilter): Promise<[Booking[], number]> {
  const where: Prisma.BookingWhereInput = {};
  if (filter.roomId) where.roomId = filter.roomId;
  if (filter.userId) where.userId = filter.userId;
  if (filter.status) where.status = filter.status;
  if (filter.from) where.startsAt = { gte: filter.from };
  if (filter.to) where.endsAt = { lte: filter.to };

  return prisma.$transaction([
    prisma.booking.findMany({
      where,
      take: filter.limit,
      skip: filter.offset,
      orderBy: { startsAt: 'asc' },
    }),
    prisma.booking.count({ where }),
  ]);
}

export function update(id: string, data: Partial<BookingData>): Promise<Booking> {
  return prisma.booking.update({ where: { id }, data });
}

export function updateStatus(id: string, status: string): Promise<Booking> {
  return prisma.booking.update({ where: { id }, data: { status } });
}

export function remove(id: string): Promise<Booking> {
  return prisma.booking.delete({ where: { id } });
}
