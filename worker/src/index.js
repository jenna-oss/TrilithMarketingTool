/* ---------------------------------------------------------------------------
 * Ask-the-corpus backend — Cloudflare Worker.
 *
 * Holds the Anthropic API key as a Worker secret so it never reaches the page.
 * The browser POSTs a question here; this streams the answer back as SSE.
 *
 * Design note: there is deliberately no retrieval layer. The whole corpus —
 * 774 ads, ~70K tokens — fits inside the context window, so every question is
 * answered against every ad rather than against whatever a search step happened
 * to surface. Prompt caching makes the repeat cost of that trivial: the corpus
 * sits in a cached system prefix and the question goes after the breakpoint, so
 * only the question is billed at full rate.
 * ------------------------------------------------------------------------ */

import Anthropic from '@anthropic-ai/sdk';
import { handleIdeas, explain } from './ideas.js';

const CORPUS_URL = 'https://jenna-oss.github.io/TrilithMarketingTool/data/ads.json';

/* Only the published page may call this. The key lives here, so an open
 * endpoint would let anyone spend it. */
const ALLOWED_ORIGINS = new Set([
  'https://jenna-oss.github.io',
  'http://localhost:8788',
]);

const MAX_QUESTION_CHARS = 2000;
const MAX_HISTORY_TURNS = 12;
const MODEL = 'claude-opus-5';

/* Corpus is immutable per deploy of the data file; hold it in module scope so
 * warm invocations skip the fetch entirely. */
let corpusPromise = null;

function loadCorpus() {
  corpusPromise ||= fetch(CORPUS_URL, { cf: { cacheTtl: 900, cacheEverything: true } })
    .then((r) => {
      if (!r.ok) throw new Error(`corpus fetch failed: ${r.status}`);
      return r.json();
    })
    .catch((err) => {
      corpusPromise = null; // don't cache a failure
      throw err;
    });
  return corpusPromise;
}

/* Ad copy is full of styled unicode and emoji, and a few ads arrive with a
 * surrogate half missing where Meta truncated the text mid-character. Those
 * cannot be encoded as JSON, so the request body was rejected outright:
 * "no low surrogate in string". Drop the orphans and NULs; matched pairs pass
 * through untouched, so the styled glyphs survive. Same scrub the Supabase
 * loader applies in tools/to-sql.mjs. */
function scrub(s) {
  const src = String(s ?? '');
  let out = '';
  for (let i = 0; i < src.length; i++) {
    const c = src.charCodeAt(i);
    if (c === 0) continue;
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = src.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) { out += src[i] + src[i + 1]; i++; }
      continue; // orphaned high surrogate
    }
    if (c >= 0xdc00 && c <= 0xdfff) continue; // orphaned low surrogate
    out += src[i];
  }
  return out;
}

/* One line per ad. Compact on purpose — this is the bulk of the cached prefix,
 * and JSON punctuation would cost tokens without adding meaning. */
function renderCorpus(corpus) {
  const ads = Object.values(corpus.ads);
  const lines = ads.map((a) =>
    `${a.libraryId}\t${scrub(a.advertiser)}\t${a.started}\t${a.source}\tfirst_seen:${a.firstSeen}\t${scrub(a.copy)}`
  );
  return {
    text: lines.join('\n'),
    count: ads.length,
    advertisers: new Set(ads.map((a) => a.advertiser)).size,
    updatedAt: corpus.updatedAt,
  };
}

const SYSTEM_INTRO = `You answer questions about a corpus of real estate lending ads collected from Meta's Ad Library, for AIKO's competitive intelligence work on behalf of Trilith Funding — a private real estate lender serving investors.

Every ad in the corpus is given below, one per line, tab-separated:
library_id, advertiser, start_date, source (which sweep found it), first_seen (the date our daily job first observed it), ad copy.

How to answer:
- Ground every claim in the corpus. Quote ad copy verbatim when it supports the point, and attribute it to the advertiser.
- Cite counts when they matter, and say how you counted.
- If the corpus does not support an answer, say so plainly rather than inferring. Absence of an ad means we did not observe it, not that it does not exist.
- Distinguish start_date (when the advertiser launched the ad) from first_seen (when we first observed it). Only first_seen is ours.
- Be direct and concrete. Lead with the answer, then the evidence. No preamble.
- Trilith is the client, not a competitor — it does not advertise on Meta and is not in this corpus.

Context worth knowing: the largest lenders by origination volume are mostly absent from this corpus. Kiavi originates roughly $8B a year and runs ~33 live ads; CoreVest has funded $7.8B and has never run one. Regional shops outspend them — Capital Fund 1 runs over 100.`;

