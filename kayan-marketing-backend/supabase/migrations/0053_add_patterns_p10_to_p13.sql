-- Migration 0053: Add Recipe Book patterns P10-P13 to voice_config.patterns.
--
-- Migration 0028 seeded P1-P9. As more high-performing posts get analyzed,
-- the operator catalogs new patterns; full descriptions live in brand DNA
-- markdown (editable from Settings → Brand DNA), but the AI Edge Functions
-- look up pattern NAMES from voice_config.patterns. So the JSON array has to
-- carry every pattern id the frontend exposes, otherwise lookups fall back
-- to the bare id with no friendly name in the AI brief.
--
-- New entries:
--   P10 — Visual Shock Prop          (Tier 2)
--   P11 — Executive Authority Flex   (Tier 2)
--   P12 — Pyrotechnic Reveal         (Tier 2)
--   P13 — DIY Problem-Solver         (Tier 1.5)
--
-- Tier classification stays in the DNA markdown — the voice_config array
-- only stores id + name to mirror constants/patterns.ts.
--
-- IDEMPOTENT: the WHERE clause skips the update if P10 is already in the
-- patterns array, so re-running is a no-op. Safe to apply on a DB that's
-- already had this migration run.

update brands
set voice_config = jsonb_set(
  voice_config,
  '{patterns}',
  coalesce(voice_config -> 'patterns', '[]'::jsonb) || '[
    {"id": "P10", "name": "Visual Shock Prop"},
    {"id": "P11", "name": "Executive Authority Flex"},
    {"id": "P12", "name": "Pyrotechnic Reveal"},
    {"id": "P13", "name": "DIY Problem-Solver"}
  ]'::jsonb
)
where not (coalesce(voice_config -> 'patterns', '[]'::jsonb) @> '[{"id": "P10"}]'::jsonb);
