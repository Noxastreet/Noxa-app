# NOXA — Group Drive Phase 2 Runbook

## Status

Review-only stacked draft. Do not deploy, merge to `main`, or mark Done from static checks.

Phase 2 was explicitly authorized on 2026-08-19 as free preparation while the Phase 1 hosted Supabase gate is unavailable. It depends on the Phase 1 draft and does not weaken that gate.

## Scope

- My Group Drives;
- Drive Details create/edit;
- start + destination Route Builder;
- individual friend and Crew-expanded invitations;
- invite-only scheduling;
- Route Review;
- safe Invitation Detail preview and Join/Decline;
- pre-active Drive Details;
- independent `drive-route` Edge Function.

## Intentional non-goals

- no production migration or Edge Function deployment;
- no `drive_location_state` reads or writes;
- no background location task;
- no Realtime subscription;
- no Active Drive map;
- no Home/Map entry point;
- no exact speed, telemetry, leaderboard, chat, multi-stop UI or automatic rerouting;
- no Event or Crew Convoy integration;
- no host Start/End runtime before Active Drive is implemented.

## Static gate

Run from the repository root:

```bash
npm run verify:group-drive-phase-1
npm run test:group-drive-phase-1
npm run verify:group-drive-phase-2
npx tsc --noEmit
npm run lint
npx expo-doctor
git diff --check
```

Expected:

- Phase 1 contract and local PostgreSQL suite remain green;
- Phase 2 verifier confirms the create/invitation routes, protected RPC usage and absence of live-location code;
- TypeScript and ESLint have zero errors;
- any pre-existing warning or Expo patch-version mismatch is recorded rather than silently reclassified.

## Required isolated hosted environment

Do not use production for this validation.

Before native testing:

1. create an isolated Supabase Preview branch or staging project;
2. apply the complete migration chain including the Phase 1 Group Drive migration;
3. deploy `drive-route` only to that isolated environment;
4. configure its existing `OPENROUTESERVICE_API_KEY` secret;
5. point the development build at the isolated environment;
6. prepare two real authenticated accounts that are mutual friends; optionally place both in one test Crew.

## Native entry before Phase 4

Phase 4 owns the Home/Map entry point. Until then, open the separate route in a native development client:

```bash
npx uri-scheme open "noxa://group-drives" --android
```

This is a review entry only. Do not add a temporary Home/Map button in Phase 2.

## Host acceptance

1. Open My Group Drives with no existing drives.
2. Confirm the empty state contains no invented activity or counts.
3. Create a drive with a 2–100 character title and optional description.
4. Choose start and destination on the Mapbox picker.
5. Deny foreground location and confirm manual point selection remains usable.
6. Retry with foreground permission and confirm `Use Current Location` updates only the picker.
7. Confirm `drive-route` returns a valid LineString, distance, duration and provider.
8. Select one mutual friend. Confirm Continue clearly states that an invitation is sent.
9. Select a test Crew. Confirm the UI describes individual invitations, not one Crew-level grant.
10. Choose “When everyone is ready”; confirm no location sharing starts.
11. Repeat with a future scheduled time; confirm scheduling does not auto-start the drive.
12. Finish review and reopen Drive Details from My Group Drives.
13. Confirm exact route and participant data are available to the host.
14. Cancel one pending invitation and confirm it becomes unavailable to that user.
15. Cancel a draft/scheduled drive through the destructive confirmation.

## Invited-account acceptance

1. Open My Group Drives on the invited account.
2. Open the invitation item.
3. Before joining, confirm the screen shows only:
   - title;
   - display-safe host name;
   - scheduled time;
   - distance and duration;
   - approximate destination label.
4. Confirm it does not show exact coordinates, route geometry, participant list or live location.
5. Decline one invitation and confirm the host sees `declined` without a participant row.
6. Accept another invitation and confirm a single `accepted` participant row is created.
7. After accepting, open Drive Details and confirm the exact start/end and participant list are now readable.
8. Leave before the drive starts; confirm route and participant-list access are revoked by the backend, not only hidden by the UI.
9. Attempt to accept a cancelled or already-started invitation and confirm the server rejects it with a safe client message.

## Route failure matrix

- missing/expired authentication → safe sign-in message;
- invalid points → no provider request;
- provider timeout → retryable timeout/unavailable state;
- provider 429 → busy/retry message;
- malformed or empty provider response → no route is stored;
- missing function or unapplied schema → honest environment-unavailable state, no fallback fake route.

## Regression gate

- Event location picker keeps its existing default title and confirmation label;
- Event `event-route` is unchanged;
- Home/Map, Route, Follow, Recenter and NOXA arrow are unchanged;
- personal Live Drive and `driver_locations` are unchanged;
- Crew Convoy remains frozen and untouched;
- auth, bottom navigation, Events and Crews still open normally.

## Merge gate

Phase 2 is not safe to merge to `main` until all of the following are true:

1. Phase 1 hosted apply, RLS/RPC, concurrency, Realtime and rollback gates pass;
2. `drive-route` is validated in the same isolated environment;
3. host + participant native runtime above passes;
4. no critical Mapbox, auth, Events, Crews or personal Live Drive regression remains;
5. GitHub Quality passes;
6. the Product Owner gives a new explicit merge authorization.
