// Stop: before the agent ends its turn, checks the eight conventions over
// everything changed since the session started and runs `make verify`, the
// same command the repository's CI runs. If a convention is violated or the
// verification fails, the stop is blocked and what failed goes back to the
// agent as the reason, so it fixes the code instead of declaring the task
// done. A session that changed nothing is not verified.
//
// It sends the agent back at most MAX_BLOCKS times per session, so a
// violation the agent cannot fix never traps it in a loop.
import { createHash } from 'node:crypto';
import { checkProject, RULE_NAMES, sessionDiff } from './lib/conventions.mjs';
import { runVerify } from './lib/verify.mjs';
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

// Stop fires at the end of every turn. A diff that already passed is not
// checked again, so a turn that changes nothing pays for nothing.
const fingerprint = createHash('sha256').update(sessionDiff(dir, base) ?? '').digest('hex');
if (state.passed === fingerprint) process.exit(0);

const result = checkProject(dir, base);
if (result.skipped) process.exit(0);

const verify = runVerify(dir);
const verifyFailed = verify.ran && !verify.ok;
if (result.violations.length === 0 && !verifyFailed) {
  writeState(input.session_id, { ...state, base, passed: fingerprint });
  process.exit(0);
}

writeState(input.session_id, { ...state, base, blocks: blocks + 1 });
const lines = [];
if (result.violations.length > 0) {
  lines.push(`A verificação de convenções do projeto encontrou ${result.violations.length} problema(s) no que foi alterado nesta sessão:`);
  lines.push(...result.violations.map(({ rule, detail }) => `- Convenção ${rule} (${RULE_NAMES[rule]}): ${detail}`));
  lines.push(...result.notes.map((note) => `Observação: ${note}.`));
}
if (verifyFailed) {
  lines.push('`make verify` falhou (o mesmo comando que o CI do repositório roda em todo pull request). Últimas linhas:');
  lines.push(verify.tail);
}
lines.push(`Corrija antes de encerrar (verificação ${blocks + 1} de ${MAX_BLOCKS}). A skill convencoes-do-projeto explica cada convenção.`);
process.stdout.write(JSON.stringify({ decision: 'block', reason: lines.join('\n') }));
