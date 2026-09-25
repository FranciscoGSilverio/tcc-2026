import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildImage, exec, stop } from '../lib/container.mjs';
import { prepare } from '../lib/prepare.mjs';
import { measure } from '../lib/measure.mjs';

const REPO = resolve(import.meta.dirname, '..', '..');
const NAME = 'runner-measure-test';
const outDir = mkdtempSync(join(tmpdir(), 'runner-meas-'));

after(() => stop(NAME));

// prepare() no longer builds the image, so a test that needs a container
// builds it once here instead of relying on a side effect.
buildImage();

// Set by the first test and reused by the ones that share its container.
let baseline;

test('an untouched working copy scores the documented baseline', async () => {
  const anchors = await prepare({
    name: NAME, outDir, hostPort: 3530, env: {}, pLevel: 'P0', repoRoot: REPO,
  });
  baseline = anchors.baselineCommit;
  assert.match(baseline, /^[0-9a-f]{40}$/);
  const result = await measure({
    name: NAME, outDir, hostPort: 3530, repoRoot: REPO, baselineCommit: baseline,
  });

  assert.equal(result.hasDiff, false);
  assert.equal(result.regressoes, 0);
  assert.equal(result.buildOk, true);
  assert.equal(result.serverUp, true);
  assert.equal(result.hidden.passed, 13);
  assert.equal(result.hidden.total, 26);

  assert.equal(result.conventions.violacoes, 1);
  assert.equal(result.conventions.rules[5].violated, true);
  for (const id of [1, 2, 3, 4, 6, 7, 8]) {
    assert.equal(result.conventions.rules[id].violated, false, `rule ${id}`);
  }
});

test('a task with no hidden suite skips it but still checks the server', async () => {
  // T2 is measured by convergence, not by assertions, so the suite is
  // not run for it -- but the application must still answer health, or
  // travou would mean something different in T2 than it does in T1.
  const result = await measure({
    name: NAME, outDir, hostPort: 3530, repoRoot: REPO, hiddenSuite: false,
    baselineCommit: baseline,
  });

  assert.equal(result.hidden, null);
  assert.equal(result.serverUp, true);
  assert.equal(result.buildOk, true);
});

test('a broken application reports the server down and no measurement', async () => {
  exec(NAME, ['sh', '-c', 'rm -f /app/src/modules/bookings/service.ts']);
  const result = await measure({
    name: NAME, outDir, hostPort: 3530, repoRoot: REPO, baselineCommit: baseline,
  });

  assert.equal(result.hasDiff, true);
  assert.equal(result.buildOk, false);
  assert.equal(result.serverUp, false);
  assert.equal(result.hidden, null);
});

// The defect this guards against is not hypothetical. Session
// T2-P0-O1-mug8g8uw (25/09) recorded an empty session.diff,
// travou_sem_diff = true, violacoes = 1 for "no lines added under tests/",
// and qualidade = 0 -- for an agent that had written four production files
// and a test file and then run `git commit`. captureDiff compared the
// index, and a commit empties the index.
test('work the agent committed still lands in the session diff', async () => {
  const name = 'runner-measure-commit-test';
  const dir = mkdtempSync(join(tmpdir(), 'runner-commit-'));
  try {
    const anchors = await prepare({
      name, outDir: dir, hostPort: 3531, env: {}, pLevel: 'P0', repoRoot: REPO,
    });
    exec(name, ['sh', '-c',
      'cd /app && printf "\n// written by the agent\n" >> src/shared/time.ts'
      + ' && git add -A && git commit -q -m "agent commits its own work"']);

    const result = await measure({
      name, outDir: dir, hostPort: 3531, repoRoot: REPO, hiddenSuite: false,
      baselineCommit: anchors.baselineCommit,
    });

    assert.equal(result.hasDiff, true);
    const diff = readFileSync(join(dir, 'session.diff'), 'utf8');
    assert.match(diff, /src\/shared\/time\.ts/);
    assert.match(diff, /written by the agent/);
  } finally {
    stop(name);
  }
});

// Same rule as pLevel in prepare(): a missing anchor fails the session
// instead of silently picking a fallback that reproduces the defect.
test('measure refuses to run without the baseline commit', async () => {
  await assert.rejects(
    () => measure({ name: NAME, outDir, hostPort: 3530, repoRoot: REPO }),
    /baselineCommit/,
  );
});
