-- Migration 0045: bilingual topic fields.
--
-- Adds `title_en` and `description_en` so each topic carries an Arabic
-- and an English version. The existing `title` / `description` columns
-- become the primary (Arabic) fields going forward; entries created
-- before this migration may be in mixed languages — that's OK, the UI
-- falls back to whichever field has content.
--
-- Idempotent: `add column if not exists`.

alter table topics
  add column if not exists title_en text,
  add column if not exists description_en text;
