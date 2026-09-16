import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { exec, stop } from '../lib/container.mjs';
import { prepare } from '../lib/prepare.mjs';
import { measure } from '../lib/measure.mjs';

const REPO = resolve(import.meta.dirname, '..', '..');
const NAME = 'runner-measure-test';
const outDir = mkdtempSync(join(tmpdir(), 'runner-meas-'));

after(() => stop(NAME));

test('an untouched working copy scores the documented baseline', async () => {
  await prepare({ name: NAME, outDir, hostPort: 3530, env: {} });
  const result = await measure({ name: NAME, outDir, hostPort: 3530, repoRoot: REPO });

  assert.equal(result.hasDiff, false);
  assert.equal(result.regressoes, 0);
  assert.equal(result.buildOk, true);
  assert.equal(result.serverUp, true);
  assert.equal(result.hidden.passed, 13);
  assert.equal(result.hidden.total, 26);
});

test('a broken application reports the server down and no measurement', async () => {
  exec(NAME, ['sh', '-c', 'rm -f /app/src/modules/bookings/service.ts']);
  const result = await measure({ name: NAME, outDir, hostPort: 3530, repoRoot: REPO });

  assert.equal(result.hasDiff, true);
  assert.equal(result.buildOk, false);
  assert.equal(result.serverUp, false);
  assert.equal(result.hidden, null);
});
