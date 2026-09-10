export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'ROOM_NAME_TAKEN'
  | 'EMAIL_TAKEN'
  | 'BOOKING_CONFLICT'
  | 'INTERNAL_ERROR';

export interface ErrorBody {
  error: { code: ErrorCode; message: string; details: Record<string, unknown> };
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    statusCode: number,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function errorBody(
  code: ErrorCode,
  message: string,
  details: Record<string, unknown> = {},
): ErrorBody {
  return { error: { code, message, details } };
}

export function validationFailed(message: string, details: Record<string, unknown> = {}): AppError {
  return new AppError('VALIDATION_ERROR', 400, message, details);
}

export function notFound(what: string): AppError {
  return new AppError('NOT_FOUND', 404, `${what} not found`);
}

export function roomNameTaken(name: string): AppError {
  return new AppError('ROOM_NAME_TAKEN', 409, 'Room name is already in use', { name });
}

export function emailTaken(email: string): AppError {
  return new AppError('EMAIL_TAKEN', 409, 'Email is already in use', { email });
}

export function bookingConflict(conflictingBookingId: string): AppError {
  return new AppError('BOOKING_CONFLICT', 409, 'Room is already booked for this period', {
    conflictingBookingId,
  });
}
