// V1 is single-tenant; the seeded Kayan Sweets UUID is the only brand.
// In V2 multi-tenant this gets resolved per session via auth.uid -> app_users.brand_id.
export const KAYAN_BRAND_ID = "11111111-1111-1111-1111-111111111111";
