import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonSuccess, jsonError } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { toCamel } from "../_shared/case.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return jsonError("NOT_FOUND", "Method not supported.", 404);

  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const db = createClient(supabaseUrl, serviceKey);

  const url = new URL(req.url);
  const brandId = url.searchParams.get("brandId");

  let q = db
    .from("branches")
    .select("*")
    .eq("is_active", true)
    .order("city", { ascending: true })
    .order("name", { ascending: true });

  if (brandId) q = q.eq("brand_id", brandId);

  const { data, error } = await q;
  if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
  return jsonSuccess(toCamel(data));
});
