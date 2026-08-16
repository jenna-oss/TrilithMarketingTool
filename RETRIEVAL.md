# The ad corpus, for agents

774 competitor ads across 249 advertisers live in Postgres under the `adspy`
schema. An agent answering a question about the category should query this
rather than be handed the corpus in a prompt.

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
`relevance` returned as 0. Supply `q` and it runs full-text search over the copy
with a trigram fallback, so a misremembered phrase or a misspelled advertiser
still lands.

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

## Keeping it current

`tools/to-sql.mjs` shapes `data/ads.json` into `data/ads-load.json`, deriving
`product_lines` and `audience` from the copy — those rules live there and
nowhere else. `tools/push-supabase.mjs` sends it through the
`adspy_upsert_ads` RPC, which owns the merge: `first_seen` is never overwritten
and `last_seen` only moves forward.

Both run as part of the daily job. The push step needs `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` as repository secrets and skips itself, without
failing, when they are absent. The service key bypasses RLS — it belongs in
secrets and nowhere else.

## On embeddings

There is no vector column. At 774 rows, full-text plus trigram plus the
structured filters answers the questions being asked, and `pgvector` would add
a third-party embedding dependency for a corpus this size. The schema leaves
room to add one later; nothing here assumes it.
