import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  CreateUserBody,
  ListUsersQuery,
  UpdateUserBody,
  UserIdParams,
  UserPage,
  UserResponse,
} from './schema.js';
import * as service from './service.js';

export const usersRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.post('/', { schema: { body: CreateUserBody, response: { 201: UserResponse } } },
    async (request, reply) => reply.code(201).send(await service.createUser(request.body)));

  app.get('/', { schema: { querystring: ListUsersQuery, response: { 200: UserPage } } },
    async (request) => service.listUsers(request.query));

  app.get('/:id', { schema: { params: UserIdParams, response: { 200: UserResponse } } },
    async (request) => service.getUser(request.params.id));

  app.patch('/:id',
    { schema: { params: UserIdParams, body: UpdateUserBody, response: { 200: UserResponse } } },
    async (request) => service.updateUser(request.params.id, request.body));

  app.delete('/:id', { schema: { params: UserIdParams } }, async (request, reply) => {
    await service.deleteUser(request.params.id);
    return reply.code(204).send();
  });
};
