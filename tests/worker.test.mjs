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

/* --- the fakes ----------------------------------------------------------- */

let calls = [];
let rpcAnswer = {};
let claudeReply = { type: 'text', text: 'Here are some ideas.' };

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
  if (u.endsWith('/auth/v1/user')) return jsonRes({ email: 'me@x.io' });
  const fn = (u.match(/\/rpc\/([a-z_]+)/) || [])[1];
  if (fn === 'kb_app_user_allowed') return jsonRes(true);
  return jsonRes(fn in rpcAnswer ? rpcAnswer[fn] : null);
};

const env = {
  SUPABASE_URL: 'https://db.example', SUPABASE_ANON_KEY: 'anon',
  ANTHROPIC_API_KEY: 'sk-test', GITHUB_TOKEN: 'tok', VOYAGE_API_KEY: '',
};
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
};
/* Exactly this function: '/rpc/kb_links' is a prefix of '/rpc/kb_links_by_ids',
 * and matching loosely made the new call look like the old one. */
const rpcs = (fn) => calls.filter((c) => new URL(c.url).pathname.endsWith('/rpc/' + fn));
const LINK = '99999999-9999-4999-8999-999999999999';
const REC = '77777777-7777-7777-7777-777777777777';

/* --- the gate ------------------------------------------------------------ */

for (const path of ['/ideas', '/videos', '/links', '/links/read', '/recordings/list', '/scripts/list', '/scripts/write', '/kb/upload']) {
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

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
