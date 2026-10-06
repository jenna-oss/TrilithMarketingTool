/* ---------------------------------------------------------------------------
 * The Worker's routes, with Supabase and Anthropic faked at the fetch layer.
 *
 *   npm test
 *
 * This file is in the repo on purpose. An earlier suite lived in a scratch
 * directory outside it and was deleted when that session ended, which left
 * every route uncovered and nobody any the wiser until the next change.
 *
 * It covers the sign-in gate on every route family, and the behaviour that is
 * easy to break by accident: the polled read that must not carry an article's
 * text, the lookups that must ask for the ids they want, the opening line a
 * script writer may not rewrite, and what happens to a file that is not audio.
 * It is not exhaustive. Add to it when you touch a route.
 * ------------------------------------------------------------------------ */

import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const worker = (await import(pathToFileURL(join(here, '..', 'worker', 'src', 'index.js')).href)).default;
const { accessToken } = await import(pathToFileURL(join(here, '..', 'worker', 'src', 'instagram.js')).href);
const { publishDue } = await import(pathToFileURL(join(here, '..', 'worker', 'src', 'posts.js')).href);

/* --- the fakes ----------------------------------------------------------- */

let calls = [];
let rpcAnswer = {};
let claudeReply = { type: 'text', text: 'Here are some ideas.' };
let supaJob = { status: 'active' };
let githubOk = true;
/* What the container reports, run by run, and how many have been made. */
let container = [];
let made = 0;

const jsonRes = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

/* One content block, in the event sequence the SDK's stream reader expects. */
function sse(block) {
  const event = (type, data) => `event: ${type}
data: ${JSON.stringify({ type, ...data })}

`;
  const opening = block.type === 'tool_use'
    ? { type: 'tool_use', id: block.id, name: block.name, input: {} }
    : { type: 'text', text: '' };
  const delta = block.type === 'tool_use'
    ? { type: 'input_json_delta', partial_json: JSON.stringify(block.input) }
    : { type: 'text_delta', text: block.text };

  const body = [
    event('message_start', { message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-sonnet-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } }),
    event('content_block_start', { index: 0, content_block: opening }),
    event('content_block_delta', { index: 0, delta }),
    event('content_block_stop', { index: 0 }),
    event('message_delta', { delta: { stop_reason: block.type === 'tool_use' ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { output_tokens: 5 } }),
    event('message_stop', {}),
  ].join('');
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

globalThis.fetch = async (url, init = {}) => {
  const u = String(url instanceof Request ? url.url : url);
  let body = null;
  if (init.body && typeof init.body === 'string') { try { body = JSON.parse(init.body); } catch { body = init.body; } }
  else if (init.body instanceof URLSearchParams) body = Object.fromEntries(init.body);
  calls.push({ url: u, body });

  if (u.includes('api.anthropic.com')) {
    const block = claudeReply.type === 'tool_use'
      ? { type: 'tool_use', id: 'tu_1', name: body?.tool_choice?.name || 'report', input: claudeReply.input }
      : { type: 'text', text: claudeReply.text };

    /* The planner streams and everything else does not. Answering a streamed
     * request with plain JSON makes the SDK give up on an empty stream, which
     * looked like a route failure on an otherwise green run. */
    if (!body?.stream) {
      return jsonRes({
        id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-sonnet-5',
        stop_reason: claudeReply.type === 'tool_use' ? 'tool_use' : 'end_turn', stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 10 },
        content: [block],
      });
    }
    return sse(block);
  }
  if (u.startsWith('https://api.supadata.ai/v1/transcript/')) return jsonRes(supaJob);
  if (u.startsWith('https://api.instagram.com/oauth/access_token')) return jsonRes({ access_token: 'SHORT-LIVED', user_id: '178414' });
  if (u.startsWith('https://graph.instagram.com/access_token')) return jsonRes({ access_token: 'LONG-LIVED-SECRET', token_type: 'bearer', expires_in: 5184000 });
  if (u.startsWith('https://graph.instagram.com/refresh_access_token')) return jsonRes({ access_token: 'RENEWED-SECRET', expires_in: 5184000 });
  if (u.startsWith('https://graph.instagram.com/v23.0/me')) return jsonRes({ user_id: '178414', username: 'thebuyboxre' });
  if (u.includes('/media_publish')) return jsonRes({ id: 'MEDIA-1' });
  if (u.includes('/v23.0/') && u.includes('fields=permalink')) return jsonRes({ permalink: 'https://www.instagram.com/reel/xyz/' });
  if (u.includes('/v23.0/') && u.includes('status_code')) return jsonRes({ status_code: container.shift() || 'FINISHED' });
  if (u.includes('/v23.0/') && u.endsWith('/media') === false && /\/v23\.0\/\d+\/media$/.test(u.split('?')[0])) return jsonRes({ id: 'CONTAINER-' + (made += 1) });
  if (/\/v23\.0\/\d+\/media$/.test(u)) return jsonRes({ id: 'CONTAINER-' + (made += 1) });
  if (u.includes('/actions/workflows/')) {
    /* 204 must carry no body at all, or the Response constructor throws. */
    return githubOk ? new Response(null, { status: 204 }) : new Response('no', { status: 403 });
  }
  if (u.includes('/storage/v1/object/upload/sign/')) {
    return jsonRes({ url: '/object/upload/sign/kb-footage/abc.mp4?token=SIGNED-TOKEN-123' });
  }
  if (u.endsWith('/auth/v1/user')) return jsonRes({ email: 'me@x.io' });
  const fn = (u.match(/\/rpc\/([a-z_]+)/) || [])[1];
  if (fn === 'kb_app_user_allowed') return jsonRes(true);
  return jsonRes(fn in rpcAnswer ? rpcAnswer[fn] : null);
};

