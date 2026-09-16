#!/usr/bin/env node
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { copyIn, exec, stop } from './lib/container.mjs';
import { InfrastructureError, prepare } from './lib/prepare.mjs';
import { measure } from './lib/measure.mjs';
import { readTranscript, toMarkdown } from './lib/transcript.mjs';
import { appendRow, emptyRow } from './lib/dataset.mjs';
import { FAKES } from './lib/fakes.mjs';

const REPO = resolve(import.meta.dirname, '..');
const TIMEOUT_MS = 30 * 60 * 1000;

const argument = (flag, fallback) => {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
};

// The statement reaches the agent as a prompt, never as a file inside
// /app: a file there would reveal to the agent that more than one task
// exists. It is Portuguese prose with quotes and parentheses, so it is
// copied into the container with `docker cp` (copyIn) to a path outside
// the working copy, /tmp/statement.txt, rather than inlined through a
// shell heredoc built by string concatenation. A heredoc means building
// one large `sh -c` argument by hand from the exact bytes of that prose;
// copyIn moves the bytes with no shell parsing of the content at all, and
// only the *path* (never the prose) appears in the command that reads it
// back with $(cat ...) when invoking the agent.
function deliverStatement(name, statementPath) {
  const staging = mkdtempSync(join(tmpdir(), 'statement-'));
  const staged = join(staging, 'statement.txt');
  writeFileSync(staged, readFileSync(statementPath, 'utf8'));
  copyIn(name, staged, '/tmp/statement.txt');
}

function runAgent({ name, model }) {
  const script = [
    'cd /app',
    `claude -p "$(cat /tmp/statement.txt)" --output-format stream-json --verbose`,
    `--max-turns 40 --model ${model} --dangerously-skip-permissions > /out/transcript.jsonl 2>/out/agent.log`,
  ].join(' ');
  return exec(name, ['sh', '-c', script]);
}

async function main() {
  const task = argument('--task', 'T1');
  const pLevel = argument('--p', 'P0');
  const oLevel = argument('--o', 'O1');
  const model = argument('--model', 'claude-sonnet-5');
  const runNumber = argument('--run', '1');
  const fake = argument('--fake', null);
  // Configurable so the runner's own tests never write to the real
  // dataset: a fixed path meant a `node --test` run would silently
  // append fake sessions to the file the actual collection lands in.
  const datasetPath = resolve(
    argument('--dataset', process.env.RUNNER_DATASET_PATH ?? join(REPO, 'resultados.csv')),
  );

  const sessionId = `${task}-${pLevel}-${oLevel}-${Date.now().toString(36)}`;
  const outDir = join(REPO, 'sessions', sessionId);
  mkdirSync(outDir, { recursive: true });

  const name = `session-${sessionId}`;
  const hostPort = 3600 + Math.floor(Math.random() * 300);
  const row = { ...emptyRow(), session_id: sessionId, task, p_level: pLevel, o_level: oLevel, run_number: runNumber, model };
  row.started_at = new Date().toISOString();

  try {
    const anchors = await prepare({
      name, outDir, hostPort,
      env: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '' },
    });
    row.image_digest = anchors.imageId;
    row.cli_version = anchors.cliVersion;

    const statement = resolve(REPO, 'tasks', 'T1-validacao-de-reservas.md');
    deliverStatement(name, statement);

    const startedAt = Date.now();
    let transcriptText;
    if (fake) {
      if (!FAKES[fake]) throw new Error(`unknown fake: ${fake}`);
      transcriptText = FAKES[fake].run(name, REPO);
      writeFileSync(join(outDir, 'transcript.jsonl'), transcriptText);
    } else {
      const agent = runAgent({ name, model });
      if (agent.status !== 0 && !agent.stdout) {
        throw new InfrastructureError(`the agent cli did not run: ${agent.stderr}`);
      }
      transcriptText = readFileSync(join(outDir, 'transcript.jsonl'), 'utf8');
    }
    const durationS = Math.round((Date.now() - startedAt) / 1000);

    const parsed = readTranscript(transcriptText);
    if (parsed.rateLimited) {
      throw new InfrastructureError('the api reported a rate limit during the session');
    }
    writeFileSync(join(outDir, 'transcript.md'), toMarkdown(parsed));

    const measured = await measure({ name, outDir, hostPort, repoRoot: REPO });

    const hitTurnLimit = parsed.stopReason !== 'end_turn' && parsed.numTurns >= 40;
    row.ended_at = new Date().toISOString();
    row.status = 'valid';
    row.model_version = parsed.model;
    row.duracao_s = durationS;
    row.custo_usd = parsed.costUsd;
    row.n_tool_calls = parsed.toolCalls;
    row.n_turns = parsed.numTurns;
    row.tokens_input = parsed.tokens.input;
    row.tokens_output = parsed.tokens.output;
    row.tokens_cache_create = parsed.tokens.cacheCreate;
    row.tokens_cache_read = parsed.tokens.cacheRead;
    row.regressoes = measured.regressoes;
    row.taxa_aceitacao = measured.hidden ? measured.hidden.rate : 0;
    row.travou_turnos = hitTurnLimit;
    row.travou_sem_diff = !measured.hasDiff;
    row.travou_build = !measured.buildOk || !measured.serverUp;
    row.travou = hitTurnLimit || !measured.hasDiff || !measured.buildOk || !measured.serverUp;
    row.diff_path = join('sessions', sessionId, 'session.diff');
    row.transcript_path = join('sessions', sessionId, 'transcript.jsonl');

    writeFileSync(join(outDir, 'result.json'), JSON.stringify({ row, hidden: measured.hidden }, null, 2));
  } catch (error) {
    row.ended_at = new Date().toISOString();
    row.status = 'invalid';
    row.invalid_reason = error instanceof InfrastructureError ? error.message : `runner error: ${error.message}`;
  } finally {
    stop(name);
  }

  appendRow(datasetPath, row);
  process.stdout.write(`${JSON.stringify(row, null, 2)}\n`);
}

const timer = setTimeout(() => {
  process.stderr.write('session exceeded the wall clock ceiling\n');
  process.exit(3);
}, TIMEOUT_MS);
timer.unref();

await main();
