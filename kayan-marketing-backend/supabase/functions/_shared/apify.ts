// Thin wrapper around the Apify run-sync-get-dataset-items endpoint. Returns
// the actor's dataset rows as a typed array. Rejects on any non-2xx with a
// safe message that does NOT include the token.
//
// The token is read at the call site (via Deno.env.get) and passed in as an
// argument — the wrapper itself never touches process env so it stays
// trivially testable. The token never appears in returned data, error
// messages, or logs.

const APIFY_BASE = "https://api.apify.com/v2";

// Apify URL paths use tildes between username and actor name; the rest of
// the codebase carries the human-readable slash form.
function toUrlForm(actor: string): string {
  return actor.replace("/", "~");
}

export interface RunActorOptions {
  // Hard server-side timeout (seconds). Apify holds the connection open up
  // to this long before returning whatever's been collected.
  timeoutSec?: number;
}

export async function runActorSync<TItem = unknown>(
  actor: string,
  token: string,
  input: unknown,
  options: RunActorOptions = {},
): Promise<TItem[]> {
  if (!token) throw new Error("Apify token missing.");
  const timeout = options.timeoutSec ?? 180;
  const path = `/acts/${toUrlForm(actor)}/run-sync-get-dataset-items`;
  const url = `${APIFY_BASE}${path}?token=${encodeURIComponent(token)}&timeout=${timeout}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    // Truncate any upstream body so we never echo more than ~200 chars back
    // through the call chain (defensive against accidental token leaks).
    const text = (await res.text().catch(() => "")) ?? "";
    throw new Error(
      `Apify ${actor} responded ${res.status}: ${text.slice(0, 200)}`,
    );
  }

  return (await res.json()) as TItem[];
}
