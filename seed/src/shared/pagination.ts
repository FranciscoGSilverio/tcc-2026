export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export interface Page<T> {
  data: T[];
  pagination: { total: number; limit: number; offset: number };
}

export function normalizeLimit(limit?: number): number {
  if (limit === undefined || Number.isNaN(limit)) return DEFAULT_LIMIT;
  if (limit < 1) return DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
}

export function normalizeOffset(offset?: number): number {
  if (offset === undefined || Number.isNaN(offset) || offset < 0) return 0;
  return offset;
}

export function paginated<T>(data: T[], total: number, limit: number, offset: number): Page<T> {
  return { data, pagination: { total, limit, offset } };
}
