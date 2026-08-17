/* ---------------------------------------------------------------------------
 * Worker entry point.
 *
 * One route now: /ideas. It answers questions about the category and proposes
 * content, and it retrieves — three search tools plus an exact counter — rather
 * than reading a corpus.
 *
 * There used to be a second route that answered questions by putting the entire
 * ad corpus in a cached system prompt, ~135K tokens, rewritten every time the
 * cache lapsed. Retrieval replaced it. The one thing it did better was
 * exhaustive counting, because it saw every ad at once where a search returns
 * 40; adspy.count_ads answers that from Postgres instead, exactly and for a few
 * hundred tokens.
 * ------------------------------------------------------------------------ */

import { handleIdeas } from './ideas.js';

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
    'Access-Control-Allow-Headers': 'content-type',
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
      return json({ error: 'POST a JSON body to /ideas: {brief, history?}' }, 405, headers);
    }

    if (path === '/ideas') return handleIdeas(request, env, headers, ctx);

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
