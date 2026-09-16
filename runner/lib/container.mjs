import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');

export const SESSION_IMAGE = 'meeting-rooms-session:1.0.0';

const docker = (args, options = {}) =>
  spawnSync('docker', args, { encoding: 'utf8', ...options });

export function buildImage() {
  const result = docker([
    'build', '-f', resolve(REPO, 'runner', 'Dockerfile.session'),
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
