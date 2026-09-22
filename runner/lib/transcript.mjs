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
  const result = events.find((event) => event.type === 'result');

  if (!result) {
    throw new Error('transcript has no result event: the session did not finish');
  }

  const usage = result.usage ?? {};

  return {
    model: sessionModel(result, init),
    modelUsage: result.modelUsage ?? {},
    cliVersion: init?.claude_code_version ?? 'unknown',
    sessionId: result.session_id ?? init?.session_id ?? 'unknown',
    numTurns: result.num_turns ?? 0,
    stopReason: result.stop_reason ?? 'unknown',
    isError: Boolean(result.is_error),
    costUsd: result.total_cost_usd ?? 0,
    durationMs: result.duration_ms ?? 0,
    tokens: {
      input: usage.input_tokens ?? 0,
      output: usage.output_tokens ?? 0,
      cacheCreate: usage.cache_creation_input_tokens ?? 0,
      cacheRead: usage.cache_read_input_tokens ?? 0,
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
