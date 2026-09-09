/* ---------------------------------------------------------------------------
 * Shared machinery for the content intelligence pipeline.
 *
 * Parsing, chunking and embedding live here so that the ingest step and the
 * process step cannot drift apart about what a chunk is. The HTML extraction
 * and prose chunker are lifted from tools/pull-content.mjs deliberately — the
 * two corpora should chunk the same way, or a passage retrieved from one will
 * read differently from a passage retrieved from the other.
 * ------------------------------------------------------------------------ */

import { createHash } from 'node:crypto';

/* --- environment --------------------------------------------------------- */

/* Secrets arrive however the tool that stored them encoded the value. A stored
 * URL with a trailing newline or a UTF-8 BOM produces "Failed to parse URL",
 * with the offending characters invisible in the CI log because the value is
 * masked. Same defence as tools/push-supabase.mjs. */
export const env = (name) => {
  let v = String(process.env[name] ?? '').trim();
  if (v.charCodeAt(0) === 0xfeff) v = v.slice(1);
  return v.trim();
};

export const SUPABASE_URL = env('SUPABASE_URL').replace(/\/+$/, '');
export const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
export const VOYAGE_KEY = env('VOYAGE_API_KEY');

/* Never let a key reach a log line, even inside an echoed request URL. */
export const redact = (s) => {
  let out = String(s);
  for (const k of [SERVICE_KEY, VOYAGE_KEY]) if (k) out = out.split(k).join('[REDACTED]');
  return out;
};

export const sha256 = (s) => createHash('sha256').update(s ?? '', 'utf8').digest('hex');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* --- Supabase ------------------------------------------------------------ */

