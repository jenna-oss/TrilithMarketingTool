/* ---------------------------------------------------------------------------
 * Optional stage 1 — harvest via Meta's official Ad Library API.
 *
 * Preferred over tools/pull.mjs when it works: a supported JSON feed instead of
 * scraping a JavaScript app, so it survives DOM changes and is not challenged
 * on datacenter IPs.
 *
 * The open question is coverage. Meta's docs list HOUSING_ADS and
 * FINANCIAL_PRODUCTS_AND_SERVICES_ADS as valid ad_type values, and US lending
 * ads must declare a Special Ad Category (Credit / Housing) — so investor-lending
 * ads may be in scope. Independent reports say /ads_archive returns little
 * outside political and the US special categories. Run with --probe to find out
 * for these specific queries rather than argue from documentation.
 *
 * THE TOKEN IS READ FROM THE ENVIRONMENT AND IS NEVER LOGGED.
 * Set it locally as META_AD_LIBRARY_TOKEN, or in CI as a repository secret.
 * Do not paste it into a file, a commit, or a chat window.
 *
 *   node tools/api-pull.mjs --probe   # which ad_type / query combos return rows
 *   node tools/api-pull.mjs           # full pull, writes data/raw/<date>.json
 * ------------------------------------------------------------------------ */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN = process.env.META_AD_LIBRARY_TOKEN;
const API = 'https://graph.facebook.com/v21.0/ads_archive';
const PROBE = process.argv.includes('--probe');

if (!TOKEN) {
  console.error(
    'META_AD_LIBRARY_TOKEN is not set.\n\n' +
    '  Local (PowerShell):  $env:META_AD_LIBRARY_TOKEN = "<token>"\n' +
    '  CI:                  gh secret set META_AD_LIBRARY_TOKEN\n\n' +
    'The second form prompts for the value so it is never typed into a file.'
  );
  process.exit(2);
}

/* Never interpolate the token into anything we print. */
const redact = (s) => String(s).split(TOKEN).join('«REDACTED»');

const AD_TYPES = ['ALL', 'FINANCIAL_PRODUCTS_AND_SERVICES_ADS', 'HOUSING_ADS'];
const QUERIES = ['fix and flip loan', 'DSCR loan', 'hard money lender', 'bridge loan investor'];

const FIELDS = [
  'id', 'page_id', 'page_name', 'ad_creative_bodies', 'ad_creative_link_titles',
  'ad_creative_link_captions', 'ad_delivery_start_time', 'ad_delivery_stop_time',
  'ad_snapshot_url', 'publisher_platforms'
].join(',');

async function call(params) {
  const url = new URL(API);
  url.searchParams.set('access_token', TOKEN);
  url.searchParams.set('ad_reached_countries', JSON.stringify(['US']));
  url.searchParams.set('fields', FIELDS);
  url.searchParams.set('limit', '100');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const e = body.error || {};
    return { ok: false, status: res.status, code: e.code, message: redact(e.message || res.statusText) };
  }
  return { ok: true, data: body.data || [], next: body.paging?.next || null };
}

/* ---- probe: report what is actually reachable --------------------------- */
if (PROBE) {
  console.log('Probing /ads_archive coverage for investor-lending queries.\n');
  const grid = [];
  for (const ad_type of AD_TYPES) {
    for (const q of QUERIES.slice(0, 2)) {
      const r = await call({ ad_type, search_terms: q });
      grid.push({
        ad_type,
        query: q,
        result: r.ok ? `${r.data.length} rows` : `ERROR ${r.code ?? r.status}: ${r.message}`.slice(0, 110)
      });
      console.log(`${ad_type.padEnd(38)} ${q.padEnd(22)} ${grid.at(-1).result}`);
    }
  }
  const anything = grid.some((g) => /^[1-9]/.test(g.result));
  console.log(
    '\n' + (anything
      ? 'Commercial lending ads ARE reachable. Switch the workflow to this script.'
      : 'No rows for any combination — the API does not cover these ads. Keep using tools/pull.mjs.')
  );
  process.exit(anything ? 0 : 3);
}

/* ---- full pull ---------------------------------------------------------- */
const runAt = new Date().toISOString();
const day = runAt.slice(0, 10);
const ads = [];
const perTarget = {};

for (const q of QUERIES) {
  let n = 0;
  for (const ad_type of AD_TYPES) {
    const r = await call({ ad_type, search_terms: q });
    if (!r.ok) { console.log(`${q} / ${ad_type}: ${r.message}`.slice(0, 120)); continue; }
    for (const a of r.data) {
      ads.push({
        libraryId: a.id,
        advertiser: a.page_name || null,
        started: a.ad_delivery_start_time ? new Date(a.ad_delivery_start_time).toDateString().slice(4) : null,
        copy: (a.ad_creative_bodies || []).join(' ').replace(/\s+/g, ' ').trim().slice(0, 400),
        source: `api:${ad_type}:${q}`
      });
      n++;
    }
  }
  perTarget[`api:${q}`] = n;
  console.log(`${q.padEnd(24)} ${n}`);
}

const unique = [...new Map(ads.filter((a) => a.libraryId && a.advertiser && a.started)
  .map((a) => [a.libraryId, a])).values()];

const healthy = unique.length >= 15;

await mkdir(join(ROOT, 'data', 'raw'), { recursive: true });
await writeFile(
  join(ROOT, 'data', 'raw', `${day}.json`),
  JSON.stringify({ runAt, healthy, via: 'api', perTarget, ads: unique }, null, 2)
);

console.log(`\n${unique.length} unique ads across ${new Set(unique.map((a) => a.advertiser)).size} advertisers`);
if (!healthy) {
  console.error('UNHEALTHY API PULL — refusing to continue so nothing bad gets published.');
  process.exit(1);
}
