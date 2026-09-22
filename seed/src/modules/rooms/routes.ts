import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  CreateRoomBody,
  ListRoomsQuery,
  RoomIdParams,
  RoomPage,
  RoomResponse,
  UpdateRoomBody,
} from './schema.js';
import * as service from './service.js';

export const roomsRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.post('/', { schema: { body: CreateRoomBody, response: { 201: RoomResponse } } },
    async (request, reply) => reply.code(201).send(await service.createRoom(request.body)));

  app.get('/', { schema: { querystring: ListRoomsQuery, response: { 200: RoomPage } } },
    async (request) => service.listRooms(request.query));

  app.get('/:id', { schema: { params: RoomIdParams, response: { 200: RoomResponse } } },
    async (request) => service.getRoom(request.params.id));

  app.patch('/:id',
    { schema: { params: RoomIdParams, body: UpdateRoomBody, response: { 200: RoomResponse } } },
    async (request) => service.updateRoom(request.params.id, request.body));

  app.delete('/:id', { schema: { params: RoomIdParams } }, async (request, reply) => {
    await service.deleteRoom(request.params.id);
    return reply.code(204).send();
  });
};
