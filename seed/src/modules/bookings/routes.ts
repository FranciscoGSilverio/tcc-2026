import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  BookingIdParams,
  BookingPage,
  BookingResponse,
  CreateBookingBody,
  ListBookingsQuery,
  UpdateBookingBody,
} from './schema.js';
import * as service from './service.js';

export const bookingsRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.post('/', { schema: { body: CreateBookingBody, response: { 201: BookingResponse } } },
    async (request, reply) => reply.code(201).send(await service.createBooking(request.body)));

  app.get('/', { schema: { querystring: ListBookingsQuery, response: { 200: BookingPage } } },
    async (request) => service.listBookings(request.query));

  app.get('/:id', { schema: { params: BookingIdParams, response: { 200: BookingResponse } } },
    async (request) => service.getBooking(request.params.id));

  app.patch('/:id',
    { schema: { params: BookingIdParams, body: UpdateBookingBody, response: { 200: BookingResponse } } },
    async (request) => service.updateBooking(request.params.id, request.body));

  app.post('/:id/cancel',
    { schema: { params: BookingIdParams, response: { 200: BookingResponse } } },
    async (request) => service.cancelBooking(request.params.id));

  app.delete('/:id', { schema: { params: BookingIdParams } }, async (request, reply) => {
    await service.deleteBooking(request.params.id);
    return reply.code(204).send();
  });
};
