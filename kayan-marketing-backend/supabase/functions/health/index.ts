import { jsonSuccess } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  return jsonSuccess({ status: "ok", timestamp: new Date().toISOString() });
});
