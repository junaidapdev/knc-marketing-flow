import type { Influencer } from "../types/influencer";

// Canonical cities for the location filter. The stored `city` field is
// messy free text — Arabic spelling variants (جدة / جده), a few English
// values ("Jeddah"), and rows that name two cities ("مكة - جدة"). We map
// those onto these buckets at runtime; the raw value is left untouched for
// display.
export const INFLUENCER_CITIES = [
  "makkah",
  "jeddah",
  "madinah",
  "riyadh",
  "taif",
] as const;
export type InfluencerCity = (typeof INFLUENCER_CITIES)[number];

export const INFLUENCER_CITY_LABELS: Record<InfluencerCity, string> = {
  makkah: "Makkah",
  jeddah: "Jeddah",
  madinah: "Madinah",
  riyadh: "Riyadh",
  taif: "Taif",
};

// Keyword groups — Arabic + English forms. The raw city string is matched
// (case-insensitive substring) against every group, so a value naming two
// cities buckets into both. Arabic is case-insensitive already; English
// keywords are lowercase to match the lowercased input.
const CITY_KEYWORDS: Record<InfluencerCity, readonly string[]> = {
  makkah: ["مك", "mak", "mecca"], // مكة, مكة المكرمة, مكه المكرمه, Makkah
  jeddah: ["جد", "jed"], // جدة, جده, Jeddah
  madinah: ["مدين", "madin", "medin"], // المدينة المنورة, المدينه, Madinah
  riyadh: ["رياض", "riyad"], // الرياض, Riyadh
  taif: ["طايف", "طائف", "taif", "taef"], // الطايف, Taif
};

// Every canonical city the raw value matches — usually one, two for the
// "covers multiple cities" rows, empty when nothing matches (so those
// creators only ever appear under the "All" location option).
export function cityBuckets(
  rawCity: string | null | undefined,
): InfluencerCity[] {
  if (!rawCity) return [];
  const text = rawCity.toLowerCase();
  return INFLUENCER_CITIES.filter((city) =>
    CITY_KEYWORDS[city].some((kw) => text.includes(kw)),
  );
}

export function matchesCity(
  influencer: Influencer,
  city: InfluencerCity,
): boolean {
  return cityBuckets(influencer.city).includes(city);
}
