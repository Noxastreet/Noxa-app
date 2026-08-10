# NOXA — Current Route, Action & Data Inventory

**Status:** Documentation-only source audit (Claude Code initial repository audit, `docs/AI_EXECUTION_PLAYBOOK.md` §5)
**Verified branch:** `feat/home-map-floating-card-foundation`
**Verified HEAD:** `8514965645ba1abc2580006a2a8d598ae7fe8d36` ("docs: add canonical MVP completion program")
**Verified PR:** [#135](https://github.com/Noxastreet/Noxa-app/pull/135) — open, draft, `headRefOid` matches HEAD exactly
**Audit date:** 2026-08-05
**Scope:** every file under `app/`, plus the `src/features`, `src/screens`, `src/components`, `src/lib` files that own real behavior for those routes. No application code was changed to produce this document.

> This document is evidence, not a design decision. Every "gap"/"mismatch"/"risk" line below cites a file and line number in this branch at the HEAD above. Where an agent could not verify something (e.g. RLS policy contents, native runtime behavior), it is explicitly marked unverified rather than assumed.

---

## 0. Verification note vs. `docs/MVP_COMPLETION_MASTER.md`

`docs/MVP_COMPLETION_MASTER.md` line 8 records "Snapshot HEAD: `2c7a045f2aaeb065e2f4d064157283af126c8959`" — one commit behind the actual current HEAD (`8514965`, which is the very commit that added the MVP program docs). This is **not** a stop-condition conflict: `git log` confirms `8514965` is a direct, linear child of `2c7a045` on this same branch, and `gh pr view` confirms PR #135's `headRefOid` equals the current local HEAD exactly. The snapshot line is simply one commit stale; no divergent/conflicting branch state exists.

---

## 1. Static check results

| Check | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit -p tsconfig.json` | **Pass** — zero output, exit 0 |
| ESLint | `npm run lint` (`expo lint`) | **Pass with 2 pre-existing warnings**, both in `src/features/crews-events/CanonicalCrewDetailScreen.tsx`: line 7 `'Image' is defined but never used`; line 524 `'memberProfiles' is assigned a value but never used` (`@typescript-eslint/no-unused-vars`) |
| Expo Doctor | `npx expo-doctor` | **18/18 checks passed** |
| Diff check | `git diff --check main...HEAD` | **Flags only markdown trailing-whitespace** (intentional two-space hard-break line endings) in `docs/AI_EXECUTION_PLAYBOOK.md`, `docs/MVP_COMPLETION_MASTER.md`, `docs/MVP_SCREEN_ACTION_REGISTER.md` — no code whitespace issues, no merge-conflict markers |

These match the "Latest reported static evidence" already recorded in `docs/MVP_COMPLETION_MASTER.md` §4 and `docs/CURRENT_STATE.md` — independently re-run and confirmed at the current HEAD.

---

## 2. Executive summary — cross-batch findings ranked by severity

These are the findings that recur across multiple domain batches or represent the highest-severity, most concretely-evidenced gaps. Full per-route detail follows in §4.

1. **P0 — Silent audience expansion on the live map.** `app/(tabs)/index.tsx:692-731` (`changeVisibilityMode`) allows widening the live-location audience (e.g. Crew → Global) while a Live Drive session is already active, with **no confirmation step** — the explicit-consent modal only fires on cold-start of sharing, not on widening an active share. This directly contradicts AGENTS.md §8: "Audience expansion must never occur silently." Same defect is the root cause behind both the Home/Map base and Personal Live Drive P0 ratings.
2. **P0/High — The quarantine and freeze boundary does not hold at runtime.** Multiple Frozen (§6.2) and Quarantined (§6.3) routes are directly, unconditionally wired as buttons on canonical MVP screens, not merely present as dead files:
   - `/post-editor` (Frozen) and `/post-details` (Quarantined) — both reachable from **Own Profile** (`app/(tabs)/profile.tsx:223,240,249`) and `/post-details` also from **Public Driver Profile** (`app/driver-profile/[id].tsx:569`). `docs/MVP_COMPLETION_MASTER.md`'s own description of `post-details` ("reachable only from frozen feed") is factually incorrect against current code.
   - `/crew-chat` (Frozen), `/crew-gallery` and `/crew-calendar` (Quarantined) — all three are member-gated action-row buttons on **Crew Detail** (`CanonicalCrewDetailScreen.tsx:722-724`). `/crew-garage` (Quarantined) is reachable **unconditionally**, not even member-gated (`CanonicalCrewDetailScreen.tsx:674-679`).
   - `/event-chat` (Frozen) is a live button on **Event Detail** (`CanonicalEventDetailScreen.tsx:672-679`), gated only by "has RSVP'd or is host," and runs its own Supabase Realtime channel.
   - `/crew-polls`, `/convoy-setup`, `/event-summary` are confirmed **orphaned** (registered in `app/_layout.tsx` only, zero `router.push`/`href` references anywhere) — these are the only Frozen/Quarantined routes that are actually isolated as documented. `/event-gallery` is reachable only transitively through the also-orphaned `/event-summary`.
3. **High — IdentityOrb is not wired anywhere**, confirmed by `grep -rn "IdentityOrb" app/` returning zero matches. `docs/CURRENT_STATE.md:30`'s claim is accurate. Real avatar photos (`profile.avatar_url`) are rendered unconditionally to any viewer — stranger or not — on: the map's driver pins (`MapboxLiveMap.tsx:358-387`), Public Driver Profile (`app/driver-profile/[id].tsx:443-454`), Social List rows (`app/social-list.tsx:157-166`), and Search results/Post comments. This is a direct, repeated violation of AGENTS.md §8 ("A stranger sees a neutral Identity Orb by default, not an unrestricted real avatar"), not an isolated bug.
4. **High — Search (MVP required system #6) has zero UI entry points.** Exhaustive grep for every quoting variant of a push/href to `/search` across `app/` and `src/` returns nothing except the bare `<Stack.Screen name="search" />` registration in `app/_layout.tsx:44`. The screen itself is fully implemented against live Supabase data, but no button, tab, or icon anywhere in the app navigates to it.
5. **High — Systemic post-auth routing inconsistency around `/visibility-setup`.** Four different post-authentication success paths disagree on whether to route through the mandatory Live-Drive-consent screen:
   - `app/index.tsx:41-43` (cold start) — correctly checks `hasCompletedVisibilitySetup`.
   - `app/onboarding.tsx:100` (`finish()`, primary "Get started" button) — routes straight to `/(tabs)`, **skipping the check**.
   - `src/navigation/authNavigation.ts:5-8` (`resetToAuthenticatedApp`, used by sign-in, sign-up, and auth-callback) — only checks onboarding completion, **never checks visibility-setup**.
   - `src/components/auth/NoxaSocialAuth.tsx:45-47` (social login) — same gap.
   In the common case (a first-time user completing onboarding in one session), the mandatory privacy-consent screen is never shown unless the user cold-restarts the app.
6. **High — Crew Detail is missing MVP-required admin/moderation actions.** `docs/MVP_SCREEN_ACTION_REGISTER.md` row "Crew Detail" and `MVP_COMPLETION_MASTER.md` §6.1 item 7 both require "remove member, ownership/destructive admin actions with confirmation." `CanonicalCrewDetailScreen.tsx` has no such UI at all — the member-row `Pressable` (line 623-628) has `accessibilityRole="button"` but no `onPress` and no label (a dead control), and a header "more options" icon (line 119-121) is a plain `View` styled identically to real buttons but has no press handler at all — both violate the register's own rule that "a noninteractive element must not imitate an active control."
7. **High — Event Detail is missing host cancel/delete.** `docs/MVP_SCREEN_ACTION_REGISTER.md` row "Event Detail" requires "host cancel/delete with confirmation." `CanonicalEventDetailScreen.tsx`'s host "manage" menu (lines 476-486) offers only "Edit Event" — no cancel/delete path exists anywhere in Event Detail or Event Editor.
8. **Medium/High — Raw, unsanitized backend error text is shown to users**, systemically, in specific files, contrary to `docs/MVP_SCREEN_ACTION_REGISTER.md`'s blanket "sanitized failure behavior" requirement for every action:
   - `app/sign-up.tsx:138` — raw Supabase Auth error on signup failure (incl. duplicate email).
   - `app/reset-password.tsx:68,93` — raw deep-link `error_description` and raw `error.message` on recovery-link verification.
   - `app/post-details.tsx` — 8 separate call sites (lines 200, 254/286, 337, 356, 375, 416, 438, 480) all render `error.message`/`result.error.message` directly; the only file in the whole app with this as a systematic pattern rather than an isolated miss.
   - `app/driver-profile/[id].tsx:343-346` (block failure), `app/post-editor.tsx:162-164` (publish failure), `app/delete-account.tsx:148,153` (edge-function error passthrough, low practical exposure since the function's own messages are pre-sanitized).
   - Nearly every screen in the Crews and Events batches (`CanonicalCrewsScreen.tsx:549`, `CanonicalCrewDetailScreen.tsx:384-389`, `crew-chat.tsx`, `crew-garage.tsx`, `crew-calendar.tsx`, `crew-gallery.tsx`, `crew-polls.tsx`, `convoy-setup.tsx`, `CanonicalEventsScreen.tsx:388`, `CanonicalEventDetailScreen.tsx:349,436,455,517`, `event-editor.tsx:261,487`, `event-chat.tsx`, `event-gallery.tsx`, `event-summary.tsx`) call `setError(err.message)` and render it verbatim.
   By contrast, `sign-in.tsx`, `forgot-password.tsx`, `auth/callback.tsx`/`authLinks.ts`, `visibility-setup.tsx`, `settings.tsx`, `edit-profile.tsx`, `(tabs)/garage.tsx`, `vehicle-details.tsx` (mostly), and `(tabs)/profile.tsx` all correctly map errors to designed copy — the sanitization pattern exists in the codebase, it's just inconsistently applied.
9. **Medium — Duplicate primitive system in Crews/Events.** `src/features/crews-events/CanonicalPrimitives.tsx` (428 lines: `CanonicalPill`, `CanonicalArtwork`, `CanonicalAvatar`, `CanonicalAvatarStack`, `CanonicalPrimaryButton`, `CanonicalSectionHeader`) is a second, parallel design-primitive system used exclusively by the four Canonical Crews/Events screens, instead of the canonical `src/components/ui` set (`NoxaButton`, `NoxaBadge`, `NoxaAvatar`, `NoxaCard`). Violates AGENTS.md §6 ("reuse shared primitives"). `CanonicalAvatarStack`'s built-in fallback (lines 154-176) also renders **hardcoded fake initials ("AK"/"N"/"PM")** when no real `profiles` array is passed — and the Crews List hero/drive cards do call it with no `profiles` prop, so fabricated avatar-stack placeholders render live in production, a direct tension with AGENTS.md §3 "Honest emptiness."
10. **Medium — Duplicate hand-rolled back button** (identical 42×42 pill `Pressable` + `Ionicons chevron-back`, no shared component) appears independently in at least 6 places: `app/blocked-users.tsx:90-96`, `app/delete-account.tsx:171-178`, `src/components/legal/LegalDocumentScreen.tsx:33-39`, `crew-chat.tsx:203-232`-style headers, `crew-gallery.tsx:304-328`, `convoy-setup.tsx:91-117` — while `settings.tsx:174-179` and most other screens correctly use the shared `NoxaIconButton`.
11. **Medium — `app/(tabs)/index.tsx` is a 1978-line god-component** mixing screen composition, permission handling, Live Drive session lifecycle, realtime subscription management, edge-function routing, and full UI/animation layout in one file — the single largest and highest-risk file in the app. See §6 for the complete oversized-file list.
12. **Low/Medium — `.env.local.backup`'s exclusion is machine-local, not repo-shared.** Its only exclusion rule lives in `.git/info/exclude` (a local, unshared file) — the repo-tracked `.gitignore` has no pattern that would catch a fresh contributor's `.env.local.backup`, `.env.*.backup`, or similar. See §7.

---

## 3. Route index

| Route | Owning file(s) | Classification | Risk |
|---|---|---|---|
| `/` | `app/index.tsx` | MVP (Entry/session gate) | Medium |
| root `Stack` config | `app/_layout.tsx` | MVP (infra) | — |
| `/welcome` | `app/welcome.tsx` | MVP | Medium-High |
| `/sign-in` | `app/sign-in.tsx` | MVP | Medium |
| `/sign-up` | `app/sign-up.tsx` | MVP | High |
| `/forgot-password` | `app/forgot-password.tsx` | MVP | Low |
| `/reset-password` | `app/reset-password.tsx` | MVP | Medium |
| `/auth/callback` | `app/auth/callback.tsx` + `src/lib/authLinks.ts` | MVP | Low |
| `/onboarding` | `app/onboarding.tsx` | MVP | **High** |
| `/visibility-setup` | `app/visibility-setup.tsx` + `src/lib/liveDrive.ts` | MVP | Medium |
| Bottom Navigation | `app/(tabs)/_layout.tsx` | MVP | Low |
| Home/Map base | `app/(tabs)/index.tsx` | MVP | **P0** |
| Driver Pin | `src/features/mapbox/MapboxLiveMap.tsx` | MVP | High |
| Driver Floating Card | *(does not exist)* | MVP (gap) | High |
| Event Pin/Card | `MapboxLiveMap.tsx` + `app/(tabs)/index.tsx` | MVP | Low-Medium |
| Route Card | `app/(tabs)/index.tsx` | MVP | Low |
| Personal Live Drive | `src/lib/liveDrive.ts` + `app/(tabs)/index.tsx` | MVP | **P0** |
| Map Location Picker | `src/features/mapbox/MapboxEventLocationPicker*.tsx` | MVP | Medium |
| `/(tabs)/crews` | `src/features/crews-events/CanonicalCrewsScreen.tsx` | MVP | Medium |
| `/crew/[id]` | `src/features/crews-events/CanonicalCrewDetailScreen.tsx` | MVP | **High** |
| `/crew-chat` | `app/crew-chat.tsx` | **Frozen**, reachable from MVP | Medium |
| `/crew-garage` | `app/crew-garage.tsx` | **Quarantined**, reachable unconditionally | Medium-High |
| `/crew-gallery` | `app/crew-gallery.tsx` | **Quarantined**, reachable from MVP | Medium |
| `/crew-calendar` | `app/crew-calendar.tsx` | **Quarantined**, reachable from MVP | Low-Medium |
| `/crew-polls` | `app/crew-polls.tsx` | **Quarantined**, orphaned | Low |
| `/convoy-setup` | `app/convoy-setup.tsx` | **Frozen**, orphaned | Low |
| `/(tabs)/events` | `src/features/crews-events/CanonicalEventsScreen.tsx` | MVP | Medium |
| `/event-details` | `src/features/crews-events/CanonicalEventDetailScreen.tsx` | MVP | **High** |
| `/event-editor` | `app/event-editor.tsx` | MVP | **High** |
| `/event-chat` | `app/event-chat.tsx` | **Frozen**, reachable from MVP | Medium-High |
| `/event-gallery` | `app/event-gallery.tsx` | **Quarantined**, orphaned (only via event-summary) | Low |
| `/event-summary` | `app/event-summary.tsx` | **Quarantined**, orphaned | Low |
| `/(tabs)/garage` | `app/(tabs)/garage.tsx` | MVP | Low-Medium |
| `/vehicle-details` | `app/vehicle-details.tsx` | MVP | Medium |
| `/vehicle-editor` | `app/vehicle-editor.tsx` | MVP | Medium-High |
| `/(tabs)/profile` | `app/(tabs)/profile.tsx` | MVP | Medium (frozen/quarantined leaks) |
| `/driver-profile/[id]` | `app/driver-profile/[id].tsx` | MVP | High (privacy) |
| `/edit-profile` | `app/edit-profile.tsx` | MVP | Low-Medium |
| `/social-list` | `app/social-list.tsx` | MVP | Medium (privacy) |
| `/notifications` ("Activity") | `app/notifications.tsx` | MVP | Low |
| `/search` | `app/search.tsx` | MVP | **High (unreachable)** |
| `/post-editor` | `app/post-editor.tsx` | **Frozen**, reachable from MVP | Medium |
| `/post-details` | `app/post-details.tsx` | **Quarantined**, reachable from MVP | **High** |
| `/settings` | `app/settings.tsx` | MVP | Medium |
| `/blocked-users` | `app/blocked-users.tsx` | MVP | Low-Medium |
| `/delete-account` | `app/delete-account.tsx` + edge fn | MVP | P1 (well-built) |
| `/privacy-policy` | `app/privacy-policy.tsx` + `LegalDocumentScreen.tsx` | MVP | Low |
| `/terms-of-service` | `app/terms-of-service.tsx` + `LegalDocumentScreen.tsx` | MVP | Low |
| Group Drive (all rows in register) | *(no code exists)* | Planned only | — |

---

## 4. Per-route detail

### 4.1 Entry, Authentication & Onboarding

#### Entry chain context (outside `app/`, gates every route below)
`package.json:3` → `App.tsx` (not `app/_layout.tsx` directly). `App.tsx:70-77` renders `NoxaConfigurationErrorScreen` (`src/screens/NoxaConfigurationErrorScreen.tsx`, 197 lines) when `getClientEnvStatus().isReady` is false, else `NoxaSplashScreen` (`src/screens/NoxaSplashScreen.tsx`, 228 lines) until `onFinish`, then mounts `ExpoRoot`. These are the documented "Splash" and "Configuration Error" matrix rows. `App.tsx:16,24,29,37,49,59,62` contain unconditional `console.log`/`console.warn` debug statements in the shipped entry path.

#### `/` — `app/index.tsx` (71 lines)
Reachable from: initial app boot only. `supabase.auth.getSession()` (23) → `hasCompletedOnboarding` (36) → `hasCompletedVisibilitySetup` (42) → `<Redirect>` to `/welcome`, `/onboarding`, `/visibility-setup`, or `/(tabs)`. No buttons. **Gap:** no try/catch around `getSession()` — a rejected promise strands the user on the loading spinner (56) indefinitely with no retry. **Risk: Medium.**

#### `app/_layout.tsx` (63 lines) — root Stack config, not a screen
Registers top-level routes; `gestureEnabled: false` on `onboarding`, `visibility-setup`, `auth/callback`, `(tabs)` (non-skippable checkpoints). Imports `@/src/lib/liveDrive` (line 7) purely for its `TaskManager.defineTask` side effect.

#### `/welcome` — `app/welcome.tsx` (192 lines)
Buttons: "Create Account" (105) → `/sign-up`; "Sign In" (106) → `/sign-in`; **"Continue as Guest" (109-114)** → `router.replace('/(tabs)')`, bypassing sign-in/onboarding/visibility-setup entirely — **not documented anywhere in `MVP_SCREEN_ACTION_REGISTER.md`'s Welcome row** (Primary: Get started; Secondary: Sign in only). Hero image is a remote Unsplash URL (12-13) with no offline fallback. **Risk: Medium-High** — undocumented auth-bypass navigation shortcut; any tab screen that assumes a session exists without its own null-session guard is a crash/silent-failure risk for a guest.

#### `/sign-in` — `app/sign-in.tsx` (212 lines)
Handlers owned directly in this file (`NoxaAuthScreen` is a layout-only shell). `handleSignIn` (87-119): duplicate-submit guard ✓, `supabase.auth.signInWithPassword` (96), errors sanitized via `getSignInErrorMessage()` (19-33, **no raw text leak**). On success: `resetToAuthenticatedApp` (`src/navigation/authNavigation.ts:5-8`) — **only checks onboarding, never visibility-setup** (see Executive Summary #5). **Risk: Medium.**

#### `/sign-up` — `app/sign-up.tsx` (320 lines)
`handleCreateAccount` (113-155): duplicate-submit guard ✓, `supabase.auth.signUp` (126). **Line 138: `setErrors({ submit: error.message })` — raw, unsanitized Supabase error shown verbatim**, including for duplicate-email (the one documented required state in the matrix). Contrast with sign-in's sanitized mapper. **Risk: High.**

#### `/forgot-password` — `app/forgot-password.tsx` (163 lines)
`sendResetLink` (25-62): duplicate-submit guard ✓, `supabase.auth.resetPasswordForEmail` (43), sanitized error mapping (47-54, rate-limit detection, **no raw leak**). Minor: inline "Back to Sign In" text link (113-115) has no `accessibilityRole`/label. **Risk: Low.**

#### `/reset-password` — `app/reset-password.tsx` (249 lines)
Deep-link only. Three separate hand-rolled URL-param parsers exist across the codebase (`reset-password.tsx:13-35`, `authLinks.ts:23-48`, `socialAuth.ts:22-45`) doing the same job — duplication, not a bug. **Line 68: raw `params.error_description` from the URL rendered verbatim. Line 93: raw `error.message` from `setSession`/`exchangeCodeForSession`/`verifyOtp` rendered verbatim.** The password-update path itself (131) is properly sanitized; only the link-verification path leaks. On success, forces `supabase.auth.signOut()` (137) — sound practice, invalidates the recovery session. **Risk: Medium.**

#### `/auth/callback` — `app/auth/callback.tsx` (144 lines) + `src/lib/authLinks.ts` (128 lines, owns the logic)
Guards against reprocessing the same URL (`processedUrlRef`, 16). All failure branches in `authLinks.ts` return pre-written sanitized copy — **best-sanitized screen in the batch, no raw error leak**. Shares the same `resetToAuthenticatedApp` visibility-setup-skip gap as sign-in/sign-up. **Risk: Low.**

#### `/onboarding` — `app/onboarding.tsx` (292 lines)
Guards unauthenticated access (66-71). "Skip" (181-187, labeled) and paged `FlatList` content (144-145, labeled) are accessible. Android hardware back is fully blocked on the first page for non-replay sessions (103-113) — intentional, matches `gestureEnabled:false`. **Line 100 (`finish()`): `router.replace('/(tabs)')` — skips `/visibility-setup` entirely**, directly contradicting `app/index.tsx`'s own routing logic for the exact same transition. This is the primary "Get started" path for every first-time user. **Risk: High** — the mandatory Live-Drive-consent screen is silently skipped in the common single-session case.

#### `/visibility-setup` — `app/visibility-setup.tsx` (373 lines) + `src/lib/liveDrive.ts` (208 lines)
In practice reachable primarily via cold app restart, given the onboarding bug above. Android hardware back fully blocked (91, `() => true`). "Go Global for 4 hours" (209-215) → `requestLiveDrivePermissions()` (`liveDrive.ts:144,149`, foreground then background, **correctly gated behind explicit tap**, matches AGENTS.md §8) → `startLiveDriveSession` (foreground-service notification, self-expiring `TaskManager` task, 4-hour duration matches spec exactly). "Continue in Ghost" (216-223) is the safe default. Errors sanitized via `getSafeLiveDriveError` (31-44, **no raw leak**). **Gap vs register:** only Ghost/Global offered, no Friends/Crew granularity, and **no "Not now" escape hatch** (back is fully blocked). Session persistence uses `localStorage` (`liveDrive.ts:23-49`) — **unverified whether this resolves correctly on React Native**; flagged as an unconfirmed runtime risk, not a confirmed bug. **Risk: Medium.**

**Cross-cutting for this batch:** No files over 800 lines. No root `components/`/`constants/theme.ts` imports. No mock-data imports. `NoxaButton` provides consistent accessibility/disabled/loading coverage for every primary action in this batch; gaps are confined to secondary raw `Pressable`/`Text` links. No secret-looking strings found. Supabase surface: `.auth.getSession/signInWithPassword/signUp/signInWithOAuth/signInWithIdToken/setSession/exchangeCodeForSession/verifyOtp/updateUser/signOut/resetPasswordForEmail`; tables `profiles`, `driver_locations`. No storage buckets or edge functions in this batch.

---

### 4.2 Home/Map (the highest-risk screen in the app)

**Owning files:** `app/(tabs)/index.tsx` (1978 lines — **god-component**, see §6), `src/features/mapbox/MapboxLiveMap.tsx` (623 lines) + 4 compat wrappers, `src/lib/liveDrive.ts` (208 lines), `src/components/ui/NoxaFloatingCard.tsx` (258 lines, correctly reused, no duplication found).

#### Bottom Navigation — `app/(tabs)/_layout.tsx` (180 lines)
Tab order (98-137): Crews → Events → Map (emphasized icon) → Garage → Profile — **matches AGENTS.md canonical order exactly**. `checkAccess` (41-60) re-runs the same onboarding/visibility-setup gate as `app/index.tsx`; unhandled promise if `getSession()` throws. **Risk: Low.**

#### Home/Map base — `app/(tabs)/index.tsx:411-1606`
Full button table, permissions, Supabase surface, realtime/background-task detail, and state coverage: see the standalone finding already logged in Executive Summary #1 (silent audience expansion, `changeVisibilityMode` 692-731) and #3 (no IdentityOrb). Additional gaps against `MVP_SCREEN_ACTION_REGISTER.md` "Home/Map base": **no Search entry point, no Notifications entry point, no dedicated "no activity" empty state** (degrades gracefully to a `0` counter instead, honest but not a distinct state). Error handling is fully sanitized here (`event-route` failures mapped to designed copy, 1093-1098; realtime reconnect banner is generic copy, not raw error). Supabase: `.from('driver_locations')` (delete/upsert/update/select), `.from('profiles')`, `.from('follows')`, `.from('crew_members')`, `.from('events')`, `supabase.channel(...)` on `driver_locations` `postgres_changes`, `supabase.functions.invoke('event-route', ...)` with 14s timeout and sanitized error mapping. **Risk: P0.**

#### Driver Pin — `MapboxLiveMap.tsx`
Clustered (≥80 drivers, `DRIVER_CLUSTER_LIMIT=53`) vs unclustered render paths; clustered dots have **no tap-to-zoom handler** (functional gap at scale). Unclustered markers render raw avatar `Image`/`Ionicons` — not `IdentityOrb` (366-387). `is_relevant`/`is_dimmed` only change border/opacity, not the avatar-vs-orb decision — **real photos shown to strangers regardless of trust relationship**. **Risk: High.**

#### Driver Floating Card — does not exist
Tapping a driver pin routes directly to the full-screen `/driver-profile/[id]` (`index.tsx:1280-1285`) — no intermediate `NoxaFloatingCard` preview. The `pin → Floating Card → Bottom Sheet → full screen` progressive-disclosure law (AGENTS.md §3) is honored for Events but skipped entirely for drivers. **Risk: High.**

#### Event Pin/Card — `MapboxLiveMap.tsx` + `EventCard` (`index.tsx:256-318`)
Correctly uses `NoxaFloatingCard` (progressive disclosure honored). Actions: "View Event" → full nav, "Route" → route mode, close (×) → deselect. Data: `.from("events")` filtered `status="scheduled"`, future `starts_at`, non-null coordinates. **Risk: Low-Medium.**

#### Route Card — `RouteCard` (`index.tsx:320-409`)
Follow/Following toggle, Retry (on error), Close (clears route + router params). Route line rendering (`MapboxLiveMap.tsx:451-477`) includes a `console.info` debug log left in the production path (140-144, coordinate counts only, no PII). **Risk: Low.**

#### Personal Live Drive — `src/lib/liveDrive.ts` + `index.tsx` orchestration
Permission order correct (foreground before background), both gated behind explicit consent modal on cold-start only — see Executive Summary #1 for the active-session widening gap, which applies here as MVP system #5 specifically. Background `TaskManager` task self-validates session expiry and user identity on every tick (68-123), correctly self-heals. 4-hour duration enforced both client-side and via `share_expires_at` written server-side. Session persistence via `localStorage` — same unverified-on-RN flag as visibility-setup. **Risk: P0.**

#### Map Location Picker — `MapboxEventLocationPicker.tsx` (102) + Compat (45)
Cancel, "Use Current Location," "Confirm Location" — **all three lack explicit `accessibilityLabel`**, relying on visible text only. Map idle-drag validates coordinates before accepting (`isValidCoordinate`). Permission delegated to parent, only requested on tap (matches register). **Risk: Medium.**

**Cross-cutting for this batch:** 5 Mapbox compat wrappers share one consistent, intentional lazy-`import()` + native-module-detection pattern (no problem). No hardcoded secrets (Mapbox token sourced from `clientEnv`). No mock/fake data anywhere in this batch (`grep -i "mock|fake|dummy|seed"` returns nothing) — "Honest emptiness" is respected here specifically.

---

### 4.3 Crews

`app/(tabs)/crews.tsx` and `app/crew/[id].tsx` are both confirmed 1-line re-exports of `src/features/crews-events/CanonicalCrewsScreen.tsx` (1357 lines) and `CanonicalCrewDetailScreen.tsx` (884 lines) respectively — all real logic lives under `src/features/crews-events/`.

#### Crews List — `CanonicalCrewsScreen.tsx`
Buttons: hero/compact card taps → crew detail; per-crew JOIN/REQUEST/REQUESTED/JOINED/OWNER/INVITE-ONLY primary button → `handleAction`; Create Crew modal (PUBLIC/PRIVATE toggle, OPEN/APPROVAL/INVITE join-policy selector, both missing explicit `accessibilityLabel` on the choice `Pressable`s though visible text covers it minimally) → insert `crews` + `crew_members`. Discovery-row `Pressable` (774-800) missing `accessibilityLabel`. **Leave crew** (608-627) confirmed via `Alert.alert`. Supabase: `crews`, `crew_members`, `crew_join_requests`, `events`, `profiles` — no RPC, no storage, no realtime (focus-effect re-fetch only). **State gap:** the register requires distinct "My Crews empty" and "discovery empty" states; this screen implements one merged empty state (713-726) that only triggers when both are empty simultaneously. **Error banner shows raw `firstError.message` (549)**, and can render simultaneously with the empty-state copy. **Risk: Medium.**

#### Crew Detail — `CanonicalCrewDetailScreen.tsx`
Confirmed unused-import (`Image`, line 7) and unused-variable (`memberProfiles`, line 524) lint warnings match `docs/CURRENT_STATE.md`'s recorded pre-existing warnings exactly. Membership button covers owner/joined/requested/invite-only/join states correctly, with confirmed leave-crew `Alert.alert` (482-501, owner leave correctly blocked). **Two decorative-but-inert controls:** header "more options" (119-121) is a plain `View`, not a `Pressable` — no `onPress`, no `accessibilityRole`, styled identically to the real Back/Share buttons beside it; the member-strip row (623-628) has `accessibilityRole="button"` but no `onPress` and no label. Both violate the register's own "a noninteractive element must not imitate an active control" rule. **Confirmed missing: remove-member / promote / ownership-transfer admin actions** — no such UI exists anywhere in the file, despite being an explicit MVP-required behavior (§6.1 item 7, register row "Crew Detail"). **Reachability finding:** `/crew-garage` is an unconditional action tile (674-679, not membership-gated); `/crew-chat`, `/crew-gallery`, `/crew-calendar` are member-gated action-row buttons (719-739) — see Executive Summary #2. `/crew-polls` and `/convoy-setup` have zero inbound `router.push`/`href` anywhere in the repo — confirmed orphaned, consistent with their quarantine/freeze status. **Risk: High.**

#### `CanonicalPrimitives.tsx` (428 lines, shared)
`CanonicalAvatarStack`'s hardcoded "AK"/"N"/"PM" fake-initials fallback (154-176) fires live whenever a caller omits the `profiles` prop — confirmed to happen on the Crews List hero and Upcoming Drive cards (`CanonicalCrewsScreen.tsx:177`). See Executive Summary #9.

#### `/crew-chat` (Frozen, 579 lines) — documented only
Reachable from MVP Crew Detail (member-gated). Realtime channel on `crew_messages` `postgres_changes` INSERT, cleaned up on unmount. Membership gate (`canChat`) correctly blocks non-members. Raw error text surfaced at 4 call sites (74, 92, 142, 189).

#### `/convoy-setup` (Frozen, 872 lines) — documented only
Confirmed **orphaned** (only the `Stack.Screen` registration references it) — consistent with `docs/GROUP_DRIVE.md:13`'s explicit statement that `crew_convoys` is separate and frozen. `leaveConvoy()` (376-391) has no confirmation, inconsistent with the leave-crew pattern elsewhere, but low-urgency given zero reachability. RPC `noxa_create_crew_convoy`; two realtime channels (`crew_convoys`, `crew_convoy_participants`).

#### `/crew-calendar` (Quarantined, 640 lines) — documented only
Reachable from MVP Crew Detail (member-gated). Best-gated role logic (`canView`/`canCreate`) of the three quarantined crew modules. Creates crew-scoped `event-editor` entries (`crewId` param). No realtime, no destructive ops.

#### `/crew-gallery` (Quarantined, 673 lines) — documented only
Reachable from MVP Crew Detail (member-gated). **Unlike its quarantined siblings, has no client-side `canView` gate** — `loadGallery()` runs unconditionally; visibility depends entirely on unverified RLS. Storage bucket `crew-gallery` is a real cross-system dependency (also referenced by `supabase/functions/delete-account/index.ts:27,193` for cleanup). Photo removal confirmed via `Alert.alert`. Only permission request in the whole Crews batch (`ImagePicker.requestMediaLibraryPermissionsAsync`, 191).

#### `/crew-garage` (Quarantined, 550 lines) — documented only
Reachable from MVP Crew Detail **unconditionally**, not member-gated at the tap level. Best-structured of the quarantined set (search, summary stats, retry-on-error). No destructive ops (vehicle deletion lives in `vehicle-editor`).

#### `/crew-polls` (Quarantined, 1001 lines) — documented only
**Confirmed orphaned** — zero inbound navigation references anywhere. Heaviest backend surface of the batch: 4 custom RPCs (`noxa_get_crew_poll_results`, `noxa_create_crew_poll`, `noxa_vote_crew_poll`, `noxa_close_crew_poll`) plus a realtime channel. Close-poll confirmed via `Alert.alert`, role-gated to owner/admin.

**Cross-cutting for this batch:** `src/components/crew/CrewModuleChrome.tsx` is correctly reused by `crew-garage`/`crew-calendar`/`crew-polls`, but `crew-chat`/`crew-gallery`/`convoy-setup` each hand-roll a near-identical header instead — 3 duplicated, not shared, header implementations. No root `components/`/`theme.ts` imports. No mock data. No secrets.

---

### 4.4 Events

`app/(tabs)/events.tsx` and `app/event-details.tsx` are confirmed 1-line re-exports of `CanonicalEventsScreen.tsx` (876 lines) and `CanonicalEventDetailScreen.tsx` (758 lines).

#### Events List — `CanonicalEventsScreen.tsx`
Hero RSVP "I'M GOING"/"YOU'RE GOING" and list-card taps → detail. `setGoing` (361-393) toggles `event_attendees` with **no confirmation on cancel** (silent delete) and **raw error text** (`result.error.message`, 388). Query itself excludes cancelled events (`status="scheduled"`, future `starts_at`) — so a "cancelled item" UI state can structurally never render. **No segment/filter control anywhere**, despite the register listing "approved segment/filter" as a secondary action. One "Weekend picks" card (452-465) missing `accessibilityLabel`. **Risk: Medium.**

#### Event Detail — `CanonicalEventDetailScreen.tsx`
Save/bookmark, Share, host-only "manage" (→ Alert with only "Edit Event," no cancel/delete), NAVIGATE (→ map route mode), sticky-footer primary RSVP ("I'm going" per `docs/PRODUCT.md`'s "«Я еду»" primary action, English-only copy in this build), "EVENT CHAT" button (member/host-gated → **Frozen** `/event-chat`, confirmed live reachability). Organizer-card tap (616-645) missing `accessibilityLabel`. **Confirmed missing: host cancel/delete event**, required by register row "Event Detail" — absent from both this screen and Event Editor. **Cancel RSVP has no confirmation** (single-tap delete). **Capacity is displayed but never enforced** — `toggleGoing` never checks `goingCount >= capacity`, so "full/closed" state from the register is unreachable. Raw error text at 3+ sites. Read-only gallery preview via signed URLs from `event_gallery_items`/`event-gallery` bucket (no upload here). **Risk: High.**

#### Event Editor — `app/event-editor.tsx` (1436 lines — oversized, see §6)
Category radio grid, "CHOOSE ON MAP" (→ `MapboxEventLocationPickerCompat` modal, with a real `Location.requestForegroundPermissionsAsync()` gate), "USE CURRENT" location, 4 date/time pickers, host/visibility radio groups, fixed-footer Save/Publish. **No image picker at all** — `cover_image_url` is read and rendered prominently by List/Detail hero cards but this editor has **no way to set or change it**, a real functional gap not called out anywhere in the docs. **Back navigation has no discard-changes confirmation**, required by register row "Event Editor." **No delete-existing-event action**, same gap as Event Detail. Save-path errors are raw (`result.error?.message`, 487); validation errors are hand-written (acceptable). Location permission correctly gated behind explicit user action, denial handled with designed copy (not raw). **Risk: High.**

#### `/event-chat` (Frozen, 582 lines) — documented only
Confirmed reachable from MVP Event Detail (RSVP/host-gated). Only Supabase Realtime subscription in the whole Events batch (`event_messages` `postgres_changes` INSERT). Access correctly gated to actual attendees.

#### `/event-gallery` (Quarantined, 664 lines) — documented only
**Not** reachable from any MVP route — `CanonicalEventDetailScreen.tsx` renders gallery images inline rather than pushing here. Only inbound reference is from the also-orphaned `/event-summary`. One properly-confirmed destructive action (photo delete, `Alert.alert`). Underlying table/bucket (`event_gallery_items`/`event-gallery`) is load-bearing for the in-scope MVP gallery preview even though this specific screen is dead code from a navigation standpoint.

#### `/event-summary` (Quarantined, 595 lines) — documented only
**Confirmed fully orphaned** — zero inbound navigation references anywhere in the repo; only reachable by direct deep link/URL. Locked behind a `completed` lifecycle gate. Reads `vehicles`, `event_gallery_items`, and the `event-gallery` bucket — same load-bearing-data caveat as above.

**Cross-cutting for this batch:** Same `CanonicalPrimitives.tsx` duplicate-primitive-system finding as Crews (Executive Summary #9) — `event-editor.tsx`/`event-chat.tsx`/`event-gallery.tsx`/`event-summary.tsx` correctly use canonical `NoxaButton`/`NoxaScreen`, only the two Canonical*Screen files deviate. Only one realtime subscription in the batch (event-chat). No RPC/edge-function calls except `event-route` (used from Home/Map, not this batch). No mock data, no secrets.

---

### 4.5 Garage & Vehicles

#### `/(tabs)/garage` — `app/(tabs)/garage.tsx` (438 lines)
Vehicle-card tap → detail; "TRY AGAIN" (retry, missing `accessibilityLabel`) and "ADD FIRST CAR" (empty state, missing `accessibilityLabel`) are the two gaps out of 5 interactive elements. Query correctly scoped `.eq('owner_id', user.id)`. **No delete affordance here** — correctly matches register ("Delete is not exposed here without confirmation"). Error state shows a generic static message, not raw text. No `onError` fallback for broken `cover_image_url` images. **Risk: Low-Medium.**

#### `/vehicle-details` — `app/vehicle-details.tsx` (507 lines)
Edit (header + management card), owner-card tap → driver profile, **Delete Vehicle** — confirmed via `Alert.alert` with destructive style, re-verifies auth + ownership client-side before the delete call, checks returned row count before declaring success. **No storage cleanup of the deleted vehicle's cover image** on this path (contrast with vehicle-editor, which does clean up on replace/update) — an orphaned-storage-object gap. **Confirmed defect:** if the owner-profile lookup fails after the vehicle itself loaded successfully (282-289), the error state blanks the **entire** vehicle page instead of degrading gracefully (rendering the vehicle with the owner card simply omitted) — the render branch treats any non-null `error` as terminal regardless of what data is actually available. **Raw Supabase error text shown on delete failure** (`Alert.alert('Unable to delete vehicle', deleteError.message)`, 329). Retry button (210) missing `accessibilityLabel`. No image-load-failure state. **Risk: Medium.**

#### `/vehicle-editor` — `app/vehicle-editor.tsx` (1181 lines — oversized, see §6)
Photo-library permission (no camera option at all) requested only on "Choose/Change Cover" tap. Save/Add — inserts or updates `vehicles`, uploads to storage bucket `vehicle-images` with a 6 MB / MIME-allowlist client-side cap, and includes solid rollback-on-failure hygiene (removes orphaned uploaded objects on a failed DB write, cleans up the previous cover object on a successful replace — cleanup failures here are only `console.warn`'d, never surfaced). **No discard-changes confirmation** on back navigation (silent data loss of unsaved edits). **No delete-vehicle action in this screen** (only in Vehicle Detail) despite the register listing it as an editor secondary action. **Only single-cover-image support** — no multi-image gallery or reorder capability exists at all (the register's "Add/remove/reorder image" wording implies more than the data model supports). Save-failure error text can include raw Supabase/Postgres text (`getSaveErrorMessage` falls through to `message`, 240-248). Three interactive elements (cover choose/change, cover remove, visibility-option radios) missing explicit `accessibilityLabel`. **Risk: Medium-High.**

**Cross-cutting for this batch:** `garage.tsx`'s `VehicleArtwork`/`SpecCell` and `vehicle-details.tsx`'s `VehicleHero`/`QuickStat` independently reimplement the same hero-image-with-spec-strip visual pattern as two separate local component pairs rather than one shared primitive — a duplication risk. `mockCars.ts` confirmed unused by all three files (only self-referenced via the dead `src/data/index.ts` barrel). No realtime, no RPC/edge functions — all mutations are direct PostgREST calls plus Storage calls against `vehicle-images`. No secrets.

---

### 4.6 Profile, Social, Search, Notifications, Posts

#### `/(tabs)/profile` (Own Profile) — `app/(tabs)/profile.tsx` (673 lines)
Settings, Edit Profile, Followers/Following/Vehicles stat cells (all labeled), Explore-card rows to Garage/Events/Crews (all **missing** `accessibilityLabel`, role-only), Notifications entry, sign-out (confirmed via `Alert.alert`, tears down Live Drive first). **"NEW POST" and empty-state "Share your first moment"** both route to the **Frozen** `/post-editor`; the Posts-grid tile tap routes to the **Quarantined** `/post-details` — see Executive Summary #2. Retry button (154-157) missing `accessibilityLabel`. Errors mapped to static copy, no raw leak. **Register mismatch:** sign-out is implemented here directly (323-330, 433-440), not only in Settings as the register states. **Risk: Medium**, driven entirely by the frozen/quarantined reachability, not this screen's own logic.

#### `/driver-profile/[id]` (Public Driver Profile) — `app/driver-profile/[id].tsx` (1072 lines — oversized, see §6)
Report/Block via a native `Alert.alert` action sheet (confirmed present, matching register's requirement that both exist and that "no exact-location action by default" — correctly, no location action exists anywhere on this screen). Follow toggle, Followers/Following stat cells, Featured-build and garage-list vehicle cards — **all of these lack explicit `accessibilityLabel`**. Posts-grid tile → **Quarantined** `/post-details`. **Block-failure error is unmapped raw text** (`blockError.message`, 343-346) — the one raw-error site on this screen. **No `IdentityOrb` used anywhere** — avatar rendered as a direct `<Image>` with initials fallback, unconditionally, to any viewer regardless of relationship — see Executive Summary #3. Hard `.limit(12)` on posts/vehicles with no pagination. **Risk: High**, driven by the privacy-law mismatch plus the quarantined-route reachability.

#### `/edit-profile` — `app/edit-profile.tsx` (795 lines)
Choose/Change/Remove avatar (both missing `accessibilityLabel`), Save. Photo-library permission requested on tap, denial handled with inline copy (no `Alert`). Thorough client-side validation (name/username/city/bio length + regex, avatar MIME allowlist + 5 MB cap). Old-avatar storage cleanup on save, rollback of newly-uploaded object on DB-write failure. Errors mapped via `mapSaveError` (Postgres `23505` → "username taken," else generic) — **no raw leak**. **No discard-changes confirmation** on back, required by register row "Edit Profile." **Risk: Low-Medium.**

#### `/social-list` — `app/social-list.tsx` (612 lines)
Followers/Following tabs, row tap → driver profile (labeled: `` `Open ${displayName} public driver profile` ``), search-clear. **No follow/unfollow control on any row** at all, despite the register listing it as a secondary action — the only interactive affordance per row is "open profile." No pagination (full-list load) — a scale risk for high-follower accounts, not a correctness bug. Same **no-`IdentityOrb`, unconditional real-avatar** pattern as driver-profile — meaningful here specifically because this list is reachable from a public profile a stranger can open. Errors mapped to static copy. **Risk: Medium**, privacy-pattern driven.

#### `/notifications` ("Activity") — `app/notifications.tsx` (730 lines)
Not a push-notification inbox — aggregates follows/crew-invitations/upcoming-attendance from Supabase, no `expo-notifications` import anywhere, no realtime subscription (manual refresh + focus-effect only). Accept/Decline crew invitations via RPC `noxa_respond_to_crew_invitation` (both missing `accessibilityLabel`, though the parent row is labeled). Filter chips (All/Events/Social/Crews, missing labels). No mark-read model, no delete/clear — both acceptable per the register's "only if implemented" wording. Errors mapped to static copy. **Risk: Low.**

#### `/search` — `app/search.tsx` (850 lines)
**Confirmed zero UI entry points** anywhere in the app — see Executive Summary #4. Internally the screen is fully correct: signed-out gate, debounced (280ms) live queries across `profiles`/`vehicles`/`crews`/`events` each `.limit(10)`, correct routing per result type, clear/back/no-results-copy states, error banner distinct from empty state, no raw error text, no mock data, no fabricated "recent query" history. Most result rows (driver/vehicle/crew/event, except the no-query-mode `DriverCard`) are missing `accessibilityLabel`. **Risk: High**, entirely due to unreachability — the screen itself is close to done.

#### `/post-editor` (Frozen, 376 lines) — documented, reachability confirmed critical
Two live entry points on Own Profile ("NEW POST" primary CTA and the empty-state row) — not dormant code, a first-class visible action on an MVP screen. Photo-library permission on tap. Posts are inserted with `is_public: true` **unconditionally** — no privacy control is exposed in the composer at all. **Raw error text on publish failure** (`publishError.message`, 162-164, unmapped). Chains directly into the Quarantined `/post-details` on success.

#### `/post-details` (Quarantined, 1074 lines — oversized, see §6) — documented, reachability confirmed critical
**Falsifies its own documentation** — `docs/MVP_COMPLETION_MASTER.md §6.3` describes it as "reachable only from frozen feed," but it is directly reachable from **two** MVP-required screens (Own Profile, Public Driver Profile) via their Posts grids. Not a thin viewer: full like/unlike, save/bookmark, threaded comments (with per-comment like/delete/reply), native share, post-delete (author, confirmed `Alert.alert`), block-author-from-comments (confirmed, shares copy with driver-profile's block flow), report post/comment (via shared `ReportModal`). **The only file in the entire app with a systematic raw-error-leak pattern** — 8 separate `setError(x.message)` call sites (200, 254/286, 337, 356, 375, 416, 438, 480), none mapped. No pagination on comments (hard `.limit(100)`). **Risk: High.**

#### `src/components/moderation/ReportModal.tsx` (326 lines, shared)
Correctly reused by both driver-profile and post-details — no duplication. Reason grid, submit → `submitContentReport()` → `content_reports` insert, duplicate-report guard via Postgres `23505`. Submit button missing explicit `accessibilityLabel` (visible text likely sufficient). **One raw-error-leak site**: any report-insert failure other than the duplicate case passes through `moderation.ts`'s unmapped thrown message.

**Cross-cutting for this batch:** No mock-data imports anywhere (fully live-Supabase). No realtime, no background tasks, no `expo-notifications`. Systemic accessibility gap: roughly a third of `Pressable` controls across this batch rely on `accessibilityRole="button"` alone with no explicit `accessibilityLabel`, concentrated in list-row/card taps specifically (icon-only controls are generally labeled correctly). No secret-looking strings; `"avatars"`/`"post-images"` are configuration constants, not secrets.

---

### 4.7 Settings, Legal, Account

#### `/settings` — `app/settings.tsx` (450 lines)
Comprehensive settings-row list — Edit Profile, Connected Vehicles, Social Connections (hardcoded to `mode:'followers'`, no "following" entry point from here specifically), Activity, Events, Crews, Open Map, Replay Onboarding, Contact NOXA (`mailto:` with `Alert` fallback), App Version (display-only), Blocked Users, Privacy Policy, Terms of Service, **Delete Account** (destructive row), **Sign Out** (destructive row, confirmed via `Alert.alert`). Sign-out teardown correctly calls `stopLiveDriveSession(true)` before `supabase.auth.signOut`. **The sign-out confirmation copy is generic and static regardless of whether Live Drive is actively sharing** — it never calls `getLiveDriveSession()` to detect an active session and branch the copy, directly contradicting register row "Settings": "Sign out confirmation where active sharing exists." **No "Visibility" settings row exists at all** — location-visibility control (Ghost/Friends/Crew/Global) is not surfaced from Settings anywhere, despite the register listing it as an expected sub-destination. Profile-card Pressable (186-211) and error-retry (214-220) both missing `accessibilityLabel`. No raw error text (sign-out and load failures both map to static strings). **Risk: Medium.**

#### `/blocked-users` — `app/blocked-users.tsx` (306 lines)
Unblock — confirmed via `Alert.alert` with specific consequence copy. `loadBlockedUsers()` (`src/lib/moderation.ts:58-68`) has **no explicit `.eq('blocker_id', ...)` filter in the query itself** — relies entirely on RLS to scope rows to the current user; **not independently verified in this pass, flagged as needing RLS confirmation** since a missing/misconfigured policy here would leak other users' block lists. **No tap-through to a limited profile view** for blocked users, despite the register listing "Open limited profile only if safe" as an available action — rows are static. Back button (90-96) hand-rolls a `Pressable`+`Ionicons` instead of using `NoxaIconButton` — see Executive Summary #10. No raw error text. All four register-required states (loading/empty/populated/error) present. **Risk: Low-Medium.**

#### `/delete-account` — `app/delete-account.tsx` (477 lines) + `supabase/functions/delete-account/index.ts` (266 lines)
The most thoroughly-built destructive flow in the app: password-provider users get a **live second password re-authentication** immediately before deletion (not just a client-side flag check, 128-133); social-provider users must complete a fresh OAuth re-auth (`verifySocialIdentity`) before the delete button unlocks; the server independently enforces a **10-minute re-authentication-freshness window** based on `last_sign_in_at` (index.ts:238-246) and re-checks the typed `"DELETE"` confirmation server-side too (defense in depth). Storage cleanup spans `avatars`, `vehicle-images`, `post-images`, `event-gallery`, `crew-gallery` buckets, including gallery items on events/crews the user owns. `auth.users` deletion cascades through `profiles` (confirmed via migration `20260711123954_create_profiles.sql:2`, `on delete cascade`) to `vehicles`/`crews`/`follows`/`crew_members`/`events`/`event_attendees`/`crew_invitations`/`crew_polls`/`user_blocks`/`content_reports`/social posts — substantiating the on-screen consequence copy (not exhaustively verified for every single content table). Server errors are correctly sanitized (generic 500, real error only `console.error`'d server-side). **One concrete gap: `functionError?.message` (the Supabase Functions client-side transport-error path) is passed through unsanitized** (148-154) — low practical exposure today since the function's own structured errors are pre-sanitized, but a genuine unmapped-raw-text path exists. **Android users whose only identity provider is Apple have no in-app deletion path at all** (255-267) — the only recourse is a static, non-tappable support-email line in the footer (not a `Linking.openURL` link, unlike every other "contact support" affordance in the app). **Risk: P1** (well-built overall, not P0) — the two gaps are the transport-error leak and the Android+Apple-only dead end.

#### `/privacy-policy` & `/terms-of-service` — thin wrappers over `src/components/legal/LegalDocumentScreen.tsx` (240 lines, shared)
Confirmed 5-line/6-line wrappers passing static document objects from `src/legal/legalDocuments.ts`. Back (labeled) and Contact (mailto with `Alert` fallback, labeled) both present and match the register exactly. No destructive actions. Reachable both from Settings and from `/sign-up`'s Terms/Privacy links pre-authentication. **Risk: Low.**

#### `src/lib/moderation.ts` (95 lines, shared)
`blockUser`/`unblockUser`/`loadBlockedUsers`/`submitContentReport` all live here. Self-block guarded. Duplicate insert/report (`23505`) correctly swallowed/mapped. `loadBlockedUsers()`'s missing explicit filter (see Blocked Users above) is the one open verification item.

**Cross-cutting for this batch:** Three independent hand-rolled back-button implementations (`blocked-users.tsx`, `delete-account.tsx`, `LegalDocumentScreen.tsx`) instead of `NoxaIconButton`, which `settings.tsx` correctly uses — see Executive Summary #10. Two header primitives (`NoxaTopBar` in settings, `NoxaHeader` everywhere else in this batch) are in concurrent use — not necessarily a bug, flagged as a consistency question. No files over 800 lines in this batch. No root `components/`/`theme.ts` imports. No mock data. No secret values in source (edge function references env-var **names** only: `SUPABASE_SECRET_KEYS`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`).

