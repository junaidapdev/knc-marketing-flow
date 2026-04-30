-- Authoring fields for the Entry Detail Panel's Content section.
-- These are filled in asynchronously by the content creator after the entry
-- is planned — never at create-time. So the create_entry_with_tasks RPC
-- doesn't need to know about them; only the calendar-entries PATCH endpoint
-- writes here.
--
--   script    — the long-form video script (TikTok / IG Reel)
--   caption   — the publishing caption (any social post)
--   hashtags  — free-form text (e.g. "#KayanSweets #حلويات_كيان"), kept as a
--               single string so the marketer types it once and copies it
--               verbatim into the platform; not an array.

alter table calendar_entries
  add column script text,
  add column caption text,
  add column hashtags text;
