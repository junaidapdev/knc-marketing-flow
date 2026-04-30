import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.0";
import { jsonSuccess, jsonError } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { toCamel } from "../_shared/case.ts";

// V1 is single-tenant; the only brand is Kayan Sweets. The frontend usually
// calls GET /brands/<id> with the seeded UUID and PATCHes the same id when
// the marketer edits voice config or brand DNA.

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  primaryColor: z.string().max(20).nullable().optional(),
  voiceConfig: z.record(z.unknown()).optional(),
  dnaMarkdown: z.string().max(50000).nullable().optional(),
  instagramHandle: z.string().max(80).nullable().optional(),
  tiktokHandle: z.string().max(80).nullable().optional(),
  defaultShootCapacity: z.number().int().min(1).max(20).optional(),
  defaultEditorOffset: z.number().int().min(0).max(30).optional(),
  defaultSchedulingBuffer: z.number().int().min(0).max(30).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const db = createClient(supabaseUrl, serviceKey);

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1] ?? "";
  const isCollection = lastPart === "brands";
  const brandId = isCollection ? null : lastPart;

  if (req.method === "GET" && isCollection) {
    const { data, error } = await db
      .from("brands")
      .select("*")
      .order("name", { ascending: true });
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data));
  }

  if (req.method === "GET" && brandId) {
    const { data, error } = await db
      .from("brands")
      .select("*")
      .eq("id", brandId)
      .single();
    if (error) return jsonError("NOT_FOUND", error.message, 404);
    return jsonSuccess(toCamel(data));
  }

  if (req.method === "PATCH" && brandId) {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError("VALIDATION_FAILED", "Invalid JSON.", 400);
    }
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("VALIDATION_FAILED", "Validation failed.", 422, {
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    const dbInput: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) dbInput.name = parsed.data.name;
    if (parsed.data.primaryColor !== undefined) dbInput.primary_color = parsed.data.primaryColor;
    if (parsed.data.voiceConfig !== undefined) dbInput.voice_config = parsed.data.voiceConfig;
    if (parsed.data.dnaMarkdown !== undefined) dbInput.dna_markdown = parsed.data.dnaMarkdown;
    if (parsed.data.instagramHandle !== undefined) dbInput.instagram_handle = parsed.data.instagramHandle;
    if (parsed.data.tiktokHandle !== undefined) dbInput.tiktok_handle = parsed.data.tiktokHandle;
    if (parsed.data.defaultShootCapacity !== undefined) dbInput.default_shoot_capacity = parsed.data.defaultShootCapacity;
    if (parsed.data.defaultEditorOffset !== undefined) dbInput.default_editor_offset = parsed.data.defaultEditorOffset;
    if (parsed.data.defaultSchedulingBuffer !== undefined) dbInput.default_scheduling_buffer = parsed.data.defaultSchedulingBuffer;

    const { data, error } = await db
      .from("brands")
      .update(dbInput)
      .eq("id", brandId)
      .select()
      .single();
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data));
  }

  return jsonError("NOT_FOUND", "Route not found.", 404);
});