---

## 5. Import/reference list — root `components/`, `constants/theme.ts`, `*.backup`, `src/data/mock*`

### Root `components/` (Expo-template boilerplate directory, separate from `src/components/`)
| File | Imported by |
|---|---|
| `components/haptic-tab.tsx` | `app/(tabs)/_layout.tsx:7` — **the only file in this directory that is actually used** |
| `components/themed-text.tsx` | none |
| `components/themed-view.tsx` | none |
| `components/ui/icon-symbol.tsx` / `.ios.tsx` | none |
| `components/ui/collapsible.tsx` | none |
| `components/parallax-scroll-view.tsx` | none |
| `components/hello-wave.tsx` | none |
| `components/external-link.tsx` | none |

Everything except `haptic-tab.tsx` is dead Expo-template scaffolding left over from project init, unused anywhere in `app/` or `src/`. Confirmed by repo-wide `grep -rln "components/<name>"` for each file returning zero matches outside the directory itself.

### `constants/theme.ts`
Confirmed **zero importers** anywhere in `app/` or `src/` (`grep -rln "constants/theme\|from ['"]@/constants"`). The canonical, actually-used theme system is `src/theme/` (`colors.ts`, `spacing.ts`, `typography.ts`, `radius.ts`, `shadows.ts`, `animations.ts`, `index.ts`), which every screen in this audit imports from correctly. `constants/theme.ts` is dead, parallel to the real theme system.

