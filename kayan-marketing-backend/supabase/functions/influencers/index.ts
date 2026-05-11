import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.0";
import { jsonSuccess, jsonError } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { toCamel } from "../_shared/case.ts";

// Internal admin CRUD for Kayan's influencer database. Public creator portal,
// submissions, scoring, and WhatsApp integrations come in later chunks.

const STATUS_VALUES = ["active", "paused", "blacklisted"] as const;
const NICHE_TAGS = [
  "food",
  "lifestyle",
  "family",
  "comedy",
  "beauty",
  "fitness",
  "fashion",
  "travel",
  "parenting",
  "tech",
  "gaming",
  "music",
] as const;
const LANGUAGE_VALUES = ["arabic", "english"] as const;

const phoneSchema = z
  .string()
  .trim()
  .min(5)
  .max(40)
  .regex(/^\+?[0-9][0-9\s().-]*$/, "Use a valid WhatsApp phone number.");

const nullableText = z.string().trim().max(500).nullable().optional();
const nullableUrl = z.string().trim().url().nullable().optional();
const followers = z.number().int().nonnegative().nullable().optional();
const handle = z.string().trim().max(120).nullable().optional();

function hasHandle(data: {
  tiktokHandle?: string | null;
  instagramHandle?: string | null;
  snapchatHandle?: string | null;
}): boolean {
  return Boolean(
    data.tiktokHandle?.trim() ||
    data.instagramHandle?.trim() ||
    data.snapchatHandle?.trim(),
  );
}

const baseSchema = z.object({
  brandId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(200),
  fullName: nullableText,
  whatsapp: phoneSchema,
  city: nullableText,
  tiktokHandle: handle,
  tiktokUrl: nullableUrl,
  tiktokFollowers: followers,
  instagramHandle: handle,
  instagramUrl: nullableUrl,
  instagramFollowers: followers,
  snapchatHandle: handle,
  snapchatUrl: nullableUrl,
  snapchatFollowers: followers,
  standardRate: z.number().nonnegative().nullable().optional(),
  acceptsBarter: z.boolean().default(false),
  nicheTags: z.array(z.enum(NICHE_TAGS)).default([]),
  languages: z.array(z.enum(LANGUAGE_VALUES)).default([]),
  notes: z.string().trim().max(5000).nullable().optional(),
  status: z.enum(STATUS_VALUES).default("active"),
});

const createSchema = baseSchema.superRefine((data, ctx) => {
  if (!hasHandle(data)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["tiktokHandle"],
      message: "Add at least one platform handle.",
    });
  }
});

const updateSchema = baseSchema.partial().superRefine((data, ctx) => {
  if (
    data.tiktokHandle !== undefined &&
    data.instagramHandle !== undefined &&
    data.snapchatHandle !== undefined &&
    !hasHandle(data)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["tiktokHandle"],
      message: "Add at least one platform handle.",
    });
  }
});

interface DbError {
  message: string;
  code?: string;
}

function cleanText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toDbInput(
  data: Partial<z.infer<typeof baseSchema>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (data.brandId !== undefined) out.brand_id = data.brandId;
  if (data.displayName !== undefined)
    out.display_name = data.displayName.trim();
  if (data.fullName !== undefined) out.full_name = cleanText(data.fullName);
  if (data.whatsapp !== undefined) out.whatsapp = data.whatsapp.trim();
  if (data.city !== undefined) out.city = cleanText(data.city);
  if (data.tiktokHandle !== undefined)
    out.tiktok_handle = cleanText(data.tiktokHandle);
  if (data.tiktokUrl !== undefined) out.tiktok_url = cleanText(data.tiktokUrl);
  if (data.tiktokFollowers !== undefined)
    out.tiktok_followers = data.tiktokFollowers;
  if (data.instagramHandle !== undefined)
    out.instagram_handle = cleanText(data.instagramHandle);
  if (data.instagramUrl !== undefined)
    out.instagram_url = cleanText(data.instagramUrl);
  if (data.instagramFollowers !== undefined)
    out.instagram_followers = data.instagramFollowers;
  if (data.snapchatHandle !== undefined)
    out.snapchat_handle = cleanText(data.snapchatHandle);
  if (data.snapchatUrl !== undefined)
    out.snapchat_url = cleanText(data.snapchatUrl);
  if (data.snapchatFollowers !== undefined)
    out.snapchat_followers = data.snapchatFollowers;
  if (data.standardRate !== undefined) out.standard_rate = data.standardRate;
  if (data.acceptsBarter !== undefined) out.accepts_barter = data.acceptsBarter;
  if (data.nicheTags !== undefined) out.niche_tags = data.nicheTags;
  if (data.languages !== undefined) out.languages = data.languages;
  if (data.notes !== undefined) out.notes = cleanText(data.notes);
  if (data.status !== undefined) out.status = data.status;
  return out;
}

