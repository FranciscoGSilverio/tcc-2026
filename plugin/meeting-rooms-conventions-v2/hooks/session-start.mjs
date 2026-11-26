// SessionStart: puts the project guide in the agent's context and records
// the commit the session starts from.
//
// The guide is what the P2 condition shipped as a CLAUDE.md the user had
// to copy by hand. A plugin cannot ship a CLAUDE.md, but it can inject the
// same text here, so installing the plugin is enough. Because the guide
// now lives in one place, the skills no longer repeat it.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { git, isProject, projectDir, readInput, readState, writeState } from './lib/project.mjs';

const input = readInput();
const dir = projectDir(input);
if (!isProject(dir)) process.exit(0);

const state = readState(input.session_id);
if (!state.base) {
  const head = git(dir, ['rev-parse', 'HEAD'])?.trim();
  if (head) writeState(input.session_id, { ...state, base: head, blocks: 0 });
}

const guide = readFileSync(join(import.meta.dirname, 'guia-do-projeto.md'), 'utf8');
process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: guide },
}));
