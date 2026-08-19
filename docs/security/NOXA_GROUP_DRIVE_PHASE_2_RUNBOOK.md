# NOXA — Group Drive Phase 2 / 2B Runbook

## Status

Review-only stacked draft. Do not deploy, merge to `main`, or mark Done from static checks.

Phase 2 was explicitly authorized on 2026-08-19 as free preparation while the Phase 1 hosted Supabase gate is unavailable. Phase 2B adds only the pre-active Lobby coordination layer defined by PR #192. It depends on the Phase 1 Lobby-safety amendment and does not weaken any hosted/production gate.

## Scope

- My Group Drives;
- Drive Details create/edit;
- start + destination Route Builder;
- individual friend and Crew-expanded invitations;
- invite-only scheduling;
- Route Review;
- safe Invitation Detail preview and Join/Decline;
- pre-active Drive Details / Lobby;
- participant `Ready / Waiting` coordination state;
- host `Start Drive`, including explicit confirmation when accepted participants are still Waiting;
- lightweight Lobby readiness refresh while the Lobby screen is visible;
- independent `drive-route` Edge Function.

## Phase 2B privacy boundary

- Join does not request location permission and does not start exact-location sharing.
- Ready does not request location permission and does not start exact-location sharing.
- Lobby reads only participant identity/lifecycle/readiness data already authorized for accepted participants.
- Phase 2B does **not** read, write or subscribe to `drive_location_state`.
- Starting the server-side Group Drive session does not start a device background-location task in this phase.
- When status becomes `active`, the review screen explicitly states that precise location / Active Drive Map are not enabled yet.
- Personal Live Drive / `driver_locations` remains completely separate.

## Intentional non-goals

- no production migration or Edge Function deployment;
- no `drive_location_state` reads or writes;
- no background location task or Group Drive location consent flow yet;
- no Active Drive participant Realtime/location subscription;
- no Active Drive map;
- no Home/Map entry point or vertical participant overlay yet;
- no host End runtime yet;
- no exact speed, telemetry, leaderboard, ranking, chat, multi-stop UI or automatic rerouting;
- no Event or Crew Convoy integration.

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

- Phase 1 base and Lobby-safety contracts remain green;
- base PostgreSQL/PGlite 41/41 and Lobby-safety 13/13 remain green;
- Phase 2 verifier confirms create/invitation/Lobby routes, Ready/Start RPC usage and absence of precise-location runtime code;
- TypeScript and ESLint have zero errors;
- any pre-existing warning or Expo patch-version mismatch is recorded rather than silently reclassified.

## Required isolated hosted environment

Do not use production for this validation.

Before native testing:

1. create an isolated Supabase Preview branch or staging project;
2. apply the complete Phase 1 base + Lobby-safety migration chain;
3. deploy `drive-route` only to that isolated environment;
4. configure its existing `OPENROUTESERVICE_API_KEY` secret;
5. point the development build at the isolated environment;
6. prepare at least two real authenticated mutual-friend accounts; three accounts are preferred for Ready/Waiting host tests.

## Native entry before Phase 4

Phase 4 owns the Home/Map entry point and vertical Map stack. Until then, open the separate Group Drive route in a native development client:

```bash
npx uri-scheme open "noxa://group-drives" --android
```

This is a review entry only. Do not add a temporary Home/Map button or participant overlay in Phase 2B.

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
12. Finish review and reopen the Group Drive Lobby.
13. Confirm exact route and accepted participant data are visible to the host.
14. Confirm each accepted non-host participant displays `Ready` or `Waiting`; the host is labelled `Host`, not Ready.
15. Confirm Lobby readiness refreshes while the screen remains open without GPS permission prompts.
16. With at least one accepted participant Waiting, tap `Start Drive`; confirm an explicit `Start anyway?` warning appears before the RPC is called.
17. Cancel that warning and confirm the drive remains pre-active.
18. Make all accepted participants Ready and start again; confirm the server session becomes `active`.
19. Confirm the resulting review screen explicitly says Active Drive precise location/Map is not enabled in Phase 2B and no device location task starts.
20. On a separate draft/scheduled drive, cancel one pending invitation and confirm it becomes unavailable to that user.
21. Cancel a draft/scheduled drive through the destructive confirmation.

## Participant Lobby acceptance

1. Before joining, confirm Invitation Detail shows only title, display-safe host name, scheduled time, distance/duration and approximate destination label.
2. Confirm it does not show exact coordinates, route geometry, participant list or live location.
3. Accept an invitation and confirm exactly one `accepted` participant row is created.
4. Open the Lobby; confirm exact route and accepted participant identities are now readable.
5. Confirm no location permission is requested by Join or opening the Lobby.
6. Tap `I'm ready`; confirm own `ready_at` becomes non-null and no `drive_location_state` row is created.
7. Confirm the UI changes to `Ready · tap to undo` and other Lobby clients eventually show this participant as Ready.
8. Undo Ready; confirm own `ready_at` returns to null.
9. Mark Ready again, then have the host change route or scheduled time; confirm readiness resets to Waiting.
10. Confirm the participant cannot call host Start successfully.
11. Leave before start; confirm route/participant access is revoked by backend, not only UI.
12. Attempt to accept a cancelled/already-started invitation and confirm the server rejects it with a safe client message.

## Overlapping Start acceptance

Use two drives sharing at least one accepted participant after the Phase 1 hosted concurrency gate is available:

1. Start Drive A and Drive B concurrently from separate host sessions.
2. Exactly one may become `active`.
3. The other must surface the safe message that one driver is already active in another Group Drive.
4. Confirm the rejected drive remains `draft`/`scheduled` with no start timestamps and no exact-location rows.
5. End/terminalize the active test drive in the controlled backend test, then confirm the other can start.

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
- auth, bottom navigation, Events and Crews still open normally;
- shared `NoxaAvatar` still renders initials when no `imageUrl` is supplied.

## Merge gate

Phase 2/2B is not safe to merge to `main` until all of the following are true:

1. Phase 1 hosted apply, RLS/RPC, true concurrency, Realtime and rollback gates pass;
2. `drive-route` is validated in the same isolated environment;
3. host + participant native runtime above passes;
4. no critical Mapbox, auth, Events, Crews or personal Live Drive regression remains;
5. GitHub Quality passes with Phase 1 base + amendment and Phase 2/2B gates;
6. the Product Owner gives a new explicit merge authorization.
