import type { InfluencerStatus } from "../constants/influencer-status";
import type { InfluencerNicheTag } from "../constants/influencer-niche-tags";
import type { InfluencerLanguage } from "../constants/influencer-languages";

// Returned by the backend `get_influencer_reliability` RPC. Percentages
// are integers 0..100 OR null when the denominator is zero. The admin
// list / detail endpoints attach this as `reliability` when requested.
export interface InfluencerReliability {
  postRate: number | null;
  tagRate: number | null;
  onTimeRate: number | null;
  totalCollabs: number;
  totalSubmissions: number;
  computedAt: string;
}

// Detail response = the row + reliability merged in. List response is
// the row alone unless `?includeReliability=true` was passed.
export interface InfluencerWithReliability extends Influencer {
  reliability: InfluencerReliability | null;
}

export interface Influencer {
  id: string;
  brandId: string;
  displayName: string;
  fullName: string | null;
  whatsapp: string;
  city: string | null;
  tiktokHandle: string | null;
  tiktokUrl: string | null;
  tiktokFollowers: number | null;
  instagramHandle: string | null;
  instagramUrl: string | null;
  instagramFollowers: number | null;
  snapchatHandle: string | null;
  snapchatUrl: string | null;
  snapchatFollowers: number | null;
  standardRate: number | null;
  acceptsBarter: boolean;
  nicheTags: InfluencerNicheTag[];
  languages: InfluencerLanguage[];
  notes: string | null;
  status: InfluencerStatus;
  portalToken: string;
  portalActivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InfluencerFilters {
  status?: InfluencerStatus;
  q?: string;
  niche?: InfluencerNicheTag;
}

export interface CreateInfluencerInput {
  brandId: string;
  displayName: string;
  fullName?: string | null;
  whatsapp: string;
  city?: string | null;
  tiktokHandle?: string | null;
  tiktokUrl?: string | null;
  tiktokFollowers?: number | null;
  instagramHandle?: string | null;
  instagramUrl?: string | null;
  instagramFollowers?: number | null;
  snapchatHandle?: string | null;
  snapchatUrl?: string | null;
  snapchatFollowers?: number | null;
  standardRate?: number | null;
  acceptsBarter?: boolean;
  nicheTags?: InfluencerNicheTag[];
  languages?: InfluencerLanguage[];
  notes?: string | null;
  status?: InfluencerStatus;
}

export type UpdateInfluencerInput = Partial<CreateInfluencerInput>;
