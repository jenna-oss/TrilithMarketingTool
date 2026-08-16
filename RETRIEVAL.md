# The corpora, for agents

Two bodies of text live in Postgres, each behind one retrieval function. An
agent answering a question should query these rather than be handed either
corpus in a prompt.

| Schema    | What it holds                                   | Entry point               |
| --------- | ----------------------------------------------- | ------------------------- |
| `adspy`   | 774 competitor ads, 249 advertisers             | `adspy.search_ads`        |
| `content` | 37 Trilith pages, 254 passages                  | `content.search_content`  |

Together they answer the two halves of a content question: what competitors are
saying, and what Trilith has already said.

---

# Competitor ads — `adspy`

## One function

```sql
select * from adspy.search_ads(
  q             => 'no income verification',  -- relevance search over ad copy
  advertiser    => 'kiavi',                   -- fuzzy, partial names are fine
  product       => 'dscr',                    -- dscr | fix-and-flip | bridge |
                                              -- ground-up | portfolio | brrrr |
                                              -- multifamily
  audience      => 'broker',                  -- broker | borrower
  seen_since    => '2026-08-01',              -- when *we* first saw it
  started_since => '2026-08-01',              -- when Meta says it launched
  max_rows      => 40                         -- capped at 500
);
```

Every argument is optional. Omit `q` and it becomes a filtered browse with
`relevance` returned as 0. Supply `q` and it matches on **any** query term, so a
natural-language question still returns something, then ranks ads carrying every
term above ads carrying one. A word-similarity fallback catches misspellings.

Each row carries an `ad_library_url` pointing at the live ad on Meta, so an
agent can cite the primary source instead of asking the reader to take its word.

Over PostgREST the same function is `public.adspy_search_ads` — the `adspy`
schema itself is not exposed.

## Roster

```sql
select * from adspy.advertiser_summary order by ad_count desc;
select name, fb_page_id from adspy.advertisers where is_tracked;
```

18 lenders are under deliberate daily watch. Seven of them have zero ads, and
that is data, not a gap — CoreVest and Anchor Loans run nothing on Meta despite
their size. The remaining 231 advertisers surfaced through keyword sweeps.

## Two things the data will not tell you

**`started` is not `first_seen`.** `started` is Meta's launch date; `first_seen`
is the day our sweep first observed the ad. Only `first_seen` supports a claim
like "new this week", and even then the baseline sweep of 2026-08-15 has to be
excluded, because everything running that day shares that date without being new.

**Ad count is not spend.** A lender running 114 creatives is not outspending one
running 33. The Ad Library reports creatives, never budget.

---

# Trilith's own content — `content`

37 pages: 22 blog posts, 4 funded-deal writeups, 6 product pages, the FAQ and
the rest. Split into 254 passages, because the unit of retrieval is the passage,
not the article — a post runs a thousand words and an agent wants the paragraph
that answers its question.

```sql
select * from content.search_content(
  q        => 'appraisal comes in low',   -- passage-level relevance search
  kind     => 'blog',                     -- blog | case-study | product | faq | page
  since    => '2026-06-01',               -- published on or after
  until    => '2026-08-01',
  max_rows => 20                          -- capped at 200
);
```

Each row returns the full `passage` plus a `snippet` with matched terms wrapped
in `**`, so an agent can judge relevance before reading the whole thing, and the
`url` and `title` to cite. When a passage is not enough:

```sql
select * from content.get_document('/blog/fix-and-flip-math');   -- full body
select * from content.document_index order by published desc;    -- coverage map
```

Over PostgREST the search is `public.content_search`.

## How ranking works, and where it is weak

Matching is OR across query terms for recall. Ranking then combines inverse
document frequency (rare terms count for more), term proximity, a bonus for
passages carrying every term, and a bonus for a hit in the heading — headings are
where these posts state their arguments.

