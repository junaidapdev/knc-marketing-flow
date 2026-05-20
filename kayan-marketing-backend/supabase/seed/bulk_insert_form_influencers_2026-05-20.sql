-- Bulk-insert 44 influencers from "نموذج المؤثرين" form submissions
-- Submission window: 2026-05-19 → 2026-05-20
-- Source CSV: نموذج المؤثرين_Submissions_2026-05-20.csv
-- Brand: Kayan Sweets (11111111-1111-1111-1111-111111111111)
--
-- Safe to re-run: rows matching (brand_id, display_name) are skipped.
--
-- Mapping decisions:
--   • display_name = "<English transliteration> / <Arabic>"
--     full_name    = original (Arabic for 42 rows, English for 2)
--   • District/Area → notes ("District: ...")
--   • Languages → ['arabic'] for all rows
--   • Follower counts:
--       - decimal w/o unit (41.5, 14.1, 773.5)  →  × 1000
--       - integer w/o unit                       →  as-is
--       - "الف"/"الاف"/"k"/"K"                  →  × 1000
--       - "مليون"/"M"                            →  × 1000000
--       - Arabic numerals normalized to Latin
--       - "لا يوجد"/"no"/"."/"-"/blank          →  null
--   • Rate ranges (e.g. "300-500") → midpoint, raw range noted
--   • Barter: نعم/yes → true; everything else → false (raw text noted when ambiguous)
--   • Snapchat /t/ share IDs stored as snapchat_handle (not a real username,
--     satisfies the at-least-one-platform check)
--   • Reported followers without a profile URL → URL/handle null, count kept, noted

