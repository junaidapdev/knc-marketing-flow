import { z } from "zod";

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
  VITE_API_BASE_URL: z.string().url().default("http://localhost:54321"),
  // Internal-tool auto-login: when both are set, the app skips the login
  // screen and signs in automatically. Leave both empty to fall back to the
  // normal login flow.
  VITE_AUTO_LOGIN_EMAIL: z.string().optional(),
  VITE_AUTO_LOGIN_PASSWORD: z.string().optional(),
  // V1 launch toggle: hide every AI-flavored surface (✨ Generate buttons,
  // the Kayan AI side panel, the "Generate riff" button on top posts).
  // The store, hook, edge function, and parser stay intact — V2 just flips
  // this on. Defaults to false so prod ships clean unless explicitly set.
  VITE_AI_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  MODE: z.enum(["development", "production", "test"]).default("development"),
});

const parsed = envSchema.safeParse(import.meta.env);
if (!parsed.success) {
  throw new Error(
    `Invalid environment variables: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
  );
}

export const env = parsed.data;
export const isDev = env.MODE === "development";
export const isProd = env.MODE === "production";
// AI feature gate. Read from this everywhere instead of `env.VITE_AI_ENABLED`
// so the call sites stay readable.
export const isAIEnabled = env.VITE_AI_ENABLED;
