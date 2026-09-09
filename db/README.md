# Schema

The `kb` schema is defined by 16 migrations applied to the Supabase project
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

Three of these — 8, 10 and 13 — are corrections to earlier ones in the same
batch, kept as separate migrations rather than folded back so the reasoning
stays readable. Each is described in the migration's own comment.
