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

// The file's content after an Edit, MultiEdit or Write, given its content
// now. Line endings are normalised first, because the edit strings the
// agent sends use \n whatever the file on disk uses. An edit whose
// old_string is not found leaves the content as it is -- the tool itself
// will refuse it.
export function applyEdit(toolName, toolInput, current) {
  const text = current.replace(/\r\n/g, '\n');
  const replace = (content, oldString = '', newString = '', all = false) => {
    if (!oldString || !content.includes(oldString)) return content;
    return all ? content.split(oldString).join(newString) : content.replace(oldString, () => newString);
  };
  if (toolName === 'Write') return toolInput.content ?? '';
  if (toolName === 'Edit') {
    return replace(text, toolInput.old_string, toolInput.new_string, toolInput.replace_all);
  }
  if (toolName === 'MultiEdit') {
    return (toolInput.edits ?? []).reduce(
      (content, edit) => replace(content, edit.old_string, edit.new_string, edit.replace_all), text);
  }
  return text;
}

// Lines of the original file that this edit takes out: present in the
// original more times than in the file after the edit, and not already
// missing before it. Comparing whole files, by count, is what tells an
// agent editing a test it wrote itself apart from one deleting an original
// test -- the two often share lines like `const response = await app.inject({`.
export function originalLinesRemoved(original, current, after) {
  const missingNow = removedLines(original, current);
  const remaining = new Map();
  for (const line of missingNow) remaining.set(line, (remaining.get(line) ?? 0) + 1);
  const newlyMissing = [];
  for (const line of removedLines(original, after)) {
    const count = remaining.get(line) ?? 0;
    if (count > 0) remaining.set(line, count - 1);
    else newlyMissing.push(line);
  }
  return newlyMissing;
}