with src(brand_id, display_name, full_name, whatsapp, city,
         tiktok_handle, tiktok_url, tiktok_followers,
         instagram_handle, instagram_url, instagram_followers,
         snapchat_handle, snapchat_url, snapchat_followers,
         standard_rate, accepts_barter, niche_tags, languages, notes) as (
  values
    -- 1. ياسمين الحربي
    ('11111111-1111-1111-1111-111111111111'::uuid,
     'Yasmeen Al Harbi / ياسمين الحربي'::text, 'ياسمين الحربي'::text, '0546167697'::text, 'المدينة المنورة'::text,
     'l7v66'::text, 'https://www.tiktok.com/@l7v66'::text, 132000::integer,
     null::text, null::text, null::integer,
     'VSVKfAH9'::text, 'https://snapchat.com/t/VSVKfAH9'::text, 90000::integer,
     600.00::numeric, false::boolean,
     array['food','lifestyle']::text[], array['arabic']::text[],
     'District: الاسكان'::text),

    -- 2. روز المدينه
    ('11111111-1111-1111-1111-111111111111',
     'Rose Al Madinah / روز المدينه', 'روز المدينه', '0555342774', 'المدينة المنوره',
     'roooooz1414', 'https://www.tiktok.com/@roooooz1414', 43,
     null, null, null,
     'Kkfyvdv2', 'https://snapchat.com/t/Kkfyvdv2', 32,
     400.00, false,
     array['food','lifestyle','family','comedy','beauty','fitness','fashion','travel','parenting','tech','gaming','music'], array['arabic'],
     'District: الهجرة. Quoted rate range: 300-500 SAR (using midpoint).'),

    -- 3. مدى المهدي البقمي
    ('11111111-1111-1111-1111-111111111111',
     'Mada Al Mahdi Al Baqami / مدى المهدي البقمي', 'مدى المهدي البقمي', '0530587307', 'Jeddah',
     'lifecapss', 'https://www.tiktok.com/@lifecapss', 111000,
     'lifecapss__', 'https://www.instagram.com/lifecapss__', 12000,
     null, null, null,
     500.00, false,
     array['food','lifestyle','fashion'], array['arabic'],
     'District: المروه ٧'),

    -- 4. عنوان جدة عبدالمحسن
    ('11111111-1111-1111-1111-111111111111',
     'Jeddah Address - Abdulmohsen / عنوان جدة عبدالمحسن', 'عنوان جدة عبدالمحسن', '0559989471', 'جدة',
     'jeddahadress', 'https://www.tiktok.com/@jeddahadress', 403000,
     'jeddahadress', 'https://www.instagram.com/jeddahadress', 150000,
     'aCvXRvAN', 'https://snapchat.com/t/aCvXRvAN', 140000,
     1700.00, false,
     array['food','lifestyle','family','comedy','beauty','fitness','fashion','tech','gaming'], array['arabic'],
     'District: جدة'),

    -- 5. هتان
    ('11111111-1111-1111-1111-111111111111',
     'Hatan / هتان', 'هتان', '0534943775', 'جده',
     'l0ii1_', 'https://www.tiktok.com/@l0ii1_', 200000,
     'l0ii1_k', 'https://www.instagram.com/l0ii1_k', 4000,
     'oGezhjQv', 'https://snapchat.com/t/oGezhjQv', 10000,
     500.00, false,
     array['food','lifestyle','family','beauty','fashion'], array['arabic'],
     'District: قريش'),

    -- 6. رنبم تغطيات الغرييه
    ('11111111-1111-1111-1111-111111111111',
     'Raneem Coverages Al Ghariyyah / رنبم تغطيات الغرييه', 'رنبم تغطيات الغرييه', '0553569194', 'جدة',
     'ra1411_0', 'https://www.tiktok.com/@ra1411_0', 218000,
     'ra1411_0', 'https://www.instagram.com/ra1411_0', 24000,
     'JtSitcx9', 'https://snapchat.com/t/JtSitcx9', 20000,
     700.00, false,
     array['food','lifestyle'], array['arabic'],
     'District: جدة/حي السنابل. "رنبم" appears to be a typo of رنيم (Raneem) — verify.'),

    -- 7. حليمه الشريف
    ('11111111-1111-1111-1111-111111111111',
     'Halimah Al Sharif / حليمه الشريف', 'حليمه الشريف', '0555901105', 'مكة',
     'hloom1408', 'https://www.tiktok.com/@hloom1408', 65000,
     'hloom1408_', 'https://www.instagram.com/hloom1408_', 28000,
     'xdABMvVL', 'https://t.snapchat.com/xdABMvVL', 290000,
     2500.00, false,
     array['food','lifestyle','family'], array['arabic'],
     'District: ولي العهد الشوقيه الزايدي'),

    -- 8. تغطيات نوف
    ('11111111-1111-1111-1111-111111111111',
     'Nouf Coverages / تغطيات نوف', 'تغطيات نوف', '0637006288', 'جده',
     'tit07890', 'https://www.tiktok.com/@tit07890', 319000,
     null, null, null,
     null, null, null,
     500.00, false,
     array['food','lifestyle','family','comedy','beauty','fitness','fashion','travel','parenting','tech','gaming','music'], array['arabic'],
     'District: المروه. WhatsApp format unusual (does not start with 05) — verify.'),

    -- 9. هاشم محمد الراشدي
    ('11111111-1111-1111-1111-111111111111',
     'Hashem Mohammed Al Rashidi / هاشم محمد الراشدي', 'هاشم محمد الراشدي', '0566988966', 'جده',
     'abo_alhaesh', 'https://www.tiktok.com/@abo_alhaesh', 1700000,
     null, null, 34000,
     'CDezriZ4', 'https://snapchat.com/t/CDezriZ4', 332000,
     3000.00, false,
     array['comedy'], array['arabic'],
     'District: الواحة. Instagram profile URL not provided; 34k followers reported.'),

    -- 10. جيهان سعد المحياني
    ('11111111-1111-1111-1111-111111111111',
     'Jihan Saad Al Mahyani / جيهان سعد المحياني', 'جيهان سعد المحياني', '0545550512', 'مكة المكرمة',
     'jee_051', 'https://www.tiktok.com/@jee_051', 108000,
     null, null, 75000,
     'jee_051', 'https://www.snapchat.com/add/jee_051', 46000,
     2000.00, false,
     array['food','lifestyle','travel'], array['arabic'],
     'District: الشرايع. Instagram URL was an invite link, not profile.'),

    -- 11. غزل
    ('11111111-1111-1111-1111-111111111111',
     'Ghazal / غزل', 'غزل', '0535971557', 'جده',
     '9ms_0', 'https://www.tiktok.com/@9ms_0', 191000,
     null, null, null,
     'gggazl123', 'https://www.snapchat.com/add/gggazl123', 6000,
     500.00, false,
     array['food','lifestyle','family','beauty','fashion','gaming','music'], array['arabic'],
     'District: المروه. Barter: "احيانا" (sometimes) — confirm before quoting.'),

    -- 12. نوف الحارثي
    ('11111111-1111-1111-1111-111111111111',
     'Nouf Al Harithi / نوف الحارثي', 'نوف الحارثي', '0506039733', 'جدة',
     'no0uf_08', 'https://www.tiktok.com/@no0uf_08', 2000,
     null, null, null,
     'of5rAbk1', 'https://snapchat.com/t/of5rAbk1', 200000,
     800.00, false,
     array['food'], array['arabic'],
     'District: جدة حي الفروسية'),

    -- 13. حساب مطاعم مكة
    ('11111111-1111-1111-1111-111111111111',
     'Makkah Restaurants Account / حساب مطاعم مكة', 'حساب مطاعم مكة', '0566647539', 'مكة',
     'makkah_385', 'https://www.tiktok.com/@makkah_385', 230000,
     null, null, 347000,
     'makkah_3855', 'https://www.snapchat.com/add/makkah_3855', 60000,
     1300.00, false,
     array['food'], array['arabic'],
     'District: مكة. Instagram URL was a reel link, not profile.'),

    -- 14. مناير الحربي
    ('11111111-1111-1111-1111-111111111111',
     'Munayer Al Harbi / مناير الحربي', 'مناير الحربي', '0550148040', 'جده',
     'mn1409z', 'https://www.tiktok.com/@mn1409z', 48000,
     'mnair_omzaid', 'https://instagram.com/mnair_omzaid', 493000,
     'jory_li', 'https://www.snapchat.com/add/jory_li', 163000,
     1000.00, false,
     array['food','lifestyle','family','beauty','fitness','fashion','travel','parenting','tech','gaming'], array['arabic'],
     'District: الصالحيه. Secondary WhatsApp on submission: 0550154228.'),

    -- 15. سحاب الزهراني
    ('11111111-1111-1111-1111-111111111111',
     'Sahab Al Zahrani / سحاب الزهراني', 'سحاب الزهراني', '0538416650', 'جده',
     'hlwm1984', 'https://www.tiktok.com/@hlwm1984', 400000,
     null, null, null,
     'G9hkNIW4', 'https://snapchat.com/t/G9hkNIW4', 493000,
     3000.00, false,
     array['food','family','beauty','parenting','gaming'], array['arabic'],
     'District: ابرق الرغامه'),

    -- 16. غنى محمد محمد
    ('11111111-1111-1111-1111-111111111111',
     'Ghina Mohammed Mohammed / غنى محمد محمد', 'غنى محمد محمد', '0566619017', 'جده',
     null, null, null,
     null, null, null,
     '9WYoEWew', 'https://snapchat.com/t/9WYoEWew', 140000,
     1000.00, true,
     array['food','comedy','travel'], array['arabic'],
     'District: مشرفه شارع المكرونه. Only Snapchat provided.'),

    -- 17. تغطيات ملاذ
    ('11111111-1111-1111-1111-111111111111',
     'Malath Coverages / تغطيات ملاذ', 'تغطيات ملاذ', '0547271498', 'جدة',
     null, null, 299000,
     null, null, null,
     'NCbaIFac', 'https://snapchat.com/t/NCbaIFac', 40000,
     600.00, false,
     array['food','fashion','travel'], array['arabic'],
     'District: جدة - المروة. TikTok profile URL not provided; 299k followers reported.'),

    -- 18. تهاني احمد الاحمري
    ('11111111-1111-1111-1111-111111111111',
     'Tahani Ahmad Al Ahmari / تهاني احمد الاحمري', 'تهاني احمد الاحمري', '0504212847', 'مكة',
     'toooti699', 'https://www.tiktok.com/@toooti699', 397000,
     'tahani90900', 'https://www.instagram.com/tahani90900', 68000,
     'cdw27QaY', 'https://snapchat.com/t/cdw27QaY', 498000,
     1500.00, false,
     array['food','family','beauty','fitness'], array['arabic'],
     'District: مكة الرصيفه'),

    -- 19. هناء هليل الحربي
    ('11111111-1111-1111-1111-111111111111',
     'Hanaa Helal Al Harbi / هناء هليل الحربي', 'هناء هليل الحربي', '0548100195', 'المدينة المنورة',
     'hana_almadinah', 'https://www.tiktok.com/@hana_almadinah', 162300,
     'hana.almadina', 'https://www.instagram.com/hana.almadina', 10000,
     'hanaa_almadina', 'https://www.snapchat.com/add/hanaa_almadina', 54000,
     800.00, true,
     array['food'], array['arabic'],
     'District: الرانوناء. Barter: "نعم + مدفوع" (yes + paid).'),

    -- 20. اسمهان الغامدي
    ('11111111-1111-1111-1111-111111111111',
     'Asmahan Al Ghamdi / اسمهان الغامدي', 'اسمهان الغامدي', '0569441000', 'جدة',
     'asmahan.1404', 'https://www.tiktok.com/@asmahan.1404', 137000,
     'asmahan.1404', 'https://www.instagram.com/asmahan.1404', 137000,
     '7pw0lP8m', 'https://snapchat.com/t/7pw0lP8m', 466000,
     1000.00, false,
     array['food','lifestyle','beauty'], array['arabic'],
     'District: الحمدانية. Rate quote: "اعلان جميع المنصات سناب وتيك توك وانستغرام ١٠٠٠ ريال" (1000 SAR across all platforms).'),

    -- 21. هديل مليباري
    ('11111111-1111-1111-1111-111111111111',
     'Hadeel Malibari / هديل مليباري', 'هديل مليباري', '0561152468', 'جده',
     null, null, 100000,
     null, null, null,
     'WL4gRJsv', 'https://snapchat.com/t/WL4gRJsv', 200000,
     3000.00, false,
     array['food','lifestyle','comedy','beauty','fitness','fashion','travel','parenting','music'], array['arabic'],
     'District: ابحر الشمالبي. TikTok URL was generic homepage, not profile. Rate includes editing ("مع مونتاجي"). Barter: "علي حسب نوع شركه" (depends on company type) — confirm.'),

    -- 22. سوما عاشور
    ('11111111-1111-1111-1111-111111111111',
     'Souma Ashour / سوما عاشور', 'سوما عاشور', '0555889023', 'مكة المكرمة',
     'ssamooo7a1', 'https://www.tiktok.com/@ssamooo7a1', 20000,
     null, null, 60000,
     'so_600s', 'https://www.snapchat.com/add/so_600s', 400000,
     300.00, false,
     array['food','lifestyle'], array['arabic'],
     'District: مكة المكرمة. Instagram URL was a reel link, not profile.'),

    -- 23. Mshari ghazi hilal (English-source)
    ('11111111-1111-1111-1111-111111111111',
     'Mshari Ghazi Hilal / مشاري غازي هلال', 'Mshari Ghazi Hilal', '0542888748', 'Jeddah',
     'msharihilal', 'https://www.tiktok.com/@msharihilal', 850000,
     'msharihilal', 'https://www.instagram.com/msharihilal', 460000,
     'msharihilal', 'https://www.snapchat.com/add/msharihilal', 90000,
     2500.00, false,
     array['food','lifestyle','comedy','travel','tech','gaming'], array['arabic'],
     'District: Alfalah. Arabic spelling inferred from English transliteration.'),

    -- 24. د/ شيف مرام الشريف
    ('11111111-1111-1111-1111-111111111111',
     'Dr. Chef Maram Al Sharif / د/ شيف مرام الشريف', 'د/ شيف مرام الشريف', '0555574509', 'مكه المكرمه',
     'drchef_maram', 'https://www.tiktok.com/@drchef_maram', 193100,
     'drchef_maram', 'https://www.instagram.com/drchef_maram', 34400,
     'lcJpHdhg', 'https://snapchat.com/t/lcJpHdhg', 85000,
     3500.00, false,
     array['food','lifestyle','beauty','travel'], array['arabic'],
     'District: الزاهر. Snapchat note from submitter: "٨٥ الف والمشاهدات ٤ مليون" (85k followers, 4M views).'),

    -- 25. بلوقر / امل الحربي
    ('11111111-1111-1111-1111-111111111111',
     'Blogger Amal Al Harbi / بلوقر امل الحربي', 'بلوقر / امل الحربي', '0582346640', 'المدينه',
     'trendy_med', 'https://www.tiktok.com/@trendy_med', 75000,
     'coffee_medina', 'https://instagram.com/coffee_medina', 125000,
     'coffee_medina20', 'https://www.snapchat.com/add/coffee_medina20', 20000,
     500.00, false,
     array['food','lifestyle'], array['arabic'],
     'District: المدينه المنوره/ حي الرانوناء. Snapchat and TikTok URLs were concatenated in form submission — split during normalization.'),

    -- 26. محمد القزم
    ('11111111-1111-1111-1111-111111111111',
     'Mohammed Al Qazm / محمد القزم', 'محمد القزم', '0550822849', 'مكة - جدة',
     'azroot', 'https://www.tiktok.com/@azroot', 1700000,
     'azroot1', 'https://www.instagram.com/azroot1', 220000,
     'eo1o10MQ', 'https://snapchat.com/t/eo1o10MQ', 500000,
     6000.00, false,
     array['comedy'], array['arabic'],
     'District: مكه - جدة'),

    -- 27. رهام تغطيات
    ('11111111-1111-1111-1111-111111111111',
     'Reham Coverages / رهام تغطيات', 'رهام تغطيات', '0500313689', 'المدينة المنورة',
     'rhoom_1', 'https://www.tiktok.com/@rhoom_1', 102000,
     'rhoom1122', 'https://www.instagram.com/rhoom1122', 17000,
     null, null, null,
     500.00, false,
     array['food','lifestyle','beauty'], array['arabic'],
     'District: الرانوناء. Snapchat field contained an Instagram URL (20k followers reported) — likely no Snapchat account; data omitted.'),

    -- 28. رامي المولد
    ('11111111-1111-1111-1111-111111111111',
     'Rami Al Mawlid / رامي المولد', 'رامي المولد', '0555711402', 'مكة',
     'rami.1402', 'https://www.tiktok.com/@rami.1402', 300000,
     'rm7.e', 'https://www.instagram.com/rm7.e', 10000,
     'gKvqCpux', 'https://snapchat.com/t/gKvqCpux', 250000,
     4000.00, false,
     array['lifestyle','comedy'], array['arabic'],
     'District: مكة المكرمة'),

    -- 29. نينو تغطيات مكة وجدة (حنين)
    ('11111111-1111-1111-1111-111111111111',
     'Nino Makkah & Jeddah Coverages (Haneen) / نينو تغطيات مكة وجدة (حنين)', 'نينو تغطيات مكة وجدة (حنين)', '0567527112', 'جدة او مكة',
     'nino0a_', 'https://www.tiktok.com/@nino0a_', 113000,
     'nino0a_', 'https://www.instagram.com/nino0a_', 73000,
     'tpLCEHza', 'https://snapchat.com/t/tpLCEHza', 25000,
     1500.00, false,
     array['lifestyle'], array['arabic'],
     'District: جدة او مكة'),

    -- 30. تغطيات جده VIP
    ('11111111-1111-1111-1111-111111111111',
     'Jeddah Coverages VIP / تغطيات جده VIP', 'تغطيات جده VIP', '0573849025', 'جدة',
     'azizh_1411', 'https://www.tiktok.com/@azizh_1411', 102000,
     null, null, null,
     null, null, null,
     500.00, false,
     array['food','lifestyle','family','beauty','gaming','music'], array['arabic'],
     'District: السنابل. Submitted with international WhatsApp format (+966); normalized to local.'),

    -- 31. ترف
    ('11111111-1111-1111-1111-111111111111',
     'Taraf / ترف', 'ترف', '0535368553', 'جدة',
     'dailydigitss', 'https://www.tiktok.com/@dailydigitss', 139000,
     null, null, null,
     null, null, null,
     500.00, false,
     array['food','lifestyle','beauty','fashion','tech','music'], array['arabic'],
     'District: جدة - المروة'),

    -- 32. آم تالا تغطيات جدة
    ('11111111-1111-1111-1111-111111111111',
     'Umm Tala Jeddah Coverages / آم تالا تغطيات جدة', 'آم تالا تغطيات جدة', '0507725655', 'جده',
     'ziz_19903', 'https://www.tiktok.com/@ziz_19903', 41500,
     null, null, null,
     null, null, null,
     400.00, false,
     array['food','lifestyle','family','comedy','beauty','fitness','fashion','travel','parenting','tech','gaming'], array['arabic'],
     'District: جدة- حي السنابل. Quoted rate range: "من300الي500" (using midpoint).'),

    -- 33. أريج تغطيات جدة
    ('11111111-1111-1111-1111-111111111111',
     'Areej Jeddah Coverages / أريج تغطيات جدة', 'أريج تغطيات جدة', '0566693913', 'جدة',
     'nn14mm05', 'https://www.tiktok.com/@nn14mm05', 227000,
     null, null, null,
     'MiehAlJe', 'https://snapchat.com/t/MiehAlJe', 38000,
     1000.00, false,
     array['lifestyle'], array['arabic'],
     'District: مكة المكرمة'),

    -- 34. صولا علي القرني
    ('11111111-1111-1111-1111-111111111111',
     'Sola Ali Al Qarni / صولا علي القرني', 'صولا علي القرني', '0558617202', 'جدة',
     '_sxi36', 'https://www.tiktok.com/@_sxi36', 230000,
     null, null, null,
     'xO9OU7Zh', 'https://snapchat.com/t/xO9OU7Zh', 50000,
     800.00, false,
     array['food'], array['arabic'],
     'District: جدة السنابل'),

    -- 35. tota alshehri (English-source)
    ('11111111-1111-1111-1111-111111111111',
     'Tota Al Shehri / توتا الشهري', 'Tota Al Shehri', '0505161416', 'Jeddah',
     'tt2o1', 'https://www.tiktok.com/@tt2o1', 104000,
     null, null, 36,
     'w7G2Wqh7', 'https://snapchat.com/t/w7G2Wqh7', 1500000,
     4500.00, false,
     array['lifestyle'], array['arabic'],
     'District: Alhamdania. Arabic spelling inferred from English transliteration. Instagram URL not provided; reported follower count: 36 (verify).'),

    -- 36. عايشة مصلح الحارثي
    ('11111111-1111-1111-1111-111111111111',
     'Aisha Musleh Al Harithi / عايشة مصلح الحارثي', 'عايشة مصلح الحارثي', '0550459876', 'جدة',
     'yusha1427', 'https://www.tiktok.com/@yusha1427', 216000,
     null, null, null,
     'SspB5zIq', 'https://snapchat.com/t/SspB5zIq', 10000,
     800.00, false,
     array['lifestyle','beauty','fashion','travel','tech','gaming'], array['arabic'],
     'District: جده السامر. Instagram fields had placeholder quotes — treated as empty.'),

    -- 37. امواج العتيبي
    ('11111111-1111-1111-1111-111111111111',
     'Amwaj Al Otaibi / امواج العتيبي', 'امواج العتيبي', '0508721367', 'جدة',
     'meme_mohammed01', 'https://www.tiktok.com/@meme_mohammed01', 14100,
     null, null, null,
     null, null, null,
     150.00, false,
     array['food','lifestyle'], array['arabic'],
     'District: المرسلات'),

    -- 38. فوزية محمد البقمي
    ('11111111-1111-1111-1111-111111111111',
     'Fawziya Mohammed Al Baqami / فوزية محمد البقمي', 'فوزية محمد البقمي', '0553294198', 'جدة',
     'ilf104', 'https://www.tiktok.com/@ilf104', 377000,
     null, null, null,
     'Sk9Qexyn', 'https://snapchat.com/t/Sk9Qexyn', 10000,
     1500.00, false,
     array['food','lifestyle','beauty','fashion','travel','parenting','tech','gaming'], array['arabic'],
     'District: جدة'),

    -- 39. ساره محمد البقمي
    ('11111111-1111-1111-1111-111111111111',
     'Sara Mohammed Al Baqami / ساره محمد البقمي', 'ساره محمد البقمي', '0556459686', 'الرياض',
     'sar.88', 'https://www.tiktok.com/@sar.88', 453000,
     null, null, null,
     null, null, null,
     500.00, false,
     array['food','lifestyle','family','comedy','beauty','fitness','fashion','travel','parenting','tech','gaming'], array['arabic'],
     'District: الرياض حي الخليج'),

    -- 40. سحر المالكي
    ('11111111-1111-1111-1111-111111111111',
     'Sahar Al Maliki / سحر المالكي', 'سحر المالكي', '0544820318', 'جدة',
     'sahar_1478', 'https://www.tiktok.com/@sahar_1478', 11500,
     null, null, null,
     null, null, null,
     250.00, false,
     array['food'], array['arabic'],
     'District: حي الامير فواز جدة. TikTok follower count was "11:5الف" — interpreted as 11.5k.'),

    -- 41. بلوقار افنان
    ('11111111-1111-1111-1111-111111111111',
     'Blogger Afnan / بلوقار افنان', 'بلوقار افنان', '0532639180', 'الطايف',
     'norr.088', 'https://www.tiktok.com/@norr.088', 773500,
     null, null, null,
     null, null, null,
     500.00, true,
     array['food','lifestyle','family','comedy','beauty','fitness','fashion','travel','parenting','tech','gaming'], array['arabic'],
     'District: سلطانه. Barter: "لنعم" (interpreted as نعم/yes).'),

    -- 42. عدسه أفنان
    ('11111111-1111-1111-1111-111111111111',
     'Adasat Afnan (Afnan''s Lens) / عدسه أفنان', 'عدسه أفنان', '0573927336', 'الرياض',
     'sar..80', 'https://www.tiktok.com/@sar..80', 557500,
     null, null, null,
     'GB041GVB', 'https://snapchat.com/t/GB041GVB', 1000,
     800.00, false,
     array['food','lifestyle','family','comedy','beauty','fitness','fashion','travel','parenting','tech','gaming'], array['arabic'],
     'District: حي الخليج. Snapchat follower count was "ألف1000" — interpreted literally as 1000 (verify).'),

    -- 43. نورة صالح المالكي
    ('11111111-1111-1111-1111-111111111111',
     'Noura Saleh Al Maliki / نورة صالح المالكي', 'نورة صالح المالكي', '0545334022', 'جدة',
     'non.almalki', 'https://www.tiktok.com/@non.almalki', 10000,
     null, null, null,
     'NesiUyH2', 'https://snapchat.com/t/NesiUyH2', 200,
     500.00, true,
     array['food','lifestyle','family','beauty','fitness','travel'], array['arabic'],
     'District: مكة المكرمة'),

    -- 44. نور محمد
    ('11111111-1111-1111-1111-111111111111',
     'Nour Mohammed / نور محمد', 'نور محمد', '0561403938', 'الطايف',
     'nor_tofe', 'https://www.tiktok.com/@nor_tofe', 65,
     null, null, 66000,
     null, null, 65,
     600.00, false,
     array['food','lifestyle','family','comedy','beauty','fitness','fashion','travel'], array['arabic'],
     'District: الحويه. Snapchat and Instagram profile URLs not provided.')
)
insert into influencers (
  brand_id, display_name, full_name, whatsapp, city,
  tiktok_handle, tiktok_url, tiktok_followers,
  instagram_handle, instagram_url, instagram_followers,
  snapchat_handle, snapchat_url, snapchat_followers,
  standard_rate, accepts_barter, niche_tags, languages, notes
)
select s.brand_id, s.display_name, s.full_name, s.whatsapp, s.city,
       s.tiktok_handle, s.tiktok_url, s.tiktok_followers,
       s.instagram_handle, s.instagram_url, s.instagram_followers,
       s.snapchat_handle, s.snapchat_url, s.snapchat_followers,
       s.standard_rate, s.accepts_barter, s.niche_tags, s.languages, s.notes
  from src s
 where not exists (
   select 1 from influencers i
    where i.brand_id = s.brand_id
      and i.display_name = s.display_name
 );

-- Sanity check (optional — run separately after the insert):
-- select count(*), count(*) filter (where snapchat_handle is not null) as has_snap,
--        count(*) filter (where tiktok_handle is not null) as has_tt,
--        count(*) filter (where instagram_handle is not null) as has_ig,
--        count(*) filter (where accepts_barter) as accepts_barter
--   from influencers
--  where brand_id = '11111111-1111-1111-1111-111111111111';
