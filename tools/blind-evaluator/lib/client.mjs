// Direct fetch, not the CLI (spec D6): the CLI is an interactive coding
// harness, the wrong tool for a single classification call. No sampling
// parameter is sent -- temperature/top_p/top_k are all rejected with a
// 400 on claude-sonnet-5 (verified empirically 2026-09-21, spec D2, and
// reconfirmed 2026-09-22 against the live API before this file was
// written). The model runs its default sampling; there is no determinism
// lever to pull here, so none is attempted.
const MODEL = 'claude-sonnet-5';

// USD per 1M tokens, Sonnet 5 list price verified 2026-09-21. The
// Messages API returns token counts, never a dollar figure, so cost is
// computed here rather than read from a ready-made field.
const PRICE_PER_MILLION = { input: 2.0, output: 10.0 };

function estimateCostUsd(usage) {
  const inputCost = (usage?.input_tokens ?? 0) * PRICE_PER_MILLION.input / 1_000_000;
  const outputCost = (usage?.output_tokens ?? 0) * PRICE_PER_MILLION.output / 1_000_000;
  return inputCost + outputCost;
}

export async function callModel({ apiKey, prompt, fetchImpl = fetch, maxTokens = 2048 }) {
  const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(`evaluator call failed: ${body.error?.message ?? response.statusText}`);
  }

  return {
    text: body.content?.[0]?.text ?? '',
    costUsd: estimateCostUsd(body.usage),
    usage: body.usage,
  };
}
