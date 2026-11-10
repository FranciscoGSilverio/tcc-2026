#!/usr/bin/env node
// Measures whether an O2 session respected its own step boundaries.
//
// Protocol section 3.3 defines O2 as four chained calls, and steps 1 and 2
// carry an explicit instruction not to change any file. That instruction
// is delivered to the agent; nothing enforces it, and nothing could
// without turning the condition into a different experiment. Whether it
// was obeyed is therefore a property of the agent's behaviour, not of the
// harness -- and it belongs to the analysis of factor O, because a session
// that implements during exploration has collapsed O2 toward O1 whatever
// its label says. Observed for the first time on 25/09/2026 in
// T1-P2-O2-muhckhv4 (haiku): six edits in step 1, and steps 2 and 3 empty.
//
// This is a heuristic and the patterns are listed in the open, because the
// number it prints is only as good as they are. Two families of write:
// the editing tools, which are unambiguous, and shell commands, which are
// not. The second family cannot be skipped -- opus edits with
// `cat > file <<'EOF'` and never touches an editing tool, so counting only
// tools would report a clean zero for every opus session and the measure
// would be silently wrong in exactly one condition.
//
// It only reads. It never writes a byte anywhere.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readRows } from '../../runner/lib/dataset.mjs';
import { ORDERS } from '../../runner/lib/capabilities.mjs';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

export const EDITING_TOOLS = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'];

// Paths outside the working copy: writing there is not a change to the
// session's deliverable, and the agents use them for scratch space.
const OUTSIDE_WORKING_COPY = /^\/(tmp|dev|out|var|proc)\b|^\/home\/node\/\.claude\b/;

export const SHELL_WRITE_PATTERNS = [
  { name: 'heredoc para arquivo', test: /(^|[;&|]\s*)(cat|tee)\s+[^|;&]*<<-?\s*'?[A-Za-z_]/ },
  { name: 'redirecionamento para arquivo', test: />>?\s*("[^"]+"|'[^']+'|[^\s;&|>]+)/ },
  { name: 'sed -i', test: /\bsed\s+(-[^\s]*\s+)*-i\b|\bsed\s+-i/ },
  { name: 'tee', test: /\btee\s+(-a\s+)?[^\s;&|]/ },
  { name: 'formatador com escrita', test: /\b(prettier|eslint)\b[^;&|]*--(write|fix)\b/ },
  { name: 'npm alterando manifesto', test: /\bnpm\s+(install|uninstall|i|pkg\s+set)\b/ },
  { name: 'git alterando a cópia', test: /\bgit\s+(apply|checkout|restore|revert|stash)\b/ },
  { name: 'mover, copiar ou remover', test: /(^|[;&|]\s*)(mv|cp|rm|touch|mkdir)\s/ },
];

// A redirect or a heredoc only counts when it lands inside the working
// copy. Without this, two things read as edits that are not: scratch files
// (`cat > /tmp/probe.js <<'EOF'`, which one haiku session used to reproduce
// a bug) and a heredoc carrying a commit message (`git commit -m "$(cat
// <<'EOF' ...)"`), which has no file target at all.
const REDIRECTED_TO_A_FILE = /(^|[;&|]\s*)(?:cat|tee|printf|echo)?[^|;&]*>>?\s*("[^"]+"|'[^']+'|[^\s;&|>]+)/g;

// The body of a heredoc is text, not shell. Scanning it for `>` read a
// commit message that happened to describe an overlap condition
// ("endsAt > start") as a redirect into the working copy, and flagged a
// session that had only committed. Every pattern runs against the command
// with heredoc bodies removed, and the delimiter kept so the heredoc
// itself is still visible.
const HEREDOC_BODY = /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1[\s\S]*?^[ \t]*\2[ \t]*$/gm;

export function withoutHeredocBodies(command) {
  return command.replace(HEREDOC_BODY, (_match, _quote, delimiter) => `<<${delimiter}`);
}

function landsInWorkingCopy(command) {
  const targets = [...command.matchAll(REDIRECTED_TO_A_FILE)]
    .map((match) => match[2].replace(/^['"]|['"]$/g, ''));
  return targets.some((target) => !OUTSIDE_WORKING_COPY.test(target) && target !== '/dev/null');
}

const NEEDS_A_TARGET_IN_THE_WORKING_COPY = new Set([
  'heredoc para arquivo',
  'redirecionamento para arquivo',
]);

export function commandWrites(rawCommand) {
  if (typeof rawCommand !== 'string' || !rawCommand.trim()) return null;
  const command = withoutHeredocBodies(rawCommand);
  for (const pattern of SHELL_WRITE_PATTERNS) {
    if (!pattern.test.test(command)) continue;
    if (NEEDS_A_TARGET_IN_THE_WORKING_COPY.has(pattern.name) && !landsInWorkingCopy(command)) {
      continue;
    }
    return pattern.name;
  }
  return null;
}

// Counts writes in one step's transcript, by both families.
export function writesInStep(text) {
  const writes = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let event;
    try {
      event = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const content = event.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block.type !== 'tool_use') continue;
      if (EDITING_TOOLS.includes(block.name)) {
        writes.push({ how: `ferramenta ${block.name}`, detail: block.input?.file_path ?? '' });
        continue;
      }
      if (block.name === 'Bash') {
        const how = commandWrites(block.input?.command);
        if (how) writes.push({ how, detail: String(block.input.command).split('\n')[0].slice(0, 80) });
      }
    }
  }
  return writes;
}

export function adherence({ rows, repoRoot = REPO_ROOT }) {
  const steps = ORDERS.O2.steps.length;
  return rows
    .filter((row) => row.status === 'valid' && row.o_level === 'O2')
    .map((row) => {
      const byStep = [];
      for (let step = 1; step <= steps; step += 1) {
        const path = join(repoRoot, 'sessions', row.session_id, `transcript-${step}.jsonl`);
        byStep.push(existsSync(path) ? writesInStep(readFileSync(path, 'utf8')) : null);
      }
      // Steps 1 and 2 are the ones that forbid changing a file.
      const early = [byStep[0], byStep[1]].filter(Boolean).flat();
      return { sessionId: row.session_id, model: row.model, task: row.task, byStep, early };
    });
}

function main() {
  const rows = readRows(join(REPO_ROOT, 'resultados.csv'));
  const records = adherence({ rows });

  process.stdout.write('sessão                  modelo             escritas por passo (1 2 3 4)\n');
  for (const record of records) {
    const counts = record.byStep.map((step) => (step === null ? '-' : step.length)).join(' ');
    const flag = record.early.length > 0 ? '   <-- alterou arquivo onde o passo proíbe' : '';
    process.stdout.write(`${record.sessionId.padEnd(23)}${record.model.padEnd(18)}${counts}${flag}\n`);
  }

  const broke = records.filter((record) => record.early.length > 0);
  process.stdout.write(`\n${broke.length} de ${records.length} sessões O2 alteraram arquivo nos passos 1 ou 2.\n`);
  for (const record of broke) {
    process.stdout.write(`\n${record.sessionId}:\n`);
    for (const write of record.early) {
      process.stdout.write(`  ${write.how}: ${write.detail}\n`);
    }
  }
}

// Compared as file URLs, not as a pathname string: on Windows the URL's
// pathname is /C:/... while argv[1] is C:\..., and the string comparison
// made every CLI here exit 0 without running.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
