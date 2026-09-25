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

// 2048 was the original ceiling, chosen before anyone here knew that
// thinking tokens are billed against max_tokens too. Measured on
// 25/09/2026, a decision-points call spent 1365 of 2048 on thinking and
// had ~680 left for a JSON object carrying ten categories and ten
// justifications: it was cut mid-sentence, and two sessions of that
// batch could not be evaluated. The ceiling buys nothing when unused --
// output tokens are billed as produced -- so it is set high enough that
// thinking and answer fit together with room to spare.
export async function callModel({ apiKey, prompt, fetchImpl = fetch, maxTokens = 8192 }) {
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

  // A truncated response is a failed measurement, not a cheap one. Without
  // this the cut-off text reached JSON.parse and surfaced as "Unterminated
  // string in JSON at position 2348" -- a message that names the symptom
  // and hides the cause. Nothing downstream ever recorded a wrong answer,
  // because parse.mjs requires every checklist question and every decision
  // point to be present and inside its closed list, so a response that
  // parses is necessarily complete. This only makes the failure legible.
  if (body.stop_reason === 'max_tokens') {
    throw new Error(
      `evaluator response was truncated at max_tokens (${body.usage?.output_tokens} output tokens, `
      + `${body.usage?.output_tokens_details?.thinking_tokens ?? 0} of them thinking)`,
    );
  }

  return {
    // The text block by type, never by position. Sonnet 5 runs adaptive
    // thinking by default and decides per request whether to think, so a
    // response is sometimes [text] and sometimes [thinking, text]. Taking
    // content[0] returned the thinking block -- which has no `text` field
    // -- and the empty string then died in JSON.parse as "Unexpected end
    // of JSON input". It failed on one of the first two real sessions and
    // not the other, which is the shape this defect always takes: fine
    // until the model happens to think.
    text: body.content?.find((block) => block.type === 'text')?.text ?? '',
    costUsd: estimateCostUsd(body.usage),
    usage: body.usage,
  };
}