function constraintError(error: DbError): Response {
  if (error.code === "23514") {
    return jsonError("VALIDATION_FAILED", "Validation failed.", 422, {
      database: error.message,
    });
  }
  return jsonError("INTERNAL_ERROR", error.message, 500);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const db = createClient(supabaseUrl, serviceKey);

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const baseIdx = pathParts.indexOf("influencers");
  const influencerId = pathParts[baseIdx + 1] ?? null;
  // Sub-action segments after :id, e.g. /influencers/:id/rotate-token
  // and /influencers/:id/status.
  const subAction = pathParts[baseIdx + 2] ?? null;
  const isCollection = influencerId === null;

  // Wraps get_influencer_reliability — failures aren't fatal here; the
  // caller is the admin UI which renders the influencer row regardless.
  const fetchReliability = async (id: string): Promise<unknown> => {
    const { data } = await db.rpc("get_influencer_reliability", {
      p_influencer_id: id,
    });
    return data ?? null;
  };

  if (req.method === "GET" && isCollection) {
    const status = url.searchParams.get("status");
    const qRaw = url.searchParams.get("q");
    const niche = url.searchParams.get("niche");

    let q = db
      .from("influencers")
      .select("*")
      .order("created_at", { ascending: false });

    if (
      status &&
      STATUS_VALUES.includes(status as (typeof STATUS_VALUES)[number])
    ) {
      q = q.eq("status", status);
    }
    if (niche) q = q.contains("niche_tags", [niche]);
    if (qRaw && qRaw.trim().length > 0) {
      const safe = qRaw.trim().replace(/[%_,]/g, "");
      q = q.or(
        [
          `display_name.ilike.%${safe}%`,
          `whatsapp.ilike.%${safe}%`,
          `tiktok_handle.ilike.%${safe}%`,
          `instagram_handle.ilike.%${safe}%`,
          `snapchat_handle.ilike.%${safe}%`,
        ].join(","),
      );
    }

    const { data, error } = await q;
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);

    // Optional reliability join — opt-in to keep the default list
    // lightweight. Used by the Influencers list page when the user
    // turns on the reliability column / high-reliability filter.
    const includeReliability =
      url.searchParams.get("includeReliability") === "true";
    if (!includeReliability) {
      return jsonSuccess(toCamel(data));
    }

    const camelRows = toCamel<Array<{ id: string }>>(data ?? []);
    const enriched = await Promise.all(
      camelRows.map(async (row) => {
        const reliability = await fetchReliability(row.id);
        return { ...row, reliability };
      }),
    );
    return jsonSuccess(enriched);
  }

  if (req.method === "GET" && influencerId && !subAction) {
    const { data, error } = await db
      .from("influencers")
      .select("*")
      .eq("id", influencerId)
      .single();
    if (error) return jsonError("NOT_FOUND", "Influencer not found.", 404);
    const reliability = await fetchReliability(influencerId);
    return jsonSuccess({
      ...(toCamel(data) as Record<string, unknown>),
      reliability,
    });
  }

  // POST /influencers/:id/rotate-token — generate a fresh portal token
  // via RPC. Returns the influencer row with the rotated token + the
  // refreshed reliability (so the UI can re-render in one shot).
  if (
    req.method === "POST" &&
    influencerId &&
    subAction === "rotate-token"
  ) {
    const { data: tokenData, error: tokenError } = await db.rpc(
      "rotate_influencer_token",
      {
        p_influencer_id: influencerId,
        p_user_id: auth.userId,
      },
    );
    if (tokenError) {
      const isMissing = /not found/i.test(tokenError.message);
      return jsonError(
        isMissing ? "NOT_FOUND" : "INTERNAL_ERROR",
        tokenError.message,
        isMissing ? 404 : 500,
      );
    }
    const { data: row, error: rowError } = await db
      .from("influencers")
      .select("*")
      .eq("id", influencerId)
      .single();
    if (rowError) return jsonError("INTERNAL_ERROR", rowError.message, 500);
    const reliability = await fetchReliability(influencerId);
    return jsonSuccess({
      ...(toCamel(row) as Record<string, unknown>),
      reliability,
      portalToken: tokenData as string,
    });
  }

  // PATCH /influencers/:id/status — narrow convenience endpoint to flip
  // active / paused / blacklisted without going through the full update
  // schema (which carries every editable field).
  if (
    req.method === "PATCH" &&
    influencerId &&
    subAction === "status"
  ) {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError("VALIDATION_FAILED", "Invalid JSON.", 400);
    }
    const parsed = z
      .object({ status: z.enum(STATUS_VALUES) })
      .safeParse(body);
    if (!parsed.success) {
      return jsonError("VALIDATION_FAILED", "Validation failed.", 422, {
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }
    const { data, error } = await db
      .from("influencers")
      .update({ status: parsed.data.status })
      .eq("id", influencerId)
      .select()
      .single();
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    const reliability = await fetchReliability(influencerId);
    return jsonSuccess({
      ...(toCamel(data) as Record<string, unknown>),
      reliability,
    });
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
      .from("influencers")
      .insert({
        ...toDbInput(parsed.data),
        portal_token: crypto.randomUUID(),
        portal_activated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) return constraintError(error as DbError);
    return jsonSuccess(toCamel(data), 201);
  }

  if (req.method === "PATCH" && influencerId && !subAction) {
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

    const { data, error } = await db
      .from("influencers")
      .update(toDbInput(parsed.data))
      .eq("id", influencerId)
      .select()
      .single();
    if (error) return constraintError(error as DbError);
    return jsonSuccess(toCamel(data));
  }

  if (req.method === "DELETE" && influencerId && !subAction) {
    const { error } = await db
      .from("influencers")
      .delete()
      .eq("id", influencerId);
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return jsonError("NOT_FOUND", "Route not found.", 404);
});
