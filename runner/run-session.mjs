#!/usr/bin/env node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { copyIn, exec, stop } from './lib/container.mjs';
import { InfrastructureError, prepare } from './lib/prepare.mjs';
import { measure } from './lib/measure.mjs';
import { readTranscript, toMarkdown } from './lib/transcript.mjs';
import { appendRow, emptyRow } from './lib/dataset.mjs';
import { FAKES } from './lib/fakes.mjs';
import { UnsupportedSessionError, resolveSession } from './lib/capabilities.mjs';

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

function deliverPrompt(name, text, containerPath) {
  const staging = mkdtempSync(join(tmpdir(), 'prompt-'));
  const staged = join(staging, 'prompt.txt');
  writeFileSync(staged, text);
  copyIn(name, staged, containerPath);
}

// One call for O1, four chained for O2. Chaining goes through an explicit
// session id rather than --continue: --continue resumes "the most recent
// conversation", which is implicit state of exactly the kind that has
// already produced three defects here (modelUsage[0], content[0], and a
// flag recorded but not honoured).
//
// Each call is chained with && and the redirections kept at the end of
// the line. Joining with plain spaces (an earlier bug) produced the
// single command `cd /app claude -p "..." ...`: `cd` reads only its
// first argument as the target directory, so `claude` and everything
// after it were just extra arguments to `cd`, which fails before the
// agent ever runs. The redirections still get set up regardless (a
// shell wires up redirections before it even resolves the command),
// which is why the failure left an empty transcript.jsonl and an empty
// agent.log rather than an error message anywhere obvious.
function runAgent({ name, model, plan, repoRoot, outDir }) {
  const pluginFlag = plan.context?.pluginDir ? '--plugin-dir /opt/plugin' : '';
  const call = (promptPath, sessionFlag, outFile) => {
    const command = [
      'cd /app',
      `claude -p "$(cat ${promptPath})" --output-format stream-json --verbose ` +
      `--max-turns 40 --model ${model} ${pluginFlag} ${sessionFlag} --dangerously-skip-permissions`,
    ].join(' && ');
    return exec(name, ['sh', '-c', `${command} > /out/${outFile} 2>>/out/agent.log`]);
  };

  if (!plan.steps) {
    call('/tmp/statement.txt', '', 'transcript.jsonl');
    return;
  }

  const statement = readFileSync(resolve(repoRoot, plan.statement), 'utf8');
  const uuid = randomUUID();

  plan.steps.forEach((step, index) => {
    const template = readFileSync(resolve(repoRoot, step), 'utf8');
    const prompt = template.replace('{{ENUNCIADO}}', statement);
    const promptPath = `/tmp/step-${index + 1}.txt`;
    deliverPrompt(name, prompt, promptPath);
    const sessionFlag = index === 0 ? `--session-id ${uuid}` : `--resume ${uuid}`;
    call(promptPath, sessionFlag, `transcript-${index + 1}.jsonl`);

    // A step that produced nothing means the chain broke. Carrying on to
    // the next step would produce a session missing a quarter of its work
    // and looking complete, so it fails here instead.
    const produced = join(outDir, `transcript-${index + 1}.jsonl`);
    if (!existsSync(produced) || !readFileSync(produced, 'utf8').trim()) {
      const log = existsSync(join(outDir, 'agent.log'))
        ? readFileSync(join(outDir, 'agent.log'), 'utf8').trim() : '';
      throw new InfrastructureError(
        `O2 step ${index + 1} produced no transcript; agent.log: ${log || '(empty)'}`,
      );
    }
  });

  const joined = plan.steps
    .map((_, index) => readFileSync(join(outDir, `transcript-${index + 1}.jsonl`), 'utf8').trim())
    .join('\n');
  writeFileSync(join(outDir, 'transcript.jsonl'), `${joined}\n`);
}

// The fourth face of the same defect: --model states the M factor, and
// nothing checked the session actually ran on it. The CLI reports either
// an exact id or an alias, so a requested name matches when it equals the
// reported key, equals that key's canonicalModel, or prefixes either.
function assertModelMatches(requested, parsed) {
  const reported = parsed.model;
  const canonical = parsed.modelUsage?.[reported]?.canonicalModel ?? reported;
  const matches = [reported, canonical].some(
    (name) => name === requested || name.startsWith(requested),
  );
  if (!matches) {
    throw new InfrastructureError(
      `the session was asked for ${requested} but ran on ${reported}`,
    );
  }
}

