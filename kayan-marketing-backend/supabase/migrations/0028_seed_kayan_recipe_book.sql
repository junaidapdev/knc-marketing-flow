-- Migration 0028: Seed the Kayan Recipe Book V2 into the brand DNA + voice_config.
--
-- V1 is single-tenant (one brand row, brand_code = 'KAYAN'). This migration
-- replaces the row's `dna_markdown` and `voice_config` with the structured
-- playbook derived from analyzing 11 winning Instagram Reels.
--
-- IDEMPOTENT: the WHERE clause skips the row if the marker
-- "RECIPE BOOK V2" is already present in dna_markdown. So:
--   - First run: dna_markdown is null (or contains the V1 string) → updates.
--   - Re-run after apply: marker present → 0 rows affected, manual edits safe.
--   - If a marketer hand-edits and removes the marker, this migration WILL
--     re-overwrite. That's an explicit trade-off — the marker is a contract.
--
-- brand_code match is case-insensitive (`ilike`) so the migration applies
-- regardless of whether the row was seeded as 'KAYAN' or 'kayan'.

update brands
set
  dna_markdown = $dna$# KAYAN SWEETS — BRAND DNA & RECIPE BOOK V2

## Identity
- Saudi confectionery and snack retail chain, 12 branches across Makkah, Jeddah,
  Madina, Al Haramain
- Positioning: high-density, visually energetic candy & snack destination
- Personality: warm, enthusiastic, playful, abundance-focused, value-driven
- Brand colors: yellow, black, white
- Audience: impulse-driven youth shoppers (primary), value-conscious bulk buyers (secondary)

## The Anchor Price
- 11.50 SR (VAT inclusive) is the brand's hero price for most products
- Treat this as a refrain, not a fact — repeat it 3-5 times per video minimum
- It is the audio signature of the brand

## The 5 Things Every Winning Kayan Reel Does
1. Opens with action, deal, or question — never with description
2. Uses the follow-button as a game mechanic, not a closing CTA
3. Always over-delivers on the announced reward (Generosity Multiplier)
4. Anchors value with a number reveal at the end (Surprising Total)
5. Treats 11.50 SR as a refrain, not a single mention

## Universal Rules

### ALWAYS
- Open with action, deal, objection, or question — never description
- Name the branch in every reel (text overlay or spoken)
- Repeat 11.50 SR at least 3 times when relevant
- End on a number — total spent, items grabbed, reward given
- Use bold yellow Arabic text overlays as the visual rhythm
- Tie follow to a reward upgrade, not a generic close-of-reel ask
- Subtitle blessings, testimonials, and CTAs in English
- Frame price reveals as a guessing game

### NEVER
- Run a CTA longer than 5 seconds
- Finish a reel without a branch reference
- Let dead pacing exceed 3 seconds without text overlay
- Describe the store — show the abundance instead
- Speculate about products or prices not in this brand DNA
- Break the price-promise mid-reel (e.g., advertise "everything 11.50" then show a 65 SR item)

## The 9 Patterns

### P1 — Follower Supermarket Sweep
Timed shopping spree, doubled for followers, ends with surprising total at register.
Variables: time limit, demographic, motive overlay, product category, branch.

### P2 — Fixed-Price Value Stack
Rapid catalog of 5-10 items all at the hero price. Auctioneer-style pacing.
Variables: anchor price, product theme, comparison metric, branch.

### P3 — Generous Upgrade Interview
Reward-for-praise question + secret time/money upgrade revealed at end.
Variables: opening question, demographic, type of secret upgrade, branch.

### P4 — Good Samaritan Store Test
Hidden-camera moral test. Customer who passes wins voucher + organic testimonial.
Variables: test setup, reward amount, branch.

### P5 — Call-a-Friend Shopping Dash
Escalating stakes: bring a friend to unlock more reward time. Visual surprise on arrival.
Variables: original time, friend specification, visual surprise, branch.

### P6 — Internal Hero Reveal
Unannounced staff reward + unscripted reaction. Builds trust differently.
Variables: milestone, reward type, branch rotation.

### P7 — Event Prediction Giveaway
Trend-jack a local event with a comments-based prediction prize. Pure engagement play.
Variables: event, prize amount (use non-round numbers), props/mascots, branch.

### P8 — Dual-Commentator Dash
Two presenters bet on customer's haul like sports announcers. Front-loaded follow gate.
Variables: personality dynamic, stakes between presenters, demographic, branch.

### P9 — Quality Objection Rebuttal
Surface customer doubt, disprove with sensory product demo. Builds trust, not excitement.
Variables: objection, hero product, sensory demonstration, comparison metric.

## Hook Templates

