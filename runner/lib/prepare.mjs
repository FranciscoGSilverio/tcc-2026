import { SESSION_IMAGE, buildImage, exec, execDetached, imageId, start } from './container.mjs';

export class InfrastructureError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InfrastructureError';
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

export async function prepare({ name, outDir, hostPort, env, skipStart = false }) {
  if (!skipStart) {
    buildImage();
    start({ name, outDir, hostPort, env });
  }

  assertNoArtefacts(name);
  initHistory(name);
  await assertServesBeforeHandover(name, hostPort);

  const version = exec(name, ['claude', '--version']);
  return {
    imageId: imageId(SESSION_IMAGE),
    cliVersion: version.stdout.trim().split(' ')[0],
  };
}
