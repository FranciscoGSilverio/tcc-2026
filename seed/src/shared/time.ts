import { validationFailed } from './errors.js';

export const MINUTE_IN_MS = 60_000;

export function parseInstant(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw validationFailed('Value is not a valid instant', { value });
  }
  return parsed;
}

export function durationMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / MINUTE_IN_MS);
}

export function isBefore(a: Date, b: Date): boolean {
  return a.getTime() < b.getTime();
}
