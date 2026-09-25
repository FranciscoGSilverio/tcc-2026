import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildImage, exec, stop } from '../lib/container.mjs';
import { prepare, applyContext, InfrastructureError } from '../lib/prepare.mjs';

const NAME = 'runner-prepare-test';
const outDir = mkdtempSync(join(tmpdir(), 'runner-prep-'));
const REPO = resolve(import.meta.dirname, '..', '..');

after(() => stop(NAME));

// prepare() no longer builds the image, so a test that needs a container
// builds it once here instead of relying on a side effect.
buildImage();

test('prepares a working copy and reports the reproducibility anchors', async () => {
  const info = await prepare({ name: NAME, outDir, hostPort: 3520, env: {}, pLevel: 'P0', repoRoot: REPO });
  assert.match(info.imageId, /^sha256:/);
  assert.match(info.cliVersion, /^\d+\./);
  // The sha measure() diffs against. Without it a session cannot be
  // measured at all, so it belongs with the other anchors.
  assert.match(info.baselineCommit, /^[0-9a-f]{40}$/);
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
    () => prepare({ name: NAME, outDir, hostPort: 3521, env: {}, skipStart: true, pLevel: 'P0', repoRoot: REPO }),
    InfrastructureError,
  );
});

test('applyContext does nothing for P0', () => {
  const calls = [];
  applyContext({ name: 'x', pLevel: 'P0', repoRoot: REPO, copy: (...a) => calls.push(a) });
  assert.equal(calls.length, 0);
});

test('applyContext copies the P1 context file into the working copy', () => {
  const calls = [];
  applyContext({ name: 'x', pLevel: 'P1', repoRoot: REPO, copy: (...a) => calls.push(a) });
  assert.equal(calls.length, 1);
  assert.match(calls[0][1], /contexts\/P1\/CLAUDE\.md$/);
  assert.equal(calls[0][2], '/app/CLAUDE.md');
});

test('applyContext copies the file for P1 and file plus plugin for P2', () => {
  const p1Calls = [];
  applyContext({ name: 'x', pLevel: 'P1', repoRoot: REPO, copy: (...a) => p1Calls.push(a) });
  assert.equal(p1Calls.length, 1);
  assert.equal(p1Calls[0][2], '/app/CLAUDE.md');

  const p2Calls = [];
  applyContext({ name: 'x', pLevel: 'P2', repoRoot: REPO, copy: (...a) => p2Calls.push(a) });
  assert.equal(p2Calls.length, 2);
  assert.equal(p2Calls[0][2], '/app/CLAUDE.md');
  // The plugin must land outside the working copy, or it shows up in the
  // session diff and contaminates the convention script and the evaluator.
  assert.equal(p2Calls[1][2], '/opt/plugin');
  assert.doesNotMatch(p2Calls[1][2], /^\/app/);
});

test('prepare refuses a session whose context level was not stated', async () => {
  // Regression: prepare used to default pLevel to 'P0' while run-session
  // never passed it, so `--p P1` ran bare and was recorded as P1.
  await assert.rejects(
    () => prepare({ name: NAME, outDir, hostPort: 3522, env: {}, skipStart: true, repoRoot: REPO }),
    /unknown context level/,
  );
});

test('applyContext rejects an unknown level', () => {
  assert.throws(() => applyContext({ name: 'x', pLevel: 'P9', repoRoot: REPO, copy: () => {} }));
});
