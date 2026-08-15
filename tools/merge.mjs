/* ---------------------------------------------------------------------------
 * Stage 2 of 3 — fold today's harvest into the running corpus.
 *
 * This is where recency actually gets solved. Meta only tells us when an ad
 * started running; it will not sort by that and its date filter matches ads
 * ACTIVE during a window rather than STARTED in it. By recording what we have
 * already seen, we get a firstSeen date of our own — so "new this week" means
 * new to us, which is the honest and more useful claim.
 * ------------------------------------------------------------------------ */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS = join(ROOT, 'data', 'ads.json');

const raws = (await readdir(join(ROOT, 'data', 'raw'))).filter((f) => f.endsWith('.json')).sort();
if (!raws.length) { console.error('No raw pulls found. Run tools/pull.mjs first.'); process.exit(1); }

const latest = JSON.parse(await readFile(join(ROOT, 'data', 'raw', raws[raws.length - 1]), 'utf8'));
if (!latest.healthy) { console.error('Latest pull is flagged unhealthy. Not merging.'); process.exit(1); }

const corpus = existsSync(CORPUS)
  ? JSON.parse(await readFile(CORPUS, 'utf8'))
  : { updatedAt: null, runs: 0, ads: {} };

const day = latest.runAt.slice(0, 10);
let added = 0;

for (const ad of latest.ads) {
  const key = ad.libraryId;
  const prev = corpus.ads[key];
  if (prev) {
    prev.lastSeen = day;
    prev.seenCount = (prev.seenCount || 1) + 1;
    // copy can be edited in place by the advertiser; keep the newest
    if (ad.copy && ad.copy !== prev.copy) prev.copy = ad.copy;
  } else {
    corpus.ads[key] = {
      libraryId: key,
      advertiser: ad.advertiser,
      started: ad.started,
      copy: ad.copy,
      source: ad.source,
      firstSeen: day,
      lastSeen: day,
      seenCount: 1
    };
    added++;
  }
}

corpus.updatedAt = latest.runAt;
corpus.runs = (corpus.runs || 0) + 1;

/* A first run would mark every historical ad as "new", which would be
 * misleading on the page. Flag it so render.mjs can say so plainly. */
corpus.baselineRun = corpus.runs === 1;

await mkdir(dirname(CORPUS), { recursive: true });
await writeFile(CORPUS, JSON.stringify(corpus, null, 2));

const total = Object.keys(corpus.ads).length;
console.log(
  `run ${corpus.runs} · ${added} new · ${total} total ads · ` +
  `${new Set(Object.values(corpus.ads).map((a) => a.advertiser)).size} advertisers` +
  (corpus.baselineRun ? '\nThis is the baseline run — everything counts as new by definition.' : '')
);