### `*.backup` files
| File | Tracked in git? | Referenced by any source file? |
|---|---|---|
| `App.tsx.backup` | **Yes** — committed (`git log -- App.tsx.backup` shows commit `fd7dfdd`) | No |
| `package.json.backup` | **Yes** — committed | No |
| `.env.local.backup` | **No** — untracked, excluded only via local `.git/info/exclude:8`, **not** via the repo-shared `.gitignore` | No (contains variable-name shape only: `EXPO_PUBLIC_SUPABASE_URL=`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=`; values not inspected) |

`App.tsx.backup` and `package.json.backup` are stale, committed dead files from before the current entry-point structure; unreferenced by any build or source file. See §7 for the `.env.local.backup` hazard.

### `src/data/mock*`
| File | Importers outside `src/data/` itself |
|---|---|
| `src/data/mockCars.ts` | **none** |
| `src/data/mockCrews.ts` | **none** |
| `src/data/mockEvents.ts` | **none** |
| `src/data/mockNotifications.ts` | **none** |
| `src/data/mockPublicDrivers.ts` | **none** (not even referenced by `src/data/index.ts`) |
| `src/data/mockSearch.ts` | **none** |
| `src/data/mockUsers.ts` | **none** |
| `src/data/index.ts` (barrel re-exporting all of the above) | **none** — nothing in `app/` or `src/` imports the barrel either |

**Confirmed: all mock data in the repository is dead code.** Every screen audited across all 7 domain batches queries live Supabase data; no fabricated users, events, crews, cars, or search results were found wired into any UI. This is consistent with — and independently confirms — AGENTS.md §3's "Honest emptiness" law at the data-source level (the one exception being the *fake-initials avatar-stack fallback* noted in §2 item 9, which is a rendering fallback inside `CanonicalPrimitives.tsx`, not a mock-data-file import).

---

## 6. Files over 800 lines / mixed-domain responsibility

| File | Lines | Notes |
|---|---|---|
| `app/(tabs)/index.tsx` | 1978 | God-component: screen composition, permission handling, Live Drive lifecycle, realtime subscription management, edge-function routing, and full UI/animation layout, all in one file. Highest-risk file in the app by both size and privacy surface. |
| `src/features/crews-events/CanonicalCrewsScreen.tsx` | 1357 | Combines list, hero, discovery, upcoming-drive card, and a full-screen create-crew modal in one file. |
| `app/event-editor.tsx` | 1436 | Form state, MIME/geocoding helpers, location-picker orchestration, Supabase CRUD, and ~460 lines of inline `StyleSheet`, all in one file. |
| `app/vehicle-editor.tsx` | 1181 | Form validation, MIME/extension helpers, storage-path parsing, error-sanitization, ~7 local UI subcomponents, Supabase+Storage orchestration, and ~380 lines of inline `StyleSheet`. |
| `app/driver-profile/[id].tsx` | 1072 | Profile identity, social graph (follow/block/report), vehicle listing, and post grid all in one file. |
| `app/post-details.tsx` | 1074 | Full social-feed detail screen (likes, comments, save, share, delete, report, block) — the largest feature surface of any Quarantined route. |
| `app/crew-polls.tsx` | 1001 | Largest of the quarantined Crew modules; 4 RPCs + realtime, confirmed orphaned from navigation. |
| `src/features/crews-events/CanonicalCrewDetailScreen.tsx` | 884 | Also carries the 2 pre-existing lint warnings noted in §1. |
| `app/convoy-setup.tsx` | 872 | Frozen, confirmed orphaned. |
| `app/(tabs)/profile.tsx` | 673 | Under the 800-line threshold but flagged in `wc -l` scan for completeness; not mixed-domain. |

Files just under the threshold worth noting for future growth: `app/search.tsx` (850), `app/edit-profile.tsx` (795), `app/crew-gallery.tsx` (673), `src/features/crews-events/CanonicalEventsScreen.tsx` (876), `src/features/crews-events/CanonicalEventDetailScreen.tsx` (758).

---

## 7. Secrets / configuration hazards (no values printed)

1. **`.env.local.backup` exclusion is machine-local only.** Its sole exclusion rule is `.git/info/exclude:8` — a local, per-clone file that is never shared via the repository. The tracked `.gitignore` covers `.env`, `.env.local`, `.env.*.local`, `.env.eas` (with `!.env.example` negated back in), but has **no pattern matching a `*.backup` suffix**. A fresh clone or a different contributor's machine has no protection against accidentally `git add`-ing this file. It currently contains only variable-name shape (`EXPO_PUBLIC_SUPABASE_URL=`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=`, no values inspected/printed), but the pattern itself is a real gap. **Recommended remediation (not applied — documentation-only audit):** add `*.backup` or `.env*.backup` to the tracked `.gitignore`.
2. **`App.tsx.backup` and `package.json.backup` are committed to git history** (see §5) — stale artifacts from before the current Expo Router entry-point structure. Not secrets themselves, but repo-hygiene clutter that increases the surface area someone might mistake for live config.
3. **Edge function environment-variable names are referenced in source but no values are present**: `supabase/functions/delete-account/index.ts` references `SUPABASE_SECRET_KEYS`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` by name only (lines 41, 57, 208) — standard Supabase Edge Function pattern, not a leak.
4. **No hardcoded API keys, tokens, or credential-looking strings were found in any of the ~50 files read across all 7 domain batches.** The Mapbox access token is sourced from `clientEnv.mapboxAccessToken` (externalized config), never inlined.
5. **Debug logging left in shipped code** (not a secret leak, but worth noting alongside config hygiene): `App.tsx:16,24,29,37,49,59,62` (app lifecycle), `src/components/auth/NoxaAuthField.tsx:27,30,40,44` (field mount/focus/blur, logs field *labels* only, never values), `MapboxLiveMap.tsx:140-144` (`console.info` route-render coordinate counts). None print credentials or PII beyond what's already visible in the UI.

---

## 8. Route reachability graph (button/link-level, confirmed via `router.push`/`router.replace`/`href` grep across `app/` and `src/`)

```
/ (index, session gate)
 ├─ (no session) → /welcome
 │    ├─ "Create Account" → /sign-up
 │    ├─ "Sign In" → /sign-in
 │    └─ "Continue as Guest" → /(tabs)  [UNDOCUMENTED AUTH BYPASS]
 ├─ (session, onboarding incomplete) → /onboarding
 │    ├─ "Skip"/"Get started" → /(tabs)  [SKIPS /visibility-setup — BUG]
 │    └─ (back on non-first page) → previous onboarding page
 ├─ (session, visibility-setup incomplete) → /visibility-setup
 │    ├─ "Go Global for 4 hours" → /(tabs)
 │    └─ "Continue in Ghost" → /(tabs)
 └─ (fully set up) → /(tabs)