// A P2 session whose init reports no plugin ran as P1 with extra steps:
// the label would say P2 and the condition would not be P2. The init
// event lists what actually loaded, so this is checkable rather than
// hopeful -- every session collected so far reported `plugins: []`.
function assertPluginLoaded(parsed, pluginName) {
  const init = parsed.events.find((e) => e.type === 'system' && e.subtype === 'init');
  const loaded = init?.plugins ?? [];
  const names = loaded.map((p) => (typeof p === 'string' ? p : p?.name)).filter(Boolean);
  if (!names.some((name) => name === pluginName || String(name).includes(pluginName))) {
    throw new InfrastructureError(
      `the session was labelled with a plugin context but init reported plugins: ${JSON.stringify(loaded)}`,
    );
  }
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

  // Before anything is created or spent: refuse a session that cannot be
  // run exactly as it will be labelled.
  const plan = resolveSession({ task, pLevel, oLevel });

  const sessionId = `${task}-${pLevel}-${oLevel}-${Date.now().toString(36)}`;
  // A fake session is not data: it never reaches the real dataset, so its
  // artefacts must not land in sessions/ either. They used to, and by the
  // time sessions/ was versioned on 23/09 there were 76 leftover fake
  // directories against 8 real ones -- enough to bury the archive and to
  // dirty `git status`, which this project uses as a gate everywhere.
  const outDir = fake
    ? mkdtempSync(join(tmpdir(), `fake-session-${sessionId}-`))
    : join(REPO, 'sessions', sessionId);
  mkdirSync(outDir, { recursive: true });

  const name = `session-${sessionId}`;
  const hostPort = 3600 + Math.floor(Math.random() * 300);
  const row = { ...emptyRow(), session_id: sessionId, task, p_level: pLevel, o_level: oLevel, run_number: runNumber, model };
  row.started_at = new Date().toISOString();

  try {
    const anchors = await prepare({
      name, outDir, hostPort, pLevel, repoRoot: REPO,
      env: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '' },
    });
    row.image_digest = anchors.imageId;
    row.cli_version = anchors.cliVersion;

    deliverStatement(name, resolve(REPO, plan.statement));

    const startedAt = Date.now();
    let transcriptText;
    if (fake) {
      if (!FAKES[fake]) throw new Error(`unknown fake: ${fake}`);
      transcriptText = FAKES[fake].run(name, REPO);
      writeFileSync(join(outDir, 'transcript.jsonl'), transcriptText);
    } else {
      runAgent({ name, model, plan, repoRoot: REPO, outDir });
      const transcriptPath = join(outDir, 'transcript.jsonl');
      transcriptText = existsSync(transcriptPath) ? readFileSync(transcriptPath, 'utf8') : '';
      // An empty transcript means the agent never ran (or never finished a
      // turn): reading it as a transcript later would fail with "no result
      // event", a message that points at the symptom, not the cause. Fail
      // here instead, with agent.log's content in the message, so the
      // actual cause (e.g. a malformed command, or the CLI refusing to
      // start) is visible without having to go dig through /out by hand.
      if (!transcriptText.trim()) {
        const agentLogPath = join(outDir, 'agent.log');
        const agentLog = existsSync(agentLogPath) ? readFileSync(agentLogPath, 'utf8').trim() : '';
        throw new InfrastructureError(
          `the agent produced an empty transcript; agent.log: ${agentLog || '(empty)'}`,
        );
      }
    }
    const durationS = Math.round((Date.now() - startedAt) / 1000);

    const parsed = readTranscript(transcriptText);
    if (parsed.rateLimited) {
      throw new InfrastructureError('the api reported a rate limit during the session');
    }
    // Fakes report a synthetic model on purpose, so they are exempt.
    if (!fake) assertModelMatches(model, parsed);
    if (!fake && plan.context?.pluginName) assertPluginLoaded(parsed, plan.context.pluginName);
    writeFileSync(join(outDir, 'transcript.md'), toMarkdown(parsed));

    const measured = await measure({
      name, outDir, hostPort, repoRoot: REPO, hiddenSuite: plan.hiddenSuite,
    });

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
    // Empty, not zero, for a task with no hidden suite: section 5.1
    // declares taxa_aceitacao as T1 only, and a zero would read as "the
    // agent got nothing right" instead of "not measured this way". For
    // T1 the zero stays and is deliberate -- a session whose application
    // does not serve is scored zero rather than discarded.
    row.taxa_aceitacao = plan.hiddenSuite ? (measured.hidden ? measured.hidden.rate : 0) : '';
    row.violacoes = measured.conventions?.violacoes ?? '';
    if (measured.conventions) {
      writeFileSync(join(outDir, 'conventions.json'), JSON.stringify(measured.conventions, null, 2));
    }
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

try {
  await main();
} catch (error) {
  // A refusal is expected behaviour, not a crash: it prints one line and
  // exits 2 (3 is already the wall-clock ceiling), without a stack trace.
  if (error instanceof UnsupportedSessionError) {
    process.stderr.write(`${error.message}\n`);
    process.exit(2);
  }
  throw error;
}
