import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { bookingsRoutes } from '../modules/bookings/routes.js';
import { roomsRoutes } from '../modules/rooms/routes.js';
import { usersRoutes } from '../modules/users/routes.js';

export const registerModules: FastifyPluginAsyncTypebox = async (app) => {
  app.get('/health', async () => ({ status: 'ok' }));
  await app.register(roomsRoutes, { prefix: '/rooms' });
  await app.register(usersRoutes, { prefix: '/users' });
  await app.register(bookingsRoutes, { prefix: '/bookings' });
};