/sign-in ⇄ /sign-up ⇄ /forgot-password → /reset-password (deep link only)
/sign-up → /terms-of-service, /privacy-policy
auth/callback (deep link only) → /(tabs) or /onboarding [same visibility-setup-skip gap]

/(tabs)  [bottom nav: Crews / Events / Map / Garage / Profile]
 ├─ Crews tab → CanonicalCrewsScreen
 │    └─ crew card/row → /crew/[id] → CanonicalCrewDetailScreen
 │         ├─ event card → /event-details
 │         ├─ "GARAGE" tile (unconditional) → /crew-garage  [QUARANTINED, unconditionally reachable]
 │         ├─ "CHAT" (member-gated) → /crew-chat  [FROZEN, reachable]
 │         ├─ "GALLERY" (member-gated) → /crew-gallery  [QUARANTINED, reachable]
 │         └─ "CALENDAR" (member-gated) → /crew-calendar  [QUARANTINED, reachable]
 │              └─ event row → /event-details ; admin "+" → /event-editor?crewId=
 ├─ Events tab → CanonicalEventsScreen
 │    ├─ "CREATE EVENT" → /event-editor
 │    └─ event card/row → /event-details → CanonicalEventDetailScreen
 │         ├─ "EVENT CHAT" (attendee/host-gated) → /event-chat  [FROZEN, reachable]
 │         ├─ host "Edit Event" → /event-editor?id=
 │         ├─ organizer/creator card → /crew/[id] or /driver-profile/[id]
 │         └─ NAVIGATE → /(tabs) (route mode)
 ├─ Map tab (index) → itself
 │    ├─ event pin/card → /event-details
 │    └─ driver pin → /driver-profile/[id]  [no intermediate Floating Card]
 ├─ Garage tab → app/(tabs)/garage.tsx
 │    ├─ vehicle card → /vehicle-details
 │    └─ "ADD"/"ADD FIRST CAR" → /vehicle-editor
 │         /vehicle-details → edit → /vehicle-editor?id= ; owner row → /driver-profile/[id]
 └─ Profile tab → app/(tabs)/profile.tsx
      ├─ settings icon → /settings
      ├─ "EDIT PROFILE" → /edit-profile
      ├─ Followers/Following stat → /social-list?mode=
      ├─ Vehicles stat → /(tabs)/garage
      ├─ "NEW POST" / empty-state row → /post-editor  [FROZEN, reachable]
      │    └─ (on publish) → /post-details  [QUARANTINED]
      ├─ post grid tile → /post-details  [QUARANTINED, reachable]
      ├─ Explore rows → /(tabs)/garage, /(tabs)/events, /(tabs)/crews
      ├─ Notifications row → /notifications
      └─ "Log Out" → (confirmed) → /welcome-equivalent signed-out root

