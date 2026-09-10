import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

export default function setup(): void {
  mkdirSync('data', { recursive: true });
  execFileSync(
    'npx',
    ['prisma', 'db', 'push', '--skip-generate', '--force-reset', '--accept-data-loss'],
    {
      env: { ...process.env, DATABASE_URL: 'file:../data/test.db' },
      stdio: 'ignore',
    },
  );
}
