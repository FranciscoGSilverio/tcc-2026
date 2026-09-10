import type { Booking } from '@prisma/client';
import { notFound } from '../../shared/errors.js';
import {
  normalizeLimit,
  normalizeOffset,
  paginated,
  type Page,
} from '../../shared/pagination.js';
import { parseInstant } from '../../shared/time.js';
import * as repository from './repository.js';
import { BOOKING_CANCELLED } from './schema.js';
import type { CreateBookingInput, ListBookingsInput, UpdateBookingInput } from './schema.js';

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const startsAt = parseInstant(input.startsAt);
  const endsAt = parseInstant(input.endsAt);
  return repository.create({
    roomId: input.roomId,
    userId: input.userId,
    title: input.title,
    startsAt,
    endsAt,
  });
}

export async function getBooking(id: string): Promise<Booking> {
  const booking = await repository.findById(id);
  if (!booking) {
    throw notFound('Booking');
  }
  return booking;
}

export async function listBookings(query: ListBookingsInput): Promise<Page<Booking>> {
  const limit = normalizeLimit(query.limit);
  const offset = normalizeOffset(query.offset);
  const [data, total] = await repository.list({
    roomId: query.roomId,
    userId: query.userId,
    status: query.status,
    from: query.from ? parseInstant(query.from) : undefined,
    to: query.to ? parseInstant(query.to) : undefined,
    limit,
    offset,
  });
  return paginated(data, total, limit, offset);
}

export async function updateBooking(id: string, input: UpdateBookingInput): Promise<Booking> {
  await getBooking(id);
  return repository.update(id, {
    ...(input.roomId !== undefined ? { roomId: input.roomId } : {}),
    ...(input.userId !== undefined ? { userId: input.userId } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.startsAt !== undefined ? { startsAt: parseInstant(input.startsAt) } : {}),
    ...(input.endsAt !== undefined ? { endsAt: parseInstant(input.endsAt) } : {}),
  });
}

export async function cancelBooking(id: string): Promise<Booking> {
  const booking = await getBooking(id);
  if (booking.status === BOOKING_CANCELLED) {
    return booking;
  }
  return repository.updateStatus(id, BOOKING_CANCELLED);
}

export async function deleteBooking(id: string): Promise<void> {
  await getBooking(id);
  await repository.remove(id);
}
