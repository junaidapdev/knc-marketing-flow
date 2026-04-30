import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthContext {
  userId: string;
  email: string;
}

export async function requireAuth(req: Request): Promise<AuthContext | { error: Response }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return {
      error: new Response(
        JSON.stringify({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Missing Authorization header." },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    return {
      error: new Response(
        JSON.stringify({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Server configuration error." },
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      ),
    };
  }

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) {
    return {
      error: new Response(
        JSON.stringify({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Invalid or expired token." },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    };
  }

  return { userId: user.id, email: user.email ?? "" };
}
