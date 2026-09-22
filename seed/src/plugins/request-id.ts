import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

export async function requestIdPlugin(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (request, reply) => {
    const incoming = request.headers['x-request-id'];
    const id = typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();
    reply.header('x-request-id', id);
  });
}
