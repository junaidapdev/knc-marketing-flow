# Kayan Marketing Frontend — Claude Code Context

## What This Is
React 18 + Vite + TypeScript strict frontend for Kayan Marketing OS.

## Critical Standards
- No `any` types
- No direct `import.meta.env` — use `src/config/env.ts`
- No `console.*` — use `src/utils/logger.ts` (ESLint enforces)
- All constants in `src/constants/`
- All types modular, grouped by domain
- Zod for all validation
- React Query for server state, Zustand for UI state (added Chunk 4)
- React Hook Form for forms (added Chunk 5)

## File Layout
- `src/config/` — env access (typed, validated)
- `src/constants/` — routes, errors, business rules
- `src/types/` — typed domain contracts
- `src/utils/` — logger, api-client
- `src/lib/` — third-party client wrappers (supabase, etc.)
- `src/pages/` — route components
- `src/components/` — reusable UI (added Chunk 4+)
- `src/features/` — feature folders (calendar, campaigns, etc.) — added Chunk 5+

## See PROJECT_LOG.md for current state.
