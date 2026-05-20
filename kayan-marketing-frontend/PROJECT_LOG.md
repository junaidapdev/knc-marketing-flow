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

## Influencer Search — REMOVED
Built across Chunks 1–8 (commits `214b87b` through `4510ee4`) and removed
on 2026-05-06. Pulled because the TikTok user-search actor proved too
slow to fit inside Supabase's gateway IDLE_TIMEOUT (~150s) without an
async-polling refactor. All UI (FilterForm, ResultCard, ResultsGrid,
EstimateCostModal, SearchCostFooter, EstimatedBadge, CardSkeleton,
ResultsErrorBoundary, InfluencersTabs, SavedCreators page, etc.) and
the supporting hooks/types/constants are gone. See git history if you
ever want to revive the implementation.

## Influencer Management Chunk 1: Internal Admin CRUD (DONE)
- Added shared influencer constants, domain types, and React Query hooks for list/detail/create/update/delete against `/functions/v1/influencers`.
- Added protected routes `/influencers` and `/influencers/:id`, with sidebar navigation between Campaigns and Performance.
- `Influencers.tsx`: admin list with status tabs, search, niche filter, desktop table, mobile cards, platform chips, follower tier, status badge, tags, and rate.
- `InfluencerDetail.tsx`: profile view grouped into Contact, Platforms, Commercials, Content fit, Notes, Portal access, and Activity placeholder for Chunk 3; includes edit and hard-delete flow.
- `InfluencerFormModal`: RHF + Zod add/edit form with identity, platform, commercial, fit, notes, and status fields; create success exposes the future creator portal link and copyable WhatsApp welcome message.

## Influencer Management Chunk 2: Creator Portal Read-Only (DONE)
- Added public route `/creator/:token` outside `ProtectedRoute` and outside `AppShell`, so creator links do not redirect to login and do not show admin navigation.
- Added portal API client using raw `fetch` against `/functions/v1/portal/:token` with no Supabase auth header, plus `usePortalProfile` React Query hook.
- Added `CreatorPortal.tsx`: mobile-first public profile page with Kayan branding, welcome headline, city, platform rows, niche/language chips, submissions placeholder for Chunk 3, and opaque invalid/deactivated-link messaging.
- Added `PortalInfluencerView` frontend type and portal copy constants.

## Influencer Management Chunk 3: Post Submission + Verification Queue (DONE)
- Submission infrastructure (Codex): types `InfluencerSubmission`, `InfluencerSubmissionListItem`, `InfluencerSubmissionDetail`, `InfluencerPerformanceLog`, `PortalSubmissionView`, `PortalCollaboration`; hooks `useInfluencerSubmissions`, `useInfluencerSubmission`, `useUpdateInfluencerSubmission`, `useInfluencerPerformanceLogs`, `useCreateInfluencerPerformanceLog`; portal hooks `usePortalCollaborations`, `useSubmitPortalPost`; `CreatorPortal.tsx` submission form (per-platform URL inputs gated by available handles, Tagged/Promo toggles, notes); `AddEntryModal` influencer dropdown gated by `type === 'influencer_collab'` with Zod superRefine; `InfluencerSelector` reusable searchable select.
- New `PendingVerifications` page at `/influencers/verifications`: filter chips (Pending / Disputed / Verified / All), desktop table + mobile cards listing influencer, collab, submitted date, platform icons, Tagged + Promo badges, status. Three modals — View (full submission with clickable post URLs + dispute reason), Verify (confirm-only — backend creates the follow-up "Log performance" task), Dispute (reason ≥ 5 chars required). Verified rows expose a "Log perf" action that opens the performance modal.
- New `PerformanceLogModal` (`features/influencers/PerformanceLogModal.tsx`): one input set per platform that actually has a post URL on the submission, suppresses platforms already logged. Save fires one POST per non-empty platform; success flash + auto-close.
- `InfluencerDetail` Activity placeholder replaced with `ActivityPanel` — performance summary tiles (Collabs / Submissions / Verified / Views / Likes / Comments / Shares aggregated from joined `performanceLogs`) plus a Collaborations list linking to each entry. Status chip per row uses Pending / Verified / Disputed / Awaiting depending on whether the entry has a submission.
- `Influencers` page header gets a secondary "Verifications" CTA (ShieldCheck icon) linking to the new page. Sidebar nav stays untouched — verifications is a sub-flow of the Influencers section.
- Routes: `INFLUENCER_VERIFICATIONS = "/influencers/verifications"` registered in `App.tsx` BEFORE the parameterized `/influencers/:id` so it doesn't get captured.

