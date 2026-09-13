/* ---------------------------------------------------------------------------
 * Sign-in for the whole app.
 *
 * Accounts are Supabase Auth email-and-password accounts, reached only through
 * these routes. The anon key never goes to the browser, because several of the
 * database's open write functions assume nobody but this Worker holds it.
 *
 * Supabase Auth in this project is shared with other AIKO tools, whose people
 * have accounts here too, so "has an account" is not the same as "may use this
 * app". Who may is kb.app_users, checked at sign-in and again on every
 * request: taking someone off the list locks them out within a minute, and the
 * other tools are untouched.
 * ------------------------------------------------------------------------ */

import { rpc } from './db.js';

const USER_CACHE_MS = 60000;
const MAX_CACHE = 500;
const MIN_PASSWORD = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* access token -> { email, allowed, until }. Per isolate, so it only saves
 * repeat checks within a burst of requests; the source of truth is Supabase. */
const userCache = new Map();

const cleanEmail = (v) => String(v ?? '').trim().toLowerCase().slice(0, 254);

const bearer = (request) => {
  const h = request.headers.get('Authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
};

async function gotrue(env, path, { method = 'POST', body, token } = {}) {
  const res = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/${path}`, {
    method,
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      authorization: `Bearer ${token || env.SUPABASE_ANON_KEY}`,
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });
  let data = null;
  try { data = await res.json(); } catch { /* an empty body */ }
  return { ok: res.ok, status: res.status, data: data || {} };
}

async function isListed(env, email) {
  if (!email) return false;
  try { return Boolean(await rpc(env, 'kb_app_user_allowed', { p_email: email })); }
  catch { return false; }
}

/* What the page keeps: enough to call the Worker and to refresh. */
const toSession = (d) => ({
  access_token: d.access_token,
  refresh_token: d.refresh_token,
  expires_at: Math.floor(Date.now() / 1000) + (Number(d.expires_in) || 3600),
  email: cleanEmail(d.user?.email),
});

/* Email links must come back to this app's sign-in page, never to somewhere a
 * caller chose. Supabase checks its own redirect list as well; this is the
 * first gate. */
function redirectFor(value, isAllowedOrigin) {
  try {
    const u = new URL(String(value));
    if (isAllowedOrigin(u.origin) && /\/signin\.html$/.test(u.pathname)) return u.origin + u.pathname;
  } catch { /* not a URL */ }
  return null;
}

const withRedirect = (path, redirect) => (redirect ? `${path}?redirect_to=${encodeURIComponent(redirect)}` : path);

const NOT_LISTED = 'This email isn’t on the list for this app. Ask to be added.';

/* The /auth/* routes, the only ones open without a session. */
export async function handleAuth(path, request, env, headers, isAllowedOrigin) {
  let body = {};
  try { body = await request.json(); } catch { /* some routes take no body */ }
  const email = cleanEmail(body.email);
  const reply = (obj, status) => new Response(JSON.stringify(obj), {
    status, headers: { ...headers, 'content-type': 'application/json' },
  });

  if (path === '/auth/signin') {
    if (!EMAIL.test(email) || !body.password) return reply({ error: 'Enter your email and password.' }, 400);
    const r = await gotrue(env, 'token?grant_type=password', { body: { email, password: String(body.password) } });
    if (!r.ok) {
      const code = r.data.error_code || r.data.code || '';
      if (code === 'email_not_confirmed') {
        return reply({ error: 'Confirm your email first: open the link we sent you.' }, 401);
      }
      return reply({ error: 'That email and password don’t match.' }, 401);
    }
    /* Checked after the password, so the list can't be probed without one. */
    if (!(await isListed(env, email))) return reply({ error: NOT_LISTED }, 403);
    return reply({ session: toSession(r.data) }, 200);
  }

  /* There is no /auth/signup, by the user's choice: accounts are created in
   * the Supabase dashboard for people on the list, and this app only signs
   * them in. A POST to it gets the "unknown sign-in route" 404 below. */

  if (path === '/auth/refresh') {
    const token = String(body.refresh_token || '');
    if (!token) return reply({ error: 'Sign in again.' }, 401);
    const r = await gotrue(env, 'token?grant_type=refresh_token', { body: { refresh_token: token } });
    if (!r.ok) return reply({ error: 'Sign in again.' }, 401);
    const s = toSession(r.data);
    if (!(await isListed(env, s.email))) return reply({ error: NOT_LISTED }, 403);
    return reply({ session: s }, 200);
  }

  if (path === '/auth/recover') {
    /* The same answer either way, so this can't reveal who has an account, and
     * only people on the list get an email. */
    if (EMAIL.test(email) && (await isListed(env, email))) {
      await gotrue(env, withRedirect('recover', redirectFor(body.redirect_to, isAllowedOrigin)), { body: { email } });
    }
    return reply({ ok: true }, 200);
  }

  if (path === '/auth/password') {
    const token = bearer(request);
    const password = String(body.password || '');
    if (!token) return reply({ error: 'Open the reset link from your email again.' }, 401);
    if (password.length < MIN_PASSWORD) {
      return reply({ error: `Use at least ${MIN_PASSWORD} characters for the password.` }, 400);
    }
    const r = await gotrue(env, 'user', { method: 'PUT', token, body: { password } });
    if (!r.ok) return reply({ error: 'That link has expired. Ask for a new one.' }, 401);
    return reply({ ok: true }, 200);
  }

  if (path === '/auth/signout') {
    const token = bearer(request);
    if (token) {
      userCache.delete(token);
      try { await gotrue(env, 'logout', { token }); } catch { /* signed out on the page regardless */ }
    }
    return reply({ ok: true }, 200);
  }

  return reply({ error: 'unknown sign-in route' }, 404);
}

/* Every other route. Returns { user } for a signed-in person on the list, or
 * { response } to send instead. `signin: true` tells the page to go and sign
 * in rather than show the error. */
export async function requireUser(request, env, headers) {
  const deny = (error, status) => ({
    response: new Response(JSON.stringify({ error, signin: true }), {
      status, headers: { ...headers, 'content-type': 'application/json' },
    }),
  });

  const token = bearer(request);
  if (!token) return deny('Sign in to use this.', 401);

  const now = Date.now();
  let hit = userCache.get(token);
  if (!hit || hit.until < now) {
    const r = await gotrue(env, 'user', { method: 'GET', token });
    if (!r.ok) {
      userCache.delete(token);
      return deny('Your session has ended. Sign in again.', 401);
    }
    const email = cleanEmail(r.data.email);
    hit = { email, allowed: await isListed(env, email), until: now + USER_CACHE_MS };
    if (userCache.size >= MAX_CACHE) userCache.delete(userCache.keys().next().value);
    userCache.set(token, hit);
  }
  if (!hit.allowed) return deny(NOT_LISTED, 403);
  return { user: { email: hit.email } };
}
