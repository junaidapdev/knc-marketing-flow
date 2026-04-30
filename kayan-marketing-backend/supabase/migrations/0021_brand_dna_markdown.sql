-- Long-form, marketer-edited brand bible. Injected verbatim into every AI
-- system prompt so generated scripts/captions sound like Kayan, not generic.
-- Lives alongside the structured `voice_config` jsonb (tone, languages,
-- audience, do/don't say) which stays as-is.
alter table brands
  add column dna_markdown text;
