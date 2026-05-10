-- Migration 0044: rename pattern P8 → "Treasure Hunt Challenge".
--
-- The original "Dual-Commentator Dash" framing pushed the AI toward a
-- sports-broadcast format with two presenters. The marketer's actual
-- intent for this slot is a single-host treasure hunt with a timer and
-- a reveal beat. We rename the pattern, replace its Brand DNA
-- description with the format the marketer actually shoots, and update
-- the cached `voice_config.patterns[]` array on the brand row to match.
--
-- Idempotent: each statement is a targeted UPDATE that's safe to re-run.

-- Update the structured patterns array inside voice_config (jsonb).
update brands
set voice_config = jsonb_set(
  voice_config,
  '{patterns}',
  (
    select coalesce(
      jsonb_agg(
        case
          when (p->>'id') = 'P8'
            then jsonb_set(p, '{name}', '"Treasure Hunt Challenge"'::jsonb)
          else p
        end
        order by ord
      ),
      '[]'::jsonb
    )
    from jsonb_array_elements(voice_config -> 'patterns')
      with ordinality as t(p, ord)
  )
)
where voice_config ? 'patterns';

-- Replace the P8 description block in the Brand DNA markdown. Matches
-- from the `### P8` heading through the blank line before `### P9`.
update brands
set dna_markdown = regexp_replace(
  dna_markdown,
  E'### P8 — [^\\n]*\\n[^\\n]*\\n[^\\n]*\\n',
  E'### P8 — Treasure Hunt Challenge\nSingle host hides items in the store and gives a contestant a timer to find them; live reactions during, then a reveal beat showing what was inside, then "be next" CTA.\nBeats: setup the rules → start the timer → quick-fire reactions ("ماشاء الله", "كفو عليك") → wrap on time-up → reveal items together → invite viewers to participate.\n'
)
where dna_markdown is not null
  and dna_markdown ~ '### P8 — ';
