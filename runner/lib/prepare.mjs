import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SESSION_IMAGE, buildImage, copyIn, exec, execDetached, imageId, start } from './container.mjs';

const DEFAULT_REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export class InfrastructureError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InfrastructureError';
  }
}

// P0 gets nothing: the bare statement is the whole point of that cell.
// P1 gets the context file described in the design spec section 5. P2
// (a plugin, not a single file) does not exist yet -- the levels this
// function must recognise are exactly the ones that already have sessions.
const CONTEXT_FILES = {
  P0: null,
  P1: 'contexts/P1/CLAUDE.md',
};

// Copies the P1 context file into the working copy before the agent ever
// sees it. `copy` defaults to copyIn (docker cp) but is injectable so this
// is testable without a container. Two ordering requirements come from
// prepare(), not from this function: it must run before initHistory, or
// the context file would show up in the session's own diff as if the
// agent had authored it, and before assertNoArtefacts, so that check also
// sweeps the context file for the forbidden study terms.
export function applyContext({ name, pLevel, repoRoot, copy = copyIn }) {
  if (!(pLevel in CONTEXT_FILES)) {
    throw new InfrastructureError(`unknown context level: ${pLevel}`);
  }
  const relativePath = CONTEXT_FILES[pLevel];
  if (!relativePath) return;

  const hostPath = resolve(repoRoot, relativePath);
  copy(name, hostPath, '/app/CLAUDE.md');
}

const FORBIDDEN_PATHS = ['hidden-tests', 'reference', 'tasks', 'docs', 'tools'];
const FORBIDDEN_TERMS = 'TCC|INATEL|harness|semente|experimento|Claude|Anthropic';

function assertNoArtefacts(name) {
  const listing = exec(name, ['sh', '-c', 'ls -A /app']);
  for (const forbidden of FORBIDDEN_PATHS) {
    if (listing.stdout.split('\n').map((line) => line.trim()).includes(forbidden)) {
      throw new InfrastructureError(`artefact reachable inside the working copy: ${forbidden}`);
    }
  }

  const grep = exec(name, ['sh', '-c',
    `grep -rIlE '${FORBIDDEN_TERMS}' /app --exclude-dir=node_modules --exclude-dir=.git --exclude=package-lock.json || true`]);
  if (grep.stdout.trim()) {
    throw new InfrastructureError(`study terms reachable inside the working copy: ${grep.stdout.trim()}`);
  }
}

function initHistory(name) {
  const script = [
    'cd /app',
    'rm -rf .git',
    'git init -q .',
    'git config user.email dev@example.com',
    'git config user.name Developer',
    'git add -A',
    'git commit -q -m "Initial commit"',
  ].join(' && ');
  const result = exec(name, ['sh', '-c', script]);
  if (result.status !== 0) {
    throw new InfrastructureError(`could not initialise the working copy history: ${result.stderr}`);
  }
}

// Neither pkill nor plain job-control kill reliably stops `make start`
// (node dist/server.js) in the session image: reference/T1/verify.sh hit
// the same problem and settled on fuser against the port itself, so this
// mirrors that fix rather than trusting a process-name match again.
function killServer(name, port = 3000) {
  exec(name, ['sh', '-c', `fuser -k -TERM ${port}/tcp 2>/dev/null || true`]);
  exec(name, ['sh', '-c', 'sleep 0.2']);
  exec(name, ['sh', '-c', `fuser -k -KILL ${port}/tcp 2>/dev/null || true`]);
}

async function assertServesBeforeHandover(name, hostPort) {
  const reset = exec(name, ['sh', '-c', 'cd /app && make db-reset && make build']);
  if (reset.status !== 0) {
    throw new InfrastructureError(`the application does not build before handover: ${reset.stderr}`);
  }

  execDetached(name, ['sh', '-c', 'cd /app && PORT=3000 make start > /out/preflight.log 2>&1']);

  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://localhost:${hostPort}/health`);
      if (response.ok) {
        killServer(name);
        return;
      }
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new InfrastructureError('the application did not answer health before handover');
}

export async function prepare({
  name, outDir, hostPort, env, skipStart = false, pLevel = 'P0', repoRoot = DEFAULT_REPO_ROOT,
}) {
  if (!skipStart) {
    buildImage();
    start({ name, outDir, hostPort, env });
  }

  // Must run before assertNoArtefacts, so that sweep also examines the
  // context file for the forbidden study terms, and before initHistory,
  // so the context file never lands inside the session's own diff as if
  // the agent had authored it.
  applyContext({ name, pLevel, repoRoot });

  assertNoArtefacts(name);
  initHistory(name);
  await assertServesBeforeHandover(name, hostPort);

  const version = exec(name, ['claude', '--version']);
  return {
    imageId: imageId(SESSION_IMAGE),
    cliVersion: version.stdout.trim().split(' ')[0],
  };
}
