import type { FastifyInstance } from 'fastify';
import { AppError, errorBody } from '../shared/errors.js';

export async function errorHandlerPlugin(app: FastifyInstance): Promise<void> {
  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send(errorBody('NOT_FOUND', 'Route not found'));
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      reply.code(error.statusCode).send(errorBody(error.code, error.message, error.details));
      return;
    }

    if (error.validation) {
      reply
        .code(400)
        .send(errorBody('VALIDATION_ERROR', 'Request payload is invalid', {
          issues: error.validation.map((issue) => issue.message ?? 'invalid'),
        }));
      return;
    }

    if (typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500) {
      reply.code(error.statusCode).send(errorBody('VALIDATION_ERROR', error.message));
      return;
    }

    request.log.error({ err: error }, 'unhandled error');
    reply.code(500).send(errorBody('INTERNAL_ERROR', 'Unexpected error'));
  });
}
