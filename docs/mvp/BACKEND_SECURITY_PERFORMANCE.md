# NOXA — Backend, Security, Performance and Static Gates

**Parent contract:** `docs/MVP_COMPLETION_MASTER.md`

## 11. Backend, privacy and security audit

### 11.1 Existing data domains to map

Claude Code must produce a table-to-screen usage map for:

- profiles;
- vehicles and vehicle storage;
- follows;
- events and event experience;
- driver_locations and visibility modes;
- crews, members, invitations and admin roles;
- social posts/saved events/crew events;
- moderation and blocks;
- edge functions `event-route` and `delete-account`.

For each table/function record:

- read paths;
- write paths;
- RPC/edge-function paths;
- RLS expectations;
- realtime usage;
- cleanup/retention;
- owning screens;
- blocked-user behavior;
- production verification status.

### 11.2 Production controls

Without a separate explicit approval, do not:

- apply production migrations;
- execute destructive SQL;
- deploy/replace production edge functions;
- rotate or reveal secrets;
- change OAuth providers;
- modify production Mapbox styles, datasets, tilesets or tokens;
- submit store builds;
- merge the integration PR.

Any production proposal must include:

1. exact resource and environment;
2. backup;
3. migration/runbook;
4. verification queries;
5. rollback;
6. expected user impact;
7. explicit stop for approval.

### 11.3 Mapbox controls

Allowed during development:

- existing public mobile token;
- existing map/style rendering;
- approved geocoding/routing APIs;
- local/dev configuration validation.

Forbidden without approval:

- printing or committing token values;
- client use of secret `sk` tokens;
- token creation/rotation/deletion;
- production style/dataset/tileset mutation;
- billing/account administration.

## 12. Performance and reliability audit

### Map and location

- [ ] no unnecessary rerender of all markers;
- [ ] viewport/density strategy documented;
- [ ] source/layer updates batched;
- [ ] camera ownership explicit;
- [ ] GPS writes throttled;
- [ ] background task has one lifecycle owner;
- [ ] realtime subscriptions cleaned up;
- [ ] stale data expires visibly and server-side where required;
- [ ] battery and network behavior documented for later device test.

### Lists and media

- [ ] stable keys;
- [ ] pagination or bounded query where data can grow;
- [ ] no unbounded image fetch;
- [ ] image dimensions/fallback/caching strategy;
- [ ] pull-to-refresh does not duplicate requests;
- [ ] optimistic updates have rollback;
- [ ] no mock datasets in release paths.

### App lifecycle

- [ ] auth listener is not duplicated;
- [ ] app foreground/background transitions are defined;
- [ ] pending deep links survive cold start;
- [ ] stale async results cannot overwrite newer state;
- [ ] offline/retry does not create duplicate records;
- [ ] destructive operations are idempotent where possible.

## 13. Static quality gates

Every logical implementation checkpoint must run:

```bash
npx tsc --noEmit -p tsconfig.json
npm run lint
npx expo-doctor
git diff --check
```

Also required where applicable:

- focused tests or scripts introduced by the change;
- migration lint/review;
- secret scan;
- dependency change explanation;
- changed-route import/reachability audit;
- screenshots or design comparison if available.

A warning may be accepted only when identified as pre-existing and unrelated.
