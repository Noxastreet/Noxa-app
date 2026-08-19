# NOXA Group Drive Phase 1 — Lobby Safety Amendment Runbook

Date: 2026-08-19

Issue: #189

Base Phase 1 PR: #190

Product/UX contract: PR #192 / `docs/GROUP_DRIVE_LOBBY_PARTICIPANT_STACK.md`

Amendment migration: `supabase/migrations/20260819201500_group_drive_phase_1_lobby_safety.sql`

## Status

**Review draft only — not authorized for production.**

This amendment is intentionally additive to the existing Phase 1 draft. It must
be applied only after the base Phase 1 migration in an isolated environment.
It does not authorize production Supabase changes, Phase 3 location runtime, or
Phase 4 Map work.

## Adds

- nullable `drive_participants.ready_at` for coordination-only Lobby readiness;
- `noxa_set_drive_ready(uuid, boolean)` for the caller's own accepted participant
  row only;
- automatic readiness reset when route version or scheduled start changes;
- automatic readiness clear when a participant leaves `accepted` lifecycle;
- deterministic accepted-participant identity locking inside `noxa_start_drive`;
- rejection when any accepted user is already a participant of another session
  whose session and participant statuses are both `active`.

## Privacy invariants

- Ready is never location consent.
- The Ready RPC does not read/write `drive_location_state`.
- Ready is unavailable after session start.
- Host does not use Ready; host owns Start.
- No speed, rank, ETA, distance progress, or location data is added here.
- Personal Live Drive and `driver_locations` remain unchanged.

## Concurrency model

`noxa_start_drive` already locks its target `drive_sessions` row. The amendment
then locks every accepted participant's shared `profiles` row in stable UUID
order. Two concurrent starts with any overlapping accepted user therefore
serialize on the same profile row(s). After the first transaction commits, the
second rechecks active membership and fails before its session transitions to
`active`.

This local model must still be tested with true concurrent hosted connections
before production approval. PGlite proves the state invariant and SQL contract,
not real network/process concurrency.

## Local verification

Run:

```bash
npm run verify:group-drive-phase-1
npm run test:group-drive-phase-1
```

The combined commands run the original Phase 1 gates plus the Lobby safety
amendment gates.

Required amendment behavior:

1. base migration + amendment compile together;
2. `ready_at` exists and is coordination-only;
3. only authenticated callers can execute `noxa_set_drive_ready`;
4. accepted non-host participant can mark/unmark own readiness;
5. host cannot use participant Ready;
6. route change clears readiness;
7. schedule change clears readiness;
8. Start clears readiness as participant lifecycle becomes active;
9. Ready after Start is rejected;
10. overlapping second Start is rejected and leaves that session unchanged;
11. after the first drive ends, the second drive may start;
12. none of these operations creates a `drive_location_state` row.

## Hosted concurrency gate

Before production application, use two separate database connections:

1. Prepare Drive A and Drive B so they share at least one accepted participant.
2. Begin `noxa_start_drive(A)` and `noxa_start_drive(B)` concurrently.
3. Exactly one may commit to `active`.
4. The other must return the overlap error after lock release.
5. Confirm the rejected session remains `draft`/`scheduled` with no lifecycle
   timestamps and no Group Drive location rows.
6. Repeat with overlap only through a non-host participant, not only the host.
7. Repeat with participant ordering reversed between the drives to verify the
   stable UUID lock order avoids deadlock.

## Amendment rollback

If the base Phase 1 schema is intentionally retained while reverting only this
amendment, run in an isolated environment first:

```sql
begin;

drop function if exists public.noxa_set_drive_ready(uuid, boolean);

drop trigger if exists drive_sessions_reset_readiness_on_plan_change
  on public.drive_sessions;
drop function if exists private.noxa_reset_drive_readiness_on_plan_change();

drop trigger if exists drive_participants_normalize_readiness
  on public.drive_participants;
drop function if exists private.noxa_normalize_drive_participant_readiness();

alter table public.drive_participants
  drop constraint if exists drive_participants_ready_lifecycle_check;
alter table public.drive_participants
  drop column if exists ready_at;

-- Restore the base Phase 1 version of public.noxa_start_drive(uuid) from
-- 20260819080201_group_drive_phase_1.sql before commit.

commit;
```

Do not use this amendment-only rollback after runtime data depends on readiness
without first reviewing data/lifecycle impact. Full Group Drive rollback remains
the base Phase 1 runbook and must include this amendment's objects before the
base tables are removed.

## Production gate

Still required before any production apply:

- final SQL review;
- complete migration-chain apply in isolated hosted Supabase;
- combined local gates PASS;
- hosted two-account authorization matrix;
- true overlapping-start concurrency test;
- hosted Realtime validation for the base location table;
- rollback rehearsal;
- Supabase security/performance advisors;
- explicit Product Owner approval.