export async function rpc(fn, body) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set.');
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${fn} failed (${res.status}): ${redact(text)}`);
  return text ? JSON.parse(text) : null;
}

/* --- tokens -------------------------------------------------------------- */

/* Four characters per token. Voyage does not publish a tokenizer for local use
 * and the number is only ever used to size a chunk and to spend a context
 * budget, both of which tolerate a rough figure. It is an estimate everywhere
 * it appears, and named as one. */
export const estimateTokens = (s) => Math.ceil(String(s ?? '').length / 4);

/* --- HTML ---------------------------------------------------------------- */

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  mdash: '—', ndash: '–', hellip: '…', middot: '·',
};

export function decode(s) {
  return String(s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

export function htmlToText(html) {
  return decode(
    html
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<(nav|footer|aside|form)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, lvl, inner) =>
        `\n\n${'#'.repeat(Number(lvl))} ${inner.replace(/<[^>]+>/g, '').trim()}\n\n`)
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) =>
        `\n- ${inner.replace(/<[^>]+>/g, '').trim()}`)
      .replace(/<\/(p|div|tr|section|blockquote)>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* Prefer the article body; fall back to <main>, then the whole document. */
export function articleScope(html) {
  return (
    html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] ??
    html
  );
}

export function metaFromHtml(html) {
  const out = {};
  const blocks = [...html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )];
  for (const [, body] of blocks) {
    let parsed;
    try { parsed = JSON.parse(decode(body.trim())); } catch { continue; }
    for (const node of [parsed, ...(parsed['@graph'] || [])].flat()) {
      if (!node || typeof node !== 'object') continue;
      const type = [node['@type']].flat().join(' ');
      if (!/Article|BlogPosting|Report|WebPage/i.test(type)) continue;
      out.title ||= node.headline || node.name;
      out.summary ||= node.description;
      out.published ||= node.datePublished;
      out.publisher ||= typeof node.publisher === 'string' ? node.publisher : node.publisher?.name;
    }
  }
  out.title ||= decode(html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1] || '') || null;
  out.title ||= decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim() || null;
  out.published ||=
    html.match(/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)/i)?.[1] || null;
  return out;
}

/* --- prose chunking (research, articles, reports) ------------------------ */

/* Spec section 13: chunk on section and heading boundaries, and do not break a
 * finding or a table across chunks unnecessarily. Sizes are the spec's 300-800
 * token band expressed in characters at four-to-one. */
const MAX_CHARS = 3200;   // ~800 tokens
const MIN_CHARS = 1200;   // ~300 tokens
const OVERLAP = 200;

function overlapTail(s) {
  const tail = s.slice(-OVERLAP);
  const sentence = tail.match(/[.!?]\s+([\s\S]*)$/);
  return (sentence ? sentence[1] : tail.replace(/^\S*\s+/, '')).trim();
}

export function chunkProse(text) {
  const sections = [];
  let heading = null;
  let buf = [];

  const flush = () => {
    const body = buf.join('\n').trim();
    if (body || heading) sections.push({ heading, body });
    buf = [];
  };

  for (const line of String(text).split('\n')) {
    const h = line.match(/^#{1,6}\s+(.*)$/);
    if (h) { flush(); heading = h[1].trim(); continue; }
    buf.push(line);
  }
  flush();

  const pieces = [];
  for (const s of sections) {
    const full = [s.heading, s.body].filter(Boolean).join('\n');
    if (full.length <= MAX_CHARS) {
      if (full.trim()) pieces.push({ heading: s.heading, text: full });
      continue;
    }
    /* Oversized section: split on paragraphs, never mid-paragraph, so a table
     * or a numbered finding stays whole unless it alone exceeds the cap. */
    const paras = s.body.split(/\n{2,}/);
    let cur = s.heading ? `${s.heading}\n` : '';
    for (const p of paras) {
      if (cur.trim() && cur.length + p.length + 2 > MAX_CHARS) {
        pieces.push({ heading: s.heading, text: cur.trim() });
        cur = `${overlapTail(cur)}\n\n${p}`;
      } else {
        cur = cur ? `${cur}\n\n${p}` : p;
      }
    }
    if (cur.trim()) pieces.push({ heading: s.heading, text: cur.trim() });
  }

  /* Pack neighbours until each chunk is substantial enough to answer a question
   * on its own — spec section 14 wants one coherent thought per chunk, and a
   * two-line fragment is not one.
   *
   * Two reasons to merge, not one: the previous chunk is undersized, OR this
   * piece is. The second case matters because a short section is often the most
   * quotable thing in a report — "Conclusion: rates ease into Q4" — and
   * dropping it for being brief loses a finding rather than trimming debris. */
  const TINY = 120;
  const packed = [];
  for (const p of pieces) {
    const last = packed[packed.length - 1];
    const undersized = last && (last.text.length < MIN_CHARS || p.text.length < TINY);
    if (undersized && last.text.length + p.text.length + 2 <= MAX_CHARS) {
      last.text = `${last.text}\n\n${p.text}`;
      last.heading ||= p.heading;
    } else {
      packed.push({ ...p });
    }
  }

  /* Whatever is still tiny after packing had no neighbour to join, so it is
   * either navigation debris or the entire document. Keep it only in the
   * second case — a one-line document is still a document. */
  const kept = packed.filter((p) => p.text.length >= TINY);
  return kept.length ? kept : packed.filter((p) => p.text.trim());
}

/* --- transcript parsing -------------------------------------------------- */

const tsToSeconds = (t) => {
  const m = String(t).trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/);
  if (!m) return null;
  const [, h, mm, ss, ms] = m;
  return Number(h || 0) * 3600 + Number(mm) * 60 + Number(ss) + Number(ms || 0) / 1000;
};

/* WebVTT and SRT differ only in the header and the millisecond separator, so
 * one parser handles both rather than two that can disagree. */
export function parseCues(text) {
  const body = String(text).replace(/\r/g, '');
  const blocks = body.split(/\n{2,}/);
  const cues = [];

  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim());
    if (!lines.length) continue;
    if (/^WEBVTT/.test(lines[0])) continue;

    const timeIdx = lines.findIndex((l) => /-->/.test(l));
    if (timeIdx === -1) continue;

    const [rawStart, rawEnd] = lines[timeIdx].split('-->').map((s) => s.trim().split(/\s+/)[0]);
    const start = tsToSeconds(rawStart);
    const end = tsToSeconds(rawEnd);
    if (start === null) continue;

    let speaker = null;
    const said = lines
      .slice(timeIdx + 1)
      .map((l) => {
        /* Both conventions appear in the wild: <v Speaker> from WebVTT, and a
         * bare "Name:" prefix from most human transcription services. */
        const v = l.match(/^<v\s+([^>]+)>\s*(.*)$/);
        if (v) { speaker ||= v[1].trim(); return v[2]; }
        const named = l.match(/^([A-Z][\w .'-]{1,30}):\s+(.*)$/);
        if (named) { speaker ||= named[1].trim(); return named[2]; }
        return l;
      })
      .join(' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (said) cues.push({ start, end, speaker, text: said });
  }
  return cues;
}

/* A transcript with no timestamps at all — a pasted interview, say. Speaker
 * turns are the only structure available, so they become the cue boundaries
 * and the timestamps stay null rather than being invented. */
export function parsePlainTranscript(text) {
  const cues = [];
  let speaker = null;
  let buf = [];

  const flush = () => {
    const said = buf.join(' ').replace(/\s+/g, ' ').trim();
    if (said) cues.push({ start: null, end: null, speaker, text: said });
    buf = [];
  };

  for (const line of String(text).split('\n')) {
    const named = line.match(/^\s*([A-Z][\w .'-]{1,30}):\s*(.*)$/);
    if (named) { flush(); speaker = named[1].trim(); buf.push(named[2]); continue; }
    buf.push(line);
  }
  flush();
  return cues;
}

/* Group cues into chunks inside the spec's 300-800 token band, preferring to
 * break where the conversation already breaks: a speaker change, or a pause
 * long enough to be a change of subject. A chunk that ends mid-thought is the
 * failure mode section 14 is about. */
export function chunkTranscript(cues, { minTokens = 300, maxTokens = 800, pauseSeconds = 2.5 } = {}) {
  const chunks = [];
  let cur = [];

  const size = (arr) => estimateTokens(arr.map((c) => c.text).join(' '));

  const emit = () => {
    if (!cur.length) return;
    const speakers = [...new Set(cur.map((c) => c.speaker).filter(Boolean))];
    const starts = cur.map((c) => c.start).filter((n) => n !== null);
    const ends = cur.map((c) => c.end).filter((n) => n !== null);
    const text = cur
      .map((c) => (speakers.length > 1 && c.speaker ? `${c.speaker}: ${c.text}` : c.text))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    chunks.push({
      text,
      speaker: speakers.length === 1 ? speakers[0] : null,
      speakers,
      start: starts.length ? Math.round(Math.min(...starts)) : null,
      end: ends.length ? Math.round(Math.max(...ends)) : null,
    });
    cur = [];
  };

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    const prev = cues[i - 1];
    const tokens = size(cur);

    const gap = prev && prev.end !== null && cue.start !== null ? cue.start - prev.end : 0;
    const speakerChanged = prev && cue.speaker && prev.speaker && cue.speaker !== prev.speaker;
    const longPause = gap >= pauseSeconds;

    /* A handover plus a real silence is a change of subject, not a change of
     * turn. Treating it as an ordinary seam meant a short transcript came back
     * as one chunk covering two unrelated arguments — exactly the failure
     * spec section 14 describes — because the token floor outranked the
     * strongest signal in the file. So a strong seam breaks at a third of the
     * floor, and an ordinary one still waits for it. */
    const strongSeam = (speakerChanged && longPause) || gap >= pauseSeconds * 3;

    if (cur.length && tokens >= minTokens && (speakerChanged || longPause)) emit();
    else if (cur.length && tokens >= minTokens / 3 && strongSeam) emit();
    else if (cur.length && tokens >= maxTokens) emit();

    cur.push(cue);
  }
  emit();

  /* A trailing scrap is folded back into its predecessor rather than published
   * as a chunk that says nothing on its own.
   *
   * The threshold is absolute, not a fraction of the floor. Tying it to
   * minTokens meant a closing argument of eighty tokens counted as a scrap and
   * was merged back into the chunk it had just been split from, undoing the
   * split. A scrap is a dangling sign-off or half a sentence; anything that
   * states something is a chunk, however short. */
  const SCRAP_TOKENS = 50;
  if (chunks.length > 1) {
    const last = chunks[chunks.length - 1];
    if (estimateTokens(last.text) < SCRAP_TOKENS) {
      const prev = chunks[chunks.length - 2];
      prev.text = `${prev.text} ${last.text}`.trim();
      prev.end = last.end ?? prev.end;
      chunks.pop();
    }
  }

  return chunks;
}

/* --- embeddings ---------------------------------------------------------- */

const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';

/* The model and dimension come from the database, never from a constant here.
 * If this read fails the caller stops: embedding at the provider's default
 * width would be rejected by the dimension guard anyway, and it is better to
 * say why up front than to fail one row at a time. */
export async function embeddingConfig() {
  const cfg = await rpc('kb_embedding_config', {});
  if (!cfg?.model || !cfg?.dimensions) {
    throw new Error('kb.embedding_config is unreadable or incomplete; cannot embed.');
  }
  return cfg;
}

/* Voyage caps a request at 128 inputs and a total token count; batching by both
 * keeps a long research report from tripping the second limit while sitting
 * well inside the first. */
export async function embed(texts, { inputType = 'document', model, dimensions } = {}) {
  if (!VOYAGE_KEY) throw new Error('VOYAGE_API_KEY is not set.');
  if (!texts.length) return [];

  const out = [];
  let batch = [];
  let batchTokens = 0;

  const flush = async () => {
    if (!batch.length) return;
    const vectors = await voyageCall(batch, { inputType, model, dimensions });
    out.push(...vectors);
    batch = [];
    batchTokens = 0;
  };

  for (const t of texts) {
    const tk = estimateTokens(t);
    if (batch.length >= 96 || batchTokens + tk > 100000) await flush();
    batch.push(t);
    batchTokens += tk;
  }
  await flush();

  if (out.length !== texts.length) {
    throw new Error(`embedding count mismatch: asked for ${texts.length}, got ${out.length}`);
  }
  return out;
}

async function voyageCall(input, { inputType, model, dimensions }, attempt = 0) {
  let res;
  try {
    res = await fetch(VOYAGE_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${VOYAGE_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        input,
        model,
        input_type: inputType,
        output_dimension: dimensions,
        truncation: true,
      }),
    });
  } catch (err) {
    if (attempt < 4) {
      await sleep(2 ** attempt * 1000);
      return voyageCall(input, { inputType, model, dimensions }, attempt + 1);
    }
    throw new Error(`Voyage unreachable: ${redact(err.message)}`);
  }

  /* Rate limits and 5xx are worth waiting out; a 400 means the request itself
   * is wrong and retrying it just spends the quota more slowly. */
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    await sleep(2 ** attempt * 1500);
    return voyageCall(input, { inputType, model, dimensions }, attempt + 1);
  }
  if (!res.ok) throw new Error(`Voyage error ${res.status}: ${redact(await res.text())}`);

  const json = await res.json();
  return json.data
    .sort((a, b) => a.index - b.index)
    .map((d) => `[${d.embedding.join(',')}]`);
}

/* --- misc ---------------------------------------------------------------- */

export function isoOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
