/* ---------------------------------------------------------------------------
 * Worker entry point.
 *
 * Two routes. /ideas answers questions about the category and proposes content,
 * retrieving through its tools rather than reading a corpus. /kb/upload puts a
 * file into the knowledge base permanently, and is the only path here that
 * writes anything — it carries its own shared-token check, since the origin
 * allowlist below is a browser control and not a security boundary.
 *
 * There used to be a second route that answered questions by putting the entire
 * ad corpus in a cached system prompt, ~135K tokens, rewritten every time the
 * cache lapsed. Retrieval replaced it. The one thing it did better was
 * exhaustive counting, because it saw every ad at once where a search returns
 * 40; adspy.count_ads answers that from Postgres instead, exactly and for a few
 * hundred tokens.
 * ------------------------------------------------------------------------ */

import { handleIdeas } from './ideas.js';
import { handleUpload } from './upload.js';
import { rpc } from './db.js';

/* Only the published pages may call this. The key lives here, so an open
 * endpoint would let anyone spend it. */
const ALLOWED_ORIGINS = new Set([
  'https://trilith-marketing-tool.vercel.app',
  'https://jenna-oss.github.io',
  'http://localhost:8788',
]);

/* Vercel gives every preview deployment its own subdomain, so a branch build
 * would be blocked by an exact-match list alone. Scope the pattern to this
 * project rather than all of *.vercel.app — anyone can deploy there, and a
 * blanket wildcard would hand the API key to whoever did. */
const PREVIEW_ORIGIN = /^https:\/\/trilith-marketing-tool-[a-z0-9-]+\.vercel\.app$/;

const isAllowed = (origin) => ALLOWED_ORIGINS.has(origin) || PREVIEW_ORIGIN.test(origin);

function cors(origin) {
  /* Echo the caller's origin when it is allowed. Returning a different one —
   * as this did when the site moved to Vercel — makes the browser block the
   * response before it reaches the page, which surfaces as "Failed to fetch"
   * with no clue as to why. */
  const allowed = isAllowed(origin) ? origin : [...ALLOWED_ORIGINS][0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, authorization',
    'Access-Control-Max-Age': '86400',
    /* Caches and CDNs must not serve one origin's CORS headers to another. */
    Vary: 'Origin',
  };
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const headers = cors(origin);
    const path = new URL(request.url).pathname.replace(/\/+$/, '');

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });

    if (origin && !isAllowed(origin)) {
      return json({ error: 'origin not allowed' }, 403, headers);
    }

    if (request.method !== 'POST') {
      return json({ error: 'POST a JSON body to /ideas or /kb/upload.' }, 405, headers);
    }

    if (path === '/ideas') return handleIdeas(request, env, headers, ctx);

    /* The only write endpoint. Guarded by a shared token inside the handler,
     * because the origin check above stops browsers and nothing else. */
    if (path === '/kb/upload') return handleUpload(request, env, headers, ctx);

    /* Fetch a stored plan by id, so a session can be resumed in another browser
     * or on another machine. Read-only, and it returns nothing for an id that
     * does not exist rather than saying which — the ids are the only thing
     * standing between one person's plan and another's. */
    if (path === '/plan') {
      let body;
      try { body = await request.json(); }
      catch { return json({ error: 'body must be JSON' }, 400, headers); }
      const id = String(body.session_id ?? '').slice(0, 64);
      if (!id) return json({ error: 'session_id is required' }, 400, headers);
      try {
        const plan = await rpc(env, 'kb_plan_load', { p_session_id: id });
        return json({ plan: plan ?? null }, 200, headers);
      } catch {
        return json({ error: 'could not load that plan' }, 502, headers);
      }
    }

    /* The retired ask endpoint. Anything still POSTing here gets told where to
     * go rather than a bare 404 that looks like an outage. */
    return json({
      error: 'This endpoint was retired. POST to /ideas with {brief, history?}.',
    }, 404, headers);
  },
};

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...headers, 'content-type': 'application/json' },
  });
}