const env = {
  SUPABASE_URL: 'https://db.supabase.co', SUPABASE_ANON_KEY: 'anon',
  ANTHROPIC_API_KEY: 'sk-test', GITHUB_TOKEN: 'tok', VOYAGE_API_KEY: '',
};
/* The token key is 32 bytes, base64, as the real one must be. */
const igEnv = {
  ...env,
  INSTAGRAM_APP_ID: '1234567890',
  INSTAGRAM_APP_SECRET: 'app-secret',
  INSTAGRAM_TOKEN_KEY: Buffer.alloc(32, 7).toString('base64'),
};
const get = (path, e = igEnv) => worker.fetch(new Request('https://w.example' + path, {
  method: 'GET', headers: { origin: 'http://localhost:8788' },
}), e, ctx);
let pending = [];
const ctx = { waitUntil(p) { pending.push(p); } };
const settle = async () => { const all = pending; pending = []; await Promise.allSettled(all); };

const post = (path, payload, token = 'signed-in', e = env) => worker.fetch(new Request('https://w.example' + path, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: 'http://localhost:8788', ...(token ? { authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(payload || {}),
}), e, ctx);

/* --- the harness --------------------------------------------------------- */

let failures = 0;
const check = (name, ok, extra) => {
  if (!ok) failures++;
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (!ok && extra !== undefined ? '  [' + String(extra).slice(0, 300) + ']' : ''));
};
const reset = () => {
  calls = []; rpcAnswer = {}; pending = [];
  claudeReply = { type: 'text', text: 'Here are some ideas.' };
  supaJob = { status: 'active' };
  githubOk = true;
  container = [];
  made = 0;
};
/* Exactly this function: '/rpc/kb_links' is a prefix of '/rpc/kb_links_by_ids',
 * and matching loosely made the new call look like the old one. */
const rpcs = (fn) => calls.filter((c) => new URL(c.url).pathname.endsWith('/rpc/' + fn));
const LINK = '99999999-9999-4999-8999-999999999999';
const REC = '77777777-7777-7777-7777-777777777777';

