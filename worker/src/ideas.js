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
    name: 'count_ads',
    description:
      'Exact counts over the WHOLE ad corpus, grouped by advertiser, product, audience, month, or none. Use this for any question about how many, how often, who does it most, or what share — never count search results, which are capped at 40 and will understate. Accepts the same filters as search_competitor_ads, so you can count the same slice you searched.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words to match in the ad copy; omit to count everything.' },
        advertiser: { type: 'string' },
        product: { type: 'string', enum: PRODUCTS },
        audience: { type: 'string', enum: ['broker', 'borrower'] },
        started_since: { type: 'string', description: 'ISO date.' },
        group_by: {
          type: 'string',
          enum: ['advertiser', 'product', 'audience', 'month', 'none'],
          description: 'Default advertiser. Use none for a single total.',
        },
      },
    },
  },
  {
    name: 'search_hook_patterns',
    description:
      'Creative STRUCTURE from advertisers outside the lending category, via the Spyglass corpus: consumer finance (NerdWallet, LendingTree, Chime, Rocket Money), real estate (Zillow), and business/finance education (Alex Hormozi, Robert Kiyosaki). Hormozi and Kiyosaki skew to an operator and broker audience; Zillow to property decisions; the finance names to money anxiety and comparison. HOOK is how a piece opens; USP is the claim it leads with. Use this for angles and hooks, never for topics: it tells you what shape a piece of creative takes, not what to write about. Pair a form found here with substance from the other two tools. Each result carries weeks_running — how many weeks the pattern kept appearing, present on every row and the better signal for whether a form is working — and times_used, a raw count that is null on most rows because the source does not report one. Null there means unknown, not unused, so never describe a pattern as unused on the strength of it. `change` is the percentage change Spyglass reports for that pattern against the previous window — it is not a share of the overall mix for that brand, and it says nothing about whether the pattern performed; a negative number means the brand is using the form less than it was, and the reason is not in this data. These brands are NOT Trilith competitors and nothing here is evidence of what any competitor is doing — Spyglass has no insight coverage for investor lenders at all.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words describing the kind of angle you want.' },
        insight_type: { type: 'string', enum: ['HOOK', 'USP'] },
        brand: { type: 'string', description: 'Partial brand name.' },
        min_total: {
          type: 'integer',
          description: 'Only patterns with a known usage count of at least this. Most patterns have no count, and those are returned regardless rather than dropped — so this narrows rather than filters. Prefer sorting on weeks_running.',
        },
        limit: { type: 'integer', description: 'Default 15, max 40.' },
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

/* Planning mode returns structure, not prose. Forcing it through a tool call
 * means the shape is validated by the API rather than parsed out of markdown,
 * so the page can render selectable cards instead of guessing at headings. */
const PLAN_TOOL = {
  name: 'submit_plan',
  description:
    'Call this exactly once, at the very end, with the finished set of video concepts. Do not call it before you have searched. Everything you propose must be traceable to something a search returned.',
  input_schema: {
    type: 'object',
    properties: {
      briefs: {
        type: 'array',
        description: 'One entry per video requested, in the order you would shoot them.',
        items: {
          type: 'object',
          properties: {
            topic: {
              type: 'string',
              description: 'What the video is about, in one line. Comes from the ad corpus or Trilith content, never from a hook pattern.',
            },
            hook_form: {
              type: 'string',
              description: 'The hook structure being borrowed, named as a form — e.g. "first-person refusal narrative".',
            },
            hook_source: {
              type: 'string',
              description: 'Which outside brand the form came from, or "original" if it is not borrowed.',
            },
            opening_line: {
              type: 'string',
              description: 'The first line of the video, exactly as it would be spoken to camera. Written, not described. One or two sentences — it has to land in the first three seconds.',
            },
            evidence: {
              type: 'string',
              description: 'Why this is worth making, citing what a search returned — an advertiser and their phrasing, or a Trilith post and its gap.',
            },
            product: { type: 'string', enum: PRODUCTS },
            audience: { type: 'string', enum: ['broker', 'borrower'] },
          },
          required: ['topic', 'hook_form', 'hook_source', 'opening_line', 'evidence'],
        },
      },
    },
    required: ['briefs'],
  },
};

