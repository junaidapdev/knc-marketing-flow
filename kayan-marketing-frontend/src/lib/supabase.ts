import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env";

// We pin the auth config explicitly so persistence does NOT silently change
// based on supabase-js defaults across upgrades.
//   - storage: localStorage so the session survives tab + browser close
//   - storageKey: stable named key (avoid collisions with any other supabase
//     instances and make it easy to inspect in DevTools)
//   - persistSession + autoRefreshToken: keep the user signed in indefinitely
//     as long as the refresh token is valid (configured in Supabase dashboard)
//   - detectSessionInUrl: needed for magic link / OAuth flows even if unused now
export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: {
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    storageKey: "kayan-marketing-auth",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
