-- Migration 0037: Seed 10 categories + ~50 starter products + branch links.
--
-- This is a STARTER catalog — Kayan's real SKU count is 2,500+ but only ~50
-- products realistically matter for content. The marketer extends this list
-- via Settings → Products as patterns emerge.
--
-- Idempotent: every insert uses `on conflict do nothing` against the unique
-- constraints on (brand_id, name) for categories + products and
-- (product_id, branch_id) for the junction.
--
-- brand_code match is case-insensitive so the seed runs against either
-- 'KAYAN' (current seed.sql) or 'kayan' (spec convention).

do $$
declare
  v_brand_id uuid;
  v_cat_gummies     uuid;
  v_cat_intense     uuid;
  v_cat_chocolates  uuid;
  v_cat_boxed       uuid;
  v_cat_savory      uuid;
  v_cat_pretzels    uuid;
  v_cat_biscuits    uuid;
  v_cat_ulker       uuid;
  v_cat_soft        uuid;
  v_cat_pantry      uuid;
begin
  select id into v_brand_id
  from brands
  where lower(brand_code) = 'kayan'
  limit 1;
  if v_brand_id is null then
    raise notice 'No brand with code KAYAN found; skipping product seed.';
    return;
  end if;

  -- ───── Categories ─────
  insert into product_categories (brand_id, name, display_order, description) values
    (v_brand_id, 'Gummies & Jellies',         1, 'Soft chewy candies'),
    (v_brand_id, 'Intense & Novelty Sweets',  2, 'Sour, fizzy, novelty candies'),
    (v_brand_id, 'Chocolates & Toffees',      3, 'Standard chocolate aisle'),
    (v_brand_id, 'Boxed Chocolates',          4, 'Premium gift-ready chocolates — only at select branches'),
    (v_brand_id, 'Savory Chips & Extruded',   5, 'Chips and savory snacks'),
    (v_brand_id, 'Pretzels & Crackers',       6, 'Pretzels, crackers, salty bites'),
    (v_brand_id, 'Biscuits & Wafers',         7, 'Biscuits, cookies, wafers'),
    (v_brand_id, 'Ülker Exclusive Aisle',     8, 'Dedicated branded section for Ülker products'),
    (v_brand_id, 'Soft Sweets & Cakes',       9, 'Cakes, soft sweets, marshmallow'),
    (v_brand_id, 'Pantry & Spreads',          10, 'Spreads, syrups, pantry essentials')
  on conflict (brand_id, name) do nothing;

  -- Resolve category ids (re-runnable: looks up after the on-conflict).
  select id into v_cat_gummies     from product_categories where brand_id = v_brand_id and name = 'Gummies & Jellies';
  select id into v_cat_intense     from product_categories where brand_id = v_brand_id and name = 'Intense & Novelty Sweets';
  select id into v_cat_chocolates  from product_categories where brand_id = v_brand_id and name = 'Chocolates & Toffees';
  select id into v_cat_boxed       from product_categories where brand_id = v_brand_id and name = 'Boxed Chocolates';
  select id into v_cat_savory      from product_categories where brand_id = v_brand_id and name = 'Savory Chips & Extruded';
  select id into v_cat_pretzels    from product_categories where brand_id = v_brand_id and name = 'Pretzels & Crackers';
  select id into v_cat_biscuits    from product_categories where brand_id = v_brand_id and name = 'Biscuits & Wafers';
  select id into v_cat_ulker       from product_categories where brand_id = v_brand_id and name = 'Ülker Exclusive Aisle';
  select id into v_cat_soft        from product_categories where brand_id = v_brand_id and name = 'Soft Sweets & Cakes';
  select id into v_cat_pantry      from product_categories where brand_id = v_brand_id and name = 'Pantry & Spreads';

  -- ───── Products ─────
  insert into products (brand_id, category_id, name, manufacturer, price_tier, is_hero_product, is_trending, marketing_notes, tags) values
    -- Gummies & Jellies
    (v_brand_id, v_cat_gummies,     'Borgat Gummies',          'Borgat',       'anchor',      true,  false, 'Signature gummy line, mid-aisle placement, kids favorite', array['kids','gummy']),
    (v_brand_id, v_cat_gummies,     'Zello',                   'Zello',        'anchor',      false, false, 'Premium imported gummies', array['imported']),

    -- Intense & Novelty
    (v_brand_id, v_cat_intense,     'TNT Super Sour',          'TNT',          'anchor',      true,  true,  'Viral sour candy, big with teens', array['sour','viral','teens']),
    (v_brand_id, v_cat_intense,     'Squeezy Squirt',          'Squeezy',      'anchor',      false, false, 'Liquid candy, fun format', array['novelty']),
    (v_brand_id, v_cat_intense,     'Nerds',                   'Wonka',        'anchor',      false, false, 'Crunchy mini candies', array['imported']),

    -- Chocolates & Toffees
    (v_brand_id, v_cat_chocolates,  'Tiffany Toffees',         'Tiffany',      'anchor',      true,  false, 'Impulse zone near register, classic Saudi favorite', array['classic','impulse']),
    (v_brand_id, v_cat_chocolates,  'Marmo',                   'Marmo',        'anchor',      false, false, 'Italian section', array['imported','italian']),
    (v_brand_id, v_cat_chocolates,  'Pepero',                  'Lotte',        'anchor',      true,  true,  'Korean chocolate sticks, viral on TikTok', array['korean','viral','imported']),
    (v_brand_id, v_cat_chocolates,  'Funzels',                 'Funzels',      'anchor',      false, false, 'Kids favorite, fun packaging', array['kids']),
    (v_brand_id, v_cat_chocolates,  'Amada',                   'Amada',        'anchor',      false, false, 'Standard chocolate option', array[]::text[]),
    (v_brand_id, v_cat_chocolates,  'Godiva',                  'Godiva',       'open_price',  true,  false, 'Premium imported chocolate — outside price 30 SR, Kayan price 11.50 SR (signature value-comparison product)', array['imported','premium','comparison']),

    -- Boxed Chocolates (premium tier — only at 7 branches, see junction below)
    (v_brand_id, v_cat_boxed,       'Fahadah',                 'Fahadah',      'premium',     true,  false, 'Premium gift-ready boxed chocolate, gift occasions', array['gift','premium','boxed']),
    (v_brand_id, v_cat_boxed,       'Mazak Larbi',             'Mazak Larbi',  'premium',     true,  false, 'Moroccan-style premium chocolate', array['gift','premium','moroccan','boxed']),

    -- Savory
    (v_brand_id, v_cat_savory,      'Pringles',                'Pringles',     'anchor',      false, false, 'Iconic chips, multiple flavors', array['imported','classic']),
    (v_brand_id, v_cat_savory,      'Cheetos',                 'Cheetos',      'anchor',      false, false, 'Cheese chips', array['classic']),
    (v_brand_id, v_cat_savory,      'Doritos',                 'Doritos',      'anchor',      false, false, 'Triangle chips', array['classic']),
    (v_brand_id, v_cat_savory,      'Chips Oman',              'Chips Oman',   'anchor',      true,  false, 'Regional vintage favorite — strong nostalgia hook', array['regional','nostalgia','vintage']),
    (v_brand_id, v_cat_savory,      'Al Batal',                'Al Batal',     'anchor',      false, false, 'Local chips brand', array['local']),
    (v_brand_id, v_cat_savory,      'Marami',                  'Marami',       'anchor',      false, false, 'Local snacks', array['local']),
    (v_brand_id, v_cat_savory,      'Tarazan Chips 24-pack',   'Tarazan',      'bulk',        true,  true,  '24-piece bundle for 11.50 — strongest bulk deal in the chips category', array['bulk','family','viral']),
    (v_brand_id, v_cat_savory,      'Salaam Oman',             'Salaam',       'anchor',      true,  false, 'Vintage regional chips — strong nostalgia, ASMR demo product', array['regional','nostalgia','asmr']),

    -- Pretzels & Crackers
    (v_brand_id, v_cat_pretzels,    'Pretzo',                  'Pretzo',       'anchor',      false, false, 'Classic pretzel sticks', array[]::text[]),
    (v_brand_id, v_cat_pretzels,    'Savi Stix',               'Savi',         'anchor',      false, false, 'Stick crackers', array[]::text[]),
    (v_brand_id, v_cat_pretzels,    'Snack Toasted',           'Snack Toasted','anchor',      false, false, 'Toasted savory snack', array[]::text[]),

    -- Biscuits & Wafers
    (v_brand_id, v_cat_biscuits,    'McVitie''s',              'McVitie''s',   'anchor',      false, false, 'British biscuits classic', array['imported','british']),
    (v_brand_id, v_cat_biscuits,    'belVita',                 'Mondelez',     'anchor',      false, false, 'Breakfast biscuits', array['imported','breakfast']),
    (v_brand_id, v_cat_biscuits,    'Ritz',                    'Mondelez',     'anchor',      false, false, 'Salted crackers', array['imported']),
    (v_brand_id, v_cat_biscuits,    'Deemah',                  'Deemah',       'anchor',      false, false, 'Saudi biscuit brand', array['local']),
    (v_brand_id, v_cat_biscuits,    'Alpella',                 'Alpella',      'anchor',      false, false, 'Turkish biscuits', array['imported','turkish']),
    (v_brand_id, v_cat_biscuits,    'Al Batal Maamoul',        'Al Batal',     'bulk',        false, false, 'Bulk maamoul cartons — family-size value', array['bulk','family','ramadan']),

    -- Ülker
    (v_brand_id, v_cat_ulker,       'Biskrem',                 'Ülker',        'anchor',      true,  false, 'Iconic Ülker filled biscuit', array['turkish','iconic']),
    (v_brand_id, v_cat_ulker,       'Halley',                  'Ülker',        'anchor',      true,  false, 'Ülker marshmallow biscuit, kids favorite', array['turkish','kids']),
    (v_brand_id, v_cat_ulker,       'Kat Kat Tat',             'Ülker',        'anchor',      false, false, 'Crunchy wafer', array['turkish']),

    -- Soft Sweets & Cakes
    (v_brand_id, v_cat_soft,        'Switz Cakes',             'Switz',        'anchor',      true,  false, 'Soft individual cakes, lunchbox classic', array['cakes','lunchbox']),
    (v_brand_id, v_cat_soft,        'Yamama',                  'Yamama',       'anchor',      false, false, 'Soft cakes', array['cakes']),
    (v_brand_id, v_cat_soft,        'Nahool',                  'Nahool',       'anchor',      false, false, 'Sweet snacks', array[]::text[]),
    (v_brand_id, v_cat_soft,        'Fleek',                   'Fleek',        'anchor',      false, false, 'Soft sweets', array[]::text[]),
    (v_brand_id, v_cat_soft,        'Nom Noms',                'Nom Noms',     'anchor',      false, false, 'Soft sweet bites', array[]::text[]),
    (v_brand_id, v_cat_soft,        'Japanese Pistachio Cake', 'Various',      'anchor',      true,  true,  'Newly arrived flavor — viral, trending, hero piece for new arrivals reels', array['new','viral','japanese','pistachio']),
    (v_brand_id, v_cat_soft,        'Japanese Square Cake',    'Various',      'anchor',      false, true,  'Square format Japanese cake — alternative shape', array['japanese','trending']),
    (v_brand_id, v_cat_soft,        'Fluffy Pancake',          'Fluffy',       'anchor',      false, true,  'Sponge pancake with chocolate filling — sensory appeal for ASMR', array['asmr','sensory']),

    -- Pantry & Spreads
    (v_brand_id, v_cat_pantry,      'Umbrella',                'Umbrella',     'anchor',      false, false, 'Pantry brand', array[]::text[]),
    (v_brand_id, v_cat_pantry,      'Hershey''s',              'Hershey''s',   'anchor',      false, false, 'Chocolate spreads', array['imported']),
    (v_brand_id, v_cat_pantry,      'Pluto',                   'Pluto',        'anchor',      false, false, 'Pantry brand', array[]::text[]),
    (v_brand_id, v_cat_pantry,      'Nova',                    'Nova',         'anchor',      false, false, 'Pantry brand', array[]::text[]),
    (v_brand_id, v_cat_pantry,      'Gandour',                 'Gandour',      'anchor',      false, false, 'Lebanese pantry classic', array['lebanese']),
    (v_brand_id, v_cat_pantry,      'Quaker Oats',             'Quaker',       'anchor',      false, false, 'Breakfast oats', array['imported','breakfast']),
    (v_brand_id, v_cat_pantry,      'Nadec Milk 1L',           'Nadec',        'anchor',      false, false, 'Saudi dairy', array['local','family']),
    (v_brand_id, v_cat_pantry,      'Red Bull',                'Red Bull',     'anchor',      false, false, 'Energy drink — outside 15 SR, Kayan 11.50 SR (comparison product)', array['imported','comparison'])
  on conflict (brand_id, name) do nothing;

  -- ───── product_branches links ─────

  -- Anchor / bulk / open_price → all branches.
  insert into product_branches (product_id, branch_id)
  select p.id, b.id
  from products p
  cross join branches b
  where p.brand_id = v_brand_id
    and b.brand_id = v_brand_id
    and p.price_tier in ('anchor', 'bulk', 'open_price')
  on conflict (product_id, branch_id) do nothing;

  -- Premium (boxed chocolates) → only the 7 branches with the dedicated section.
  insert into product_branches (product_id, branch_id)
  select p.id, b.id
  from products p
  cross join branches b
  where p.brand_id = v_brand_id
    and b.brand_id = v_brand_id
    and p.price_tier = 'premium'
    and b.name in (
      'Al Salama', 'Al Sanabil', 'Abhur', 'Al Haramain',
      'Al Rusaifah', 'Al Awali', 'Al Shaddha'
    )
  on conflict (product_id, branch_id) do nothing;
end $$;
