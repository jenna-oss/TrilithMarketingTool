/* ---------------------------------------------------------------------------
 * Stage 1 of 3 — harvest the Meta Ad Library.
 *
 * Writes data/raw/<date>.json. Exits non-zero if the harvest looks unhealthy,
 * which stops the pipeline before anything reaches the published page.
 *
 * The Ad Library is a JavaScript app and returns an empty shell to plain HTTP
 * clients, so this drives a real browser. It also offers no recency sort, so we
 * read the "Started running on" date off every card and sort ourselves.
 * ------------------------------------------------------------------------ */

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* Category sweeps plus the lenders we already resolved to numeric page ids.
 * Page-id queries are exact; keyword queries are fuzzy but catch new entrants. */
const TARGETS = [
  { label: 'kw:fix-and-flip', url: kw('fix and flip loan') },
  { label: 'kw:dscr',         url: kw('DSCR loan investor') },
  { label: 'kw:bridge',       url: kw('bridge loan real estate investor') },
  { label: 'kw:ground-up',    url: kw('new construction loan investor') },
  { label: 'page:lendingone', url: page('1488778371407976') },
  { label: 'page:renovo',     url: page('232025073545293') },
  { label: 'page:templeview', url: page('1790851891232875') },
  { label: 'page:corevest',   url: page('550429851723713') },
  { label: 'page:easystreet', url: page('161927707529642') },
  { label: 'page:roc360',     url: page('122866955776216') },
  { label: 'page:upright',    url: page('405332459610678') },
  { label: 'page:velocity',   url: page('796752613736461') },
  { label: 'page:longhorn',   url: page('126610117257') }
];

function kw(q) {
  return 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US' +
    `&q=${encodeURIComponent(q)}&search_type=keyword_unordered&media_type=all`;
}
function page(id) {
  return 'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=US' +
    `&view_all_page_id=${id}&media_type=all`;
}

/* A page-id target legitimately returns zero (six lenders have never advertised),
 * so health is judged on the keyword sweeps only. */
const MIN_TOTAL_ADS = 15;
const MIN_KEYWORD_TARGETS_WITH_RESULTS = 2;

const SCROLLS = 18;
const PAUSE_MS = 1200;

/* Runs inside the page. Kept dependency-free and defensive: Meta reorders and
 * renames DOM nodes often, so we parse the rendered text rather than classes. */
function harvest() {
  const text = document.body.innerText;
  if (/No ads match/i.test(text)) return [];
  return text.split(/Library ID:/).slice(1).map((b) => {
    const advertiser = (b.match(/\n([^\n]{2,70})\nSponsored/) || [])[1] || null;
    const started    = (b.match(/([A-Za-z]{3} \d{1,2}, \d{4})/) || [])[1] || null;
    const libraryId  = (b.match(/^\s*(\d{6,})/) || [])[1] || null;
    const copy = ((b.match(/Sponsored\n([\s\S]{0,500})/) || [])[1] || '')
      .replace(/\s+/g, ' ').trim().slice(0, 400);
    return { libraryId, advertiser, started, copy };
  }).filter((r) => r.libraryId && r.advertiser && r.started);
}

async function sweep(page_, target) {
  await page_.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // Best effort: a consent dialog occasionally appears and blocks scrolling.
  for (const label of ['Allow all cookies', 'Decline optional cookies', 'Only allow essential cookies']) {
    const btn = page_.getByRole('button', { name: label });
    if (await btn.count().catch(() => 0)) { await btn.first().click().catch(() => {}); break; }
  }
  await page_.waitForTimeout(3500);

  let last = -1, stagnant = 0;
  for (let i = 0; i < SCROLLS; i++) {
    await page_.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page_.waitForTimeout(PAUSE_MS);
    const n = await page_.evaluate(() => (document.body.innerText.match(/Library ID:/g) || []).length);
    stagnant = n === last ? stagnant + 1 : 0;
    last = n;
    if (stagnant >= 2) break;
  }
  return page_.evaluate(harvest);
}

const runAt = new Date().toISOString();
const day = runAt.slice(0, 10);

/* CI installs a browser matching the pinned Playwright version, so it needs
 * nothing here. Locally the cached build often lags the npm package; point
 * PW_CHROMIUM_PATH at an existing chrome.exe to reuse it instead of
 * re-downloading, e.g.
 *   %LOCALAPPDATA%\ms-playwright\chromium-1208\chrome-win64\chrome.exe */
const launchOpts = process.env.PW_CHROMIUM_PATH
  ? { executablePath: process.env.PW_CHROMIUM_PATH }
  : {};

const browser = await chromium.launch(launchOpts);
const ctx = await browser.newContext({
  locale: 'en-US',
  timezoneId: 'America/New_York',
  viewport: { width: 1280, height: 900 },
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
});
const pg = await ctx.newPage();

const results = [];
const perTarget = {};

for (const t of TARGETS) {
  try {
    const rows = await sweep(pg, t);
    perTarget[t.label] = rows.length;
    rows.forEach((r) => results.push({ ...r, source: t.label }));
    console.log(`${t.label.padEnd(20)} ${rows.length}`);
  } catch (err) {
    perTarget[t.label] = null; // null = errored, distinct from a real zero
    console.log(`${t.label.padEnd(20)} ERROR ${err.message.slice(0, 80)}`);
  }
}

await browser.close();

/* ---- health gate ------------------------------------------------------- */
const keywordHits = Object.entries(perTarget)
  .filter(([k, v]) => k.startsWith('kw:') && v > 0).length;

const healthy =
  results.length >= MIN_TOTAL_ADS &&
  keywordHits >= MIN_KEYWORD_TARGETS_WITH_RESULTS;

await mkdir(join(ROOT, 'data', 'raw'), { recursive: true });
await writeFile(
  join(ROOT, 'data', 'raw', `${day}.json`),
  JSON.stringify({ runAt, healthy, perTarget, ads: results }, null, 2)
);

console.log(`\n${results.length} ads across ${new Set(results.map((r) => r.advertiser)).size} advertisers`);

if (!healthy) {
  console.error(
    `\nUNHEALTHY PULL — ${results.length} ads, ${keywordHits} keyword targets returned rows.\n` +
    'Refusing to continue so a blocked or broken run cannot overwrite good data ' +
    'or publish an empty page. Most likely cause: Meta challenged this IP.'
  );
  process.exit(1);
}