/* --- the gate ------------------------------------------------------------ */

for (const path of ['/ideas', '/videos', '/links', '/links/read', '/recordings/list', '/scripts/list', '/scripts/write', '/kb/upload', '/instagram/account', '/instagram/start', '/footage/list', '/footage/start']) {
  reset();
  const res = await post(path, {}, '');
  check(`${path} without a session -> 401`, res.status === 401, res.status);
}

/* --- the polled read must not carry the article -------------------------- */

reset();
rpcAnswer.kb_link_status = { id: LINK, url: 'https://example.com/a', kind: 'article', status: 'ready', title: 'A long read', site: 'example.com', words: 40000, partial: false };
let res = await post('/links/read', { id: LINK });
let j = await res.json();
check('links/read asks for the row without the body',
  rpcs('kb_link_status').length === 1 && rpcs('kb_link_read').length === 0,
  `status:${rpcs('kb_link_status').length} full:${rpcs('kb_link_read').length}`);
check('...and never hands the page the text', res.status === 200 && j.link.title === 'A long read' && !('body' in j.link) && !('job_id' in j.link),
  JSON.stringify(j.link));

/* A transcript still being generated is the one case that needs the stored
 * description, as what to fall back to, so there the full row is fetched. */
reset();
rpcAnswer.kb_link_status = { id: LINK, url: 'https://www.youtube.com/watch?v=abc12345678', kind: 'video', status: 'reading', job_id: 'job-1' };
rpcAnswer.kb_link_read = { ...rpcAnswer.kb_link_status, body: 'the description' };
res = await post('/links/read', { id: LINK }, 'signed-in', { ...env, SUPADATA_API_KEY: '' });
check('a job with no transcript key does not reach for the body', rpcs('kb_link_read').length === 0);

/* The other half of that: when the job has finished, the poll is what stores
 * the result, and it needs the full row to fall back to on a failure. This is
 * the path the light read above was threaded through, so it is checked both
 * ways round. */
const JOB_ROW = {
  id: LINK, url: 'https://www.youtube.com/watch?v=abc12345678', kind: 'video',
  status: 'reading', job_id: 'job-1', title: 'A video', site: 'The Buy Box',
};
const withSupa = { ...env, SUPADATA_API_KEY: 'sd-test' };

