import { KAYAN_BRAND_ID } from "../constants/brand";

interface CurrentBrand {
  brandId: string;
}

// V1 single-tenant. Swap this for a context-backed implementation in V2.
export function useCurrentBrand(): CurrentBrand {
  return { brandId: KAYAN_BRAND_ID };
}