/driver-profile/[id]  (reachable from: map pins, search, social-list, notifications, post-details, event-detail organizer, vehicle-details owner)
 ├─ post grid tile → /post-details  [QUARANTINED, reachable]
 ├─ vehicle cards → /vehicle-details
 └─ safety-actions sheet → Report (ReportModal) / Block (confirmed Alert)

/settings
 ├─ /edit-profile, /(tabs)/garage, /social-list?mode=followers, /notifications,
 │  /(tabs)/events, /(tabs)/crews, /(tabs), /onboarding?replay=1
 ├─ /blocked-users → (unblock, confirmed Alert)
 ├─ /privacy-policy, /terms-of-service
 ├─ /delete-account  (destructive, dual re-auth, server-enforced freshness)
 └─ "Sign Out" (confirmed Alert, generic copy regardless of active Live Drive)

/search  — REGISTERED (app/_layout.tsx) BUT ZERO INBOUND NAVIGATION REFERENCES FOUND

ORPHANED (registered in app/_layout.tsx, zero router.push/href anywhere else):
 /crew-polls, /convoy-setup, /event-summary
 /event-gallery — reachable only transitively via the also-orphaned /event-summary
```

---

## 9. Raw/unsanitized backend error surfaces (consolidated list)

Every call site below renders a Supabase/Postgres/edge-function error message (or an unmapped deep-link error parameter) directly to the user, rather than through a designed-copy mapper.

| File | Line(s) | Trigger |
|---|---|---|
| `app/sign-up.tsx` | 138 | Sign-up failure (incl. duplicate email) |
| `app/reset-password.tsx` | 68, 93 | Recovery-link `error_description` param; `setSession`/`exchangeCodeForSession`/`verifyOtp` failure |
| `app/post-details.tsx` | 200, 254/286, 337, 356, 375, 416, 438, 480 | Post load, batch load, like/save/comment-like toggle, comment submit/delete, post delete — 8 sites, systemic |
| `app/post-editor.tsx` | 162-164 | Publish failure |
| `app/driver-profile/[id].tsx` | 343-346 | Block-user failure |
| `app/delete-account.tsx` | 148, 153 | Edge-function transport-error passthrough (function's own structured errors are pre-sanitized; only the transport-layer path leaks) |
| `src/components/moderation/ReportModal.tsx` | 82-86 | Any report-insert failure other than duplicate (via unmapped `moderation.ts` throw) |
| `src/features/crews-events/CanonicalCrewsScreen.tsx` | 549 | Crews-list load failure |
| `src/features/crews-events/CanonicalCrewDetailScreen.tsx` | 384-389, 477, 496, 511 | Crew-detail load/join/leave/cancel-request failures |
| `app/crew-chat.tsx` | 74, 92, 142, 189 | Load/send message failures |
| `app/crew-garage.tsx` | 191, 213, 243 | Load failures |
| `app/crew-calendar.tsx` | 179, 205, 221 | Load failures |
| `app/crew-gallery.tsx` | 107, 119, 171 | Load/upload failures |
| `app/crew-polls.tsx` | 407, 433, 463, 540, 559, 581 | Load/vote/create/close-poll failures |
| `app/convoy-setup.tsx` | 253, 342, 371, 388, 401, 418 | Convoy lifecycle failures |
| `src/features/crews-events/CanonicalEventsScreen.tsx` | 388 | RSVP toggle failure |
| `src/features/crews-events/CanonicalEventDetailScreen.tsx` | 349, 436, 455, 517 | Detail load/save-toggle/RSVP-toggle failures |
| `app/event-editor.tsx` | 261, 487 | Load/save failures |
| `app/event-chat.tsx` | 81, 97, 191 | Load/send message failures |
| `app/event-gallery.tsx` | 102, 114, 166 | Load/upload failures |
| `app/event-summary.tsx` | 96, 134, 154, 165, 172 | Load failures |

**Files confirmed to correctly sanitize errors everywhere** (contrast case — the pattern exists in the codebase, it's just not applied uniformly): `app/sign-in.tsx`, `app/forgot-password.tsx`, `app/auth/callback.tsx`/`src/lib/authLinks.ts`, `app/reset-password.tsx`'s own password-update path (line 131 only), `app/visibility-setup.tsx`/`src/lib/liveDrive.ts`, `app/(tabs)/index.tsx` (Home/Map, including realtime-reconnect and edge-function-routing errors), `app/settings.tsx`, `app/edit-profile.tsx`, `app/(tabs)/garage.tsx`, `app/vehicle-editor.tsx` (mostly), `app/(tabs)/profile.tsx`, `app/blocked-users.tsx`.

---

## 10. Duplicate visual primitives

1. **`src/features/crews-events/CanonicalPrimitives.tsx`** — a complete second design-primitive system (`CanonicalPill`, `CanonicalArtwork`, `CanonicalAvatar`, `CanonicalAvatarStack`, `CanonicalPrimaryButton`, `CanonicalSectionHeader`) used exclusively by the four Canonical Crews/Events screens, parallel to canonical `src/components/ui`. See Executive Summary #9 for the fake-initials fallback risk this also introduces.
2. **Hand-rolled back button** (42×42 pill `Pressable` + `Ionicons chevron-back`, no shared component) independently reimplemented in at least 6 places: `app/blocked-users.tsx:90-96`, `app/delete-account.tsx:171-178`, `src/components/legal/LegalDocumentScreen.tsx:33-39`, and the crew-module headers in `crew-chat.tsx`, `crew-gallery.tsx`, `convoy-setup.tsx` — vs. the shared `NoxaIconButton` correctly used in `settings.tsx` and elsewhere.
3. **`garage.tsx`'s `VehicleArtwork`/`SpecCell`** vs. **`vehicle-details.tsx`'s `VehicleHero`/`QuickStat`** — two independently-written local component pairs implementing the same hero-image-with-gradient-scrim-and-spec-strip pattern.
4. **Crew module headers** — `src/components/crew/CrewModuleChrome.tsx` (`CrewModuleHeader`/`CrewModuleIconButton`/`CrewModuleState`) is correctly reused by `crew-garage.tsx`, `crew-calendar.tsx`, `crew-polls.tsx`, but `crew-chat.tsx`, `crew-gallery.tsx`, and `convoy-setup.tsx` each hand-roll a near-identical header instead of importing it.
5. **Two header primitives in concurrent use**: `NoxaTopBar` (used by `settings.tsx`) vs. `NoxaHeader` (used by `blocked-users.tsx`, `delete-account.tsx`, `LegalDocumentScreen.tsx`) — both exported from `src/components/ui`, overlapping purpose, not flagged as a bug but worth a consistency decision.
6. **`HeaderAction`/`StateCard`** local components in `app/driver-profile/[id].tsx` (lines 52-71, 97-113) duplicate patterns available as shared primitives (`NoxaIconButton`, empty/error-state components) rather than importing them — the file only imports `NoxaButton, NoxaScreen` from `@/src/components/ui`.

---

## 11. Group Drive — implementation status

`docs/GROUP_DRIVE.md` (378 lines) is confirmed **documentation only** — no application code exists. Repo-wide search for `group` or `drive` route files under `app/` returns nothing (the one false-positive match, `app/driver-profile`, contains "drive" as a substring of "driver," not the Group Drive feature). Every row in `docs/MVP_SCREEN_ACTION_REGISTER.md`'s Group Drive section (My Group Drives, Group Drive Details, Route Builder, Add Participants, Scheduling, Route Review, Invitation Detail, Active Drive Map, Participants, Host Controls, Completed Summary) has **zero corresponding implementation** — all are "Planned" status per `docs/CURRENT_STATE.md`'s honest-status vocabulary, matching `docs/ROADMAP.md`'s Stage 1.5 ("not started"). No mismatch to report here beyond confirming the documented state is accurate.

---

## 12. Summary of what this audit did not verify

Per `docs/AI_CONTEXT.md`'s instruction to report conflicts/gaps rather than assume, the following are explicitly flagged as unverified by this documentation-only pass and would require either RLS inspection or native-device runtime evidence:

- `user_blocks` table RLS scoping for `loadBlockedUsers()` (`src/lib/moderation.ts:58-68`) — the query has no explicit `blocker_id` filter and relies entirely on RLS.
- `crew-gallery.tsx`'s missing client-side view gate relies entirely on RLS for member-only visibility enforcement — not independently confirmed correct.
- Cross-platform reliability of `localStorage` (used by `src/lib/liveDrive.ts:23-49` for Live Drive session persistence) on the actual React Native/Expo runtime this app ships on — flagged as a potential "restoring" state failure mode, not confirmed broken.
- `driver_locations.user_id`'s cascade-delete behavior on account deletion was not independently confirmed (the broader `profiles`-cascade pattern was spot-checked across most tables, not exhaustively).
- All physical Android/iOS runtime behavior remains **deferred**, per `docs/CURRENT_STATE.md`'s "Static PASS / Runtime pending" ceiling — nothing in this document should be read as runtime-validated.

No files were edited, no dependencies changed, no Supabase/Mapbox configuration touched, and no destructive operations were performed to produce this document.
