-- Brand: Kayan Sweets
insert into brands (id, name, brand_code, primary_color, voice_config) values (
  '11111111-1111-1111-1111-111111111111',
  'Kayan Sweets',
  'KAYAN',
  '#FFD700',
  '{
    "tone": "warm, energetic, youth-forward, value-conscious",
    "primary_language": "Arabic",
    "secondary_language": "English",
    "audience": "youth impulse buyers + bulk family shoppers in Saudi Arabia",
    "key_positioning": "11.50 SR fixed-price destination with premium boxed chocolates available at select branches",
    "default_hashtags": ["#KayanSweets", "#حلويات_كيان"],
    "do_say": ["affordable indulgence", "global candy", "family treats"],
    "dont_say": ["cheap", "low-quality", "discount"]
  }'::jsonb
);

-- Branches (per Kayan Sweets brand context)
insert into branches (brand_id, name, city, has_boxed_chocolates) values
  ('11111111-1111-1111-1111-111111111111', 'Al Rusaifah', 'Makkah', true),
  ('11111111-1111-1111-1111-111111111111', 'Al Awali', 'Makkah', true),
  ('11111111-1111-1111-1111-111111111111', 'Al Shouqiyah', 'Makkah', false),
  ('11111111-1111-1111-1111-111111111111', 'Al Marwa', 'Jeddah', false),
  ('11111111-1111-1111-1111-111111111111', 'Al Salama', 'Jeddah', true),
  ('11111111-1111-1111-1111-111111111111', 'Al Hamdaniyya', 'Jeddah', false),
  ('11111111-1111-1111-1111-111111111111', 'Al Khumra', 'Jeddah', false),
  ('11111111-1111-1111-1111-111111111111', 'Al Sanabil', 'Jeddah', true),
  ('11111111-1111-1111-1111-111111111111', 'Al Salhiyaa', 'Jeddah', false),
  ('11111111-1111-1111-1111-111111111111', 'Abhur', 'Jeddah', true),
  ('11111111-1111-1111-1111-111111111111', 'Al Shaddha', 'Madina', true),
  ('11111111-1111-1111-1111-111111111111', 'Al Haramain', 'Other', true);

-- Default budget cap for current month (placeholder; user adjusts in app)
insert into budget_caps (brand_id, month, total_cap, category_caps) values (
  '11111111-1111-1111-1111-111111111111',
  date_trunc('month', current_date)::date,
  20000,
  '{
    "ad_spend_tiktok": 6000,
    "ad_spend_snap": 6000,
    "ad_spend_ig": 3000,
    "influencer": 3000,
    "shop_materials": 1000,
    "production": 500,
    "other": 500
  }'::jsonb
);
