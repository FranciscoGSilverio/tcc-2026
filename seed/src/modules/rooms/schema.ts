import { Type, type Static } from '@sinclair/typebox';

const DateString = Type.Unsafe<Date>(Type.String());

export const RoomResponse = Type.Object({
  id: Type.String(),
  name: Type.String(),
  capacity: Type.Integer(),
  floor: Type.Union([Type.String(), Type.Null()]),
  createdAt: DateString,
  updatedAt: DateString,
});

export const CreateRoomBody = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 120 }),
    capacity: Type.Integer({ minimum: 1, maximum: 1000 }),
    floor: Type.Optional(Type.String({ maxLength: 40 })),
  },
  { additionalProperties: false },
);

export const UpdateRoomBody = Type.Partial(CreateRoomBody);

export const RoomIdParams = Type.Object({ id: Type.String({ minLength: 1 }) });

export const ListRoomsQuery = Type.Object({
  name: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Integer({ minimum: 1 })),
  offset: Type.Optional(Type.Integer({ minimum: 0 })),
});

export const RoomPage = Type.Object({
  data: Type.Array(RoomResponse),
  pagination: Type.Object({
    total: Type.Integer(),
    limit: Type.Integer(),
    offset: Type.Integer(),
  }),
});

export type CreateRoomInput = Static<typeof CreateRoomBody>;
export type UpdateRoomInput = Static<typeof UpdateRoomBody>;
export type ListRoomsInput = Static<typeof ListRoomsQuery>;
