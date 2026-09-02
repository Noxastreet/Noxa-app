# NOXA — Group Drive Phase 4B Simulated Participant Stack Runbook

## Scope

This stacked draft turns the approved Phase 4A progress/order state into the first visual Active Drive participant stack:

- approved full-row compact design: avatar plus remaining distance/status;
- `Arrived`, restrained 0.1 km precision and honest `Unavailable` presentation;
- a maximum of five visible participants, current-user reservation and `+N`;
- selected participant accent ring without rank or competition language;
- Reanimated 320 ms layout transition with system Reduced Motion handling;
- accessible participant/state labels and 44 × 44 minimum interaction targets;
- an isolated development-only simulation screen at `/group-drives/participant-stack-preview`.

The visual direction is the Product Owner-selected first Superdesign draft. The later ultra-compact overlapping-label variation was rejected and reverted.

## Isolation and privacy

1. The preview consumes the existing Phase 3A in-memory simulation and Phase 4A local route-progress/order logic.
2. It requests no location permission and starts no background task.
3. It imports no Supabase client, makes no Realtime subscription and writes no location row.
4. It imports no Mapbox code and does not change Home/Map.
5. The preview has no normal navigation entry and redirects to My Group Drives outside `__DEV__`.
6. Personal Live Drive, `src/lib/liveDrive.ts`, `driver_locations`, Event Route and Crew Convoy remain untouched.

## Interaction contract

- A focusable row calls `onSelectParticipant(userId)`; the future Active Drive map will own the camera response.
- Stale/unknown rows call the separate unavailable callback and never pretend that a marker can be focused.
- `+N` opens the future participant sheet through a callback; this draft does not add that sheet.
- Ordering remains presentation-only and carries no rank, speed, ETA or finishing history.

## Local/CI verification

Run:

```text
npm run verify:group-drive-phase-4b
npm run test:group-drive-phase-4b
npx tsc --noEmit
npm run lint
```

For an Expo Go / Android emulator visual smoke in development, open:

```text
/group-drives/participant-stack-preview
```

Use **Next update** twice to confirm that a truthful order change animates without bounce. Enable system Reduced Motion and confirm rows move directly to their settled order. Tap `Unavailable` and confirm the preview reports that focus is unavailable. Tap `+N` and confirm the hidden count is reported.

## Gates not claimed

- No Mapbox map, participant marker or camera focus is implemented.
- No native GPS, foreground/background writer or permission flow is implemented.
- No hosted multi-account Realtime behavior is validated by this UI draft.
- Expo Go / emulator visual acceptance and physical Android/iOS acceptance remain open.
- This stacked draft is not safe to merge to `main` while Phase 1/2B/3A/4A remain draft and their release gates are open.
- Production Supabase remains unchanged.
