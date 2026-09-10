import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { roomsRoutes } from '../modules/rooms/routes.js';

export const registerModules: FastifyPluginAsyncTypebox = async (app) => {
  app.get('/health', async () => ({ status: 'ok' }));
  await app.register(roomsRoutes, { prefix: '/rooms' });
};
