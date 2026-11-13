// Pure helpers of the PreToolUse guards, kept apart from the hook entry
// points so the tests can import them without running a hook.

const MANAGERS = new Set(['npm', 'pnpm', 'yarn', 'bun']);
const INSTALL_VERBS = new Set(['install', 'i', 'add']);

// The packages a shell command would install, or null. `npm install` with
// no package named only restores what the lockfile already has.
export function installsPackage(command) {
  for (const segment of command.split(/&&|\|\||[;|\n]/)) {
    const tokens = segment.trim().split(/\s+/);
    const at = tokens.findIndex((token, index) => MANAGERS.has(token) && INSTALL_VERBS.has(tokens[index + 1]));
    if (at === -1) continue;
    const named = tokens.slice(at + 2).filter((token) => token && !token.startsWith('-'));
    if (named.length > 0) return named.join(' ');
  }
  return null;
}

// Lines of `before` that are no longer in `after`, counted as a multiset so
// that moving a line around is not a removal.
export function removedLines(before, after) {
  const remaining = new Map();
  for (const line of after.split(/\r?\n/)) remaining.set(line, (remaining.get(line) ?? 0) + 1);
  const removed = [];
  for (const line of before.split(/\r?\n/)) {
    const count = remaining.get(line) ?? 0;
    if (count > 0) remaining.set(line, count - 1);
    else if (line.trim() !== '') removed.push(line);
  }
  return removed;
}