- Conditional Time Doubler: "[X] seconds to grab anything from [aisle] — [2X] if you follow us."
- Price Refrain: "As we accustomed you at Kayan, [item] is just [price] Riyals."
- Reward-for-Answer: "If you can tell me [question], I'll [reward]."
- Social Experiment: "We're testing today — if a customer [does the right thing], they win [reward]."
- Third-Person Surprise: "He decided to give the next person [reward]. Watch."
- Internal Spotlight: "We surprised our hardest-working [role] at the [branch] branch."
- Auctioneer Catalog: "We are Kayan — everything you see is just [price]. Watch."
- Wholesome Gift: "[X] seconds to grab anything — to gift to your [family member]."
- Event Trend-Jack: "On the occasion of [biggest local event], we're giving [prize] to whoever [predicts]."
- Dual-Banter: P1: "[X] seconds!" P2: "What's [X]? Give them [2X] — only if they follow us."
- Objection Rebuttal: "Many of you ask — [common doubt]. Let me prove that wrong."

## CTA Templates

- Customer-Voiced Branch Close: "[Branch] is the best — follow Kayan so you can be next."
- Search-Prompt Close: "Search 'Kayan Sweets' on your map — visit the [branch] branch."
- Cliffhanger Tease: "What's coming next week is even bigger. Hit follow."
- Engagement-Prediction: "Write your prediction in the comments. Follow and share."
- Share Trigger: "Send this to the friend you'd most like to see grab a basket. Visit [branch]."

## Output Format Rules

When generating a script:
1. Always produce BOTH Arabic (Saudi dialect) AND English versions
2. Mark sections with **Hook**, **Body**, **CTA** sub-headings
3. Include shot directions in [brackets]
4. Total runtime target: 15-60 seconds
5. Hook must land in first 3 seconds
6. End with a number (total, items, reward, prediction)
7. Always name a specific branch
$dna$,
  voice_config = $vc$
{
  "anchor_price": "11.50 SR",
  "primary_language": "Arabic (Saudi dialect)",
  "secondary_language": "English",
  "tone": ["warm", "enthusiastic", "playful", "abundance-focused", "value-driven"],
  "audience": {
    "primary": "Saudi youth shoppers (teens, young adults, families with kids)",
    "secondary": "Value-conscious bulk buyers (parents, event hosts, gift buyers)"
  },
  "signature_phrases": [
    "كما عودناكم احنا كيان",
    "بـ 11.5 ريال",
    "ما شاء الله",
    "اللهم اشهد"
  ],
  "branches": [
    { "name": "Al Awali", "city": "Makkah", "boxed_chocolates": true },
    { "name": "Al Rusaifah", "city": "Makkah", "boxed_chocolates": true },
    { "name": "Al Shouqiyah", "city": "Makkah", "boxed_chocolates": false },
    { "name": "Al Marwa", "city": "Jeddah", "boxed_chocolates": false },
    { "name": "Al Salama", "city": "Jeddah", "boxed_chocolates": true },
    { "name": "Al Hamdaniyya", "city": "Jeddah", "boxed_chocolates": false },
    { "name": "Al Khumra", "city": "Jeddah", "boxed_chocolates": false },
    { "name": "Al Sanabil", "city": "Jeddah", "boxed_chocolates": true },
    { "name": "Al Salhiyaa", "city": "Jeddah", "boxed_chocolates": false },
    { "name": "Abhur", "city": "Jeddah", "boxed_chocolates": true },
    { "name": "Al Shaddha", "city": "Madina", "boxed_chocolates": true },
    { "name": "Al Haramain", "city": "Other", "boxed_chocolates": true }
  ],
  "patterns": [
    { "id": "P1", "name": "Follower Supermarket Sweep" },
    { "id": "P2", "name": "Fixed-Price Value Stack" },
    { "id": "P3", "name": "Generous Upgrade Interview" },
    { "id": "P4", "name": "Good Samaritan Store Test" },
    { "id": "P5", "name": "Call-a-Friend Shopping Dash" },
    { "id": "P6", "name": "Internal Hero Reveal" },
    { "id": "P7", "name": "Event Prediction Giveaway" },
    { "id": "P8", "name": "Dual-Commentator Dash" },
    { "id": "P9", "name": "Quality Objection Rebuttal" }
  ],
  "forbidden": [
    "describing the store instead of showing it",
    "CTAs longer than 5 seconds",
    "skipping the branch callout",
    "advertising 'everything at 11.50 SR' then showing a higher-priced item",
    "speculating about products not in this brand DNA"
  ]
}
$vc$::jsonb
where brand_code ilike 'kayan'
  and (dna_markdown is null or dna_markdown not like '%RECIPE BOOK V2%');
