import { Type, type Static } from '@sinclair/typebox';
import { DateString } from '../../shared/schema.js';

export const BOOKING_ACTIVE = 'ACTIVE';
export const BOOKING_CANCELLED = 'CANCELLED';

export const BookingResponse = Type.Object({
  id: Type.String(),
  roomId: Type.String(),
  userId: Type.String(),
  title: Type.String(),
  startsAt: DateString,
  endsAt: DateString,
  status: Type.String(),
  createdAt: DateString,
  updatedAt: DateString,
});

export const CreateBookingBody = Type.Object(
  {
    roomId: Type.String({ minLength: 1 }),
    userId: Type.String({ minLength: 1 }),
    title: Type.String({ minLength: 1, maxLength: 200 }),
    startsAt: Type.String({ minLength: 1 }),
    endsAt: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const UpdateBookingBody = Type.Partial(CreateBookingBody);

export const BookingIdParams = Type.Object({ id: Type.String({ minLength: 1 }) });

export const ListBookingsQuery = Type.Object({
  roomId: Type.Optional(Type.String()),
  userId: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
  from: Type.Optional(Type.String()),
  to: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Integer({ minimum: 1 })),
  offset: Type.Optional(Type.Integer({ minimum: 0 })),
});

export const BookingPage = Type.Object({
  data: Type.Array(BookingResponse),
  pagination: Type.Object({
    total: Type.Integer(),
    limit: Type.Integer(),
    offset: Type.Integer(),
  }),
});

export type CreateBookingInput = Static<typeof CreateBookingBody>;
export type UpdateBookingInput = Static<typeof UpdateBookingBody>;
export type ListBookingsInput = Static<typeof ListBookingsQuery>;
