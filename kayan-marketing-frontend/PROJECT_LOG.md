# Kayan Marketing Frontend — Project Log

## Chunk 1: Scaffolding (DONE)
- Vite + React 18 + TS strict initialized
- Tailwind configured with Kayan brand color tokens (placeholder)
- Standards established: env config, logger, ESLint bans console + any

## Chunk 4: Frontend Shell + Auth (DONE)
- Auth store (Zustand), `useAuthInit` hook, `ProtectedRoute`, `AppShell` with sidebar
- Login page with React Hook Form + Zod
- Six placeholder pages routed (Today, Calendar, Campaigns, Performance, Budget, Settings)
- API client utility with auth header injection (`apiRequest`)
- React Query provider wired at app root

## Chunk 5: Calendar Entries + Tasks CRUD (DONE)
- Mirrored constants (`entry-types`, `task-chains`, `budget-categories`) + `computeTaskChain()` for client-side preview
- Domain types: `CalendarEntry`, `Task`, `EntryStatus`, `TaskStatus`
- Hooks: `useCalendarEntries`, `useEntryDetail`, `useCreateEntry`, `useUpdateEntry`, `useDeleteEntry`, `useTasks`, `useCreateTask`, `useUpdateTask`, `useDeleteTask` (React Query, auto-invalidation)
- `AddEntryModal` (RHF + Zod, live task-chain preview, brand color tokens)
- `EntryDetailPanel` (read view + edit form + task status cycling + delete)
- `apiRequest` now handles 204 No Content for DELETE

## Chunk 6: Today Page (DONE)
- New page-aggregation hook `useTodaySummary(brandId, today)` — single query against `/today-summary`
- `useToggleTaskStatus` — optimistic cache patching against `today-summary` query, rolls back on PATCH failure
- Sub-components in `src/features/today/`: `OverdueAlertStrip`, `TaskRow`, `DailyDocket` (grouped by assignee), `ThreeDayRadar`, `BudgetSnapshot`
- `QuickAddTaskModal` for standalone tasks (RHF + Zod)
- `Today.tsx` wires everything: refresh button, "+ New Task", "+ Add Calendar Entry" (opens chunk-5 modal), task menu opens parent entry's detail panel
- `KAYAN_BRAND_ID` constant + `useCurrentBrand()` hook for V1 single-tenant brand resolution

## Chunk 7: Calendar Views (DONE)
- `ENTRY_TYPE_COLORS` Tailwind class map (placeholder; design system phase replaces)
- `EntryChip` shared compact/stacked chip
- `MonthlyView` — 7-col Sun-first grid, up to 3 chips per day + "+N more", today highlight, day-click drills to weekly, hover-+ adds entry on that day
- `WeeklyView` — 7 stacked columns Sun-Sat, today column highlighted, "+ Add" affordance per cell, right rail of pending tasks for the week
- `Calendar.tsx` page: header with month/week label, prev/today/next nav, Monthly/Weekly toggle, "+ Add Entry"
- `AddEntryModal` accepts `defaultDate` so day-click prefills targetDate; resets correctly across reopens

## Chunk 8: Campaigns (DONE)
- Constants: `CAMPAIGN_TYPES`, `CAMPAIGN_STATUSES`, `AD_PLATFORMS`, `AD_OBJECTIVES`, `ROLLOUT_STATUSES` + label maps
- Domain types: `Campaign`, `CampaignDetail` (with joined rollouts + ad-spend), `CampaignBranchRollout`, `CampaignAdSpend`, `Branch`
- Hooks: `useCampaigns`, `useCampaign`, `useCreateCampaign`, `useUpdateCampaign`, `useDeleteCampaign`, `useBranches` (direct supabase-js), `useCampaignEntries`
- `CampaignForm` — single scrolling form with collapsible Sections (Basics, Offer details, Branch rollouts, Ad spend lines, Notes); RHF `useFieldArray` for rollouts + ad lines; client-side Zod cross-field validation (end >= start, rollout dates within window, ad windows within campaign window)
- `Campaigns.tsx` — list with All/Planned/Active/Completed/Cancelled filter pills, table view, click row → detail
- `CampaignDetail.tsx` — 6 tabs: Overview, Branch Rollout (with calendar-entry deep links), Linked Content, Ad Spend, Budget (computed roll-up), Results (locked until status = completed); status-change select + delete
- Router: `/campaigns/:id` mounted in App.tsx

