const parseLines = (text) => {
  const events = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      // A malformed line must not cost us the rest of the transcript.
    }
  }
  return events;
};

// The CLI reports every model the session touched, auxiliary ones
// included: the pilot session T1-P0-O1-mu4t4rvp ran on sonnet but also
// shows a haiku entry the CLI used for its own bookkeeping. Taking the
// first key recorded the auxiliary model in a column that is an
// experimental factor, so the session's model is identified by the one
// that produced the work -- output tokens, not key order.
function sessionModel(result, init) {
  const entries = Object.entries(result.modelUsage ?? {});
  if (entries.length === 0) return init?.model ?? 'unknown';
  const [name] = entries.reduce((best, entry) =>
    (entry[1]?.outputTokens ?? 0) > (best[1]?.outputTokens ?? 0) ? entry : best);
  return name;
}

const countToolCalls = (events) =>
  events
    .filter((event) => event.type === 'assistant')
    .reduce((total, event) => {
      const content = event.message?.content;
      if (!Array.isArray(content)) return total;
      return total + content.filter((block) => block.type === 'tool_use').length;
    }, 0);

export function readTranscript(text) {
  const events = parseLines(text);
  const init = events.find((event) => event.type === 'system' && event.subtype === 'init');
  const results = events.filter((event) => event.type === 'result');

  if (results.length === 0) {
    throw new Error('transcript has no result event: the session did not finish');
  }
  const last = results[results.length - 1];

  // O2 chains four calls, so a session's transcript carries one result
  // per step. Reading only the first recorded step 1 and discarded the
  // other three quarters of the session.
  const sum = (pick) => results.reduce((total, result) => total + (pick(result) ?? 0), 0);

  // The same rule as 17/09 -- the model that did the work, by output
  // volume -- applied across every step's usage map at once.
  const mergedUsage = {};
  for (const result of results) {
    for (const [name, usage] of Object.entries(result.modelUsage ?? {})) {
      const current = mergedUsage[name] ?? { outputTokens: 0 };
      mergedUsage[name] = { ...usage, outputTokens: current.outputTokens + (usage.outputTokens ?? 0) };
    }
  }

  return {
    model: sessionModel({ modelUsage: mergedUsage }, init),
    modelUsage: mergedUsage,
    cliVersion: init?.claude_code_version ?? 'unknown',
    sessionId: last.session_id ?? init?.session_id ?? 'unknown',
    numTurns: sum((r) => r.num_turns),
    stopReason: last.stop_reason ?? 'unknown',
    isError: Boolean(last.is_error),
    // Any step, not just the last. The CLI says plainly when it stopped a
    // call at the turn ceiling, and that is the only reliable signal:
    // `num_turns` is not on the same scale as --max-turns, and sessions
    // that finished on their own have reported more turns than the ceiling
    // they ran under (48 against a ceiling of 40, measured 25/09/2026).
    // Reading only the last step would miss an O2 chain whose second call
    // was cut and whose fourth ended cleanly.
    maxTurnsReached: results.some((result) => result.subtype === 'error_max_turns'),
    costUsd: sum((r) => r.total_cost_usd),
    durationMs: sum((r) => r.duration_ms),
    tokens: {
      input: sum((r) => r.usage?.input_tokens),
      output: sum((r) => r.usage?.output_tokens),
      cacheCreate: sum((r) => r.usage?.cache_creation_input_tokens),
      cacheRead: sum((r) => r.usage?.cache_read_input_tokens),
    },
    toolCalls: countToolCalls(events),
    rateLimited: events.some((event) => event.type === 'rate_limit_event'),
    events,
  };
}

export function toMarkdown(parsed) {
  const lines = [
    '# Transcrição da sessão',
    '',
    `- Modelo: ${parsed.model}`,
    `- Versão do CLI: ${parsed.cliVersion}`,
    `- Turnos: ${parsed.numTurns}`,
    `- Motivo de parada: ${parsed.stopReason}`,
    `- Chamadas de ferramenta: ${parsed.toolCalls}`,
    `- Custo em dólares: ${parsed.costUsd}`,
    '',
    '---',
    '',
  ];

  for (const event of parsed.events) {
    if (event.type !== 'assistant') continue;
    const content = event.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block.type === 'text' && block.text?.trim()) {
        lines.push('## Resposta', '', block.text.trim(), '');
      }
      if (block.type === 'tool_use') {
        lines.push(`## Ferramenta: ${block.name}`, '', '```json', JSON.stringify(block.input ?? {}, null, 2), '```', '');
      }
    }
  }

  return lines.join('\n');
}
