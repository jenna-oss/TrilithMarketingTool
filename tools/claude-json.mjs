/* ---------------------------------------------------------------------------
 * One Claude call that must come back as JSON, shared by the creator pipeline.
 *
 * The creators page is built on judgments a keyword rule cannot make: whether a
 * video about "Japan tax-free shopping" belongs on a page about residential
 * real estate investing, and what the shared form of a dozen opening lines
 * actually is. Both are asked here.
 *
 * Needs ANTHROPIC_API_KEY. Throws MissingKey when it is absent so each caller
 * can decide whether that is fatal — refreshing videos without a relevance
 * screen is not safe, but it is better than publishing nothing.
 * ------------------------------------------------------------------------ */

const API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-opus-5';
const TIMEOUT_MS = 120000;

export class MissingKey extends Error {
  constructor() {
    super('ANTHROPIC_API_KEY not set');
    this.name = 'MissingKey';
  }
}

export function hasKey() {
  return Boolean(String(process.env.ANTHROPIC_API_KEY ?? '').trim());
}

/* Models are chatty by default and will happily wrap JSON in prose or a fenced
 * block. Prefilling the assistant turn with the opening brace makes the reply
 * start inside the object, which removes most of the parsing problem; the
 * fence-stripping below covers the rest. */
function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  return JSON.parse(body);
}

export async function claudeJson({ system, user, maxTokens = 8192 }) {
  const key = String(process.env.ANTHROPIC_API_KEY ?? '').trim();
  if (!key) throw new MissingKey();

  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [
        { role: 'user', content: user },
        /* Prefill: the reply continues from here, so it opens inside the object. */
        { role: 'assistant', content: '{' },
      ],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = String(await res.text()).split(key).join('[REDACTED]');
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 300)}`);
  }

  const body = await res.json();

  /* A refusal is not a parse failure and must not be reported as one. */
  if (body.stop_reason === 'refusal') {
    throw new Error('Claude declined this request.');
  }
  /* Truncation yields JSON that parses as far as it got and then throws
   * somewhere unhelpful. Name it here instead. */
  if (body.stop_reason === 'max_tokens') {
    throw new Error(`Reply hit max_tokens (${maxTokens}); raise it or send fewer items.`);
  }

  const text = (body.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  try {
    return extractJson(`{${text}`);
  } catch (err) {
    throw new Error(`Claude did not return JSON: ${err.message} — got: ${text.slice(0, 200)}`);
  }
}
