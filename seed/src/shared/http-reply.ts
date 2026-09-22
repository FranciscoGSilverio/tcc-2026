import type { FastifyReply } from 'fastify';
import { errorBody, type ErrorCode } from './errors.js';

export function replyNotFound(reply: FastifyReply, what: string): FastifyReply {
  return reply.code(404).send(errorBody('NOT_FOUND', `${what} not found`));
}

export function replyConflict(reply: FastifyReply, code: ErrorCode, message: string): FastifyReply {
  return reply.code(409).send(errorBody(code, message));
}
