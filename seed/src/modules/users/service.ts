import type { User } from '@prisma/client';
import { emailTaken, notFound, validationFailed } from '../../shared/errors.js';
import {
  normalizeLimit,
  normalizeOffset,
  paginated,
  type Page,
} from '../../shared/pagination.js';
import * as repository from './repository.js';
import type { CreateUserInput, ListUsersInput, UpdateUserInput } from './schema.js';

const MAX_NAME_LENGTH = 120;

function assertValidEmail(email: string): void {
  if (!email.includes('@') || !email.includes('.')) {
    throw validationFailed('Email is not valid', { email });
  }
}

function assertValidName(name: string): void {
  if (name.length > MAX_NAME_LENGTH) {
    throw validationFailed('Name is too long', { maxLength: MAX_NAME_LENGTH });
  }
}

export async function createUser(input: CreateUserInput): Promise<User> {
  assertValidEmail(input.email);
  assertValidName(input.name);
  const existing = await repository.findByEmail(input.email);
  if (existing) {
    throw emailTaken(input.email);
  }
  return repository.create(input);
}

export async function getUser(id: string): Promise<User> {
  const user = await repository.findById(id);
  if (!user) {
    throw notFound('User');
  }
  return user;
}

export async function listUsers(query: ListUsersInput): Promise<Page<User>> {
  const limit = normalizeLimit(query.limit);
  const offset = normalizeOffset(query.offset);
  const [data, total] = await repository.list({ email: query.email, limit, offset });
  return paginated(data, total, limit, offset);
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  await getUser(id);
  if (input.email !== undefined) {
    assertValidEmail(input.email);
    const existing = await repository.findByEmail(input.email);
    if (existing && existing.id !== id) {
      throw emailTaken(input.email);
    }
  }
  if (input.name !== undefined) {
    assertValidName(input.name);
  }
  return repository.update(id, input);
}

export async function deleteUser(id: string): Promise<void> {
  await getUser(id);
  await repository.remove(id);
}
