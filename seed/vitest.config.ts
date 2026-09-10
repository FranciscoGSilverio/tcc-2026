import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./tests/helpers/global-setup.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    env: { DATABASE_URL: 'file:./data/test.db', NODE_ENV: 'test' },
    include: ['tests/**/*.test.ts'],
  },
});
