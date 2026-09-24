import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SESSION_IMAGE, copyIn, exec, execDetached, imageId, start } from './container.mjs';
// The context levels live in capabilities.mjs, not here. A second list
// of levels in a second file is how the dataset label and the actual
// behaviour drifted apart in the first place, so this module reads the
// same table the labels come from.
import { CONTEXTS } from './capabilities.mjs';

const DEFAULT_REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export class InfrastructureError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InfrastructureError';
  }
}

// Copies the context file into the working copy before the agent ever
// sees it, and for P2 also copies the plugin directory to /opt/plugin,
// outside the working copy. `copy` defaults to copyIn (docker cp) but is
// injectable so this is testable without a container. Two ordering
// requirements come from prepare(), not from this function: it must run
// before initHistory, or the context file would show up in the session's
// own diff as if the agent had authored it, and before assertNoArtefacts,
// so that check also sweeps the context file for the forbidden study
// terms. assertNoArtefacts only scans /app, so it never sees the plugin
// at /opt/plugin -- the plugin's own content is checked separately, by
// runner/test/contexts.test.mjs.
export function applyContext({ name, pLevel, repoRoot, copy = copyIn }) {
  if (!(pLevel in CONTEXTS)) {
    throw new InfrastructureError(`unknown context level: ${pLevel}`);
  }
  const context = CONTEXTS[pLevel];
  if (!context) return;

  copy(name, resolve(repoRoot, context.file), '/app/CLAUDE.md');
  if (context.pluginDir) {
    copy(name, resolve(repoRoot, context.pluginDir), '/opt/plugin');
  }
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

// `pLevel` deliberately has no default. It used to default to 'P0', and
// run-session.mjs did not pass it: a session launched with `--p P1` built
// its directory and its dataset row as P1 while the container received no
// context file at all, producing a plausible, wrong row rather than an
// error. A missing level must fail the session, not silently pick one.
export async function prepare({
  name, outDir, hostPort, env, skipStart = false, pLevel, repoRoot = DEFAULT_REPO_ROOT,
}) {
  // prepare() no longer builds the image. The protocol holds the image
  // identical across sessions (section 3.4) and building here recorded a
  // different digest for every one of the first eight. The image is now
  // built once, deliberately, by runner/build-image.mjs, and
  // run-session.mjs refuses to run when it is missing or when its digest
  // stops matching the dataset.
  if (!skipStart) {
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
