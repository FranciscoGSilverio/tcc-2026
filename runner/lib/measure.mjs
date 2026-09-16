import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { copyIn, exec, execDetached } from './container.mjs';

const SEED_TEST_FILES = [
  'tests/health.test.ts',
  'tests/database.test.ts',
  'tests/shared.test.ts',
  'tests/rooms.test.ts',
  'tests/users.test.ts',
  'tests/bookings.test.ts',
  'tests/amenities.test.ts',
];

function captureDiff(name, outDir) {
  exec(name, ['sh', '-c', 'cd /app && git add -A && git diff --cached > /out/session.diff']);
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

export async function measure({ name, outDir, hostPort, repoRoot }) {
  const hasDiff = captureDiff(name, outDir);

  restoreFrozenTests(name, repoRoot);
  countRegressions(name);
  const failed = readRegressions(outDir);

  const build = exec(name, ['sh', '-c', 'cd /app && npm run typecheck && npm run build']);
  const buildOk = build.status === 0;

  exec(name, ['sh', '-c', 'cd /app && make db-reset']);
  execDetached(name, ['sh', '-c', 'cd /app && PORT=3000 make start > /out/server.log 2>&1']);
  const serverUp = await serverAnswers(hostPort);

  const hidden = serverUp ? runHiddenSuite(repoRoot, hostPort) : null;
  killServer(name);

  return {
    hasDiff,
    regressoes: failed ?? (buildOk ? 0 : SEED_TEST_FILES.length),
    buildOk,
    serverUp,
    hidden,
  };
}
