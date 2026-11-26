// SessionStart: puts the team reference in the agent's context and records
// the commit the session starts from.
//
// The study's lesson: what was always in context worked, and procedures the
// agent could choose to open were sometimes never opened. So the reference
// the team shares (the eight conventions, how open decisions are recorded,
// how the work is verified) is injected here on every session, never left
// for the agent to look up. What is specific to the repository stays in its
// own CLAUDE.md (template in templates/), and nothing is said in both.
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

const guide = readFileSync(join(import.meta.dirname, 'referencia-do-time.md'), 'utf8');
process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: guide },
}));
