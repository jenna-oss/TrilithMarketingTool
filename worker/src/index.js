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

    /* The finished-video library, for the Output page. Read-only: one
     * SECURITY DEFINER function returns renders marked 'rendered', the newest
     * cut per slot, and nothing that failed. The videos bucket is public, so
     * each row carries a plain storage URL the page can play directly. */
    if (path === '/videos') {
      try {
        const rows = await rpc(env, 'kb_video_library', { p_limit: 60 });
        const base = env.SUPABASE_URL.replace(/\/+$/, '');
        const videos = (rows || []).map((r) => ({
          id: r.id,
          session_id: r.session_id,
          slot: r.slot,
          topic: r.topic,
          hook: r.hook,
          angle: r.angle,
          product: r.product,
          audience: r.audience,
          duration: r.duration_seconds == null ? null : Number(r.duration_seconds),
          rendered_at: r.rendered_at,
          review_status: r.review_status ?? null,
          reviewed_at: r.reviewed_at ?? null,
          has_source: Boolean(r.has_source),
          last_edit: r.last_edit ?? null,
          url: `${base}/storage/v1/object/public/videos/`
            + String(r.storage_path).split('/').map(encodeURIComponent).join('/'),
        }));
        return json({ videos }, 200, headers);
      } catch {
        return json({ error: 'could not load videos' }, 502, headers);
      }
    }

    /* Record a review decision on a finished video: to_post or rejected.
     * Either can be changed later. No token, by choice: asking for one on every
     * move got in the way, and the most a stranger with this URL could do is
     * flip a review label on a finished video. The origin check above keeps
     * other sites' pages out; it does not stop curl. */
    if (path === '/videos/review') {
      let body;
      try { body = await request.json(); }
      catch { return json({ error: 'body must be JSON' }, 400, headers); }
      const id = String(body.id ?? '');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        return json({ error: 'id must be a video id' }, 400, headers);
      }

      const status = body.status;
      if (status !== 'to_post' && status !== 'rejected') {
        return json({ error: 'status must be to_post or rejected' }, 400, headers);
      }

      try {
        const out = await rpc(env, 'kb_video_set_review', { p_id: id, p_status: status });
        if (!out || !out.found) return json({ error: 'no finished video with that id' }, 404, headers);
        return json({ review_status: out.review_status, reviewed_at: out.reviewed_at }, 200, headers);
      } catch {
        return json({ error: 'could not update that video' }, 502, headers);
      }
    }

    /* Notes from the Edit tab, sent together as one edit of a finished video.
     * Queued in Supabase, then started in GitHub Actions straight away. Open
     * by the user's choice (no token), so the limits live in
     * kb_video_request_edit: up to 8 notes of 3 to 400 characters, videos in
     * Ready to review only, one edit at a time per video, ten a day. */
    if (path === '/videos/edit') {
      if (!env.GITHUB_TOKEN) {
        return json({ error: 'Edits aren’t set up yet: the Worker needs its GitHub token.' }, 503, headers);
      }

      let body;
      try { body = await request.json(); }
      catch { return json({ error: 'body must be JSON' }, 400, headers); }
      const id = String(body.id ?? '');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        return json({ error: 'id must be a video id' }, 400, headers);
      }
      /* Each note says what to change; `at` pins it to a moment (seconds), or
       * is null for the whole video. The database checks the limits and turns
       * the notes into the text the agent reads. */
      const notes = Array.isArray(body.notes)
        ? body.notes.slice(0, 8).map((n) => {
            const at = n && n.at != null && n.at !== '' ? Number(n.at) : NaN;
            return {
              note: String((n && n.note) ?? '').trim().slice(0, 400),
              at: Number.isFinite(at) ? Math.max(0, at) : null,
            };
          })
        : [];

      let queued;
      try { queued = await rpc(env, 'kb_video_request_edit', { p_render_id: id, p_notes: notes }); }
      catch { return json({ error: 'Couldn’t queue the edit. Try again.' }, 502, headers); }
      if (!queued || !queued.ok) {
        return json({ error: (queued && queued.error) || 'Couldn’t queue the edit.' }, 409, headers);
      }

      const started = await startEdit(env, queued.id);
      if (!started.ok) {
        /* Otherwise the video would show "editing" for three hours with
         * nothing running. */
        try { await rpc(env, 'kb_video_edit_abandon', { p_edit_id: queued.id, p_error: started.error }); }
        catch { /* the request still fails below; the row goes stale on its own */ }
        return json({ error: started.error }, 502, headers);
      }
      return json({ edit_id: queued.id }, 202, headers);
    }

    /* The retired ask endpoint. Anything still POSTing here gets told where to
     * go rather than a bare 404 that looks like an outage. */
    return json({
      error: 'This endpoint was retired. POST to /ideas with {brief, history?}.',
    }, 404, headers);
  },
};

/* Start the render workflow for one edit. GITHUB_TOKEN is a fine-grained token
 * that can only run this repo's workflows (Actions: read and write); the
 * workflow does the rest, reading the request from Supabase by its id. */
async function startEdit(env, editId) {
  const repo = env.GITHUB_REPO || 'jenna-oss/TrilithMarketingTool';
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/render-videos.yml/dispatches`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.GITHUB_TOKEN}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        /* GitHub rejects API calls without one. */
        'user-agent': 'trilith-ask-worker',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main', inputs: { edit_id: editId } }),
    });
    if (res.ok) return { ok: true };
    console.error('workflow dispatch failed:', res.status, (await res.text()).slice(0, 300));
    return { ok: false, error: `Couldn’t start the edit (GitHub answered ${res.status}).` };
  } catch (err) {
    console.error('workflow dispatch failed:', err?.message);
    return { ok: false, error: 'Couldn’t reach GitHub to start the edit. Try again.' };
  }
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...headers, 'content-type': 'application/json' },
  });
}
