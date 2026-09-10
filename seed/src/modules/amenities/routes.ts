import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { replyConflict, replyNotFound } from '../../shared/http-reply.js';
import * as queries from './queries.js';

const AmenityResponse = Type.Object({
  id: Type.String(),
  name: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
});

const CreateAmenityBody = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 80 }),
    description: Type.Optional(Type.String({ maxLength: 200 })),
  },
  { additionalProperties: false },
);

const AmenityIdParams = Type.Object({ id: Type.String({ minLength: 1 }) });

const RoomAmenityParams = Type.Object({
  roomId: Type.String({ minLength: 1 }),
  amenityId: Type.String({ minLength: 1 }),
});

export const amenitiesRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.post('/amenities', { schema: { body: CreateAmenityBody, response: { 201: AmenityResponse } } },
    async (request, reply) => {
      const existing = await queries.findAmenityByName(request.body.name);
      if (existing) {
        return replyConflict(reply, 'AMENITY_NAME_TAKEN', 'Amenity name is already in use');
      }
      const created = await queries.insertAmenity(request.body.name, request.body.description);
      return reply.code(201).send(created);
    });

  app.get('/amenities', { schema: { response: { 200: Type.Array(AmenityResponse) } } },
    async () => queries.listAmenities());

  app.delete('/amenities/:id', { schema: { params: AmenityIdParams } },
    async (request, reply) => {
      const amenity = await queries.findAmenityById(request.params.id);
      if (!amenity) {
        return replyNotFound(reply, 'Amenity');
      }
      await queries.deleteAmenity(amenity.id);
      return reply.code(204).send();
    });

  app.put('/rooms/:roomId/amenities/:amenityId', { schema: { params: RoomAmenityParams } },
    async (request, reply) => {
      const room = await queries.findRoom(request.params.roomId);
      if (!room) {
        return replyNotFound(reply, 'Room');
      }
      const amenity = await queries.findAmenityById(request.params.amenityId);
      if (!amenity) {
        return replyNotFound(reply, 'Amenity');
      }
      await queries.linkAmenity(room.id, amenity.id);
      return reply.code(204).send();
    });

  app.delete('/rooms/:roomId/amenities/:amenityId', { schema: { params: RoomAmenityParams } },
    async (request, reply) => {
      const room = await queries.findRoom(request.params.roomId);
      if (!room) {
        return replyNotFound(reply, 'Room');
      }
      await queries.unlinkAmenity(room.id, request.params.amenityId);
      return reply.code(204).send();
    });
};
