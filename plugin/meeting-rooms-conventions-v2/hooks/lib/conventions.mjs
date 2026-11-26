// The eight conventions of protocol section 2.6, checked over the working
// tree of the user's project against the commit the session started from.
//
// Rules 1, 3, 5, 6 and 8 come from diff-rules.mjs, a byte-for-byte copy of
// tools/convention-check/diff-rules.mjs -- the same code that scored the
// collection (a test keeps the two identical). Rules 2 and the scripts half
// of 3 compare the manifests, as tools/convention-check/check.mjs does.
// Rules 4 and 7 run the project's own ESLint, the same rule ids check.mjs
// maps. The one deliberate difference from the scorer: rule 5 only applies
// when something under src/ changed, because here the check also runs on
// sessions that never meant to change behaviour.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { diffRules } from './diff-rules.mjs';
import { git } from './project.mjs';

const RULE_4_ESLINT = [
  '@typescript-eslint/no-explicit-any',
  '@typescript-eslint/no-non-null-assertion',
  '@typescript-eslint/ban-ts-comment',
];
const RULE_7_ESLINT = ['no-console'];

export const RULE_NAMES = {
  1: 'arquivo de produção novo fora de src/modules/<recurso>/, src/shared/ ou src/plugins/',
  2: 'dependência nova no package.json',
  3: 'arquivo de configuração ou scripts do package.json alterados',
  4: 'escape de tipo (any, @ts-ignore, @ts-expect-error, ! não-nulo)',
  5: 'mudança em src/ sem nenhuma linha de teste acrescentada em tests/',
  6: 'linha removida de um arquivo de teste existente',
  7: 'console.* em código de produção',
  8: 'teste marcado com .skip, .only ou .todo',
};

// git diff covers tracked files; a file the agent created and never added
// is invisible to it, so untracked files are appended as new-file diffs in
// the same format.
export function sessionDiff(dir, base) {
  const tracked = git(dir, ['diff', '--no-color', '--no-ext-diff', base]);
  if (tracked === null) return null;
  const untracked = (git(dir, ['ls-files', '--others', '--exclude-standard', '-z']) ?? '')
    .split('\0')
    .filter(Boolean)
    .map((path) => {
      let content;
      try {
        content = readFileSync(join(dir, path), 'utf8');
      } catch {
        return '';
      }
      const lines = content.split(/\r?\n/);
      if (lines.at(-1) === '') lines.pop();
      return [
        `diff --git a/${path} b/${path}`, 'new file mode 100644', '--- /dev/null', `+++ b/${path}`,
        ...lines.map((line) => `+${line}`),
      ].join('\n');
    });
  return [tracked, ...untracked].filter((part) => part.trim()).join('\n');
}

export function changedPaths(diffText) {
  const paths = new Set();
  for (const line of diffText.split('\n')) {
    if (!line.startsWith('+++ ')) continue;
    const target = line.slice(4).split('\t')[0].trim();
    if (target !== '/dev/null') paths.add(target.startsWith('b/') ? target.slice(2) : target);
  }
  return [...paths];
}

function readJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function dependencyKeys(manifest) {
  return new Set([...Object.keys(manifest?.dependencies ?? {}), ...Object.keys(manifest?.devDependencies ?? {})]);
}

function manifestRules(frozen, current) {
  if (!frozen || !current) return { 2: null, 3: null };
  const frozenDeps = dependencyKeys(frozen);
  const added = [...dependencyKeys(current)].filter((key) => !frozenDeps.has(key));
  const scriptsChanged = JSON.stringify(Object.entries(frozen.scripts ?? {}).sort())
    !== JSON.stringify(Object.entries(current.scripts ?? {}).sort());
  return {
    2: added.length ? `dependência acrescentada: ${added.join(', ')}` : null,
    3: scriptsChanged ? 'scripts do package.json alterados' : null,
  };
}

// Runs the project's ESLint over the changed .ts files. Returns null when
// ESLint is not installed (make setup not run yet), so the caller can say
// so instead of passing rules 4 and 7 silently.
function eslintRules(dir, files) {
  if (files.length === 0) return { 4: null, 7: null };
  const bin = join(dir, 'node_modules', 'eslint', 'bin', 'eslint.js');
  if (!existsSync(bin)) return null;
  const run = spawnSync(process.execPath, [bin, '--no-ignore', '--format', 'json', ...files], {
    cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  const report = readJson(run.stdout);
  if (!Array.isArray(report)) return null;
  const found = { 4: [], 7: [] };
  for (const file of report) {
    const rel = relative(dir, file.filePath).split('\\').join('/');
    for (const message of file.messages ?? []) {
      if (RULE_4_ESLINT.includes(message.ruleId)) found[4].push(`${rel}:${message.line}`);
      if (RULE_7_ESLINT.includes(message.ruleId)) found[7].push(`${rel}:${message.line}`);
    }
  }
  return { 4: found[4].join(', ') || null, 7: found[7].join(', ') || null };
}

// { skipped: reason } when there is nothing to check, otherwise
// { violations: [{ rule, detail }], notes: [] }.
export function checkProject(dir, base) {
  const diffText = sessionDiff(dir, base);
  if (diffText === null) return { skipped: 'git indisponível' };
  if (!diffText.trim()) return { skipped: 'nada alterado' };

  const paths = changedPaths(diffText);
  const diff = diffRules(diffText);
  const manifest = manifestRules(
    readJson(git(dir, ['show', `${base}:package.json`]) ?? ''),
    existsSync(join(dir, 'package.json')) ? readJson(readFileSync(join(dir, 'package.json'), 'utf8')) : null,
  );
  const tsFiles = paths.filter((path) => path.endsWith('.ts') && existsSync(join(dir, path)));
  const eslint = eslintRules(dir, tsFiles);
  const touchedSrc = paths.some((path) => path.startsWith('src/'));

  const details = {
    1: diff[1].violated ? diff[1].detail : null,
    2: manifest[2],
    3: diff[3].violated ? diff[3].detail : manifest[3],
    4: eslint?.[4] ?? null,
    5: touchedSrc && diff[5].violated ? 'nenhuma linha acrescentada em tests/' : null,
    6: diff[6].violated ? diff[6].detail : null,
    7: eslint?.[7] ?? null,
    8: diff[8].violated ? diff[8].detail : null,
  };
  const violations = Object.entries(details)
    .filter(([, detail]) => detail)
    .map(([rule, detail]) => ({ rule: Number(rule), detail }));
  const notes = eslint === null ? ['ESLint indisponível (rode make setup): convenções 4 e 7 não verificadas'] : [];
  return { violations, notes };
}
