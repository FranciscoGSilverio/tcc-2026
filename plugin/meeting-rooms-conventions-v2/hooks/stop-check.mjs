// Stop: before the agent ends its turn, checks the eight conventions over
// everything changed since the session started. If any is violated, the
// stop is blocked and the list goes back to the agent as the reason, so it
// fixes the code instead of declaring the task done.
//
// It sends the agent back at most MAX_BLOCKS times per session, so a
// violation the agent cannot fix never traps it in a loop.
import { checkProject, RULE_NAMES } from './lib/conventions.mjs';
import { baseCommit, isProject, projectDir, readInput, readState, writeState } from './lib/project.mjs';

const MAX_BLOCKS = 2;

const input = readInput();
const dir = projectDir(input);
if (!isProject(dir)) process.exit(0);

const state = readState(input.session_id);
const blocks = state.blocks ?? 0;
if (blocks >= MAX_BLOCKS) process.exit(0);

const base = baseCommit(dir, input.session_id);
if (!base) process.exit(0);

const result = checkProject(dir, base);
if (result.skipped || result.violations.length === 0) process.exit(0);

writeState(input.session_id, { ...state, base, blocks: blocks + 1 });
const lines = result.violations.map(({ rule, detail }) => `- Convenção ${rule} (${RULE_NAMES[rule]}): ${detail}`);
const reason = [
  `A verificação de convenções do projeto encontrou ${result.violations.length} problema(s) no que foi alterado nesta sessão:`,
  ...lines,
  ...result.notes.map((note) => `Observação: ${note}.`),
  `Corrija antes de encerrar (verificação ${blocks + 1} de ${MAX_BLOCKS}). A skill convencoes-do-projeto explica cada convenção.`,
].join('\n');
process.stdout.write(JSON.stringify({ decision: 'block', reason }));