function cors(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : [...ALLOWED_ORIGINS][0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
  };
}

const sse = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const headers = cors(origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') {
      return new Response('POST a JSON body: {question, history?}', { status: 405, headers });
    }
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return new Response(JSON.stringify({ error: 'origin not allowed' }), {
        status: 403, headers: { ...headers, 'content-type': 'application/json' },
      });
    }

    /* Two routes, one Worker, so there is one deploy and one API key to
     * manage. Anything that is not /ideas stays the ask-the-corpus endpoint,
     * which ask.html calls at the bare Worker URL. */
    if (new URL(request.url).pathname.replace(/\/+$/, '') === '/ideas') {
      return handleIdeas(request, env, headers, ctx);
    }

    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'body must be JSON' }, 400, headers); }

    const question = String(body.question ?? '').trim();
    if (!question) return json({ error: 'question is required' }, 400, headers);
    if (question.length > MAX_QUESTION_CHARS) {
      return json({ error: `question must be under ${MAX_QUESTION_CHARS} characters` }, 400, headers);
    }

    /* Trust only the shape, not the contents — this arrives from the browser. */
    const history = Array.isArray(body.history)
      ? body.history
          .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
          .slice(-MAX_HISTORY_TURNS)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }))
      : [];

    let corpus;
    try { corpus = renderCorpus(await loadCorpus()); }
    catch (err) { return json({ error: `corpus unavailable: ${err.message}` }, 503, headers); }

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

    /* See the note in ideas.js: work driven from ReadableStream.start() is torn
     * down as soon as this handler returns, so the answer never streamed. The
     * TransformStream is kept alive by ctx.waitUntil instead. */
    const enc = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const send = (e, d) => writer.write(enc.encode(sse(e, d)));

    const work = (async () => {
        try {
          send('meta', {
            ads: corpus.count,
            advertisers: corpus.advertisers,
            corpusUpdated: corpus.updatedAt,
          });

          const model = client.beta.messages.stream({
            model: MODEL,
            max_tokens: 8000,
            thinking: { type: 'adaptive' },
            /* Safety classifiers can decline; route the retry automatically
             * rather than surfacing a dead end to the user. */
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
            system: [
              { type: 'text', text: SYSTEM_INTRO },
              {
                type: 'text',
                text: `<corpus updated="${corpus.updatedAt}" ads="${corpus.count}">\n${corpus.text}\n</corpus>`,
                /* 1h TTL: usage here is bursty (a demo, a client call), so the
                 * 5-minute window would expire between questions and re-pay the
                 * write on nearly every turn. */
                cache_control: { type: 'ephemeral', ttl: '1h' },
              },
            ],
            messages: [...history, { role: 'user', content: question }],
          });

          for await (const event of model) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              send('token', event.delta.text);
            }
          }

          const final = await model.finalMessage();

          if (final.stop_reason === 'refusal') {
            send('error', {
              message: 'That request was declined by the safety system. Try rephrasing it.',
              category: final.stop_details?.category ?? null,
            });
          }

          send('done', {
            model: final.model,
            usage: {
              input: final.usage.input_tokens,
              output: final.usage.output_tokens,
              cacheRead: final.usage.cache_read_input_tokens,
              cacheWrite: final.usage.cache_creation_input_tokens,
            },
          });
        } catch (err) {
          /* Distinguish what the user can act on from what they can't. See the
           * note on explain() — the instanceof form threw inside this very
           * catch block, swallowing every error the route produced. */
          console.error('ask route failed:', err?.name, err?.message);
          send('error', { message: explain(err, 'Something went wrong answering that.') });
        } finally {
          await writer.close();
        }
    })();

    ctx.waitUntil(work);

    return new Response(readable, {
      headers: {
        ...headers,
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      },
    });
  },
};

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...headers, 'content-type': 'application/json' },
  });
}
