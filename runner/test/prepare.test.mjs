import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exec, stop } from '../lib/container.mjs';
import { prepare, InfrastructureError } from '../lib/prepare.mjs';

const NAME = 'runner-prepare-test';
const outDir = mkdtempSync(join(tmpdir(), 'runner-prep-'));

after(() => stop(NAME));

test('prepares a working copy and reports the reproducibility anchors', async () => {
  const info = await prepare({ name: NAME, outDir, hostPort: 3520, env: {} });
  assert.match(info.imageId, /^sha256:/);
  assert.match(info.cliVersion, /^\d+\./);
});

test('the working copy history holds exactly one neutral commit', () => {
  const log = exec(NAME, ['sh', '-c', 'cd /app && git log --oneline'], { workdir: '/app' });
  assert.equal(log.stdout.trim().split('\n').length, 1);
  assert.match(log.stdout, /Initial commit/);
  assert.equal(/claude|harness|TCC|INATEL|semente/i.test(log.stdout), false);
});

test('the working copy is clean, so any later diff belongs to the agent', () => {
  const status = exec(NAME, ['sh', '-c', 'cd /app && git status --short']);
  assert.equal(status.stdout.trim(), '');
});

test('aborts as infrastructure failure when an artefact is reachable', async () => {
  exec(NAME, ['sh', '-c', 'mkdir -p /app/hidden-tests && touch /app/hidden-tests/run.mjs']);
  await assert.rejects(
    () => prepare({ name: NAME, outDir, hostPort: 3521, env: {}, skipStart: true }),
    InfrastructureError,
  );
});
