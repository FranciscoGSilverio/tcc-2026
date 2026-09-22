import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callModel } from '../lib/client.mjs';

test('sends no sampling parameters at all', async () => {
  let captured;
  const fetchImpl = async (url, options) => {
    captured = JSON.parse(options.body);
    return { ok: true, json: async () => ({ content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 1, output_tokens: 1 } }) };
  };
  await callModel({ apiKey: 'x', prompt: 'hello', fetchImpl });
  assert.equal('temperature' in captured, false);
  assert.equal('top_p' in captured, false);
  assert.equal('top_k' in captured, false);
  assert.equal(captured.model, 'claude-sonnet-5');
});

test('computes cost from usage at Sonnet 5 list price', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 1_000_000, output_tokens: 1_000_000 } }),
  });
  const result = await callModel({ apiKey: 'x', prompt: 'hello', fetchImpl });
  // $2.00 input + $10.00 output per 1M tokens.
  assert.equal(result.costUsd, 12);
});

test('returns the response text', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ content: [{ type: 'text', text: 'the answer' }], usage: { input_tokens: 1, output_tokens: 1 } }),
  });
  const result = await callModel({ apiKey: 'x', prompt: 'hello', fetchImpl });
  assert.equal(result.text, 'the answer');
});

test('throws with the API error message when the call fails', async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 400,
    statusText: 'Bad Request',
    json: async () => ({ error: { message: 'something specific went wrong' } }),
  });
  await assert.rejects(
    () => callModel({ apiKey: 'x', prompt: 'hello', fetchImpl }),
    /something specific went wrong/,
  );
});

// Regression: Sonnet 5 runs adaptive thinking and decides per request
// whether to think, so the response is sometimes [text] and sometimes
// [thinking, text]. Reading content[0] worked on one real session and
// failed on the very next one.
test('finds the text block even when a thinking block comes first', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      content: [
        { type: 'thinking', thinking: 'deliberating about the diff' },
        { type: 'text', text: '{"1": {"resposta": "sim"}}' },
      ],
      usage: { input_tokens: 1, output_tokens: 1 },
    }),
  });
  const result = await callModel({ apiKey: 'x', prompt: 'hello', fetchImpl });
  assert.equal(result.text, '{"1": {"resposta": "sim"}}');
});

test('still finds the text block when it is the only one', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      content: [{ type: 'text', text: 'plain answer' }],
      usage: { input_tokens: 1, output_tokens: 1 },
    }),
  });
  const result = await callModel({ apiKey: 'x', prompt: 'hello', fetchImpl });
  assert.equal(result.text, 'plain answer');
});
