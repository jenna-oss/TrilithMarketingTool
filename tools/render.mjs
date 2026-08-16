/* ---------------------------------------------------------------------------
 * Stage 3 of 3 — write the automated regions of index.html.
 *
 * The briefing is hand-written analysis and stays that way. Only the regions
 * between AUTO markers are touched:
 *
 *   AUTO:TOTALS  the corpus size quoted in the long-tail section, which is the
 *                one figure on the page that moves every day
 *   AUTO:FEED    the live-feed section (currently removed from the page)
 *
 * Each region is independent and each is optional. A missing marker is a design
 * decision, not a failure — the job still harvests and commits.
 * ------------------------------------------------------------------------ */

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = join(ROOT, 'index.html');
const START = '<!-- AUTO:FEED:START -->';
const END = '<!-- AUTO:FEED:END -->';

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const corpus = JSON.parse(await readFile(join(ROOT, 'data', 'ads.json'), 'utf8'));
const ads = Object.values(corpus.ads);
if (!ads.length) { console.error('Corpus is empty. Not rendering.'); process.exit(1); }

let html = await readFile(PAGE, 'utf8');

/* Replace the text between a marker pair. Returns the original untouched when
 * the markers are absent or inverted, so a missing region is a no-op. */
function replaceRegion(source, name, body) {
  const open = `<!-- AUTO:${name}:START -->`;
  const close = `<!-- AUTO:${name}:END -->`;
  const i = source.indexOf(open);
  const j = source.indexOf(close);
  if (i === -1 || j === -1 || j < i) return { html: source, wrote: false };
  return {
    html: source.slice(0, i) + open + body + close + source.slice(j + close.length),
    wrote: true,
  };
}

/* The corpus size, quoted mid-sentence in the long-tail section. This is the
 * only number on the page that changes daily, and it was drifting: the page
 * said 774 while the sweep had reached 781. */
const advertiserCount = new Set(ads.map((x) => x.advertiser)).size;
const totals = replaceRegion(
  html, 'TOTALS',
  `${ads.length.toLocaleString()} live ads from ${advertiserCount} advertisers`
);
html = totals.html;
if (totals.wrote) {
  console.log(`Totals: ${ads.length} ads from ${advertiserCount} advertisers.`);
}

const a = html.indexOf(START);
const b = html.indexOf(END);

/* The live-feed section was removed from the page. Absent markers are a design
 * decision, not a failure — write whatever else changed and exit cleanly rather
 * than going red every morning. */
if (a === -1 || b === -1 || b < a) {
  if (totals.wrote) {
    await writeFile(PAGE, html);
    console.log('Wrote the totals region. No AUTO:FEED region — skipping the feed.');
  } else {
    console.log('No AUTO regions in index.html — nothing to render.');
  }
  process.exit(0);
}

const byFirstSeen = [...ads].sort((x, y) =>
  (y.firstSeen || '').localeCompare(x.firstSeen || '') ||
  Date.parse(y.started || 0) - Date.parse(x.started || 0));

const newest = byFirstSeen.slice(0, 12);
const advertisers = new Set(ads.map((x) => x.advertiser));

/* Exclude the baseline sweep: those ads were first *observed* on day one but
 * are not new to the market, and counting them would overstate the feed for a
 * week after setup. */
const cutoff = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
const thisWeek = ads.filter(
  (x) => x.firstSeen >= cutoff && x.firstSeen !== corpus.baselineDay
);

const updated = new Date(corpus.updatedAt);
const stale = (Date.now() - updated.getTime()) > 3 * 864e5;

const cards = newest.map((x) => `
      <div class="creative">
        <span class="thumb-none">${esc((x.started || '').replace(/,.*/, '').toUpperCase())}</span>
        <span class="body">
          <span class="who">${esc(x.advertiser)}</span>
          <span class="line">${esc(x.copy.slice(0, 190))}</span>
          <span class="meta"><span class="chip">FIRST SEEN ${esc(x.firstSeen)}</span></span>
        </span>
      </div>`).join('\n');

const summary = corpus.baselineRun
  ? `<p><strong>Baseline sweep.</strong> The first run records the category as it
       stands, so nothing is marked new yet — ${ads.length} ads across
       ${advertisers.size} advertisers. From here on this section reports only
       creative that was not there the day before.</p>`
  : `<p><strong>${thisWeek.length} ${thisWeek.length === 1 ? 'ad' : 'ads'} newly observed in the
       last seven days</strong>, against a tracked corpus of ${ads.length} ads across
       ${advertisers.size} advertisers. The baseline sweep of
       ${esc(corpus.baselineDay || 'setup')} is excluded — those were first seen by us
       that day but were already running.</p>`;

const staleNote = stale
  ? `<p class="dark-list">⚠ Last successful run was ${esc(corpus.updatedAt.slice(0, 10))} —
       more than three days ago. The scheduled job may be blocked or broken.</p>`
  : '';

const block = `${START}
    <div class="method">
      <h3>Feed status</h3>
      ${summary}
      ${staleNote}
      <p class="dark-list">Run ${corpus.runs} · last updated ${esc(corpus.updatedAt.slice(0, 16).replace('T', ' '))} UTC · tracking ${ads.length} ads</p>
    </div>

    <div class="wall" style="margin-top:var(--s4)">${cards}
    </div>
    ${END}`;

const out = html.slice(0, a) + block + html.slice(b + END.length);

/* Guard: never shrink the page dramatically — that would mean we clobbered
 * something outside the markers. */
if (out.length < html.length * 0.6) {
  console.error('Rendered page is suspiciously smaller than the original. Not writing.');
  process.exit(1);
}

await writeFile(PAGE, out);
console.log(`Rendered ${newest.length} cards · ${thisWeek.length} new this week · run ${corpus.runs}`);
