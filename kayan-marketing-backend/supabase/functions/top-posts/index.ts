import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.0";
import { jsonSuccess, jsonError } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { toCamel } from "../_shared/case.ts";

const PLATFORM_VALUES = ["tiktok", "instagram", "snapchat"] as const;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const createSchema = z.object({
  brandId: z.string().uuid(),
  entryId: z.string().uuid().nullable().optional(),
  platform: z.enum(PLATFORM_VALUES),
  postDate: z.string().regex(DATE_REGEX),
  captionSnippet: z.string().max(500).nullable().optional(),
  plays: z.number().int().nonnegative().nullable().optional(),
  likes: z.number().int().nonnegative().nullable().optional(),
  comments: z.number().int().nonnegative().nullable().optional(),
  shares: z.number().int().nonnegative().nullable().optional(),
  engagementRate: z.number().min(0).max(100).nullable().optional(),
  thumbnailUrl: z.string().url().nullable().optional(),
  postUrl: z.string().url().nullable().optional(),
});

const updateSchema = createSchema.partial().omit({ brandId: true });

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
  const isCollection = lastPart === "top-posts";
  const postId = isCollection ? null : lastPart;

  if (req.method === "GET" && isCollection) {
    const brandId = url.searchParams.get("brandId");
    const fromDate = url.searchParams.get("from");
    const toDate = url.searchParams.get("to");
    const platformFilter = url.searchParams.get("platform");
    const sort = url.searchParams.get("sort") ?? "post_date";

    if (!brandId) return jsonError("VALIDATION_FAILED", "brandId is required.", 422);

    let q = db.from("top_posts").select("*").eq("brand_id", brandId);
    if (fromDate) q = q.gte("post_date", fromDate);
    if (toDate) q = q.lte("post_date", toDate);
    if (platformFilter) q = q.eq("platform", platformFilter);
    q = q.order(sort, { ascending: false });

    const { data, error } = await q;
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data));
  }

  if (req.method === "POST" && isCollection) {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError("VALIDATION_FAILED", "Invalid JSON.", 400);
    }
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("VALIDATION_FAILED", "Validation failed.", 422, {
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    const { data, error } = await db
      .from("top_posts")
      .insert({
        brand_id: parsed.data.brandId,
        entry_id: parsed.data.entryId ?? null,
        platform: parsed.data.platform,
        post_date: parsed.data.postDate,
        caption_snippet: parsed.data.captionSnippet ?? null,
        plays: parsed.data.plays ?? null,
        likes: parsed.data.likes ?? null,
        comments: parsed.data.comments ?? null,
        shares: parsed.data.shares ?? null,
        engagement_rate: parsed.data.engagementRate ?? null,
        thumbnail_url: parsed.data.thumbnailUrl ?? null,
        post_url: parsed.data.postUrl ?? null,
      })
      .select()
      .single();
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data), 201);
  }

  if (req.method === "PATCH" && postId) {
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
    const d = parsed.data;
    if (d.entryId !== undefined) dbInput.entry_id = d.entryId;
    if (d.platform !== undefined) dbInput.platform = d.platform;
    if (d.postDate !== undefined) dbInput.post_date = d.postDate;
    if (d.captionSnippet !== undefined) dbInput.caption_snippet = d.captionSnippet;
    if (d.plays !== undefined) dbInput.plays = d.plays;
    if (d.likes !== undefined) dbInput.likes = d.likes;
    if (d.comments !== undefined) dbInput.comments = d.comments;
    if (d.shares !== undefined) dbInput.shares = d.shares;
    if (d.engagementRate !== undefined) dbInput.engagement_rate = d.engagementRate;
    if (d.thumbnailUrl !== undefined) dbInput.thumbnail_url = d.thumbnailUrl;
    if (d.postUrl !== undefined) dbInput.post_url = d.postUrl;

    const { data, error } = await db
      .from("top_posts")
      .update(dbInput)
      .eq("id", postId)
      .select()
      .single();
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data));
  }

  if (req.method === "DELETE" && postId) {
    const { error } = await db.from("top_posts").delete().eq("id", postId);
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return jsonError("NOT_FOUND", "Route not found.", 404);
});
