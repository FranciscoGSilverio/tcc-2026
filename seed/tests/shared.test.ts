import { describe, expect, it } from 'vitest';
import { AppError, bookingConflict, errorBody, notFound } from '../src/shared/errors.js';
import { normalizeLimit, normalizeOffset, paginated } from '../src/shared/pagination.js';
import { durationMinutes, parseInstant } from '../src/shared/time.js';

describe('errors', () => {
  it('builds a not found error', () => {
    const error = notFound('Room');
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.statusCode).toBe(404);
  });

  it('carries the conflicting booking in the details', () => {
    const error = bookingConflict('abc');
    expect(error.statusCode).toBe(409);
    expect(error.details).toEqual({ conflictingBookingId: 'abc' });
  });

  it('wraps a payload in the error envelope', () => {
    expect(errorBody('NOT_FOUND', 'Room not found')).toEqual({
      error: { code: 'NOT_FOUND', message: 'Room not found', details: {} },
    });
  });
});

describe('pagination', () => {
  it('falls back to the default limit', () => {
    expect(normalizeLimit(undefined)).toBe(20);
  });

  it('caps the limit at the maximum', () => {
    expect(normalizeLimit(500)).toBe(100);
  });

  it('never returns a negative offset', () => {
    expect(normalizeOffset(-5)).toBe(0);
  });

  it('builds the page envelope', () => {
    expect(paginated([1, 2], 7, 20, 0)).toEqual({
      data: [1, 2],
      pagination: { total: 7, limit: 20, offset: 0 },
    });
  });
});

describe('time', () => {
  it('parses an ISO instant', () => {
    expect(parseInstant('2030-01-01T10:00:00.000Z').getTime()).toBe(
      Date.UTC(2030, 0, 1, 10, 0, 0),
    );
  });

  it('rejects a value that is not an instant', () => {
    expect(() => parseInstant('not-a-date')).toThrowError(AppError);
  });

  it('measures the duration in minutes', () => {
    const start = new Date(Date.now());
    const end = new Date(start.getTime() + 90 * 60_000);
    expect(durationMinutes(start, end)).toBe(90);
  });
});
