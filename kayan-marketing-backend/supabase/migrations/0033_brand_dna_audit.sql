-- Migration 0033: Brand DNA audit log + atomic update RPC.
--
-- Lets the marketer edit dna_markdown + voice_config from inside the app
-- without losing history. Every save snapshots the PREVIOUS values into
-- brand_dna_history before writing the new row, so:
--   - "What did the AI prompt look like yesterday?" → query history
--   - "Restore last week's version" → POST /brand-dna/restore/:id
--
-- The trigger pattern (snapshot-then-update) lives inside the RPC rather
-- than as a Postgres trigger so the change_note can flow through. Triggers
-- can't see the calling user's intent; an explicit RPC can.
--
-- Idempotent: `if not exists` on table + index + policy, `or replace` on
-- function.

create table if not exists brand_dna_history (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  edited_by uuid references app_users(id) on delete set null,
  dna_markdown text,
  voice_config jsonb,
  change_note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_brand_dna_history_brand_created
  on brand_dna_history(brand_id, created_at desc);

alter table brand_dna_history enable row level security;
drop policy if exists "brand_dna_history_authenticated_full_access" on brand_dna_history;
create policy "brand_dna_history_authenticated_full_access"
  on brand_dna_history for all to authenticated
  using (true) with check (true);

-- Atomic save: snapshot current → write new → return updated row.
-- p_change_note is optional; null means "no note recorded".
create or replace function update_brand_dna(
  p_brand_id uuid,
  p_dna_markdown text,
  p_voice_config jsonb,
  p_edited_by uuid,
  p_change_note text default null
) returns brands
language plpgsql
security definer
as $$
declare
  v_brand brands;
begin
  -- Snapshot the OLD values into history BEFORE the update so a restore
  -- always finds a row to roll back to.
  insert into brand_dna_history (brand_id, edited_by, dna_markdown, voice_config, change_note)
  select id, p_edited_by, dna_markdown, voice_config, p_change_note
  from brands
  where id = p_brand_id;

  update brands
  set
    dna_markdown = p_dna_markdown,
    voice_config = p_voice_config,
    updated_at = now()
  where id = p_brand_id
  returning * into v_brand;

  return v_brand;
end;
$$;
