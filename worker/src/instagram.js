/* ---------------------------------------------------------------------------
 * /instagram/* — connecting the account the app publishes to.
 *
 * There is no password login for Instagram and there should not be one here:
 * you are sent to Instagram's own page, you approve there, and we are handed a
 * token. Nothing in this app ever sees the password.
 *
 * Our sign-in is a bearer token in a header, and an OAuth redirect is a browser
 * navigation that cannot carry one. So a signed-in page asks for a ticket
 * first; that ticket travels to Instagram as `state` and comes back on the
 * callback, which is the only route here that is not behind the gate. A
 * callback without a ticket we issued, unused and minutes old, is refused.
 *
 * The token is encrypted before it is stored. This Supabase project is shared
 * with other AIKO tools, so anything holding its anon key can call the
 * function that returns the row — what that returns is ciphertext, and the key
 * is INSTAGRAM_TOKEN_KEY, which lives only here.
 * ------------------------------------------------------------------------ */

import { rpc } from './db.js';

const AUTHORIZE = 'https://www.instagram.com/oauth/authorize';
const EXCHANGE = 'https://api.instagram.com/oauth/access_token';
const GRAPH = 'https://graph.instagram.com';

/* Read the account, and publish to it. Nothing else. */
const SCOPES = 'instagram_business_basic,instagram_business_content_publish';

/* A long-lived token lasts 60 days. Renew with a week to spare rather than
 * finding out it lapsed when a post was due. */
const RENEW_WITHIN_DAYS = 7;

const json = (obj, status, headers) => new Response(JSON.stringify(obj), {
  status, headers: { ...headers, 'content-type': 'application/json' },
});

/* --- the key ------------------------------------------------------------- */

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function key(env) {
  if (!env.INSTAGRAM_TOKEN_KEY) throw new Error('no INSTAGRAM_TOKEN_KEY is set');
  const raw = unb64(env.INSTAGRAM_TOKEN_KEY);
  if (raw.length !== 32) throw new Error('INSTAGRAM_TOKEN_KEY must be 32 bytes, base64');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function seal(env, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const out = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(env), new TextEncoder().encode(text));
  return { cipher: b64(out), iv: b64(iv) };
}

async function open(env, cipher, iv) {
  const out = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(iv) }, await key(env), unb64(cipher),
  );
  return new TextDecoder().decode(out);
}

/* --- talking to Instagram ------------------------------------------------- */

const callbackUrl = (request) => `${new URL(request.url).origin}/instagram/callback`;

async function longLivedToken(env, code, redirectUri) {
  const form = new FormData();
  form.append('client_id', env.INSTAGRAM_APP_ID);
  form.append('client_secret', env.INSTAGRAM_APP_SECRET);
  form.append('grant_type', 'authorization_code');
  form.append('redirect_uri', redirectUri);
  form.append('code', code);

  const short = await fetch(EXCHANGE, { method: 'POST', body: form, signal: AbortSignal.timeout(20000) });
  const got = await short.json().catch(() => ({}));
  if (!short.ok || !got.access_token) {
    throw new Error(got.error_message || `Instagram refused the code (${short.status})`);
  }

  /* An hour's token is no use to something that posts next Tuesday. */
  const url = `${GRAPH}/access_token?${new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: env.INSTAGRAM_APP_SECRET,
    access_token: got.access_token,
  })}`;
  const long = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const kept = await long.json().catch(() => ({}));
  if (!long.ok || !kept.access_token) {
    throw new Error(kept.error?.message || `Instagram would not extend the token (${long.status})`);
  }
  return {
    token: kept.access_token,
    expiresAt: new Date(Date.now() + (Number(kept.expires_in) || 5184000) * 1000).toISOString(),
    userId: String(got.user_id || ''),
  };
}

async function whoIsIt(token) {
  const url = `${GRAPH}/v23.0/me?${new URLSearchParams({ fields: 'user_id,username', access_token: token })}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const me = await res.json().catch(() => ({}));
  return { userId: String(me.user_id || ''), username: String(me.username || '') };
}

/* The token to publish with: decrypted, and renewed first if it is close to
 * running out. Used by the scheduler, not by any page. */
export async function accessToken(env) {
  const row = await rpc(env, 'kb_ig_secret', {});
  if (!row?.cipher) return null;

  let token = await open(env, row.cipher, row.iv);
  const daysLeft = (new Date(row.expires_at).getTime() - Date.now()) / 86400000;
  if (Number.isFinite(daysLeft) && daysLeft < RENEW_WITHIN_DAYS) {
    try {
      const url = `${GRAPH}/refresh_access_token?${new URLSearchParams({
        grant_type: 'ig_refresh_token', access_token: token,
      })}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      const fresh = await res.json().catch(() => ({}));
      if (res.ok && fresh.access_token) {
        token = fresh.access_token;
        const sealed = await seal(env, token);
        await rpc(env, 'kb_ig_save', {
          p_ig_user_id: row.ig_user_id,
          p_username: null,
          p_cipher: sealed.cipher,
          p_iv: sealed.iv,
          p_expires: new Date(Date.now() + (Number(fresh.expires_in) || 5184000) * 1000).toISOString(),
          p_email: null,
        });
      }
    } catch (err) {
      /* An old token that still works beats failing to post. */
      console.error('instagram: could not refresh the token:', err?.message);
    }
  }
  return { token, igUserId: row.ig_user_id };
}

