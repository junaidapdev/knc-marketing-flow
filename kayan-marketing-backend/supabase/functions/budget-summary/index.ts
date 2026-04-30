import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.0";
import { jsonSuccess, jsonError } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { toCamel } from "../_shared/case.ts";

const querySchema = z.object({
  brandId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  if (req.method !== "GET") {
    return jsonError("NOT_FOUND", "Method not supported.", 404);
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    brandId: url.searchParams.get("brandId"),
    month: url.searchParams.get("month"),
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_FAILED", "Invalid query.", 422, {
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const db = createClient(supabaseUrl, serviceKey);

  const { data, error } = await db.rpc("get_budget_summary", {
    p_brand_id: parsed.data.brandId,
    p_month: parsed.data.month,
  });

  if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
  return jsonSuccess(toCamel(data));
});