## Influencer Management Chunk 4: Reliability Score + Portal Management (DONE)
- New types `InfluencerReliability` + `InfluencerWithReliability` + portal `PortalReliabilityView` (discriminated by `available`).
- Hooks: `useInfluencersWithReliability`, `useRotateInfluencerToken`, `useUpdateInfluencerStatus`. `useInfluencer` now returns `InfluencerWithReliability` (reliability is merged server-side on detail).
- **Influencer Detail page**:
  • New top-of-section `Reliability` panel — three color-coded stat cards (Post / Tag / On-time, ≥80 sage / ≥50 yellow / <50 rose), gated by ≥3 collabs with a clear "X collabs so far" placeholder when below the threshold.
  • Replaced the old "Portal access" block with `Portal management` — prominent status badge, current portal URL with copy + open-in-new-tab, four actions (Rotate / Pause / Reactivate / Blacklist), two confirmation modals.
  • `RotateConfirmModal` is a two-step flow: pre-rotation warning → post-rotation "new link ready" view with copy buttons for both the URL and the WhatsApp welcome template (mirrors the create-influencer modal's surface).
  • `BlacklistConfirmModal` carries a red-banner warning and a reversible-but-portal-killing explanation.
- **Influencers list page**: new `Reliability` column showing the **composite** (min of the three rates) with the same chip palette. Quick-filter chip row: All / High reliability (all three rates ≥ 80) / Needs review (any rate < 50 OR not enough collabs yet). Filtering is client-side (≤200 row scale) — the hook now passes `?includeReliability=true`. Empty states distinguish between "no high-reliability yet" and the celebratory "nothing to review" case.
- **Creator portal**: new `PortalReliabilitySection` between profile and active collabs — same three cards when available, friendly "you're N away" message when fewer than 3 collabs. Includes "Keep your scores high to be invited to more campaigns" tagline.
- All standards observed: no `any`, no `console.*`, no inline magic numbers (constants for the gating threshold + chip thresholds), Zod stays on the form layer, React Query handles invalidation after rotation/status flips.

## V1 Influencer Management COMPLETE
**Pages**: `Influencers` (admin list + reliability filters), `InfluencerDetail` (full admin profile, activity, portal management), `PendingVerifications` (queue + verify/dispute/log-perf flow), `CreatorPortal` (public, mobile-first).

**Backend**: 9 migrations (0046 → reliability/rotation), 4 Edge Functions (`influencers`, `portal`, `influencer-submissions`, `influencer-performance`), 3 security-definer RPCs (`create_entry_with_tasks` re-signed with `p_influencer_id`, `create_influencer_submission`, `update_influencer_submission_verification`, `rotate_influencer_token`, `get_influencer_reliability`).

**Known follow-ups** (out of V1, captured in earlier logs):
- Replace in-memory portal rate-limiter with a durable / shared limiter before production traffic.
- Build `influencer_token_rotations` audit table to persist who rotated which token when (the RPC already accepts `p_user_id` for this; just unwired today).
- Wire the `PerformanceLogModal` into the existing task detail UI (currently launched from the Verifications row only).

## Reports Module Chunk 2: Frontend Preview (DONE)
- Added protected `/reports` route and sidebar navigation item between Performance and Budget.
- Added frontend `ReportSummary` / `ReportComparison` type mirror plus lazy `useReportSummary` hook against `GET /reports/summary` with 60s stale time.
- Added report constants, preset date-range utilities, and `DateRangePicker` with This Month, Last Month, Last 7/30/90 days, This Quarter, Last Quarter, and Custom presets. Client validation enforces end date after start date and max 365 days.
- Added `Reports.tsx`: date-range form, optional custom report title, compare-to-previous checkbox, generate/refresh behavior, empty state, loading skeleton, and retryable error state.
- Added pure presentation `ReportCard` component for Chunk 3 image export reuse. It renders content totals, activity/campaign stats, influencer submission status, performance coverage/totals, comparison deltas, below-threshold messaging, and the unsubmitted-collabs warning.

## Reports Module Chunk 3: Image Download + Polish (DONE)
- Installed `html-to-image` for client-side PNG export. Chosen over `html2canvas` because it produces sharper output on text-heavy reports and has better support for modern CSS (flexbox, grid, custom properties), while staying smaller than `dom-to-image`.
- `ReportCard` now forwards a ref to its fixed-width 800px white-background capture surface so the rendered card can be exported consistently.
- Added report export utilities: PNG generation with retina pixel ratio 2, clean filename builder (`kayan-marketing-report-{slug}-{from}-to-{to}.png`), WhatsApp-friendly plain-text summary builder, and clipboard copy with a legacy fallback for browsers that block `navigator.clipboard`.
- `Reports.tsx` now scrolls the preview into view after Generate, shows a preview-ready subtitle, and exposes `Copy as Text` plus `Download Report` actions with loading, success, and error states.
- Verification: lint/build pass. Chrome/in-app-browser smoke tested with a local mock reports endpoint for comparison reports, zero-entry reports, two successive report generations, copy-as-text, and PNG generation flow. Downloads are blocked by the Codex in-app browser itself, but the app completed generation and surfaced the success state.

## Reports Module COMPLETE
**Follow-up:** run the same PNG download smoke test on the deployed app in Safari iOS and Chrome Android after the `/reports/summary` Edge Function is deployed to the production Supabase project, because the local simulator service and in-app browser download manager were not available in this workspace.

## Script Revision Feature (DONE)
- Added Script-card-only revision UI inside `EntryDetailPanel`: creator notes textarea, quick-fix chips, Regenerate Script, preview panel, Apply Revised Script, Regenerate Again, and Cancel.
- Revision flow is preview-first. Calling `POST /script-revisions` returns a revised script preview and stores revision history, but the existing script field is untouched until the user clicks Apply Revised Script.
- Applying a revision updates only `calendar_entries.script` via the existing entry update mutation. Caption, hashtags, and shot directions are intentionally not regenerated in this chunk.
- Added frontend script revision constants, type, React Query mutation hook, and Zod validation requiring either notes or quick-fix feedback before regeneration.

## Script English Translation Toggle (DONE)
- Enabled the Script card language tabs for generated bilingual scripts. When the script contains `**Arabic**` and `**English**` sections, the existing `Both / AR / EN` segmented control appears and switches the preview cleanly.
- Updated the first-time script generation prompt copy to request Arabic first and English translation second. Existing Arabic-only scripts still display normally with no forced empty English tab.

## Topic Generator V2 Plan (PLANNED)
- Goal: make AI topic generation feel like a strategic Kayan content planner, not a repeated prompt output. The product should generate relevant variety across seasons, products, branches, audiences, formats, and experimental ideas.
- Chunk 1: backend novelty foundation. Fix `regular` so it means no occasion bias, expand generator memory beyond queued topics, add normalized fingerprints, and prevent duplicate/near-duplicate saves before topics reach the queue.
- Chunk 2: frontend generation modes and lanes. Upgrade the suggestion modal from count + occasion into a focused generator with modes like Balanced, Seasonal, Product Push, Branch Traffic, Premium Gifts, Funny/Challenge, and Experimental.
- Chunk 3: quality pass and scoring. Add an AI critic pass that over-generates, scores, improves, and saves only the strongest ideas, then displays score/reasoning metadata to help creators trust the queue.

## Topic Generator V2 Chunk 1: Memory + Novelty Guard (DONE)
- Backend `topic-suggester` now understands `regular` as no occasion bias, uses queued/in-progress/used/archived topic memory, and sends grouped avoid context to the model.
- Stale branch/pattern opportunities now account for active queued topics, reducing repeated suggestions for the same branch or recipe-book pattern before the team has used them.
- Server-side near-duplicate filtering now runs before insert using normalized fingerprints and token overlap. The frontend hook type accepts duplicate skip metadata (`matchedTitle`, `matchedTheme`) while keeping the existing modal flow unchanged.
- V2 follow-ups remain: Chunk 2 mode/lane UI and Chunk 3 critic/scoring.

## Topic Generator V2 Chunk 2: Modes + Strategic Lanes (DONE)
- Added shared topic generation constants for seven modes: Balanced, Seasonal, Product Push, Branch Traffic, Premium Gifts, Funny/Challenge, and Experimental. Each mode carries a label, description, backend instruction, and lane mix.
- `SuggestTopicsModal` now lets the marketer choose a generation mode, keep occasion bias, and optionally add product focus, audience focus, and notes/direction while staying compact.
- `useSuggestTopics` now sends the new optional fields and accepts duplicate skip metadata. Result feedback now says how many fresh ideas were saved and how many repeated ideas were skipped.
- Backend stores mode/lane/business/novelty/production metadata into topic notes for V1. Remaining follow-up: Chunk 3 critic/scoring.

## Topic Generator V2 Chunk 3: AI Critic + Save-the-Best (DONE)
- Added shared score constants for brand fit, novelty, seasonal relevance, production ease, sales usefulness, and creator energy so frontend/backend metadata stays aligned.
- The suggestion modal now understands the richer V2 response and shows the real quality flow: saved strong ideas, reviewed ideas, rejected weak/repeated ideas, and average score when available.
- Topic cards now surface a compact "Score X/10" chip when V2 score metadata exists in the topic notes, keeping the queue readable without adding a full scoring dashboard.

## Topic Generator V2 COMPLETE
- Topic generation now has memory, duplicate protection, generation modes, strategic lanes, AI critic scoring, and save-the-best selection.
- Follow-ups: store score metadata in dedicated columns if reporting is needed; add embeddings-based similarity if token overlap is not enough; learn from accepted vs archived ideas to tune future generation.

## Quick Book Popover — Chunk 1 (DONE)
- New `QuickBookPopover` lets the influencer manager book an `influencer_collab` calendar entry directly from an InfluencerCard, without leaving the page. Anchored portal popover with a custom 1-month mini calendar (date-fns), navigable up to 90 days out, past-date dates disabled, today ringed in yellow, selection in obsidian/yellow.
- Smart defaults: title → `"Collab with " + primaryName`, budget → `influencer.standardRate` (editable; required when null), shoot date → `target_date - brand.defaultSchedulingBuffer` (3 if missing), editor offset → `brand.defaultEditorOffset` (2 if missing), assignee → `junaid` (V1 hardcoded), category → `influencer`, autoCreateTasks → true so the backend computes the seeded influencer-collab task chain. Manual shoot-date edits stick (dirty flag) so the auto-sync doesn't fight the user.
- Reuses `useCreateEntry` from `features/calendar/hooks/use-calendar-entries` — no new RPC, no backend changes.
- New `UndoToast` (portal-mounted, 10s auto-dismiss, bottom-center) shows after a successful book: "Booked [Name] on [Date] · Undo". Undo calls `useDeleteEntry` on the new entry id and surfaces errors via logger. State lives at the Influencers page so only one toast can be active.
- InfluencerCard gained a `CalendarDays` button between Copy and the View arrow. The button is the popover anchor (toggles open/closed) and adopts obsidian/yellow when active so users can spot which card has a popover open.
- Two small utils ship alongside so the smart-defaults can't drift: `utils/display-name.ts` parses the `"English / Arabic"` `display_name` format, and `utils/quick-book-defaults.ts` builds the `create_entry_with_tasks` payload.
- Edge cases handled: `standardRate` null → blank budget input with `(required)` hint; viewport-edge cards → popover clamps to 16px from either edge; window resize / scroll → popover re-positions; click-outside and Escape both close.

## Quick Book — Chunks 2 + 3 reverted (2026-05-20)
- Built and rolled back the same day after the V1 user confirmed Chunk 1 covers the actual workflow (monthly batch during salary week → just scroll, click 📅, pick a date, Book — no need for in-popover calendar context or a drag-drop strip).
- Removed from the tree: `features/influencers/CalendarStrip.tsx`, `features/influencers/utils/suggest-slot.ts`. The popover lost its Chunk-2 layer (calendar dots, last-booked label, suggested ring, budget-impact line) and the InfluencerCard lost the drag handlers + touch-tap fallback. The page no longer renders a strip, no longer tracks `draggingInfluencer`, no longer renders the info-toast variant. `UndoToast.onUndo` is required again.
- Decision recorded so future chunks don't reinvent: V1 only books monthly; suggestion intelligence and second entry-points (drag strip) are not needed until that cadence changes or a second influencer manager joins.
- Pending in roadmap if/when friction shows up: bulk-book (multi-select + range distribution, Chunk 4) is the natural next step for a monthly batch workflow.
