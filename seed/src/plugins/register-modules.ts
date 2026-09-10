import type { FastifyInstance } from 'fastify';

export async function registerModules(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({ status: 'ok' }));
}
