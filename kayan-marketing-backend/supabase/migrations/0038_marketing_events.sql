-- Migration 0038: Marketing events reference calendar.
--
-- Lightweight yearly context layer for Saudi/Kayan planning moments:
-- public holidays, school breaks, religious seasons, and retail windows.
-- These are not campaigns. Campaigns and calendar entries can be planned
-- around them later, but the event row itself stays a reference point.

create table if not exists marketing_events (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  title text not null,
  event_type text not null check (event_type in (
    'public_holiday',
    'religious_season',
    'school_calendar',
    'retail_season',
    'brand_opportunity'
  )),
  importance text not null check (importance in (
    'mega',
    'major',
    'soft',
    'reference'
  )),
  start_date date not null,
  end_date date not null,
  description text,
  marketing_notes text,
  branch_focus text[] not null default '{}'::text[],
  source_note text,
  is_date_estimate boolean not null default false,
  estimate_reason text,
  status text not null default 'active' check (status in ('active', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_events_date_order check (end_date >= start_date),
  unique (brand_id, title, start_date)
);

create index if not exists idx_marketing_events_brand_dates
  on marketing_events(brand_id, start_date, end_date);

create index if not exists idx_marketing_events_brand_importance
  on marketing_events(brand_id, importance, start_date);

drop trigger if exists marketing_events_set_updated_at on marketing_events;
create trigger marketing_events_set_updated_at
  before update on marketing_events
  for each row execute function set_updated_at();

alter table marketing_events enable row level security;
drop policy if exists "marketing_events_authenticated_full_access" on marketing_events;
create policy "marketing_events_authenticated_full_access"
  on marketing_events for all to authenticated
  using (true) with check (true);

do $$
declare
  v_brand_id uuid;
begin
  select id into v_brand_id
  from brands
  where lower(brand_code) = 'kayan'
  limit 1;

  if v_brand_id is null then
    raise notice 'No brand with code KAYAN found; skipping marketing events seed.';
    return;
  end if;

  insert into marketing_events (
    brand_id,
    title,
    event_type,
    importance,
    start_date,
    end_date,
    description,
    marketing_notes,
    branch_focus,
    source_note,
    is_date_estimate,
    estimate_reason,
    metadata
  ) values
    (
      v_brand_id,
      'New Year',
      'brand_opportunity',
      'soft',
      '2026-01-01',
      '2026-01-01',
      'Light international calendar moment. Not a Saudi public holiday for most retail planning.',
      'Use only as a soft fresh-start snack or gifting angle if content capacity allows.',
      array['all'],
      'Reference planning note; low-priority retail opportunity.',
      false,
      null,
      '{"season":"year_start"}'::jsonb
    ),
    (
      v_brand_id,
      'Mid-year school break',
      'school_calendar',
      'major',
      '2026-01-09',
      '2026-01-17',
      'School break window during the 2025-2026 academic year.',
      'Family packs, kids at home snacks, and value bundles.',
      array['all'],
      'Saudi school calendar references list mid-year holiday from Jan 9 to Jan 17, 2026.',
      false,
      null,
      '{"school_year":"2025-2026"}'::jsonb
    ),
    (
      v_brand_id,
      'Ramadan begins',
      'religious_season',
      'mega',
      '2026-02-18',
      '2026-02-18',
      'Expected start of Ramadan 1447 AH.',
      'Begin Ramadan daily content rhythm: iftar gatherings, family stock-up, abundance, and fixed-price value.',
      array['all'],
      'Listed by public holiday calendars as Ramadan begins on Feb 18, 2026; lunar dates depend on moon sighting.',
      true,
      'Islamic lunar date; official observance depends on moon sighting.',
      '{"season":"ramadan"}'::jsonb
    ),
    (
      v_brand_id,
      'Saudi Founding Day',
      'public_holiday',
      'major',
      '2026-02-22',
      '2026-02-22',
      'Annual Saudi Founding Day public holiday.',
      'Heritage-led content, Saudi pride displays, and branch-level national storytelling.',
      array['all'],
      'MHRSD announced Feb 22, 2026 as the official Founding Day holiday.',
      false,
      null,
      '{"fixed_annual_date":"02-22"}'::jsonb
    ),
    (
      v_brand_id,
      'Eid Al-Fitr school break',
      'school_calendar',
      'major',
      '2026-03-06',
      '2026-03-28',
      'School break around Eid Al-Fitr.',
      'Plan kids gifting, family visits, and long-break snack bundles.',
      array['all'],
      'Saudi school calendar references list Eid Al-Fitr school break from Mar 6 to Mar 28, 2026.',
      false,
      null,
      '{"school_year":"2025-2026","season":"eid_al_fitr"}'::jsonb
    ),
    (
      v_brand_id,
      'Eid Al-Fitr holiday window',
      'religious_season',
      'mega',
      '2026-03-20',
      '2026-03-23',
      'Expected Eid Al-Fitr holiday window.',
      'Ready-to-gift bundles, boxed chocolates, children gifts, and family visit baskets.',
      array['all'],
      'Public holiday calendars list Eid Al-Fitr around Mar 20, 2026; financial-sector holiday references run Mar 17-23.',
      true,
      'Islamic lunar date; official observance depends on Shawwal moon sighting.',
      '{"season":"eid_al_fitr"}'::jsonb
    ),
    (
      v_brand_id,
      'Eid Al-Adha school break',
      'school_calendar',
      'major',
      '2026-05-22',
      '2026-06-01',
      'School break around Eid Al-Adha.',
      'Family bundles, road-trip snacks, and long-break gifting.',
      array['all'],
      'Saudi school calendar references list Eid Al-Adha holiday from May 22 to Jun 1, 2026.',
      false,
      null,
      '{"school_year":"2025-2026","season":"eid_al_adha"}'::jsonb
    ),
    (
      v_brand_id,
      'Hajj season peak',
      'religious_season',
      'mega',
      '2026-05-25',
      '2026-05-31',
      'Peak Hajj ritual window, including Mina, Arafah, Eid Al-Adha, and Tashreeq days.',
      'Holy-city branches should push pilgrim-friendly packaged snacks, take-home gifts, and multilingual in-store clarity.',
      array['Makkah','Madina','Al Haramain'],
      'Astronomical Hajj 2026 references place 8-13 Dhu Al-Hijjah around May 25-30/31, 2026.',
      true,
      'Islamic lunar date; official observance depends on Dhu Al-Hijjah moon sighting.',
      '{"season":"hajj"}'::jsonb
    ),
    (
      v_brand_id,
      'Day of Arafah',
      'religious_season',
      'major',
      '2026-05-26',
      '2026-05-26',
      'Expected Day of Arafah.',
      'Keep tone respectful; useful for holy-city operational planning more than playful content.',
      array['Makkah','Madina','Al Haramain'],
      'Astronomical Hajj references place Arafah on May 26, 2026.',
      true,
      'Islamic lunar date; official observance depends on Dhu Al-Hijjah moon sighting.',
      '{"season":"hajj","day":"arafah"}'::jsonb
    ),
    (
      v_brand_id,
      'Eid Al-Adha',
      'religious_season',
      'mega',
      '2026-05-27',
      '2026-05-30',
      'Expected Eid Al-Adha holiday window.',
      'Family gifting, boxed chocolates, road-trip snacks, and pilgrim take-home products.',
      array['all','Makkah','Madina','Al Haramain'],
      'Public holiday calendars list Eid Al-Adha around May 27, 2026; date remains tentative until moon sighting.',
      true,
      'Islamic lunar date; official observance depends on Dhu Al-Hijjah moon sighting.',
      '{"season":"eid_al_adha"}'::jsonb
    ),
    (
      v_brand_id,
      'Islamic New Year 1448',
      'religious_season',
      'soft',
      '2026-06-16',
      '2026-06-16',
      'Expected start of Hijri year 1448 AH.',
      'Soft reflection moment; low-pressure content only.',
      array['all'],
      'Hijri New Year 1448 is commonly estimated around Jun 16, 2026.',
      true,
      'Islamic lunar date; official observance depends on moon sighting.',
      '{"season":"hijri_new_year"}'::jsonb
    ),
    (
      v_brand_id,
      'Summer vacation begins',
      'school_calendar',
      'major',
      '2026-06-25',
      '2026-06-25',
      'End of 2025-2026 school year and start of summer vacation.',
      'End-of-school celebrations, kids party packs, and summer snack stock-up.',
      array['all'],
      'Saudi academic-calendar references list summer vacation starting Jun 25, 2026.',
      false,
      null,
      '{"school_year":"2025-2026","season":"summer"}'::jsonb
    ),
    (
      v_brand_id,
      'Back-to-school retail window',
      'retail_season',
      'mega',
      '2026-08-01',
      '2026-08-22',
      'Pre-school shopping window before students return.',
      'Lunchbox snacks, parent bulk-buy bundles, kids favorites, and week-of-school snack packs.',
      array['all'],
      'Planning window based on students returning Aug 23, 2026.',
      false,
      null,
      '{"season":"back_to_school"}'::jsonb
    ),
    (
      v_brand_id,
      'Students return to school',
      'school_calendar',
      'mega',
      '2026-08-23',
      '2026-08-23',
      'Start of the 2026-2027 academic year for students.',
      'First-week lunchbox content and family routine messaging.',
      array['all'],
      'Saudi academic roadmap references the 2026-2027 school year beginning Aug 23, 2026.',
      false,
      null,
      '{"school_year":"2026-2027","season":"back_to_school"}'::jsonb
    ),
    (
      v_brand_id,
      'Saudi National Day',
      'public_holiday',
      'mega',
      '2026-09-23',
      '2026-09-23',
      'Annual Saudi National Day public holiday.',
      'Green-and-white displays, Saudi-loved product spotlights, heritage content, and national bundles.',
      array['all'],
      'Fixed annual Saudi National Day date: Sep 23.',
      false,
      null,
      '{"fixed_annual_date":"09-23","season":"national_day"}'::jsonb
    ),
    (
      v_brand_id,
      'Autumn school break planning window',
      'school_calendar',
      'soft',
      '2026-11-20',
      '2026-11-28',
      'Expected late-November school break planning window.',
      'Family activity packs, road-trip snacks, and kids-at-home bundles.',
      array['all'],
      'Planning estimate based on the prior academic-year autumn break pattern; confirm when the 2026-2027 detailed calendar is published.',
      true,
      'Detailed 2026-2027 break dates should be confirmed from the latest Ministry of Education calendar.',
      '{"school_year":"2026-2027","season":"autumn_break"}'::jsonb
    )
  on conflict (brand_id, title, start_date) do update
  set
    event_type = excluded.event_type,
    importance = excluded.importance,
    end_date = excluded.end_date,
    description = excluded.description,
    marketing_notes = excluded.marketing_notes,
    branch_focus = excluded.branch_focus,
    source_note = excluded.source_note,
    is_date_estimate = excluded.is_date_estimate,
    estimate_reason = excluded.estimate_reason,
    metadata = excluded.metadata,
    updated_at = now();
end $$;
