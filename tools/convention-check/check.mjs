// Implements protocol section 2.6 in full: the five diff-based rules from
// diff-rules.mjs, plus the two manifest-based rules (2 and the scripts
// half of 3) and the two ESLint-based rules (4 and 7), which need the
// frozen seed/eslint.config.js run inside the container because the host
// has no node_modules for the seed's TypeScript/ESLint toolchain.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { copyIn, exec } from '../../runner/lib/container.mjs';
import { diffRules } from './diff-rules.mjs';
import { pathToFileURL } from 'node:url';

// Confirmed empirically against the frozen seed/eslint.config.js (see
// README.md "Conferência empírica"): a production file combining `any`,
// `@ts-ignore`, a non-null assertion and a `console.log` call reported
// exactly these four ruleIds.
const RULE_4_ESLINT = [
  '@typescript-eslint/no-explicit-any',
  '@typescript-eslint/no-non-null-assertion',
  '@typescript-eslint/ban-ts-comment',
];
const RULE_7_ESLINT = ['no-console'];

function collectDependencyKeys(manifest) {
  return new Set([
    ...Object.keys(manifest?.dependencies ?? {}),
    ...Object.keys(manifest?.devDependencies ?? {}),
  ]);
}

function checkRule2(frozenManifest, sessionManifest) {
  const frozenKeys = collectDependencyKeys(frozenManifest);
  const sessionKeys = collectDependencyKeys(sessionManifest);
  const added = [...sessionKeys].filter((key) => !frozenKeys.has(key));
  return added.length > 0
    ? { violated: true, detail: `dependency added: ${added.join(', ')}` }
    : { violated: false, detail: '' };
}

function scriptsEqual(frozenManifest, sessionManifest) {
  const frozenScripts = frozenManifest?.scripts ?? {};
  const sessionScripts = sessionManifest?.scripts ?? {};
  const frozenKeys = Object.keys(frozenScripts).sort();
  const sessionKeys = Object.keys(sessionScripts).sort();
  if (frozenKeys.length !== sessionKeys.length) return false;
  return frozenKeys.every((key, index) =>
    key === sessionKeys[index] && frozenScripts[key] === sessionScripts[key]);
}

function checkRule3Manifest(frozenManifest, sessionManifest) {
  return scriptsEqual(frozenManifest, sessionManifest)
    ? { violated: false, detail: '' }
    : { violated: true, detail: 'package.json scripts changed' };
}

function eslintRule(eslint, id) {
  if (eslint === null || eslint === undefined) {
    return { violated: false, detail: 'eslint unavailable' };
  }
  return eslint[id]
    ? { violated: true, detail: `eslint flagged rule ${id}` }
    : { violated: false, detail: '' };
}

// Pure combination of the three sources of evidence: the diff (rules
// 1, 3, 5, 6, 8), the manifest pair (rules 2 and the rest of 3), and the
// caller-supplied ESLint verdict (rules 4 and 7). Kept free of any I/O so
// it can be unit-tested without Docker or git.
export function checkConventions({ diffText, frozenManifest, sessionManifest, eslint }) {
  const diff = diffRules(diffText);
  const rule2 = checkRule2(frozenManifest, sessionManifest);
  const rule3Manifest = checkRule3Manifest(frozenManifest, sessionManifest);
  const rule3 = diff[3].violated ? diff[3] : rule3Manifest;

  const rules = {
    1: diff[1],
    2: rule2,
    3: rule3,
    4: eslintRule(eslint, 4),
    5: diff[5],
    6: diff[6],
    7: eslintRule(eslint, 7),
    8: diff[8],
  };

  const violacoes = Object.values(rules).filter((rule) => rule.violated).length;
  return { violacoes, rules };
}

// The diff already tells us which files currently exist after the
// session's changes (the "+++ b/..." side); only .ts files are worth
// asking ESLint about, since that is the toolchain the frozen config
// targets.
function changedTypeScriptFiles(diffText) {
  const files = new Set();
  for (const line of diffText.split('\n')) {
    if (!line.startsWith('+++ ')) continue;
    const target = line.slice('+++ '.length).split('\t')[0];
    const path = target.startsWith('b/') ? target.slice(2) : target;
    if (path === '/dev/null' || !path.endsWith('.ts')) continue;
    files.add(path);
  }
  return [...files];
}

// Runs the frozen seed/eslint.config.js -- not whatever copy the agent may
// have edited -- inside the container, over the files the session
// touched. The frozen copy is written over /app/eslint.config.js itself
// (rather than passed via --config) because a flat config file resolves
// its own imports (@eslint/js, typescript-eslint) relative to its own
// location on disk, and only /app has the node_modules tree those
// packages live in; a copy staged outside /app fails to resolve them.
// This must run after the diff has already been captured (measure.mjs
// captures it first), exactly like restoreFrozenTests overwrites test
// files only after the diff reflects what the agent left behind.
export function runEslintInContainer({ name, diffText, repoRoot }) {
  const files = changedTypeScriptFiles(diffText);
  if (files.length === 0) return { 4: false, 7: false };

  const staging = mkdtempSync(join(tmpdir(), 'frozen-eslint-'));
  const frozenConfig = execFileSync('git', ['-C', repoRoot, 'show', 'HEAD:seed/eslint.config.js']);
  const stagedConfig = join(staging, 'eslint.config.js');
  writeFileSync(stagedConfig, frozenConfig);
  copyIn(name, stagedConfig, '/app/eslint.config.js');

  const result = exec(name, [
    'sh', '-c',
    `cd /app && npx eslint --no-ignore --format json ${files.map((file) => `'${file}'`).join(' ')}`,
  ]);

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    return null;
  }

  const ruleIds = new Set();
  for (const file of report) {
    for (const message of file.messages ?? []) {
      if (message.ruleId) ruleIds.add(message.ruleId);
    }
  }

  return {
    4: RULE_4_ESLINT.some((ruleId) => ruleIds.has(ruleId)),
    7: RULE_7_ESLINT.some((ruleId) => ruleIds.has(ruleId)),
  };
}

// Extracts /app/package.json from a running container, the same way the
// CLI needs to see what the session actually left behind (not what the
// seed originally shipped). Exported so measure.mjs can reuse it instead
// of re-implementing the docker cp.
export function readManifestFromContainer(name) {
  const staging = mkdtempSync(join(tmpdir(), 'session-manifest-'));
  const dest = join(staging, 'package.json');
  execFileSync('docker', ['cp', `${name}:/app/package.json`, dest]);
  return JSON.parse(readFileSync(dest, 'utf8'));
}

export function readFrozenManifest(repoRoot) {
  return JSON.parse(execFileSync('git', ['-C', repoRoot, 'show', 'HEAD:seed/package.json']).toString());
}

const argument = (flag) => {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
};

async function main() {
  const sessionDir = argument('--session');
  const containerName = argument('--container');
  if (!sessionDir || !containerName) {
    process.stderr.write('usage: node check.mjs --session <dir> --container <name>\n');
    process.exit(1);
  }

  const repoRoot = resolve(import.meta.dirname, '..', '..');
  const diffText = readFileSync(join(sessionDir, 'session.diff'), 'utf8');
  const frozenManifest = readFrozenManifest(repoRoot);
  const sessionManifest = readManifestFromContainer(containerName);
  const eslint = runEslintInContainer({ name: containerName, diffText, repoRoot });

  const result = checkConventions({ diffText, frozenManifest, sessionManifest, eslint });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

// Compared as file URLs, not as a pathname string: on Windows the URL's
// pathname is /C:/... while argv[1] is C:\..., and the string comparison
// made every CLI here exit 0 without running.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