const PLAN_SYSTEM = `

You are in PLANNING MODE. The brief names a number of short-form videos — vertical, thirty to sixty seconds. Produce exactly that many concepts and submit them with the submit_plan tool. Every concept is a video; no other format is on the table.

Work in this order and do not skip it:
1. Search the ad corpus and Trilith's own content for what is worth saying — the topics. Use count_ads if a claim about how common something is would sharpen the choice.
2. Search hook patterns for the forms worth borrowing.
3. Pair them. A concept is a topic carried by a hook form, and the two come from different places: substance from the lending corpora, shape from the outside brands.

Rules for the set as a whole:
- No two concepts may lean on the same hook form, and no two may cover the same topic. A batch of ten that is really one idea ten ways is a failure.
- Prefer topics where the evidence shows a gap — something competitors are not saying, or something Trilith has argued in prose but never led with.
- Every opening_line must be written out as it would actually be delivered. Not "a line about speed" but the line.
- evidence must name a source. An advertiser and their words, or a Trilith URL. If you cannot cite it, do not propose it.

Write a short paragraph before you submit, saying what you searched and how you split the set. Then call submit_plan once. Do not list the concepts in prose as well — the tool call is the deliverable.`;

const SYSTEM = `You are a content strategist working for AIKO, on behalf of their client Trilith Funding — a private real estate lender that finances investors (fix-and-flip, bridge, DSCR, ground-up, BRRRR, multifamily).

You have three corpora, reachable only through your tools:
1. Competitor ads — real ads from lenders on Meta, harvested daily. This is what the competition is actually saying.
2. Trilith's own published content — blog posts, funded-deal writeups, product pages, FAQ.
3. Hook patterns — creative structure from advertisers outside lending, from the Spyglass corpus: consumer finance (NerdWallet, LendingTree, Chime, Rocket Money), real estate (Zillow), and business/finance education (Alex Hormozi, Robert Kiyosaki).

The third one is different in kind and you must treat it differently. Those brands are not Trilith's competitors and are not in the lending category. Spyglass has no insight coverage for investor lenders at all, so nothing in it is evidence about the competition. It gives you FORM — how a piece of creative opens, what claim it leads with — abstracted into reusable shapes. Use it for angles and hooks, never for topics. The substance of an idea must come from the ad corpus or Trilith's own writing; a hook pattern only tells you what shape to pour it into.

Never write "competitors are using this hook" on the strength of a hook pattern. If you borrow a form, say where it came from and that it is being adapted from outside the category — that is the interesting part, not something to hide.

You do two jobs, and the brief tells you which.

ANSWER a question about the category — who advertises what, how a claim is phrased, how many do it, what has changed. Lead with the answer, then the evidence.

PROPOSE short-form video for Trilith — a hook and a topic for a vertical video, thirty to sixty seconds, spoken to camera or over B-roll.

Short-form video is the only format Trilith is making. Never propose a blog post, a newsletter, a long-form article, a carousel or a static ad, and never suggest turning an idea into one. Trilith's published writing is a source you read for topics and to avoid repeating an argument; it is not a format you write for.

Most briefs are one or the other. Do not turn a straight question into a pitch: if someone asks which advertisers mention tax returns, tell them, and stop.

Counting rule, which matters because it is easy to get wrong: search results are capped, so counting them undercounts. Any question about how many, how often, who does it most, or what share must go through count_ads, which is computed over every ad. If you state a number, say how you got it.

How to work:
- Search before you propose. An idea you did not ground in either corpus is a guess, and the user can tell.
- Check what Trilith has already published before suggesting a topic. If a post already covers it, say so and propose the angle that is genuinely new — a sharper hook, an update, a contrarian take — rather than pretending the ground is empty.
- Quote competitor copy verbatim when it supports a point, and name the advertiser. Link the ad using the ad_library_url the tool returns.
- Link Trilith posts by their url when you reference them.
- Prefer a few well-evidenced ideas over a long list of thin ones. For each, give the angle, why the evidence supports it, and the opening line written out as it would be spoken.
- Be direct. Lead with the answer or the ideas. No preamble, no restating the question.

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
  /* Arrives as a plain 400, which reads as "your request was malformed" when
   * the request was fine and the account simply has no credit. */
  if (/credit balance/i.test(text)) {
    return 'The Anthropic account is out of credits. Top up under Plans & Billing at console.anthropic.com.';
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

  if (name === 'count_ads') {
    const rows = await rpc(env, 'adspy_count_ads', {
      q: input.query || null,
      advertiser: input.advertiser || null,
      product: PRODUCTS.includes(input.product) ? input.product : null,
      audience: ['broker', 'borrower'].includes(input.audience) ? input.audience : null,
      started_since: input.started_since || null,
      group_by: ['advertiser', 'product', 'audience', 'month', 'none'].includes(input.group_by)
        ? input.group_by : 'advertiser',
    });
    return rows.map((r) => ({
      bucket: r.bucket,
      ads: r.ads,
      advertisers: r.advertisers,
      earliest: r.earliest,
      latest: r.latest,
      share_percent: r.share_percent,
    }));
  }

  if (name === 'search_hook_patterns') {
    const rows = await rpc(env, 'hook_patterns_search', {
      q: input.query || null,
      insight_type: ['HOOK', 'USP'].includes(input.insight_type) ? input.insight_type : null,
      brand: input.brand || null,
      min_total: Number.isFinite(Number(input.min_total)) ? Number(input.min_total) : null,
      max_rows: clamp(input.limit, 15, 40),
    });
    return rows.map((r) => ({
      brand: r.brand_name,
      type: r.type_tag,
      pattern: r.label,
      /* Null on most rows: the REST endpoint reports no usage count, so only
       * patterns seeded from the MCP surface carry one. Null means unknown,
       * never zero — say so rather than reporting a pattern as unused. */
      times_used: r.total,
      /* Weeks the pattern kept appearing. The signal that is present on
       * everything, and the better one for "is this working". */
      weeks_running: r.weeks_active,
      /* Spyglass's own change figure against the previous window. Negative
       * means the brand is leaning on the pattern less than it was. */
      change: r.percent_delta,
      captured: r.captured_at,
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
  if (input.insight_type) bits.push(`type: ${input.insight_type}`);
  if (input.group_by) bits.push(`by ${input.group_by}`);
  const label = {
    search_competitor_ads: 'Competitor ads',
    search_trilith_content: 'Trilith content',
    search_hook_patterns: 'Hook patterns',
    trilith_coverage: 'Trilith coverage',
    count_ads: 'Counting ads',
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

  /* Planning mode asks for a fixed number of concepts and returns them as
   * structure. Capped at 12: past that the batch stops being reviewable, which
   * defeats the point of confirming before locking. */
  const planning = body.mode === 'plan';
  const count = planning
    ? Math.min(Math.max(parseInt(body.count, 10) || 5, 1), 12)
    : 0;

  /* In planning mode the count is the instruction; a free-text focus is
   * optional, so synthesise a brief rather than rejecting an empty one. */
  const brief = String(body.brief ?? '').trim()
    || (planning ? `Plan ${count} videos.` : '');
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
              /* After the cache breakpoint, so switching modes does not
               * invalidate the cached prefix. */
              ...(planning
                ? [{ type: 'text', text: `${PLAN_SYSTEM}\n\nProduce exactly ${count} concepts.` }]
                : []),
            ],
            tools: planning ? [...TOOLS, PLAN_TOOL] : TOOLS,
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

          /* submit_plan ends the run: it is the deliverable, not a search whose
           * result feeds another round. The API has already validated the shape
           * against the schema, so the page can render it directly. */
          const submitted = calls.find((c) => c.name === 'submit_plan');
          if (submitted) {
            const briefs = Array.isArray(submitted.input?.briefs) ? submitted.input.briefs : [];
            if (!briefs.length) {
              send('error', { message: 'The planner returned no concepts. Try again, or ask for fewer.' });
            } else {
              send('plan', {
                requested: count,
                briefs: briefs.slice(0, count).map((b) => ({
                  topic: String(b.topic || '').trim(),
                  hook_form: String(b.hook_form || '').trim(),
                  hook_source: String(b.hook_source || '').trim(),
                  opening_line: String(b.opening_line || '').trim(),
                  evidence: String(b.evidence || '').trim(),
                  product: b.product || null,
                  audience: b.audience || null,
                })),
              });
              /* Say so rather than silently trimming — asking for ten and
               * getting eight is something the reviewer should see. */
              if (briefs.length < count) {
                send('note', { message: `Returned ${briefs.length} of ${count} requested.` });
              }
            }
            break;
          }

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
