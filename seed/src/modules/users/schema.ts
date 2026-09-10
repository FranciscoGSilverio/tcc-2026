import { Type, type Static } from '@sinclair/typebox';
import { DateString } from '../../shared/schema.js';

export const EMAIL_PATTERN = '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$';

export const UserResponse = Type.Object({
  id: Type.String(),
  name: Type.String(),
  email: Type.String(),
  createdAt: DateString,
  updatedAt: DateString,
});

export const CreateUserBody = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 120 }),
    email: Type.String({ minLength: 3, maxLength: 160, pattern: EMAIL_PATTERN }),
  },
  { additionalProperties: false },
);

export const UpdateUserBody = Type.Partial(CreateUserBody);

export const UserIdParams = Type.Object({ id: Type.String({ minLength: 1 }) });

export const ListUsersQuery = Type.Object({
  email: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Integer({ minimum: 1 })),
  offset: Type.Optional(Type.Integer({ minimum: 0 })),
});

export const UserPage = Type.Object({
  data: Type.Array(UserResponse),
  pagination: Type.Object({
    total: Type.Integer(),
    limit: Type.Integer(),
    offset: Type.Integer(),
  }),
});

export type CreateUserInput = Static<typeof CreateUserBody>;
export type UpdateUserInput = Static<typeof UpdateUserBody>;
export type ListUsersInput = Static<typeof ListUsersQuery>;
