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

const rows = [];
const failures = [];

for (const brand of BRANDS) {
  for (const type of TYPES) {
    try {
      const body = await insights(brand.id, type);

      /* The MCP surface returns {rows:[{label,total,rawDelta,percentDelta}]}.
       * Accept a bare array too rather than assume, and fail loudly with the
       * shape we actually got instead of silently recording nothing. */
      const list = Array.isArray(body) ? body : body?.rows;
      if (!Array.isArray(list)) {
        throw new Error(`unexpected shape: ${JSON.stringify(body).slice(0, 200)}`);
      }

      for (const r of list) {
        const label = String(r.label ?? '').trim();
        if (!label) continue;
        rows.push({
          brand_id: brand.id,
          brand_name: brand.name,
          category: brand.category,
          insight_type: type,
          label,
          total: Number(r.total) || 0,
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

console.log(`\n${rows.length} patterns across ${BRANDS.length} brands`);
if (failures.length) console.log(`${failures.length} calls failed:`, failures);
