import type { Room } from '@prisma/client';
import { notFound, roomNameTaken } from '../../shared/errors.js';
import {
  normalizeLimit,
  normalizeOffset,
  paginated,
  type Page,
} from '../../shared/pagination.js';
import * as repository from './repository.js';
import type { CreateRoomInput, ListRoomsInput, UpdateRoomInput } from './schema.js';

export async function createRoom(input: CreateRoomInput): Promise<Room> {
  const existing = await repository.findByName(input.name);
  if (existing) {
    throw roomNameTaken(input.name);
  }
  return repository.create(input);
}

export async function getRoom(id: string): Promise<Room> {
  const room = await repository.findById(id);
  if (!room) {
    throw notFound('Room');
  }
  return room;
}

export async function listRooms(query: ListRoomsInput): Promise<Page<Room>> {
  const limit = normalizeLimit(query.limit);
  const offset = normalizeOffset(query.offset);
  const [data, total] = await repository.list({ name: query.name, limit, offset });
  return paginated(data, total, limit, offset);
}

export async function updateRoom(id: string, input: UpdateRoomInput): Promise<Room> {
  await getRoom(id);
  if (input.name !== undefined) {
    const existing = await repository.findByName(input.name);
    if (existing && existing.id !== id) {
      throw roomNameTaken(input.name);
    }
  }
  return repository.update(id, input);
}

export async function deleteRoom(id: string): Promise<void> {
  await getRoom(id);
  await repository.remove(id);
}
