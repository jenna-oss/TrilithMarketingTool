/* ---------------------------------------------------------------------------
 * /links/* — an article or a YouTube URL pasted on the Plan page.
 *
 * The page spots a URL in the message box and sends it here. The Worker reads
 * the page, keeps the text on the link row, and ingests it as a document. So
 * the session that pasted it can have it read in full, and every later session
 * can find a passage in it by searching.
 *
 * Reading happens after the answer goes out (ctx.waitUntil), like a
 * recording's transcript: a slow site should not hold the box open. The row
 * says 'reading' until it lands and the page polls.
 *
 * The fetchers are the same ones the nightly ingest of kb/sources.json uses —
 * tools/kb-web.mjs — so a link read on demand and the same link read at 14:00
 * produce the same document rather than two near-copies.
 *
 * Only a signed-in person on the app's list reaches any of this: index.js
 * gates every route but /auth/*.
 * ------------------------------------------------------------------------ */

import { rpc } from './db.js';
import { ingestText } from './upload.js';
import { fetchArticle, fetchYouTube, isYouTube, videoId } from '../../tools/kb-web.mjs';

/* Comfortably inside the chunk limit, and far more than any one article. */
const MAX_TEXT = 200000;
/* Under this an article is a paywall teaser or a cookie wall, not a read. */
const MIN_WORDS = 120;
/* A video with no captions is only its title, channel and description. */
const MIN_SUMMARY_WORDS = 25;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* Nothing that points back inside somebody's network. Workers cannot route to
 * these anyway; refusing them here means the refusal is legible. */
