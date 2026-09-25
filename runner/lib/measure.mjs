import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { copyIn, exec, execDetached } from './container.mjs';
import {
  checkConventions, readFrozenManifest, readManifestFromContainer, runEslintInContainer,
} from '../../tools/convention-check/check.mjs';

const SEED_TEST_FILES = [
  'tests/health.test.ts',
  'tests/database.test.ts',
  'tests/shared.test.ts',
  'tests/rooms.test.ts',
  'tests/users.test.ts',
  'tests/bookings.test.ts',
  'tests/amenities.test.ts',
];

// Diffs against the initial commit, never against the index. `git diff
// --cached` reports what is staged, so an agent that runs `git commit`
// empties it and the session records an empty diff for a full
// implementation -- see the comment on initHistory in prepare.mjs for the
// session where this happened. `git add -A` still runs first, so files the
// agent created but never tracked are in the comparison too.
//
// `baselineCommit` deliberately has no default. A missing sha must fail
// the session rather than quietly fall back to the index and reproduce the
// defect this replaced.
function captureDiff(name, outDir, baselineCommit) {
  if (!/^[0-9a-f]{40}$/.test(baselineCommit ?? '')) {
    throw new Error(
      `measure: baselineCommit must be the sha of the working copy's initial commit; got "${baselineCommit}"`,
    );
  }
  exec(name, ['sh', '-c',
    `cd /app && git add -A && git diff ${baselineCommit} > /out/session.diff`]);
  const path = join(outDir, 'session.diff');
  return existsSync(path) && statSync(path).size > 0;
}

function restoreFrozenTests(name, repoRoot) {
  const staging = mkdtempSync(join(tmpdir(), 'frozen-tests-'));
  execFileSync('sh', ['-c',
    `git -C ${repoRoot} archive HEAD seed/tests | tar -x -C ${staging}`]);
  for (const file of SEED_TEST_FILES) {
    copyIn(name, join(staging, 'seed', file), `/app/${file}`);
  }
}

function countRegressions(name) {
  const result = exec(name, ['sh', '-c',
    `cd /app && npx vitest run ${SEED_TEST_FILES.join(' ')} --reporter=json --outputFile=/out/regressions.json`]);
  return result;
}

function readRegressions(outDir) {
  const path = join(outDir, 'regressions.json');
  if (!existsSync(path)) return null;
  try {
    const report = JSON.parse(readFileSync(path, 'utf8'));
    return report.numFailedTests ?? null;
  } catch {
    return null;
  }
}

async function serverAnswers(hostPort, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(`http://localhost:${hostPort}/health`);
      if (response.ok) return true;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

// Mirrors reference/T1/verify.sh: neither pkill nor job-control kill
// reliably stops `make start` (node dist/server.js) in the session image
// (both were observed leaving the old server bound to the port), so the
// server is stopped by fuser against the port itself.
function killServer(name, port = 3000) {
  exec(name, ['sh', '-c', `fuser -k -TERM ${port}/tcp 2>/dev/null || true`]);
  exec(name, ['sh', '-c', 'sleep 0.2']);
  exec(name, ['sh', '-c', `fuser -k -KILL ${port}/tcp 2>/dev/null || true`]);
}

// Reads the diff that captureDiff already wrote and runs the protocol
// section 2.6 convention rules over it. This must run before
// restoreFrozenTests overwrites the seed's own test files back to their
// frozen content, or the ESLint step (rules 4 and 7) would inspect
// content the agent never actually left behind. `null` on any failure --
// never a fabricated zero -- so a broken measurement never reads as a
// clean session.
function measureConventions(name, outDir, repoRoot) {
  try {
    const diffPath = join(outDir, 'session.diff');
    const diffText = existsSync(diffPath) ? readFileSync(diffPath, 'utf8') : '';
    const frozenManifest = readFrozenManifest(repoRoot);
    const sessionManifest = readManifestFromContainer(name);
    const eslint = runEslintInContainer({ name, diffText, repoRoot });
    return checkConventions({ diffText, frozenManifest, sessionManifest, eslint });
  } catch {
    return null;
  }
}

function runHiddenSuite(repoRoot, hostPort) {
  const result = spawnSync('node', [resolve(repoRoot, 'hidden-tests', 'T1', 'run.mjs')], {
    encoding: 'utf8',
    env: { ...process.env, BASE_URL: `http://localhost:${hostPort}` },
  });
  if (result.status !== 0) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

export async function measure({
  name, outDir, hostPort, repoRoot, hiddenSuite = true, baselineCommit,
}) {
  const hasDiff = captureDiff(name, outDir, baselineCommit);
  const conventions = measureConventions(name, outDir, repoRoot);

  restoreFrozenTests(name, repoRoot);
  countRegressions(name);
  const failed = readRegressions(outDir);

  const build = exec(name, ['sh', '-c', 'cd /app && npm run typecheck && npm run build']);
  const buildOk = build.status === 0;

  exec(name, ['sh', '-c', 'cd /app && make db-reset']);
  execDetached(name, ['sh', '-c', 'cd /app && PORT=3000 make start > /out/server.log 2>&1']);
  const serverUp = await serverAnswers(hostPort);

  // Only the suite is conditional: the server still starts for every
  // task, because answering health is a genuine check that the
  // application survived the session, it feeds travou_build, and keeping
  // it makes travou mean the same thing in T1 and T2.
  const hidden = hiddenSuite && serverUp ? runHiddenSuite(repoRoot, hostPort) : null;
  killServer(name);

  return {
    hasDiff,
    regressoes: failed ?? (buildOk ? 0 : SEED_TEST_FILES.length),
    buildOk,
    serverUp,
    hidden,
    conventions,
  };
}
