# NOXA — Group Drive Phase 3B Native Location Runbook

## Scope

Phase 3B adds the first real Group Drive location writer. It is intentionally isolated from personal Live Drive and from the Phase 4 Active Drive Map.

Added:

- a dedicated `noxa-group-drive-location-v1` TaskManager task;
- a Group Drive-scoped disclosure primitive;
- foreground/background permission request only after explicit disclosure acceptance;
- server-active-session verification before the writer starts;
- writes only through `noxa_upsert_drive_location`;
- server-owned `active_expires_at` used as the local hard stop;
- fail-closed local teardown for sign-out and authorization revocation;
- transient network failures keep the writer alive for a later retry;
- a separate location-sharing screen for native acceptance;
- platform permission copy updated to disclose both personal Live Drive and explicitly approved active Group Drive use.

## Isolation

The following are intentionally unchanged:

- `src/lib/liveDrive.ts`;
- `driver_locations`;
- personal Ghost/Friends/Crew/Global visibility lifecycle;
- Events and `event-route`;
- Crew Convoy;
- Home/Map, Follow and Recenter;
- production Supabase schema/data.

The Phase 3B verifier checks the exact Git blob of `src/lib/liveDrive.ts` to detect accidental changes.

## Static / deterministic checks

Run:

```text
npx tsc --noEmit
npm run lint
npm run verify:group-drive-phase-3b
npm run test:group-drive-phase-3b
```

The deterministic runtime smoke proves:

- background task registration;
- foreground permission refusal does not start sharing;
- stale disclosure cannot start sharing;
- valid scoped disclosure starts only the dedicated Group Drive task;
- first location write uses `noxa_upsert_drive_location` with no speed/rank/progress payload;
- transient RPC/network failure keeps the task alive;
- server authorization failure stops and clears local runtime state;
- sign-out stops and clears local runtime state.

## Physical Android acceptance

Use a development build, not Expo Go.

1. Create/join a Group Drive with two real authenticated accounts.
2. Before host Start, confirm Join and Ready show no location permission prompt and create no `drive_location_state` row.
3. Host starts the drive.
4. Open `/group-drives/<drive-id>/location-sharing` on the participant device.
5. Choose **Not now** and verify no permission prompt/writer/location row is created.
6. Reopen the screen, choose **Share my location**, accept foreground/background permissions, and verify one protected location row appears for that participant.
7. Move the device and verify the same opaque row is updated rather than duplicated.
8. Background the app and verify updates continue according to Android permission/foreground-service behavior.
9. Restore the app and verify the writer remains associated only with the same active Group Drive.
10. Disconnect/reconnect networking and verify updates recover without creating duplicates.
11. Leave/remove/end/revoke access and verify the native writer stops and no later write recreates the row after server cleanup.
12. Sign out and verify the native Group Drive task stops and does not restart.
13. Regression-check personal Live Drive, Events, Home/Map Follow/Recenter, auth and onboarding.

## Not claimed

- No Android runtime PASS yet.
- No iOS runtime PASS yet.
- No production migration/deployment.
- No automatic Lobby → location-sharing navigation yet; Phase 4/Active Drive integration remains a separate reviewed change.
- No Active Drive Map/markers/participant stack integration in this PR.
- No host End/summary completion work; that remains Phase 5.

Keep the PR Draft until physical Android acceptance is recorded. iOS acceptance remains required before release.