reset();
rpcAnswer.kb_link_status = JOB_ROW;
rpcAnswer.kb_link_read = { ...JOB_ROW, body: 'the description, kept as the fallback' };
rpcAnswer.kb_upload_document = { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', changed: true };
supaJob = { status: 'completed', content: new Array(300).fill('spoken').join(' ') };
res = await post('/links/read', { id: LINK }, 'signed-in', withSupa);
let stored = rpcs('kb_link_ready')[0]?.body;
check('a finished job is collected by the poll and stored as a transcript',
  stored?.p_partial === false && stored.p_words === 300
  && rpcs('kb_upload_document')[0]?.body?.payload?.document_type === 'transcript',
  JSON.stringify({ partial: stored?.p_partial, words: stored?.p_words }));

reset();
rpcAnswer.kb_link_status = JOB_ROW;
rpcAnswer.kb_link_read = { ...JOB_ROW, body: new Array(60).fill('described').join(' ') };
rpcAnswer.kb_upload_document = { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', changed: true };
supaJob = { status: 'failed', error: 'could not process' };
res = await post('/links/read', { id: LINK }, 'signed-in', withSupa);
stored = rpcs('kb_link_ready')[0]?.body;
check('a failed job falls back to the description it saved, flagged partial',
  stored?.p_partial === true && stored.p_words === 60,
  JSON.stringify({ partial: stored?.p_partial, words: stored?.p_words }));

reset();
res = await post('/links/read', { id: 'not-an-id' });
check('links/read with a bad id -> 400', res.status === 400);

/* --- looking up what a planning session picked ---------------------------- */

reset();
rpcAnswer.kb_recordings_by_ids = [{ id: REC, name: 'Call with Mike', status: 'ready', words: 120 }];
rpcAnswer.kb_links_by_ids = [{ id: LINK, title: 'A long read', site: 'example.com', status: 'ready', kind: 'article', partial: false }];
res = await post('/ideas', { brief: 'what should we make?', history: [], recordings: [REC], links: [LINK] });
await res.text();
await settle();
check('picked recordings are fetched by id, not by listing two hundred rows',
  rpcs('kb_recordings_by_ids').length === 1 && rpcs('kb_recordings')?.length === 0,
  `byIds:${rpcs('kb_recordings_by_ids').length} list:${rpcs('kb_recordings').length}`);
check('so are picked links',
  rpcs('kb_links_by_ids').length === 1 && rpcs('kb_links').length === 0,
  `byIds:${rpcs('kb_links_by_ids').length} list:${rpcs('kb_links').length}`);
check('both are named to the model in the message it answers',
  /Call with Mike/.test(JSON.stringify(calls.find((c) => c.url.includes('anthropic'))?.body || {}))
  && /A long read/.test(JSON.stringify(calls.find((c) => c.url.includes('anthropic'))?.body || {})));

/* --- a script is written to the plan's opening line ----------------------- */

reset();
rpcAnswer.kb_script_save = '44444444-4444-4444-8444-444444444444';
claudeReply = { type: 'tool_use', input: { lines: ['An opening I preferred.', 'The rent covers the note.', 'Follow for the next one.'] } };
res = await post('/scripts/write', {
  session_id: 'plan-abc', slot: 1, topic: 'Four rowhomes, one loan',
  opening_line: 'Four rowhomes in Baltimore. One loan.', product: 'dscr',
});
j = await res.json();
check('the opening line agreed in the plan is put back as line 1',
  res.status === 200 && j.lines[0] === 'Four rowhomes in Baltimore. One loan.', j.lines?.[0]);
check('the script is saved against the slot it came from',
  rpcs('kb_script_save')[0]?.body?.p_session === 'plan-abc' && rpcs('kb_script_save')[0].body.p_slot === 1);

reset();
res = await post('/scripts/write', { session_id: 'plan-abc', topic: 'No slot' });
check('a script with no slot -> 400, the model is not called',
  res.status === 400 && calls.filter((c) => c.url.includes('anthropic')).length === 0);

/* --- uploads that are not what they say ----------------------------------- */

reset();
const form = new FormData();
form.append('file', new File([new Uint8Array(new Array(5000).fill(7))], 'notes.pdf', { type: 'application/pdf' }));
form.append('name', 'A pdf');
res = await worker.fetch(new Request('https://w.example/recordings', {
  method: 'POST',
  headers: { origin: 'http://localhost:8788', authorization: 'Bearer signed-in' },
  body: form,
}), { ...env, ELEVENLABS_API_KEY: 'el' }, ctx);
check('a recording that is not audio -> 415, nothing stored',
  res.status === 415 && calls.filter((c) => c.url.includes('/storage/')).length === 0, res.status);

/* --- the edges ----------------------------------------------------------- */

reset();
res = await post('/nonsense', {});
check('an unknown route -> 404', res.status === 404, res.status);

/* --- connecting Instagram -------------------------------------------------- */

reset();
res = await post('/instagram/start', {}, 'signed-in', env);   // no keys set
j = await res.json();
check('connecting with no Instagram keys -> 503 saying which to set',
  res.status === 503 && /INSTAGRAM_APP_SECRET/.test(j.hint || ''), JSON.stringify(j));

reset();
rpcAnswer.kb_ig_ticket_new = '00000000-aaaa-4aaa-8aaa-000000000001';
res = await post('/instagram/start', {}, 'signed-in', igEnv);
j = await res.json();
const authorize = new URL(j.url || 'https://x.invalid');
check('connecting hands back Instagram own page, not a form here',
  authorize.origin + authorize.pathname === 'https://www.instagram.com/oauth/authorize', j.url);
check('...asking only to read the account and publish to it',
  authorize.searchParams.get('scope') === 'instagram_business_basic,instagram_business_content_publish',
  authorize.searchParams.get('scope'));
check('...with the one-time ticket as state, and our callback as the redirect',
  authorize.searchParams.get('state') === '00000000-aaaa-4aaa-8aaa-000000000001'
  && authorize.searchParams.get('redirect_uri') === 'https://w.example/instagram/callback',
  authorize.search);

/* The callback is the one route with no session on it, so the ticket is the
 * whole of its security. */
reset();
rpcAnswer.kb_ig_ticket_take = null;
res = await get('/instagram/callback?code=abc&state=00000000-aaaa-4aaa-8aaa-000000000009');
let html = await res.text();
check('a callback with a ticket we did not issue saves nothing',
  res.status === 200 && /expired, or had already been used/.test(html) && rpcs('kb_ig_save').length === 0,
  res.status);

reset();
rpcAnswer.kb_ig_ticket_take = 'me@x.io';
res = await get('/instagram/callback?code=abc&state=00000000-aaaa-4aaa-8aaa-000000000001');
html = await res.text();
const connected = rpcs('kb_ig_save')[0]?.body;
check('a good callback connects the account and names it',
  /thebuyboxre is connected/.test(html) && connected?.p_ig_user_id === '178414' && connected.p_username === 'thebuyboxre',
  html.slice(0, 140));
check('the short-lived token is traded for a sixty-day one',
  calls.some((c) => c.url.includes('ig_exchange_token'))
  && new Date(connected.p_expires).getTime() - Date.now() > 50 * 86400000);
check('what is stored is ciphertext, not the token',
  typeof connected.p_cipher === 'string' && connected.p_cipher.length > 0
  && !JSON.stringify(connected).includes('LONG-LIVED-SECRET'),
  JSON.stringify(connected).slice(0, 200));

/* And it has to come back out again, or nothing can ever post. */
reset();
rpcAnswer.kb_ig_secret = {
  ig_user_id: '178414', cipher: connected.p_cipher, iv: connected.p_iv,
  expires_at: new Date(Date.now() + 50 * 86400000).toISOString(),
};
const opened = await accessToken(igEnv);
check('the Worker can open it again with its own key',
  opened?.token === 'LONG-LIVED-SECRET' && opened.igUserId === '178414', JSON.stringify(opened));
check('...and a token with weeks left is not renewed needlessly',
  !calls.some((c) => c.url.includes('ig_refresh_token')));

reset();
rpcAnswer.kb_ig_secret = {
  ig_user_id: '178414', cipher: connected.p_cipher, iv: connected.p_iv,
  expires_at: new Date(Date.now() + 2 * 86400000).toISOString(),
};
const renewed = await accessToken(igEnv);
check('a token close to running out is renewed and stored again',
  renewed?.token === 'RENEWED-SECRET' && rpcs('kb_ig_save').length === 1,
  JSON.stringify({ token: renewed?.token, saved: rpcs('kb_ig_save').length }));

reset();
rpcAnswer.kb_ig_account = { ig_user_id: '178414', username: 'thebuyboxre', expires_at: new Date().toISOString() };
res = await post('/instagram/account', {}, 'signed-in', igEnv);
j = await res.json();
check('the page is told who is connected, and never the token',
  j.connected === true && j.username === 'thebuyboxre' && !JSON.stringify(j).includes('cipher'),
  JSON.stringify(j));

/* --- scheduling ------------------------------------------------------------ */

const soon = () => new Date(Date.now() + 3600000).toISOString();

reset();
for (const [what, payload] of [
  ['an unknown kind', { kind: 'story', media: [{ url: 'https://x/a.mp4' }], scheduled_for: soon() }],
  ['nothing to post', { kind: 'reel', media: [], scheduled_for: soon() }],
  ['media that is not https', { kind: 'reel', media: [{ url: 'http://x/a.mp4' }], scheduled_for: soon() }],
  ['a carousel of one', { kind: 'carousel', media: [{ url: 'https://x/a.jpg' }], scheduled_for: soon() }],
  ['a time that has gone', { kind: 'reel', media: [{ url: 'https://x/a.mp4' }], scheduled_for: new Date(Date.now() - 7200000).toISOString() }],
]) {
  reset();
  res = await post('/posts/create', payload);
  check(`scheduling ${what} -> 400, nothing saved`,
    res.status === 400 && rpcs('kb_post_create').length === 0, res.status);
}

reset();
rpcAnswer.kb_post_create = '55555555-5555-4555-8555-555555555555';
res = await post('/posts/create', {
  kind: 'reel', media: [{ url: 'https://videos.example/a.mp4' }],
  caption: 'Four rowhomes, one loan.', scheduled_for: soon(),
  render_id: 'cccc3333-3333-4333-8333-cccccccccccc',
});
j = await res.json();
const scheduled = rpcs('kb_post_create')[0]?.body;
check('a reel is scheduled, with its caption, time and the video it came from',
  res.status === 200 && j.status === 'scheduled' && scheduled.p_kind === 'reel'
  && scheduled.p_media[0].kind === 'video' && scheduled.p_caption === 'Four rowhomes, one loan.'
  && scheduled.p_render_id === 'cccc3333-3333-4333-8333-cccccccccccc',
  JSON.stringify(scheduled).slice(0, 200));

reset();
rpcAnswer.kb_post_cancel = false;
res = await post('/posts/cancel', { id: '55555555-5555-4555-8555-555555555555' });
check('cancelling one that has already gone out -> 409', res.status === 409, res.status);

/* --- sending it ------------------------------------------------------------ */

/* The publisher needs a token it can open, so reuse the one sealed above. */
const igPublish = {
  ...igEnv, POST_WAIT_TRIES: 2, POST_WAIT_MS: 1,
};
const sealed = () => ({
  ig_user_id: '178414', cipher: connected.p_cipher, iv: connected.p_iv,
  expires_at: new Date(Date.now() + 50 * 86400000).toISOString(),
});
const DUE = (over) => ({
  id: '55555555-5555-4555-8555-555555555555', kind: 'reel', attempts: 1,
  media: [{ url: 'https://videos.example/a.mp4', kind: 'video' }],
  caption: 'Four rowhomes, one loan.', container_id: null, ...over,
});

reset();
rpcAnswer.kb_ig_secret = null;
rpcAnswer.kb_post_claim = DUE();
let out = await publishDue(igPublish);
check('with no account connected nothing is claimed or sent',
  out.error === 'no Instagram account is connected' && rpcs('kb_post_claim').length === 0, JSON.stringify(out));

reset();
rpcAnswer.kb_ig_secret = sealed();
rpcAnswer.kb_post_claim = DUE();
container = ['IN_PROGRESS', 'FINISHED'];
out = await publishDue(igPublish, 1);
let built = calls.find((c) => /\/v23\.0\/178414\/media$/.test(c.url))?.body;
check('a reel is built as a REELS container from the video url',
  built?.media_type === 'REELS' && built.video_url === 'https://videos.example/a.mp4'
  && built.caption === 'Four rowhomes, one loan.', JSON.stringify(built));
check('...and published only once the container says it is finished',
  calls.some((c) => c.url.includes('/media_publish')) && out.done[0]?.outcome === 'posted',
  JSON.stringify(out.done));
const posted = rpcs('kb_post_state').map((c) => c.body).find((b) => b.p_status === 'posted');
check('...with the permalink kept',
  posted?.p_permalink === 'https://www.instagram.com/reel/xyz/' && posted.p_media_id === 'MEDIA-1',
  JSON.stringify(posted));

reset();
rpcAnswer.kb_ig_secret = sealed();
rpcAnswer.kb_post_claim = DUE({ kind: 'image', media: [{ url: 'https://videos.example/a.jpg', kind: 'image' }] });
container = ['FINISHED'];
await publishDue(igPublish, 1);
built = calls.find((c) => /\/v23\.0\/178414\/media$/.test(c.url))?.body;
check('an image is built from image_url, with no media_type',
  built?.image_url === 'https://videos.example/a.jpg' && !built.media_type, JSON.stringify(built));

reset();
rpcAnswer.kb_ig_secret = sealed();
rpcAnswer.kb_post_claim = DUE({
  kind: 'carousel',
  media: [{ url: 'https://videos.example/1.jpg', kind: 'image' }, { url: 'https://videos.example/2.mp4', kind: 'video' }],
});
container = ['FINISHED'];
await publishDue(igPublish, 1);
const containers = calls.filter((c) => /\/v23\.0\/178414\/media$/.test(c.url)).map((c) => c.body);
check('a carousel builds each child first, then one container holding them',
  containers.length === 3 && containers[0].is_carousel_item === 'true'
  && containers[1].media_type === 'VIDEO' && containers[1].is_carousel_item === 'true'
  && containers[2].media_type === 'CAROUSEL' && containers[2].children.split(',').length === 2,
  JSON.stringify(containers.map((c) => c.media_type || 'image')));
check('...and only the holding container carries the caption',
  !containers[0].caption && !containers[1].caption && containers[2].caption === 'Four rowhomes, one loan.');

/* Still processing when the run gives up: the container is kept so the next
 * run carries on, and nothing is published. */
reset();
rpcAnswer.kb_ig_secret = sealed();
rpcAnswer.kb_post_claim = DUE();
container = ['IN_PROGRESS', 'IN_PROGRESS', 'IN_PROGRESS'];
out = await publishDue(igPublish, 1);
const left = rpcs('kb_post_state').map((c) => c.body).at(-1);
check('a container still processing is left working, with its id kept',
  out.done[0]?.outcome === 'waiting' && left.p_status === 'working' && left.p_container === 'CONTAINER-1'
  && !calls.some((c) => c.url.includes('/media_publish')),
  JSON.stringify({ outcome: out.done[0]?.outcome, status: left.p_status, container: left.p_container }));

reset();
rpcAnswer.kb_ig_secret = sealed();
rpcAnswer.kb_post_claim = DUE({ container_id: 'CONTAINER-EARLIER' });
container = ['FINISHED'];
await publishDue(igPublish, 1);
check('a post picked up mid-flight does not build a second container',
  !calls.some((c) => /\/v23\.0\/178414\/media$/.test(c.url))
  && calls.some((c) => c.url.includes('/media_publish')));

/* Instagram refusing the media. */
reset();
rpcAnswer.kb_ig_secret = sealed();
rpcAnswer.kb_post_claim = DUE({ attempts: 1 });
container = ['ERROR'];
out = await publishDue(igPublish, 1);
let said = rpcs('kb_post_state').map((c) => c.body).at(-1);
check('a container that errors goes back to scheduled, with the reason on it',
  said.p_status === 'scheduled' && (said.p_error || '').length > 0,
  JSON.stringify({ status: said.p_status, error: said.p_error }));

reset();
rpcAnswer.kb_ig_secret = sealed();
rpcAnswer.kb_post_claim = DUE({ attempts: 5 });
container = ['ERROR'];
out = await publishDue(igPublish, 1);
said = rpcs('kb_post_state').map((c) => c.body).at(-1);
check('after five tries it is marked failed rather than retried forever',
  said.p_status === 'failed' && out.done[0]?.outcome === 'failed',
  JSON.stringify({ status: said.p_status, outcome: out.done[0]?.outcome }));

/* --- raw footage ----------------------------------------------------------- */

reset();
res = await post('/footage/start', { name: 'A take', bytes: 2e9, content_type: 'application/pdf' });
check('footage that is not video -> 415, no row and no signature',
  res.status === 415 && rpcs('kb_footage_create').length === 0
  && !calls.some((c) => c.url.includes('/upload/sign/')), res.status);

reset();
res = await post('/footage/start', { name: 'A take', bytes: 1000, content_type: 'video/mp4' });
check('a file too small to be a take -> 400', res.status === 400, res.status);

reset();
res = await post('/footage/start', { name: 'A take', bytes: 9e9, content_type: 'video/mp4' });
check('a file over the bucket limit -> 413, said in gigabytes',
  res.status === 413 && /GB/.test((await res.json()).error || ''), res.status);

reset();
rpcAnswer.kb_footage_create = '66666666-6666-4666-8666-666666666666';
res = await post('/footage/start', { name: 'Monday morning take', bytes: 2.4e9, content_type: 'video/quicktime' });
j = await res.json();
check('a take is signed for upload, and the row records it',
  res.status === 200 && j.id === '66666666-6666-4666-8666-666666666666'
  && j.token === 'SIGNED-TOKEN-123' && /\.mov$/.test(j.path)
  && rpcs('kb_footage_create')[0].body.p_bytes === 2.4e9,
  JSON.stringify(j).slice(0, 200));
check('the upload goes to the direct storage host, resumable',
  j.endpoint === 'https://db.storage.supabase.co/storage/v1/upload/resumable', j.endpoint);
check('the browser is never handed the anon key',
  !JSON.stringify(j).includes('anon'), JSON.stringify(j).slice(0, 200));

reset();
rpcAnswer.kb_footage_read = {
  id: '66666666-6666-4666-8666-666666666666', name: 'Monday morning take', status: 'ready',
  storage_path: 'abc.mov', transcript: 'Four rowhomes...', words: [{ t: 'Four', s: 0.1, e: 0.4 }],
};
res = await post('/footage/read', { id: '66666666-6666-4666-8666-666666666666' });
j = await res.json();
check('reading a take gives the page the transcript but not the word timings',
  j.footage.transcript.startsWith('Four rowhomes') && j.footage.has_words === true
  && !('words' in j.footage) && !('storage_path' in j.footage),
  JSON.stringify(j.footage).slice(0, 200));

/* Finishing an upload is what starts the cutting; nothing else does. */
reset();
rpcAnswer.kb_footage_state = true;
res = await post('/footage/uploaded', { id: '66666666-6666-4666-8666-666666666666' });
const dispatched = calls.find((c) => c.url.includes('/actions/workflows/'));
check('an upload that finished starts the cutting run for that take',
  res.status === 202 && /cut-footage\.yml\/dispatches$/.test(dispatched?.url || '')
  && dispatched.body.inputs.footage_id === '66666666-6666-4666-8666-666666666666',
  dispatched?.url);

reset();
rpcAnswer.kb_footage_state = true;
githubOk = false;
res = await post('/footage/uploaded', { id: '66666666-6666-4666-8666-666666666666' });
githubOk = true;
check('a take whose run could not be started is marked failed, not left waiting',
  res.status === 502 && rpcs('kb_footage_state').some((c) => c.body.p_status === 'failed'),
  res.status);

reset();
rpcAnswer.kb_footage_delete = { ok: true, storage_path: 'abc.mov' };
res = await post('/footage/delete', { id: '66666666-6666-4666-8666-666666666666' });
await settle();
check('deleting a take takes the file with it',
  res.status === 200 && calls.some((c) => c.url.includes('/object/kb-footage/abc.mov') && c.url),
  res.status);

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