## Chunk 9: Performance + Budget (DONE)
- Constants: `SOCIAL_PLATFORMS` + labels + brand colors
- Types: `PerformanceSnapshot`, `TopPost`, `BudgetSummary`, `BudgetCap`, `BudgetContributingRow`
- Hooks: `usePerformanceSnapshots`, `useUpsertSnapshot`, `useTopPosts`, `useCreateTopPost`, `useDeleteTopPost`, `useBudgetSummary`, `useBudgetCap`, `useUpsertBudgetCap`
- Performance page: 3 platform cards (followers + 7d/30d deltas computed from up to 60d of snapshots), Recharts `FollowerTrendChart` with 30D/60D/90D toggle, Top Posts table sorted by plays, two modals (Log Weekly Snapshot, Log Top Post)
- Budget page: month selector (prev/this/next), total cap card with progress bar, 7 category cards in a grid (each click-to-expand showing contributing entries + ad-spend lines), `EditBudgetModal` to upsert cap and per-category caps
- Color thresholds for progress bars: ≥90% red, ≥70% yellow, else emerald
- Recharts installed (39 packages, ~50 kB gzipped)

## Chunk 10: AI Assistant (DONE)
- Constants: `PROMPT_TEMPLATES` (7) + labels + per-template input placeholders, `AI_CONTEXT_TYPES`
- `useAIStore` (Zustand): isOpen, context (type/contextId/label/entryType/payload), conversationId, template, messages — context change resets conversation
- `getAvailablePrompts(routePath, ctx)` — entry-type-aware (video entries → Generate Script, Suggest Hooks, Caption & Hashtags), route-aware (`/calendar` → Content Gap Analysis, `/performance` → Monthly Report), Trend Brief + Free-form always present
- `useAIChat` — wraps `apiRequest('/ai-assistant', ...)`; optimistic user message render, conversationId persisted in store
- `AIFloatingButton` — fixed bottom-right pill, hides itself when panel is open
- `AIPanel` — slide-in side panel (full-screen on mobile, 420 px on desktop): context line + Clear button, prompt-template chip row, scrollable message thread, "New conversation" reset, ⌘/Ctrl+Enter to send, 10k-char counter, per-message Copy / Save to entry notes
- Mounted in `AppShell` so the button + panel appear on every protected page (never on `/login`)
- `EntryDetailPanel` and `CampaignDetail` push their context into `useAIStore` while open and clear it on unmount

## V1 COMPLETE
- Pages: Login, Today, Calendar, Campaigns, CampaignDetail, Performance, Budget, Settings (placeholder), AI panel global
- All 15 engineering standards observed end-to-end

## Post-V1: Branch tracking for shop activities (DONE)
- `CalendarEntry.branchId: string | null` + optional `branch: EntryBranchSummary | null` (populated only on detail GET); `Task.branch: EntryBranchSummary | null` (populated only by today-summary)
- Moved `useBranches` from `features/campaigns/hooks` to `features/branches/hooks`, switched from direct supabase-js query to `apiRequest('/branches')`. Added `formatBranchLabel` and `groupBranchesByCity` helpers in `features/branches/utils/branch-helpers.ts`
- `BranchSelector` shared component (native `<select>` with `<optgroup>` per city, keyboard-accessible). Used in AddEntryModal, EntryDetailPanel, and the Calendar branch filter
- `AddEntryModal`: branch field renders only when `type === 'shop_activity'`; Zod `superRefine` requires it client-side mirroring the backend rule; switching away clears the value, switching to shop_activity autofocuses the selector
- `EntryDetailPanel`: read view shows "Branch: <name>, <city>" for shop_activity entries; edit form exposes the same selector with PATCH including `branchId` on save
- `Calendar.tsx`: branch filter dropdown in header; state in URL search param `?branchId=` via `useSearchParams` (replace mode); persists across refresh and monthly⇄weekly toggle. `useCalendarEntries` accepts `branchId`. MonthlyView and WeeklyView both pass it to the hook so the filter applies to all entries that have a branch_id, not just shop activities
- `Today` view: `TaskRow` shows an emerald MapPin chip when the task's parent entry has a branch — surfaces the location on the docket without needing to open the entry

