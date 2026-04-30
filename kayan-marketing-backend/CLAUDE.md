# Kayan Marketing Backend — Claude Code Context

## What This Is
Backend for Kayan Marketing OS. Supabase (Postgres + Auth + Edge Functions). Single user V1 (Junaid).

## Critical Standards (Never Violate)
- No `any` types — use `unknown` + type guards
- All env via `src/config/env.ts` — never `process.env` directly
- All constants in `src/constants/` — no inline magic strings/numbers
- All errors via `constants/errors.ts` — never inline error messages
- Common API response shape via `src/utils/api-response.ts`
- HTTP status codes from `constants/http-status.ts` only
- Use `logger` from `src/utils/logger.ts` — never `console.log`
- Multi-write DB operations use transactions
- Zod for all validation

## Project Phases
See `PROJECT_LOG.md` for what's been built and what's next.

## File Layout
- `src/config/` — env config (one source of truth)
- `src/constants/` — errors, status codes, business rules
- `src/types/` — typed contracts (one domain per file)
- `src/utils/` — logger, response builders
- `supabase/migrations/` — SQL migrations
- `supabase/seed/` — seed data scripts
- `supabase/functions/` — Edge Functions (Deno runtime)
