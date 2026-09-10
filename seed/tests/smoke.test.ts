import { describe, expect, it } from 'vitest';

describe('toolchain', () => {
  it('runs TypeScript under Vitest', () => {
    const value: string = 'ok';
    expect(value).toBe('ok');
  });
});
