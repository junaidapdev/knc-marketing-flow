import type { InfluencerStatus } from "../constants/influencer-status";
import type { InfluencerNicheTag } from "../constants/influencer-niche-tags";
import type { InfluencerLanguage } from "../constants/influencer-languages";

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
