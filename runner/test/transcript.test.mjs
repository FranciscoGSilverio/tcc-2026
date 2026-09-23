import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readTranscript, toMarkdown } from '../lib/transcript.mjs';

const fixture = readFileSync(new URL('./fixtures/transcript-minimal.jsonl', import.meta.url), 'utf8');

test('reads the final result event', () => {
  const parsed = readTranscript(fixture);
  assert.equal(parsed.numTurns, 1);
  assert.equal(parsed.stopReason, 'end_turn');
  assert.equal(parsed.isError, false);
  assert.ok(parsed.costUsd > 0);
});

test('separates the four token counters', () => {
  const parsed = readTranscript(fixture);
  assert.equal(parsed.tokens.input, 2);
  assert.equal(parsed.tokens.output, 4);
  assert.equal(parsed.tokens.cacheCreate, 39696);
  assert.equal(parsed.tokens.cacheRead, 0);
});

test('reads the exact model identifier and the cli version', () => {
  const parsed = readTranscript(fixture);
  assert.match(parsed.model, /^claude-/);
  assert.ok(parsed.cliVersion.length > 0);
});

test('counts tool calls, which is zero in this fixture', () => {
  assert.equal(readTranscript(fixture).toolCalls, 0);
});

test('counts tool calls when the transcript has them', () => {
  const withTool = [
    JSON.stringify({ type: 'system', subtype: 'init', model: 'claude-sonnet-5', claude_code_version: '2.1.0', session_id: 'x' }),
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'ok' }, { type: 'tool_use', name: 'Bash' }] } }),
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read' }] } }),
    JSON.stringify({ type: 'result', subtype: 'success', num_turns: 2, stop_reason: 'end_turn', is_error: false, total_cost_usd: 1, duration_ms: 10, usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }, modelUsage: { 'claude-sonnet-5': {} } }),
  ].join('\n');
  assert.equal(readTranscript(withTool).toolCalls, 2);
});

test('fails loudly when there is no result event', () => {
  const noResult = JSON.stringify({ type: 'system', subtype: 'init', model: 'm', claude_code_version: 'v', session_id: 's' });
  assert.throws(() => readTranscript(noResult), /result/i);
});

test('survives a malformed line without losing the rest', () => {
  const broken = `not json\n${fixture}`;
  assert.equal(readTranscript(broken).numTurns, 1);
});

test('detects a rate limit event', () => {
  const limited = [
    JSON.stringify({ type: 'rate_limit_event', rate_limit_info: {} }),
    fixture.trim().split('\n').pop(),
  ].join('\n');
  assert.equal(readTranscript(limited).rateLimited, true);
});

test('renders markdown naming the model and the turn count', () => {
  const markdown = toMarkdown(readTranscript(fixture));
  assert.match(markdown, /claude-/);
  assert.match(markdown, /1/);
});

test('picks the model that did the work, not the first key reported', () => {
  const result = {
    type: 'result',
    num_turns: 3,
    total_cost_usd: 0.42,
    modelUsage: {
      'claude-haiku-4-5-20251001': { inputTokens: 1260, outputTokens: 17, costUSD: 0.001345 },
      'claude-sonnet-5': { inputTokens: 34, outputTokens: 14813, costUSD: 0.4196 },
    },
  };
  const text = [
    JSON.stringify({ type: 'system', subtype: 'init', model: 'claude-sonnet-5' }),
    JSON.stringify(result),
  ].join('\n');

  assert.equal(readTranscript(text).model, 'claude-sonnet-5');
});

test('falls back to the requested model when no usage is reported', () => {
  const text = [
    JSON.stringify({ type: 'system', subtype: 'init', model: 'claude-opus-5' }),
    JSON.stringify({ type: 'result', num_turns: 1 }),
  ].join('\n');

  assert.equal(readTranscript(text).model, 'claude-opus-5');
});

test('sums turns, cost, tokens and tool calls across four result events', () => {
  const step = (turns, cost, out) => JSON.stringify({
    type: 'result', num_turns: turns, total_cost_usd: cost, stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: out, cache_creation_input_tokens: 1, cache_read_input_tokens: 2 },
    modelUsage: { 'claude-sonnet-5': { outputTokens: out, costUSD: cost } },
  });
  const assistantWithTool = JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: 'Read', input: {} }] },
  });
  const text = [
    JSON.stringify({ type: 'system', subtype: 'init', model: 'claude-sonnet-5', claude_code_version: '2.1.272' }),
    assistantWithTool, step(3, 0.10, 100),
    assistantWithTool, step(5, 0.20, 200),
    assistantWithTool, step(7, 0.30, 300),
    assistantWithTool, step(9, 0.40, 400),
  ].join('\n');

  const parsed = readTranscript(text);
  assert.equal(parsed.numTurns, 24);
  assert.equal(Math.round(parsed.costUsd * 100) / 100, 1.0);
  assert.equal(parsed.tokens.output, 1000);
  assert.equal(parsed.tokens.input, 40);
  assert.equal(parsed.toolCalls, 4);
});

test('stop reason and error flag come from the last step, not the first', () => {
  const text = [
    JSON.stringify({ type: 'system', subtype: 'init', model: 'claude-sonnet-5' }),
    JSON.stringify({ type: 'result', num_turns: 1, stop_reason: 'end_turn', is_error: false }),
    JSON.stringify({ type: 'result', num_turns: 1, stop_reason: 'max_turns', is_error: true }),
  ].join('\n');

  const parsed = readTranscript(text);
  assert.equal(parsed.stopReason, 'max_turns');
  assert.equal(parsed.isError, true);
});

test('a single result event still behaves exactly as before', () => {
  const text = [
    JSON.stringify({ type: 'system', subtype: 'init', model: 'claude-sonnet-5' }),
    JSON.stringify({
      type: 'result', num_turns: 31, total_cost_usd: 0.42, stop_reason: 'end_turn',
      usage: { input_tokens: 44, output_tokens: 12503 },
      modelUsage: { 'claude-sonnet-5': { outputTokens: 12503 } },
    }),
  ].join('\n');

  const parsed = readTranscript(text);
  assert.equal(parsed.numTurns, 31);
  assert.equal(parsed.model, 'claude-sonnet-5');
  assert.equal(parsed.stopReason, 'end_turn');
});