/* --- the routes ----------------------------------------------------------- */

const page = (title, body) => new Response(
  `<!doctype html><meta charset="utf-8"><title>${title}</title>`
  + '<style>body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#ECE9D8;color:#3B5850;'
  + 'display:grid;place-items:center;height:100vh;margin:0;text-align:center}'
  + 'div{max-width:28rem;padding:2rem}h1{color:#103224;font-size:1.25rem;margin:0 0 .5rem}'
  + 'a{color:#2C785E}</style>'
  + `<div><h1>${title}</h1>${body}</div>`,
  { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } },
);

/* The callback, which arrives as a navigation from Instagram with no session.
 * index.js routes it before the gate; the ticket is what stands in for one. */
export async function handleInstagramCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') || '';
  const denied = url.searchParams.get('error_description') || url.searchParams.get('error');

  if (denied) return page('Not connected', `<p>Instagram said: ${denied}</p><p><a href="/">Close this and try again</a></p>`);
  if (!code) return page('Not connected', '<p>Instagram sent us back without a code.</p>');

  let who = null;
  try { who = await rpc(env, 'kb_ig_ticket_take', { p_ticket: state }); } catch { who = null; }
  if (!who) {
    return page('Not connected', '<p>That connection link had expired, or had already been used. Start again from the Schedule page.</p>');
  }

  try {
    const got = await longLivedToken(env, code, callbackUrl(request));
    const me = await whoIsIt(got.token);
    const sealed = await seal(env, got.token);
    await rpc(env, 'kb_ig_save', {
      p_ig_user_id: me.userId || got.userId,
      p_username: me.username || null,
      p_cipher: sealed.cipher,
      p_iv: sealed.iv,
      p_expires: got.expiresAt,
      p_email: who,
    });
    return page('Connected', `<p>${me.username ? '@' + me.username : 'The account'} is connected. You can close this tab.</p>`);
  } catch (err) {
    console.error('instagram: connecting failed:', err?.message);
    return page('Not connected', `<p>${err?.message || 'Something went wrong.'}</p><p>Nothing was saved. Try again from the Schedule page.</p>`);
  }
}

export async function handleInstagram(path, request, env, headers, ctx, user) {
  if (path === '/instagram/account') {
    try {
      const account = await rpc(env, 'kb_ig_account', {});
      return json({
        connected: Boolean(account?.ig_user_id),
        username: account?.username || null,
        expires_at: account?.expires_at || null,
        ready: Boolean(env.INSTAGRAM_APP_ID && env.INSTAGRAM_APP_SECRET && env.INSTAGRAM_TOKEN_KEY),
      }, 200, headers);
    } catch {
      return json({ error: 'could not read the connection' }, 502, headers);
    }
  }

  if (path === '/instagram/start') {
    if (!env.INSTAGRAM_APP_ID || !env.INSTAGRAM_APP_SECRET) {
      return json({
        error: 'Instagram isn’t set up yet: the Worker needs the app’s id and secret.',
        hint: 'From the worker folder: npx wrangler secret put INSTAGRAM_APP_SECRET',
      }, 503, headers);
    }
    if (!env.INSTAGRAM_TOKEN_KEY) {
      return json({
        error: 'Instagram isn’t set up yet: the Worker needs a key to encrypt the token with.',
        hint: 'npx wrangler secret put INSTAGRAM_TOKEN_KEY — 32 random bytes, base64',
      }, 503, headers);
    }

    let ticket;
    try { ticket = await rpc(env, 'kb_ig_ticket_new', { p_email: user?.email || null }); }
    catch { return json({ error: 'could not start that. Try again.' }, 502, headers); }

    const to = `${AUTHORIZE}?${new URLSearchParams({
      client_id: env.INSTAGRAM_APP_ID,
      redirect_uri: callbackUrl(request),
      response_type: 'code',
      scope: SCOPES,
      state: ticket,
    })}`;
    return json({ url: to }, 200, headers);
  }

  if (path === '/instagram/disconnect') {
    try {
      await rpc(env, 'kb_ig_forget', {});
      return json({ connected: false }, 200, headers);
    } catch {
      return json({ error: 'could not disconnect' }, 502, headers);
    }
  }

  return json({ error: 'unknown instagram route' }, 404, headers);
}
