import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');

export const SESSION_IMAGE = 'meeting-rooms-session:1.0.0';

const docker = (args, options = {}) =>
  spawnSync('docker', args, { encoding: 'utf8', ...options });

// --provenance=false is what makes image_digest mean anything. BuildKit
// attaches a provenance attestation to every build, which becomes an extra
// manifest in a manifest list, and `docker inspect --format {{.Id}}`
// reports that list's digest. The attestation carries build timestamps, so
// the digest changes on every build even when every layer is CACHED and
// the resulting filesystem is byte-identical -- measured directly on
// 25/09: two consecutive builds gave different .Id values with identical
// RootFS layers and identical Config.
//
// That is why the first sessions each recorded a different image_digest
// while running the same environment: the column was recording BuildKit's
// attestation nonce, not the container. Without the attestation the id is
// the image manifest digest, which is stable for identical content -- so
// a digest that changes now means the environment really changed, which is
// exactly what the drift guard in run-session.mjs is there to catch.
export function buildImage() {
  const result = docker([
    'build', '--provenance=false', '-f', resolve(REPO, 'runner', 'Dockerfile.session'),
    '-t', SESSION_IMAGE, resolve(REPO, 'runner'),
  ]);
  if (result.status !== 0) {
    throw new Error(`session image build failed: ${result.stderr}`);
  }
}

export function imageId(image) {
  const result = docker(['inspect', '--format', '{{.Id}}', image]);
  if (result.status !== 0) {
    throw new Error(`image not found: ${image}`);
  }
  return result.stdout.trim();
}

export function start({ name, outDir, hostPort, env }) {
  stop(name);
  const envArgs = Object.entries(env ?? {}).flatMap(([key, value]) => ['-e', `${key}=${value}`]);
  const result = docker([
    'run', '-d', '--name', name,
    '-v', `${outDir}:/out`,
    '-p', `${hostPort}:3000`,
    ...envArgs,
    SESSION_IMAGE,
  ]);
  if (result.status !== 0) {
    throw new Error(`container did not start: ${result.stderr}`);
  }
}

export function exec(name, command, options = {}) {
  return docker(['exec', ...(options.workdir ? ['-w', options.workdir] : []), name, ...command]);
}

export function execDetached(name, command) {
  return docker(['exec', '-d', name, ...command]);
}

export function copyIn(name, hostPath, containerPath) {
  const result = docker(['cp', hostPath, `${name}:${containerPath}`]);
  if (result.status !== 0) {
    throw new Error(`copy into the container failed: ${result.stderr}`);
  }
}

export function stop(name) {
  docker(['rm', '-f', name], { stdio: 'ignore' });
}
