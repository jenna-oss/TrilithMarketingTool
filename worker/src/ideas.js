/* ---------------------------------------------------------------------------
 * Content ideation agent — the /ideas route.
 *
 * Unlike the ask-the-corpus route, this one does not stuff a corpus into the
 * prompt. It has two of them now, and the content corpus is chunked precisely
 * so it does not have to be read whole. So the model gets tools instead and
 * decides what to look up: competitor ads on one side, Trilith's own published
 * writing on the other.
 *
 * Every search it runs is streamed to the page as a `tool` event. An idea that
 * claims a gap in the market is only worth anything if you can see what was
 * searched to find it.
 *
 * Reads Supabase through the anon key and the read-only RPCs, so this route
 * cannot write to either corpus even if something goes wrong.
 * ------------------------------------------------------------------------ */

import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-opus-5';
const MAX_BRIEF_CHARS = 2000;
const MAX_HISTORY_TURNS = 10;

/* Each round is one model turn plus its tool calls. Enough to search both
 * corpora, follow a thread, and check coverage before answering — but bounded,
 * because a runaway loop here spends the API key. */
const MAX_ROUNDS = 6;
const RPC_TIMEOUT_MS = 12000;

const PRODUCTS = ['dscr', 'fix-and-flip', 'bridge', 'ground-up', 'portfolio', 'brrrr', 'multifamily'];
const KINDS = ['blog', 'case-study', 'product', 'faq', 'page'];

const TOOLS = [
  {
    name: 'search_competitor_ads',
    description:
      'Search 774 real estate lending ads from 249 advertisers, harvested from Meta\'s Ad Library. Use this to find what competitors are actually saying — hooks, offers, phrasing, which products they push. Matches any query term, so natural phrasing works. Every argument is optional; omit query to browse by filter alone.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words or a phrase to look for in the ad copy.' },
        advertiser: { type: 'string', description: 'Partial advertiser name, e.g. "kiavi".' },
        product: { type: 'string', enum: PRODUCTS },
        audience: { type: 'string', enum: ['broker', 'borrower'] },
        started_since: { type: 'string', description: 'ISO date. Only ads Meta says launched on or after this.' },
        limit: { type: 'integer', description: 'Default 12, max 30.' },
      },
    },
  },
  {
    name: 'search_trilith_content',
    description:
      'Search what Trilith has already published — 22 blog posts, 4 funded-deal writeups, product pages and the FAQ, split into 254 passages. Use this before proposing an idea, to reuse an argument the brand has already made or to avoid repeating a post.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words or a phrase to look for.' },
        kind: { type: 'string', enum: KINDS },
        since: { type: 'string', description: 'ISO date. Only documents published on or after this.' },
        limit: { type: 'integer', description: 'Default 8, max 20.' },
      },
    },
  },
  {
    name: 'trilith_coverage',
    description:
      'List Trilith documents — one row each, no passages. The fastest way to see what topics are already covered and where the gaps are. Note that only blog posts carry a publisher-stated date.',
    input_schema: {
      type: 'object',
      properties: { kind: { type: 'string', enum: KINDS } },
    },
  },
];

const SYSTEM = `You are a content strategist working for AIKO, on behalf of their client Trilith Funding — a private real estate lender that finances investors (fix-and-flip, bridge, DSCR, ground-up, BRRRR, multifamily).

You have two corpora, reachable only through your tools:
1. Competitor ads — 774 ads from 249 advertisers on Meta, harvested daily.
2. Trilith's own published content — blog posts, funded-deal writeups, product pages, FAQ.

Your job is to propose content Trilith should make: blog posts, ad angles, social hooks, newsletter topics.

How to work:
- Search before you propose. An idea you did not ground in either corpus is a guess, and the user can tell.
- Check what Trilith has already published before suggesting a topic. If a post already covers it, say so and propose the angle that is genuinely new — a sharper hook, an update, a contrarian take — rather than pretending the ground is empty.
- Quote competitor copy verbatim when it supports a point, and name the advertiser. Link the ad using the ad_library_url the tool returns.
- Link Trilith posts by their url when you reference them.
- Prefer a few well-evidenced ideas over a long list of thin ones. For each, give the angle, why the evidence supports it, and a concrete opening hook or headline.
- Be direct. Lead with the ideas. No preamble, no restating the question.

What the evidence cannot support, and you must not imply otherwise:
- Ad count is not ad spend. The Ad Library reports creatives, never budget. A lender running 114 ads is not necessarily outspending one running 33.
- 'started' is when Meta says an ad launched; 'first_seen' is when our sweep first observed it. Only first_seen is ours, and the baseline sweep of 2026-08-15 makes everything look first-seen that day.
- Absence from the ad corpus means we did not observe it on Meta, not that it does not exist. Several large lenders advertise nowhere we can see.
- Only Trilith blog posts have publisher-stated dates. A date whose date_source is 'sitemap-lastmod' came from a file timestamp, not from the publisher — do not present it as a publication date.

Useful context: the biggest lenders by origination volume are mostly quiet on Meta. Kiavi originates roughly $8B a year against ~33 live ads, and its copy is brand-led — it almost never names a loan product. CoreVest has funded $7.8B and runs nothing. Regional shops outspend the giants on creative volume: Capital Fund 1 runs over 100. Trilith itself does not advertise on Meta and is not in the ad corpus.`;

