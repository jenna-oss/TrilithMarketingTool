/* ---------------------------------------------------------------------------
 * Stage 3 of 3 — write the live-feed section into index.html.
 *
 * Only the region between the AUTO:FEED markers is touched, so the hand-written
 * analysis around it is never disturbed. Bails out rather than writing a broken
 * or empty section, because this page is client-facing and publishes itself.
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

const html = await readFile(PAGE, 'utf8');
const a = html.indexOf(START);
const b = html.indexOf(END);

/* The live-feed section was removed from the page. Absent markers are a design
 * decision, not a failure — exit cleanly so the daily job still harvests and
 * commits data instead of going red every morning. Re-add the markers to the
 * page and this stage starts writing again with no change here. */
if (a === -1 || b === -1 || b < a) {
  console.log('No AUTO:FEED region in index.html — skipping the feed render.');
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
