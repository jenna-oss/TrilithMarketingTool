# Schema

The `kb` schema is defined by 38 migrations applied to the Supabase project
`kugnlobgsguxggnqiseh`, listed below in order. They are **not** duplicated here
as files, for the same reason `adspy` and `content` are not: Supabase holds the
authoritative record in `supabase_migrations.schema_migrations`, and a
hand-maintained second copy drifts. `data/sql/` holds data loads, never DDL.

To pull them into this repo as files:

```bash
npx supabase link --project-ref kugnlobgsguxggnqiseh
npx supabase db pull
```

## The migrations

| # | Name | What it does |
|---|---|---|
| 1 | `kb_foundation` | schema, pgvector, embedding config, ranking weights, recency curve, brands/strategies/pillars |
| 2 | `kb_documents` | `documents`, `document_chunks`, the dimension guard, the ingest queue |
| 3 | `kb_content_and_logging` | `published_content`, `content_ideas`, `hooks`, `retrieval_log` |
| 4 | `kb_knowledge_layer` | phase 3: `document_summaries`, `topics`, `topic_insights`, `retrieval_settings` |
| 5 | `kb_scoring` | `recency_score`, `strategic_score`, `search_chunks` |
| 6 | `kb_search_tools` | `search_transcripts`, `search_research`, `search_previous_content`, `search_content_ideas`, `search_hooks` |
| 7 | `kb_retrieval_service` | `assess_repetition`, `log_retrieval`, `save_idea`, `retrieve` |
| 8 | `kb_retrieve_limit_fix` | `p_limit` was applied to the aggregate row rather than the rows aggregated, so it did nothing |
| 9 | `kb_security_and_api` | RLS on every table, grants, the `public.kb_*` wrappers |
| 10 | `kb_keyword_recall` | OR matching with an all-terms bonus; `websearch_to_tsquery` ANDed every term and returned nothing for ordinary questions |
| 11 | `kb_write_rpcs` | `kb_upsert_document`, `kb_replace_chunks`, `kb_set_embeddings`, `kb_upsert_published` |
| 12 | `kb_pipeline_read_rpcs` | queue readers, `kb_save_summary`, `kb_save_insight` |
| 13 | `kb_ready_without_embeddings` | a document is retrievable once chunked; holding it until every chunk had a vector hid the whole corpus when no embedding key was set |
| 14 | `kb_content_mirror_source` | pages in `content` not yet mirrored into `published_content` |
| 15 | `kb_hook_seed_rpcs` | hook patterns not yet adapted into the hook library |
| 16 | `kb_pin_search_path` | pinned `search_path` on all 25 kb functions |
| 36 | `kb_link_create_skip_partial` | pasting a link again hands back the read we already have, but only a real one: a partial read is a video whose words could not be got, and caching that meant the first paste after the transcript service was wired up returned the description again without asking anyone for a transcript |
| 35 | `kb_links_transcript_job` | a transcript that has to be generated rather than fetched comes back as a job that can take minutes, which is far longer than a Worker should wait: `links.job_id` parks it, `kb_link_job` stores it alongside what is already known about the video, and the page's own polling of `/links/read` is what collects the result. The body saved at that point is the description, kept as the fallback if the job fails |
| 34 | `kb_links` | a link pasted on the Plan page: `links` (url, canonical url, kind, the extracted text, whether it is partial, the document it became) and `kb_link_create` / `_ready` / `_failed` / `_read` plus `kb_links` for the Worker. Pasting the same canonical url inside 30 days hands back the row already read rather than fetching it again |
| 33 | `kb_recordings` + `kb_recordings_own_bucket` | voice recordings from the Recordings page: `recordings` (audio path, transcript, words, status, the document its transcript became), `kb_recording_create` / `_ready` / `_failed` / `_read` / `_rename` / `_delete` and `kb_recordings` for the Worker, and the private `kb-recordings` bucket with anon insert/read/delete on it. The second migration exists because `recordings` was already taken: another AIKO tool made a public bucket of that name in May, and the first migration's `on conflict do nothing` would have put private audio in it |
| 32 | `kb_video_edit_remake_and_script` | the Edit page's re-make and script panel: `video_edits` gains `mode` (`exact` / `remake`; a video without a kept source is always re-made; 3 re-makes a day inside the 10 edits) and `script_changes` (`[{line, from, to}]`, checked against the lines saved in the video's `metadata.script`); `kb_video_request_edit(uuid, jsonb, text, jsonb)` replaces the two-argument version; `kb_video_edit_start` and the library's `last_edit` carry the mode; `kb_video_script` (open, for the Worker) reads a video's lines; `kb_video_scripts_missing` / `kb_video_set_script` (service role) are for the backfill-scripts workflow |
| 31 | `kb_video_edit_newest_only` | `kb_video_request_edit` refuses any version of a video but the newest (`newer: true`), so a page loaded before another edit finished can't overwrite it; the Edit page then moves the unsent notes onto the newer version |
| 30 | `kb_app_users` | who may use the app: the allowlist the Worker checks at sign-in and on every request, and `kb_app_user_allowed` (anon, for the Worker). Supabase Auth is shared with other AIKO tools, so nothing is added to `auth.users` |
| 29 | `kb_plan_renders` | the Plan page's Render button: `plan_renders` is the once-per-plan guard and the ledger for a 12-videos-a-day cap (a failed start still counts); `kb_plan_request_render` (open) and `kb_plan_render_abandon` for the Worker |
| 28 | `kb_video_edit_notes` | edits arrive from the Edit tab as notes (`notes` jsonb: up to 8, each optionally pinned to a moment in seconds); `kb_video_request_edit(uuid, jsonb)` replaces the text version and refuses videos not in Ready to review; `kb_video_edit_start` also returns the notes and the video's storage path, for the frame grabs |
| 28a | `kb_video_edit_finish_guard` | an edit's outcome can only be recorded while it is queued or running |
| 27 | `kb_video_edits` | typed edits to finished videos: the `video_edits` queue, the private `video-sources` bucket, `kb_video_request_edit` (open, rate-limited) and `kb_video_edit_abandon` for the Worker, `kb_video_edit_start` / `kb_video_edit_finish` for the workflow; the library gains `has_source` and `last_edit` |
| 26 | `kb_video_review` | replaces 25: `review_status` (`to_post` / `rejected`, null = ready to review) and `reviewed_at`, set by `kb_video_set_review`; rows marked posted carry over as `to_post`, and `posted_at` and `kb_video_set_posted` are dropped |
| 25 | `kb_video_posted` | `posted_at` on renders, the library returns it, and `kb_video_set_posted` marks or unmarks a finished video (the Worker gates it with the team token) |
| 24 | `kb_video_library` | finished videos for the Output page: rendered only, newest per slot, title and opening line from the plan |
| 23 | `kb_video_renders` | the videos bucket and the row tying each render back to its brief |
| 22 | `kb_plans_ready_to_render` | locked plans, newest first — how briefs reach CI without a committed file |
| 21 | `kb_effectiveness_resolve_urls` | resolve cited URLs to row ids, or the section 39 metric reads zero forever |
| 20 | `kb_retrieval_effectiveness` | the section 39 metric as a view: how many retrieved sources reached a saved idea |
| 19 | `kb_planning_sessions` | durable plan storage, bulk retrieval logging |
| 18 | `kb_mirror_canonical_url` | one row per real page: the content corpus holds every page twice, under `www.` and bare hostnames |
| 17 | `kb_upload_rpcs` | `kb_upload_document` and `kb_upload_chunks` — the only write path anon can reach, contained to the `upload:` source-key namespace |

Three of these — 8, 10 and 13 — are corrections to earlier ones in the same
batch, kept as separate migrations rather than folded back so the reasoning
stays readable. Each is described in the migration's own comment.