The weak spot is worth knowing: the corpus is small and topically narrow, so IDF
misjudges domain vocabulary. "Appraisal" appears in 34 of 254 passages and
"low" in 12, which makes the retriever treat *low* as the rarer, more meaningful
word. Proximity is what rescues the ranking there. Expect the same effect for any
term central to lending — DSCR, bridge, rehab — and lean on `kind` and date
filters when a query is built entirely from house vocabulary.

## Two things the content data will not tell you

**Only blog posts have publisher-stated dates.** `date_source` says where a date
came from: `json-ld` means Trilith stated it, `sitemap-lastmod` means it was
inferred from a file timestamp. Product pages have no date at all — every static
page shares one sitemap timestamp, which is the site build stamp, and the
harvester discards it rather than presenting a build as a publication.

**No author is recorded**, because the site's structured data does not name one.

---

## Keeping it current

Both corpora refresh from the same daily job.

**Ads.** `tools/to-sql.mjs` shapes `data/ads.json` into `data/ads-load.json`,
deriving `product_lines` and `audience` from the copy — those rules live there
and nowhere else. `tools/push-supabase.mjs` sends it through the
`adspy_upsert_ads` RPC, which owns the merge: `first_seen` is never overwritten
and `last_seen` only moves forward.

**Content.** `tools/pull-content.mjs` walks the sitemap and re-chunks every
page into `data/content.json`. `tools/push-content.mjs` sends it through
`content_upsert_docs`, which upserts each document by URL and replaces its
chunks wholesale — chunk boundaries move whenever a post is edited or the
chunker changes, so ordinals cannot be merged in place.

The content steps are marked `continue-on-error`: Trilith's writing changes
slowly and can be re-harvested tomorrow, but a missed ad sweep is gone for good,
so a site hiccup must not take the ad pull down with it.

Both push steps need `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as
repository secrets and skip themselves, without failing, when those are absent.
The service key bypasses RLS — it belongs in secrets and nowhere else.

## The ideation agent

`ideas.html` is the page a strategist actually uses. It talks to the `/ideas`
route on the Worker, which gives the model three tools rather than a corpus:

| Tool                     | Backed by                |
| ------------------------ | ------------------------ |
| `search_competitor_ads`  | `public.adspy_search_ads` |
| `search_trilith_content` | `public.content_search`   |
| `trilith_coverage`       | `public.content_coverage` |

It runs up to six rounds of searching before answering, and streams every
search it makes to the page as it goes — an idea claiming a gap in the market
is only worth anything if you can see the query behind it.

The Worker reads Supabase with the **anon** key, so this route physically
cannot write to either corpus. The system prompt carries the same caveats
recorded here: ad count is not spend, `started` is not `first_seen`, absence
from the corpus is not absence from the market, and a `sitemap-lastmod` date is
not a publication date.

Deploy:

```
cd worker && npm install
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler deploy
```

Then set `WORKER_URL` at the top of the script in `ideas.html` and `ask.html`.
Both pages show setup instructions and disable their input until it is set.

## Security

Neither `adspy` nor `content` is exposed over PostgREST. Four wrappers in
`public` are the only doors:

| Function                      | Who can call it |
| ----------------------------- | --------------- |
| `public.adspy_search_ads`     | anon, authenticated, service_role |
| `public.content_search`       | anon, authenticated, service_role |
| `public.adspy_upsert_ads`     | service_role only |
| `public.content_upsert_docs`  | service_role only |

The read wrappers run as `SECURITY INVOKER`, so the RLS policies on the
underlying tables stay in the path. The write wrappers are `SECURITY DEFINER`
and have `EXECUTE` revoked from `public`, `anon` and `authenticated` — a definer
function callable by anon would let anyone rewrite either corpus.

## On embeddings

There is no vector column on either corpus. At 774 ads and 254 passages,
full-text with IDF and proximity ranking answers the questions being asked, and
`pgvector` would add a third-party embedding dependency (Anthropic provides no
embeddings API) for corpora this size. Both schemas leave room to add one later;
nothing here assumes it.

Revisit that for the content corpus first — it is the one where a question can
be phrased with none of the words the passage uses, which is exactly what
keyword retrieval cannot fix.