## Influencer Search — Chunk 1: Foundation (DONE)
- Constants `src/constants/influencer.ts`: `PLATFORMS` (tiktok|instagram|youtube), `CONTENT_CATEGORIES` (dessert|food|family|gifting|lifestyle), `LANGUAGES` (arabic|english|both), `GCC_COUNTRIES` (sa|ae|kw|bh|qa|om), `CREATOR_SEARCH_STATUSES` — all with display label maps, mirroring migration 0039 CHECK constraints
- Types `src/types/influencer.ts`: `CreatorSearch`, `CreatorResult`, `SavedCreator`, `CreatorSearchFilters`, `CreatorSearchCost`, `CreatorAudienceDemographics`. Re-exported from `types/index.ts`
- Route `INFLUENCER_SEARCH = "/influencers/search"` added to `constants/routes.ts` and registered in `App.tsx`
- Sidebar entry "Influencer Search" with the `Search` icon (lucide-react), placed between Topics and Campaigns in `AppShell.tsx`
- `pages/InfluencerSearch.tsx`: title-only scaffold page so the route + nav are demoable
- No filter form, results, or backend wiring yet — those start in Chunk 2 (mocked) and Chunk 3 (real Apify)

## Influencer Search — Chunk 2: Filter form + results grid (mocked) (DONE)
- New folder `src/features/influencers/`:
  • `components/FilterForm.tsx` — RHF + Zod, all 6 filter groups (platforms multi-select with min-1 rule, location countries + city, audience age range with min/max number inputs 13–65, gender skew, audience country breakdown, follower min/max, engagement rate min/max %, avg views min, avg likes min, posting frequency, content categories multi-select, language). Cross-field validation via `superRefine`: max ≥ min for age, followers, and engagement
  • `components/ResultCard.tsx` — avatar (or `User` icon fallback), `@handle`, platform chip, city/country line, follower + engagement metrics, score placeholder ("—" with tooltip pointing to Chunk 5), Save button (no-op, local-state-only flip to `BookmarkCheck`)
  • `components/ResultsGrid.tsx` — responsive grid (1 / 2 / 3 cols at sm / xl), with empty/loading/error states
  • `hooks/use-creator-search.ts` — React Query mutation calling a 600 ms stub that filters `MOCK_CREATORS` by selected platforms only (other filters wait for Chunk 3 backend)
  • `data/mock-creators.ts` — 10 hardcoded GCC dessert/family/food creators across all 3 platforms
  • `utils/format.ts` — `formatFollowerCount` (480_000 → "480K", 1_240_000 → "1.2M") and `formatEngagementRate` (handles both decimal `0.054` and already-percent `5.4` inputs)
- `pages/InfluencerSearch.tsx` rewired into a two-column layout (`lg:grid-cols-[360px_1fr]`); collapses to single column below `lg`. Stale-result preservation: latest successful results persist across rerenders that aren't part of a new search
- No backend wiring, no real persistence — Save button local-only; mutation never hits the network. All standards observed (no `any`, Zod validates before submit, no `console.*`, constants/types modular)
- `npm run build`, `eslint`, and `tsc --noEmit` all clean

## Influencer Search — Chunk 3+4: Real Apify backend wiring (DONE)
- `useCreatorSearch` swapped from the 600 ms mock to a real `apiRequest("/search-creators", ...)` call. Returns the new `CreatorSearchResponse` shape `{ searchId, results, failureReasons }`. Mock dataset (`data/mock-creators.ts`) is left in place as dead code in case it's useful for storybook/tests later — easy to delete in a polish pass.
- New `CreatorSearchResponse` type added to `types/influencer.ts` covering the `failureReasons: string[]` partial-failure surface.
- `InfluencerSearch.tsx` now renders an inline `FailureStrip` (yellow-bg warning style matching the existing `TimelineWarning`) above the results grid whenever `failureReasons` is non-empty. Each reason is a `"<platform>: <message>"` string truncated to 140 chars; the platform name is rendered in a mono chip for scannability.
- All three platform checkboxes stay enabled (Chunk 2 never gated them, since the partial-Chunk-3 work merged straight into Chunk 4).
- Standards observed: no `any`, no `console.*`, types modular, Zod still validates the form. `npm run build`, `eslint`, and `tsc --noEmit` all clean.

## Influencer Search — Chunk 5: Claude-scored creator ranking (DONE)
- `ResultCard` now renders a real `Fit score` chip (color-coded per Chunk 5 spec: ≥80 emerald via `bg-sage`, ≥60 yellow via `bg-yellow`, else neutral `bg-cream-2`). Chip label is the integer 0–100, hover shows the rationale.
- New full-width italic `rationale` line below the metrics row — surfaces Claude's one-sentence "why this score" verdict. Hidden when the rationale is null.
- Cards render in the order returned by the backend (already sorted `fit_score desc, engagement_rate desc, follower_count desc`); no client-side re-sorting.
- All standards observed (no `any`, no `console.*`, no inline magic numbers). `npm run build`, `eslint`, and `tsc --noEmit` clean.
