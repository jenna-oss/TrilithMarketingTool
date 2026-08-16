/* ---------------------------------------------------------------------------
 * Turns data/ads.json into batched upsert SQL for adspy.ads.
 *
 * Emits UPSERTs rather than inserts so it is safe to re-run: re-loading the
 * same corpus refreshes copy and last_seen without duplicating rows or
 * resetting first_seen, which is the one field we cannot recompute.
 * ------------------------------------------------------------------------ */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BATCH = 120;

/* Derived, not authoritative — an ad naming two products gets both tags. */
function productLines(copy, source) {
  const t = `${copy} ${source || ''}`.toLowerCase();
  const out = new Set();
  if (/\bdscr\b/.test(t)) out.add('dscr');
  if (/fix[\s-]?(and|&|n)?[\s-]?flip|\bflip(ping|s|ped)?\b/.test(t)) out.add('fix-and-flip');
  if (/\bbridge\b/.test(t)) out.add('bridge');
  if (/ground[\s-]?up|new construction|construction loan/.test(t)) out.add('ground-up');
  if (/\bportfolio\b/.test(t)) out.add('portfolio');
  if (/\bbrrrr\b/.test(t)) out.add('brrrr');
  if (/multi[\s-]?family|\bmultifamily\b/.test(t)) out.add('multifamily');
  return [...out];
}

/* Broker-targeted copy is unmistakable — it talks about the reader's clients,
 * commission, or pipeline. Everything else in a lending corpus is aimed at the
 * borrower, so that is the default rather than 'unknown'. */
function audience(copy) {
  const t = (copy || '').toLowerCase();
  if (/\bbroker|wholesale|your client|your investor client|commission|your pipeline|referral program|loan officer/.test(t)) {
    return 'broker';
  }
  return 'borrower';
}

const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const arr = (a) => (a.length ? `ARRAY[${a.map(q).join(',')}]::text[]` : `'{}'::text[]`);
/* Meta writes 'Started running on Aug 1, 2025' and similar. Anything Date
 * cannot parse becomes null rather than a bogus day. */
const isoDay = (s) => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};
const dt = (s) => (isoDay(s) ? `'${isoDay(s)}'::date` : 'null');

const corpus = JSON.parse(await readFile(join(ROOT, 'data', 'ads.json'), 'utf8'));
const ads = Object.values(corpus.ads);

const rows = ads.map((a) => {
  const pl = productLines(a.copy, a.source);
  return `(${[
    q(a.libraryId),
    q(a.advertiser),
    q(a.copy || ''),
    dt(a.started),
    q(a.firstSeen),
    q(a.lastSeen || a.firstSeen),
    a.seenCount || 1,
    q(a.source),
    arr(pl),
    q(audience(a.copy)),
  ].join(',')})`;
});

/* Load-ready payload: same shape the table wants, so Postgres only has to
 * unpack JSON. Derivation stays here rather than being re-implemented in SQL. */
await writeFile(
  join(ROOT, 'data', 'ads-load.json'),
  JSON.stringify(
    ads.map((a) => ({
      library_id: a.libraryId,
      advertiser_name: a.advertiser,
      copy: a.copy || '',
      started: isoDay(a.started),
      first_seen: a.firstSeen,
      last_seen: a.lastSeen || a.firstSeen,
      seen_count: a.seenCount || 1,
      source: a.source,
      product_lines: productLines(a.copy, a.source),
      audience: audience(a.copy),
    })),
  ),
);

await mkdir(join(ROOT, 'data', 'sql'), { recursive: true });

const batches = [];
for (let i = 0; i < rows.length; i += BATCH) batches.push(rows.slice(i, i + BATCH));

for (const [i, batch] of batches.entries()) {
  const sql =
    `insert into adspy.ads
  (library_id, advertiser_name, copy, started, first_seen, last_seen, seen_count, source, product_lines, audience)
values
${batch.join(',\n')}
on conflict (library_id) do update set
  copy          = excluded.copy,
  last_seen     = greatest(adspy.ads.last_seen, excluded.last_seen),
  seen_count    = excluded.seen_count,
  product_lines = excluded.product_lines,
  audience      = excluded.audience,
  updated_at    = now();`;
  await writeFile(join(ROOT, 'data', 'sql', `ads-${String(i + 1).padStart(2, '0')}.sql`), sql);
}

const byAudience = ads.reduce((m, a) => { const k = audience(a.copy); m[k] = (m[k] || 0) + 1; return m; }, {});
const tagged = ads.filter((a) => productLines(a.copy, a.source).length).length;

console.log(`${ads.length} ads → ${batches.length} batches in data/sql/`);
console.log('audience split:', byAudience);
console.log(`product lines tagged on ${tagged}/${ads.length}`);
