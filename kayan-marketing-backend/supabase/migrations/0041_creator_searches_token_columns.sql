-- Migration 0041: Claude token columns on creator_searches.
--
-- Records per-run token usage for the Chunk 5 scoring call. Chunk 6 will
-- multiply these by Haiku's per-token pricing to populate
-- creator_search_costs.claude_cost_usd. Stored as integers (Anthropic
-- returns whole-token counts).
--
-- Idempotent: `add column if not exists`.

alter table creator_searches
  add column if not exists claude_prompt_tokens integer not null default 0
    check (claude_prompt_tokens >= 0);

alter table creator_searches
  add column if not exists claude_completion_tokens integer not null default 0
    check (claude_completion_tokens >= 0);