async function rpc(env, fn, args) {
  const res = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  });
  if (!res.ok) {
    /* The response body can echo the request. Never let it reach the page. */
    throw new Error(`${fn} returned ${res.status}`);
  }
  return res.json();
}

const clamp = (n, def, max) => Math.min(Math.max(Number(n) || def, 1), max);

/* Turn an SDK error into something the page can act on.
 *
 * Deliberately not `err instanceof Anthropic.RateLimitError`: those classes are
 * not defined on the bundled default export, so the comparison threw
 * "Right-hand side of 'instanceof' is not an object" *inside the catch block* —
 * which meant no error ever reached the client and the stream just ended. Match
 * on status and name instead, which survive any bundling. */
export function explain(err, fallback) {
  const status = Number(err?.status);
  const text = String(err?.message || '');
  if (status === 401 || status === 403 || /authentication|api[- ]?key/i.test(text)) {
    return 'The API key is missing or invalid on the server.';
  }
  if (status === 429) return 'Rate limited — wait a moment and try again.';
  if (status >= 500) return `Model error (${status}).`;
  if (status >= 400) return `Request rejected by the model (${status}).`;
  if (/connection|network|fetch failed|timeout/i.test(text) || err?.name === 'APIConnectionError') {
    return 'Could not reach the model. Try again.';
  }
  return fallback;
}

async function runTool(env, name, input) {
  if (name === 'search_competitor_ads') {
    const rows = await rpc(env, 'adspy_search_ads', {
      q: input.query || null,
      advertiser: input.advertiser || null,
      product: PRODUCTS.includes(input.product) ? input.product : null,
      audience: ['broker', 'borrower'].includes(input.audience) ? input.audience : null,
      started_since: input.started_since || null,
      max_rows: clamp(input.limit, 12, 30),
    });
    return rows.map((r) => ({
      advertiser: r.advertiser_name,
      started: r.started,
      first_seen: r.first_seen,
      products: r.product_lines,
      audience: r.audience_tag,
      ad_library_url: r.ad_library_url,
      /* Long copy adds tokens without adding signal — the hook is at the top. */
      copy: String(r.copy || '').slice(0, 700),
    }));
  }

  if (name === 'search_trilith_content') {
    const rows = await rpc(env, 'content_search', {
      q: input.query || null,
      kind: KINDS.includes(input.kind) ? input.kind : null,
      since: input.since || null,
      max_rows: clamp(input.limit, 8, 20),
    });
    return rows.map((r) => ({
      title: r.title,
      url: r.url,
      kind: r.kind_tag,
      published: r.published,
      date_source: r.date_source,
      heading: r.heading,
      passage: r.passage,
    }));
  }

  if (name === 'trilith_coverage') {
    return rpc(env, 'content_coverage', {
      kind: KINDS.includes(input.kind) ? input.kind : null,
    });
  }

  throw new Error(`unknown tool: ${name}`);
}

/* Rebuild an assistant turn using only the fields the API accepts.
 *
 * finalMessage() hands back blocks decorated with SDK-side extras — a text
 * block carries `parsed`, for one — and echoing those straight back is rejected
 * with "messages.1.content.1.text.parsed: Extra inputs are not permitted",
 * which kills round two of every tool loop.
 *
 * Thinking blocks must survive intact, signature included: extended thinking
 * plus tool use requires the original reasoning to come back unmodified, and
 * dropping it is rejected just as hard as sending too much. */
function toApiBlocks(content) {
  return content.map((b) => {
    switch (b.type) {
      case 'text':
        return b.citations
          ? { type: 'text', text: b.text, citations: b.citations }
          : { type: 'text', text: b.text };
      case 'thinking':
        return { type: 'thinking', thinking: b.thinking, signature: b.signature };
      case 'redacted_thinking':
        return { type: 'redacted_thinking', data: b.data };
      case 'tool_use':
        return { type: 'tool_use', id: b.id, name: b.name, input: b.input };
      default:
        return b;
    }
  });
}

/* A short human-readable form of what was searched, for the transparency strip
 * in the UI. The model's own arguments, not a paraphrase. */
