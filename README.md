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

## Tools

`tools/recency-pull.js` — re-run the category sweep to see new competitor creative
as it launches.

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
