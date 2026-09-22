import type { User } from '@prisma/client';
import { prisma } from '../../db/client.js';
import type { CreateUserInput, UpdateUserInput } from './schema.js';

export interface UserFilter {
  email?: string;
  limit: number;
  offset: number;
}

export function create(input: CreateUserInput): Promise<User> {
  return prisma.user.create({ data: input });
}

export function findById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

export function findByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
}

export function list(filter: UserFilter): Promise<[User[], number]> {
  const where = filter.email ? { email: { contains: filter.email } } : {};
  return prisma.$transaction([
    prisma.user.findMany({
      where,
      take: filter.limit,
      skip: filter.offset,
      orderBy: { name: 'asc' },
    }),
    prisma.user.count({ where }),
  ]);
}

export function update(id: string, input: UpdateUserInput): Promise<User> {
  return prisma.user.update({ where: { id }, data: input });
}

export function remove(id: string): Promise<User> {
  return prisma.user.delete({ where: { id } });
}