function describe(name, input) {
  const bits = [];
  if (input.query) bits.push(`"${input.query}"`);
  if (input.advertiser) bits.push(`advertiser: ${input.advertiser}`);
  if (input.product) bits.push(`product: ${input.product}`);
  if (input.audience) bits.push(`audience: ${input.audience}`);
  if (input.kind) bits.push(`kind: ${input.kind}`);
  if (input.since || input.started_since) bits.push(`since ${input.since || input.started_since}`);
  const label = {
    search_competitor_ads: 'Competitor ads',
    search_trilith_content: 'Trilith content',
    trilith_coverage: 'Trilith coverage',
  }[name] || name;
  return { label, detail: bits.join(' · ') || 'everything' };
}

export async function handleIdeas(request, env, headers, ctx) {
  /* Name the missing binding rather than both. A secret created with an empty
   * value looks present to `wrangler secret list` and to the version metadata,
   * so "one of these two is unset" sends you looking in the wrong place. */
  const missing = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'].filter((k) => !env[k]);
  if (missing.length) {
    return json({
      error: `Not configured on the Worker: ${missing.join(', ')}.`,
      hint: 'SUPABASE_URL comes from [vars] in wrangler.toml; SUPABASE_ANON_KEY from `npx wrangler secret put SUPABASE_ANON_KEY`.',
    }, 503, headers);
  }

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'body must be JSON' }, 400, headers); }

  const brief = String(body.brief ?? '').trim();
  if (!brief) return json({ error: 'brief is required' }, 400, headers);
  if (brief.length > MAX_BRIEF_CHARS) {
    return json({ error: `brief must be under ${MAX_BRIEF_CHARS} characters` }, 400, headers);
  }

  const history = Array.isArray(body.history)
    ? body.history
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-MAX_HISTORY_TURNS)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }))
    : [];

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  /* Write through a TransformStream kept alive by ctx.waitUntil, rather than
   * doing the work inside ReadableStream.start(). Workers tears down pending
   * async work once the handler returns, so the start() form delivered the
   * first event and then closed the connection the moment it awaited the
   * model — a 200 with a truncated body and no exception anywhere. */
  const enc = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const send = (e, d) => writer.write(enc.encode(`event: ${e}\ndata: ${JSON.stringify(d)}\n\n`));

  const work = (async () => {
      const messages = [...history, { role: 'user', content: brief }];
      let totals = { input: 0, output: 0, cacheRead: 0, searches: 0 };

      /* Emit immediately. The first round is usually thinking followed by tool
       * calls, which produce no text, so without this the page sits silent for
       * a long time and looks broken — and a silent stream is impossible to
       * tell apart from a stalled one when debugging. */
      send('start', { model: MODEL });

      try {
        for (let round = 0; round < MAX_ROUNDS; round++) {
          const model = client.beta.messages.stream({
            model: MODEL,
            max_tokens: 8000,
            thinking: { type: 'adaptive' },
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
            system: [
              {
                type: 'text',
                text: SYSTEM,
                /* The instructions are identical on every turn and every round,
                 * and a session is several rounds deep. 1h TTL because usage is
                 * bursty — a planning session, then nothing for hours. */
                cache_control: { type: 'ephemeral', ttl: '1h' },
              },
            ],
            tools: TOOLS,
            messages,
          });

          for await (const event of model) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              send('token', event.delta.text);
            }
          }

          const final = await model.finalMessage();

          totals.input += final.usage.input_tokens || 0;
          totals.output += final.usage.output_tokens || 0;
          totals.cacheRead += final.usage.cache_read_input_tokens || 0;

          if (final.stop_reason === 'refusal') {
            send('error', {
              message: 'That request was declined by the safety system. Try rephrasing it.',
            });
            break;
          }

          const calls = final.content.filter((b) => b.type === 'tool_use');
          if (!calls.length) break;

          messages.push({ role: 'assistant', content: toApiBlocks(final.content) });

          const results = [];
          for (const call of calls) {
            const { label, detail } = describe(call.name, call.input || {});
            try {
              const rows = await runTool(env, call.name, call.input || {});
              totals.searches += 1;
              send('tool', { label, detail, count: Array.isArray(rows) ? rows.length : 0 });
              results.push({
                type: 'tool_result',
                tool_use_id: call.id,
                content: JSON.stringify(rows),
              });
            } catch (err) {
              send('tool', { label, detail, count: 0, failed: true });
              results.push({
                type: 'tool_result',
                tool_use_id: call.id,
                is_error: true,
                content: `Search failed: ${err.message}`,
              });
            }
          }

          messages.push({ role: 'user', content: results });

          if (round === MAX_ROUNDS - 1) {
            send('error', {
              message: `Stopped after ${MAX_ROUNDS} rounds of searching. Ask something narrower.`,
            });
          }
        }

        send('done', { model: MODEL, usage: totals });
      } catch (err) {
        /* Surfaces in `wrangler tail`. The page gets a sanitised message; the
         * operator needs the real one. */
        console.error('ideas route failed:', err?.name, err?.message);
        send('error', { message: explain(err, 'Something went wrong generating ideas.') });
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
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...headers, 'content-type': 'application/json' },
  });
}
