/* ---------------------------------------------------------------------------
 * Refresh the hook-pattern corpus from the Spyglass API.
 *
 * Spyglass bills credits per row returned, so this is deliberately narrow: a
 * fixed brand list, two insight types, one call each. It is not wired into the
 * agent at request time for the same reason — a live tool call would spend
 * credits on every question asked. The agent reads the Postgres copy; this
 * refreshes that copy on a schedule.
 *
 * Needs SPYGLASS_API_KEY. Skips itself, without failing, when it is absent.
 * ------------------------------------------------------------------------ */

import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://app.spyglass.so/api/v1';
const TIMEOUT_MS = 20000;
const PAUSE_MS = 400;

/* HOOK is how a piece opens, USP is the claim it leads with. TARGET_PERSONA and
 * MEDIA_MIX are available but not pulled — they answer a different question and
 * every row costs credits. */
const TYPES = ['HOOK', 'USP'];

/* Resolved once and pinned. Re-searching by name on every run would spend
 * credits to rediscover ids that do not change, and risks silently latching
 * onto a different brand when a name is ambiguous. */
const BRANDS = [
  { id: '108521893501',    name: 'NerdWallet',      category: 'Finance' },
  { id: '84763399274',     name: 'LendingTree',     category: 'Finance' },
  { id: '246223015551168', name: 'Chime',           category: 'Finance' },
  { id: '633318986770616', name: 'Rocket Money',    category: 'Finance' },
  { id: '33416011787',     name: 'Robert Kiyosaki', category: 'Finance' },
  { id: '7129388593',      name: 'Zillow',          category: 'Real Estate' },
  { id: '116482854782233', name: 'Alex Hormozi',    category: 'Education' },
];

const KEY = String(process.env.SPYGLASS_API_KEY ?? '').trim();
if (!KEY) {
  console.log('SPYGLASS_API_KEY not set — skipping the hook-pattern refresh.');
  process.exit(0);
}

const redact = (s) => String(s).split(KEY).join('[REDACTED]');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function insights(brandId, type) {
  const url = `${BASE}/brands/${encodeURIComponent(brandId)}/insights?type=${type}`;
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${KEY}`, accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${redact(await res.text()).slice(0, 300)}`);
  }
  return res.json();
}

/* The REST response is bucketed by week — {type, count, buckets:[{year, week,
 * clusters:[{id, label, rawDelta, percentDelta, ...}]}]} — where the MCP
 * surface handed back a flat list. Collapse it: a pattern's total is its
 * volume summed across every week in the window, and its deltas come from the
 * most recent week that reported them.
 *
 * The per-cluster volume field is not named in the docs, so try the plausible
 * ones and report the keys we actually saw if none match. Better to fail with
 * the field list than to silently record every pattern as zero. */
const VOLUME_KEYS = ['total', 'count', 'size', 'volume', 'mediaCount', 'adCount'];
let loggedShape = false;

function flatten(body) {
  /* Flat form, in case the API ever returns one. */
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.rows)) return body.rows;
  if (!Array.isArray(body?.buckets)) return null;

  const buckets = [...body.buckets].sort(
    (a, b) => (a.year - b.year) || (a.week - b.week)
  );

  const byLabel = new Map();

  for (const bucket of buckets) {
    for (const c of bucket.clusters ?? []) {
      const label = String(c.label ?? '').trim();
      if (!label) continue;

      if (!loggedShape) {
        console.log(`  cluster fields: ${Object.keys(c).join(', ')}`);
        loggedShape = true;
      }

      const key = VOLUME_KEYS.find((k) => Number.isFinite(Number(c[k])));
      const volume = key ? Number(c[key]) : 0;

      const prev = byLabel.get(label) ?? { label, total: 0, rawDelta: null, percentDelta: null };
      prev.total += volume;
      /* Buckets are in ascending order, so the last non-null wins — the most
       * recent week that had something to compare against. */
      if (c.rawDelta !== null && c.rawDelta !== undefined) prev.rawDelta = c.rawDelta;
      if (c.percentDelta !== null && c.percentDelta !== undefined) prev.percentDelta = c.percentDelta;
      byLabel.set(label, prev);
    }
  }

  return [...byLabel.values()].sort((a, b) => b.total - a.total);
}

const rows = [];
const failures = [];

for (const brand of BRANDS) {
  for (const type of TYPES) {
    try {
      const body = await insights(brand.id, type);

      const list = flatten(body);
      if (!Array.isArray(list)) {
        throw new Error(`unexpected shape: ${JSON.stringify(body).slice(0, 300)}`);
      }

      for (const r of list) {
        rows.push({
          brand_id: brand.id,
          brand_name: brand.name,
          category: brand.category,
          insight_type: type,
          label: r.label,
          total: r.total,
          raw_delta: r.rawDelta ?? null,
          percent_delta: r.percentDelta ?? null,
        });
      }
      console.log(`  ${brand.name.padEnd(16)} ${type.padEnd(5)} ${list.length} patterns`);
    } catch (err) {
      failures.push({ brand: brand.name, type, why: err.message });
      console.log(`  ${brand.name.padEnd(16)} ${type.padEnd(5)} FAILED — ${err.message}`);
    }
    await sleep(PAUSE_MS);
  }
}

/* A partial refresh is fine — the upsert leaves untouched rows alone. An empty
 * one means something is systematically wrong and should not be written. */
if (!rows.length) {
  console.error('Spyglass returned no patterns at all. Not writing.');
  if (failures.length) console.error(failures);
  process.exit(1);
}

await mkdir(join(ROOT, 'data'), { recursive: true });
await writeFile(
  join(ROOT, 'data', 'hook-patterns.json'),
  JSON.stringify({ fetchedAt: new Date().toISOString(), rows, failures }, null, 2)
);

/* If every pattern came back with volume zero the field-name guess missed, and
 * loading them would flatten min_total filtering and the ordering to nothing.
 * Say so rather than write a corpus that looks fine and ranks randomly. */
if (rows.length && rows.every((r) => r.total === 0)) {
  console.error(
    'Every pattern has a volume of 0 — none of ' + VOLUME_KEYS.join('/') +
    ' matched. Check the "cluster fields" line above and add the right key.'
  );
  process.exit(1);
}

console.log(`\n${rows.length} patterns across ${BRANDS.length} brands`);
if (failures.length) console.log(`${failures.length} calls failed:`, failures);
