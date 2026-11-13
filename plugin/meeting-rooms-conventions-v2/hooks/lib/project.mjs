// Shared plumbing for the hooks: read the hook input, decide whether the
// session is inside the meeting-rooms project at all, and keep a small
// per-session state file (the commit the session started from, and how many
// times the Stop check has already sent the agent back).
//
// Every hook is a no-op outside the project: the plugin is installed per
// user, so it is loaded in every repository that user opens, and blocking a
// tsconfig.json edit in some unrelated project would be a bug.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';

export const PROJECT_NAME = 'meeting-rooms-api';

export const CONFIG_FILES = [
  'tsconfig.json', 'eslint.config.js', '.prettierrc', 'vitest.config.ts',
  'Makefile', 'Dockerfile', '.dockerignore', 'docker-compose.yml',
  '.editorconfig', '.gitignore', 'prisma/schema.prisma',
];
// Rule 2 (dependencies) and the scripts half of rule 3 both live in the
// manifest; no task of this kind needs to touch it, so it is guarded whole.
export const MANIFEST_FILES = ['package.json', 'package-lock.json'];

export function readInput() {
  try {
    const raw = readFileSync(0, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function projectDir(input) {
  return resolve(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
}

export function isProject(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).name === PROJECT_NAME;
  } catch {
    return false;
  }
}

// Project-relative path with forward slashes, or null when the file is
// outside the project.
export function projectPath(dir, filePath) {
  if (!filePath) return null;
  const absolute = isAbsolute(filePath) ? filePath : resolve(dir, filePath);
  const rel = relative(dir, absolute).split('\\').join('/');
  return rel.startsWith('..') || isAbsolute(rel) ? null : rel;
}

export function git(dir, args) {
  try {
    return execFileSync('git', ['-C', dir, '-c', 'core.quotepath=false', ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

function stateFile(sessionId) {
  const safe = String(sessionId || 'sem-sessao').replace(/[^\w-]/g, '_');
  return join(tmpdir(), 'meeting-rooms-conventions-v2', `${safe}.json`);
}

export function readState(sessionId) {
  try {
    return JSON.parse(readFileSync(stateFile(sessionId), 'utf8'));
  } catch {
    return {};
  }
}

export function writeState(sessionId, state) {
  const file = stateFile(sessionId);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, JSON.stringify(state));
}

// The commit the session started from. Recorded at SessionStart so that a
// commit made by the agent mid-session does not hide its own changes from
// the Stop check; HEAD is the fallback when the state was lost.
export function baseCommit(dir, sessionId) {
  return readState(sessionId).base || git(dir, ['rev-parse', 'HEAD'])?.trim() || null;
}