const PRIVATE = /^(localhost|\[?::1\]?|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i;
/* Query keys that say where a click came from, not which page it is. */
const TRACKERS = /^(utm_|fbclid|gclid|msclkid|mc_[ce]id|igshid|ref_src|si$|s$)/i;

const json = (obj, status, headers) => new Response(JSON.stringify(obj), {
  status, headers: { ...headers, 'content-type': 'application/json' },
});

const wordCount = (text) => (String(text).match(/\S+/g) || []).length;

async function readBody(request) {
  try { return await request.json(); } catch { return null; }
}

/* One URL, one row: the canonical form is what a second paste is matched
 * against, so the same article arriving with different tracking tags is read
 * once. Exported for the tests. */
export function normalise(raw) {
  const text = String(raw ?? '').trim();
  if (!text || text.length > 2000) return null;

  let u;
  try { u = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (u.port && u.port !== '80' && u.port !== '443') return null;

  const host = u.hostname.toLowerCase();
  if (!host.includes('.') || PRIVATE.test(host) || /\.(local|internal|localdomain)$/.test(host)) return null;

  if (isYouTube(u.href)) {
    const id = videoId(u.href);
    if (!id) return null;
    const watch = `https://www.youtube.com/watch?v=${id}`;
    return { url: watch, canonical: watch, kind: 'video', site: 'YouTube' };
  }

  for (const key of [...u.searchParams.keys()]) {
    if (TRACKERS.test(key)) u.searchParams.delete(key);
  }
  u.hash = '';
  u.hostname = host.replace(/^www\./, '');
  const canonical = u.href.replace(/\/$/, '');
  return { url: canonical, canonical, kind: 'article', site: u.hostname };
}

/* Read it, put it in the corpus, and mark the row. Whatever goes wrong is
 * written on the row, where the chip shows it, rather than lost in a log. */
async function read(env, ctx, { id, url, kind }) {
  try {
    const doc = kind === 'video'
      ? await fetchYouTube({ url, allow_description_only: true })
      : await fetchArticle({ url });

    let text = String(doc.raw_content || '').trim();
    const partial = Boolean(doc.metadata?.partial);
    const floor = kind === 'video' ? MIN_SUMMARY_WORDS : MIN_WORDS;
    if (wordCount(text) < floor) {
      throw new Error(kind === 'video'
        ? 'nothing came back but the title'
        : 'that page gave up almost no text — it is probably behind a paywall, or drawn by JavaScript');
    }
    if (text.length > MAX_TEXT) {
      text = `${text.slice(0, MAX_TEXT)}\n\n[cut here: the page went on longer than this]`;
    }

    let documentId = null;
    try {
      const stored = await ingestText(env, null, {
        sourceKey: doc.source_key,
        title: doc.title,
        text,
        documentType: doc.document_type,
        source: doc.source,
        sourceUrl: doc.source_url || url,
        publishedAt: doc.published_at,
        metadata: {
          ingest_route: doc.metadata?.ingest_route || 'link',
          ...(partial ? { partial: true } : {}),
        },
      });
      documentId = stored.documentId;
    } catch (err) {
      console.error('link ingest failed:', err?.message);
    }

    await rpc(env, 'kb_link_ready', {
      p_id: id,
      p_title: doc.title,
      p_site: doc.source,
      p_author: doc.metadata?.channel || null,
      p_published: doc.published_at,
      p_words: wordCount(text),
      p_seconds: doc.metadata?.duration_seconds ?? null,
      p_partial: partial,
      p_body: text,
      p_document_id: documentId,
    });
  } catch (err) {
    console.error('link read failed:', err?.message);
    try { await rpc(env, 'kb_link_failed', { p_id: id, p_error: String(err?.message || err) }); }
    catch { /* the chip stays on 'reading', and Try again can run it later */ }
  }
}

export async function handleLinks(path, request, env, headers, ctx, user) {
  if (path === '/links') {
    const body = await readBody(request);
    const link = normalise(body?.url);
    if (!link) return json({ error: 'that does not look like a page I can read' }, 400, headers);

    let created;
    try {
      created = await rpc(env, 'kb_link_create', {
        p_url: link.url, p_canonical: link.canonical, p_kind: link.kind, p_email: user?.email || null,
      });
    } catch {
      return json({ error: 'Couldn’t save that link. Try again.' }, 502, headers);
    }

    /* Already read, recently and cleanly: hand back what we have. */
    if (created?.reused) {
      return json({ ...created, site: created.site || link.site, url: link.url }, 200, headers);
    }

    ctx.waitUntil(read(env, ctx, { id: created.id, url: link.url, kind: link.kind }));
    return json({ id: created.id, status: 'reading', kind: link.kind, site: link.site, url: link.url }, 202, headers);
  }

  if (path === '/links/list') {
    const body = await readBody(request);
    try {
      const rows = await rpc(env, 'kb_links', { p_limit: Number(body?.limit) || 50 });
      return json({ links: rows || [] }, 200, headers);
    } catch {
      return json({ error: 'could not load the links' }, 502, headers);
    }
  }

  const body = await readBody(request);
  const id = String(body?.id ?? '');
  if (!UUID.test(id)) return json({ error: 'id must be a link id' }, 400, headers);

  if (path === '/links/read') {
    let link;
    try { link = await rpc(env, 'kb_link_read', { p_id: id }); }
    catch { return json({ error: 'could not load that link' }, 502, headers); }
    if (!link) return json({ error: 'no link with that id' }, 404, headers);
    /* The page only needs to know what it is and whether it is ready; the text
     * itself is for the planner, which reads it inside the Worker. */
    const { body: text, ...rest } = link;
    return json({ link: { ...rest, words: rest.words ?? wordCount(text || '') } }, 200, headers);
  }

  if (path === '/links/retry') {
    let link;
    try { link = await rpc(env, 'kb_link_read', { p_id: id }); }
    catch { return json({ error: 'could not load that link' }, 502, headers); }
    if (!link) return json({ error: 'no link with that id' }, 404, headers);
    if (link.status === 'ready') return json({ status: 'ready' }, 200, headers);

    ctx.waitUntil(read(env, ctx, { id, url: link.url, kind: link.kind }));
    return json({ status: 'reading' }, 202, headers);
  }

  return json({ error: 'unknown links route' }, 404, headers);
}
