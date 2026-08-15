# Trilith Marketing Tool

Competitive intelligence briefing on the private real estate lending category,
prepared by [AIKO](https://aikogroup.io) for Trilith Funding.

`index.html` is a self-contained page — no build step, no dependencies. Open it
directly, or serve the repo root with any static host.

## What it covers

- **The board** — five competing lenders (Kiavi, Lima One, Visio, Anchor Loans,
  New Silver) with paid presence, landing page count, social reach, and the
  position each is buying.
- **The creative wall** — 21 live and recently-live ad creatives, verbatim, each
  linking to the asset that ran. Filterable by lender.
- **Hook taxonomy** — the nine angles the category advertises on, ordered by how
  heavily it leans on each.
- **Pain map** — ten borrower pains scored by competitive pressure.
- **Conversion** — button text, landing page destinations, and offer mechanics.
- **Where the room is** — seven positions nobody in the category has taken.

## Sourcing

Drawn from the Spyglass advertising corpus (Meta, Instagram, TikTok), cross-read
against each lender's live site and landing pages. 130 creatives across five
brands, trailing 90 days to August 2026.

Three limits are stated on the page itself and repeated here:

1. **Days-in-market is a proxy, not a metric.** Platforms do not publish spend or
   performance figures. A long-running ad is probably working; it is not proof.
2. **Absence is not proof of absence.** A brand returning no results means no
   indexed paid social — not that no marketing exists.
3. **The Spanish-language demand signal needs validating.** It comes from creator
   accounts whose audience geography is not verified in this data.

## Daily automation

`.github/workflows/daily-ad-pull.yml` runs at 11:00 UTC (06:00 ET) and can also be
triggered by hand from the Actions tab. Three stages:

| Stage | Script | Does |
|---|---|---|
| Pull | `tools/pull.mjs` | Drives Chromium over 4 keyword sweeps and 9 lender page IDs, writes `data/raw/<date>.json` |
| Merge | `tools/merge.mjs` | Folds into `data/ads.json`, stamping a **firstSeen** date per ad |
| Render | `tools/render.mjs` | Rewrites only the `AUTO:FEED` region of `index.html` |

Then it commits and pushes; Pages rebuilds itself.

**Why `firstSeen` matters.** Meta reports when an ad *started* but offers no recency
sort, and its date filter matches ads *active during* a window rather than *started*
in one. Watching daily gives a first-seen date of our own, so "new this week" means
new to us — which is both honest and more useful than anything a single query returns.

### Guards

Publishing is automatic, so two things are gated:

- **Unhealthy harvest fails the run.** `pull.mjs` exits non-zero unless it finds at
  least 15 ads and at least 2 keyword sweeps returned rows. A blocked or broken run
  commits nothing and leaves the previous good data and page in place. A page-ID
  target returning zero is *not* treated as failure — six lenders genuinely have no
  ads.
- **Render refuses to shrink the page.** If the output is under 60% of the input it
  aborts, on the assumption something outside the markers got clobbered.

The feed section also shows a staleness warning on the page itself if the last
successful run is more than three days old.

### Known risk

Meta frequently challenges datacenter IPs and a headless runner cannot clear a
challenge, so expect some failed runs. Failures are safe — they just skip a day. If
it fails for several consecutive days, run the job somewhere with a residential IP,
or use `tools/recency-pull.js` by hand in the meantime.

### Careful: two writers touch index.html

`render.mjs` writes the `AUTO:FEED` region. Regenerating the whole page from the
design source overwrites that region with the placeholder. If you regenerate the
page, run `node tools/render.mjs` afterwards to restore the feed — it is idempotent
and safe to run any time `data/ads.json` exists.

### Running it locally

```
npm install
npx playwright install chromium
npm run daily
```

If a cached Chromium already exists but its build number lags the npm package, point
at it instead of downloading another: set `PW_CHROMIUM_PATH` to the `chrome.exe`
path. CI does not need this.

## Tools

`tools/recency-pull.js` — a no-install version of the same sweep for ad-hoc checks,
pasted into the browser console.

Meta's Ad Library has **no recency sort**. Keyword searches are forced to
`sort_data[mode]=total_impressions`, and passing `creation_time` is silently
overridden back to impressions. Its date filter matches ads *active during* a
window rather than ads that *started* in it, so long-running 2024 ads still
surface inside a 2026 window.

The script works around that: it scrolls the results, reads the "Started running
on" date off each ad, de-duplicates creative variants, sorts newest-first, and
copies a CSV to the clipboard. It has to run in the browser console — the Ad
Library is a JavaScript app and returns an empty shell to `curl`.

Usage, the working search URLs, and pre-resolved lender page IDs are in the file
header. Last verified 2026-08-15: 29 unique ads across 27 advertisers in a single
sweep, 7 of them started within the prior 45 days.

## Notes

- Figures and metrics use a monospace face; competitor ad copy is set in serif
  italic to mark it as quoted material rather than authored copy.
- The page renders in both light and dark themes.
- Typography falls back through `Poppins → Century Gothic → Avenir Next`. Poppins
  is not bundled, so install it locally for the intended rendering.
