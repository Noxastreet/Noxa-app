# NOXA — MVP Execution Waves and Status Contract

**Parent contract:** `docs/MVP_COMPLETION_MASTER.md`

## 14. Status vocabulary

Use only these delivery states:

- **Planned** — accepted intent, no approved design/code.
- **Design in review** — visual/interaction contract exists but is not approved.
- **Design approved** — approved contract, implementation not complete.
- **Implemented** — code exists; static or runtime evidence may still be missing.
- **Static PASS** — required static checks pass on an exact commit.
- **Runtime pending** — requires native device/build evidence.
- **Device PASS** — acceptance path passed on recorded device/build.
- **Done** — merged, required production evidence recorded, and device criteria met.
- **Frozen** — preserved outside MVP; no active improvement.
- **Rejected** — must not be implemented.

Never use “Done” for a design, code presence or passing lint alone.

## 15. Ordered execution program

Only one wave is active at a time. Keep at most five active tasks.

### Wave 0 — Knowledge and audit normalization

Deliverables:

- [x] canonical master audit;
- [x] screen/action register;
- [x] AI execution playbook;
- [ ] Claude Code exact import/route/action/data inventory;
- [ ] classify quarantined routes;
- [ ] normalize stale Notion statuses against GitHub;
- [ ] record current branch/head/check evidence;
- [ ] identify dead code, mocks and duplicate foundations without deleting them.

Exit: all work is classified and every agent reads the same program.

### Wave 1 — UI foundation convergence

- [ ] audit every existing `src/components/ui` primitive;
- [ ] approve/fix Bottom Navigation contract;
- [ ] implement Sheet Controller;
- [ ] decide Toast/feedback mechanism;
- [ ] normalize tokens and remove one-off styles only when screens migrate;
- [ ] add missing accessibility/state contracts;
- [ ] no broad app redesign in one commit.

Exit: shared primitives can support all MVP screens.

### Wave 2 — Entry, Auth and Onboarding

Design then implement:

- Welcome;
- Sign in;
- Sign up;
- Forgot/Reset;
- Onboarding;
- Visibility Setup;
- configuration/callback states.

Exit: complete account-to-Map path is Static PASS.

### Wave 3 — Home/Map and personal Live Drive

- Driver Floating Card;
- IdentityOrb privacy integration;
- adaptive density/hotspot;
- Smart Camera;
- route/follow cleanup;
- Driving Mode;
- personal Live Drive state/lifecycle hardening;
- no Group Drive work mixed into this wave.

Exit: core Map path is Static PASS and has a complete deferred device checklist.

### Wave 4 — Events and Crews

- preserve canonical list/detail screens;
- complete Event Editor;
- audit all real states/data/actions;
- simplify Crew detail to MVP;
- freeze/quarantine advanced modules;
- no chat/gallery/polls expansion.

Exit: Events and Crews MVP paths are Static PASS.

### Wave 5 — Garage, Profile, Search and Notifications

- Garage;
- Vehicle Detail/Editor;
- own/public/edit Profile;
- conditional social lists;
- Search;
- Notifications;
- remove release-path mock data.

Exit: identity and discovery paths are Static PASS.

### Wave 6 — Settings, safety, moderation and legal

- Settings;
- blocked users;
- report/block;
- account deletion;
- Privacy Policy;
- Terms;
- support/error copy;
- backend deployment remains separately approved.

Exit: safety/legal UI path is Static PASS.

### Wave 7 — Group Drive

Prerequisites:

- design v1.1.1 approved;
- `docs/GROUP_DRIVE.md` unchanged or consciously revised;
- core UI foundations ready.

Phases remain separate checkpoints:

1. presentation components;
2. mock-data screens/navigation;
3. reviewed migrations/RLS/RPCs, not production-applied;
4. drive-route;
5. realtime/location lifecycle;
6. Active Drive integration;
7. completion summary;
8. full two-account device checklist later.

Exit: Group Drive is Static PASS with no unauthorized production mutation.

### Wave 8 — Static release candidate hardening

- [ ] route reachability;
- [ ] no release-path mocks;
- [ ] no raw errors;
- [ ] no secrets;
- [ ] no dead mandatory actions;
- [ ] consistent terminology;
- [ ] accessibility pass;
- [ ] performance review;
- [ ] crash/product analytics decision;
- [ ] legal/release metadata review;
- [ ] exact RC commit SHA recorded.

Exit: codebase is ready for account/device purchase and native builds.

### Wave 9 — Physical-device validation

After Android and Apple Developer accounts/devices are available:

- build from exact RC commit;
- record build IDs, app version, OS and device models;
- execute the full route/system checklist;
- test two accounts for social/location/privacy paths;
- file P0/P1 defects;
- fix through scoped commits;
- re-run regression;
- merge only after evidence.

## 16. Definition of MVP completion

NOXA MVP is complete only when:

- all required MVP routes are implemented and classified;
- every screen has approved visual/interaction behavior;
- all required states are implemented;
- all core actions reach real outcomes;
- V2 modules are frozen and cannot confuse the core flow;
- TypeScript, lint, Expo Doctor and diff checks pass;
- security/privacy contracts are reviewed;
- production changes have explicit runbooks and evidence;
- exact Android and iOS release candidates pass their device checklists;
- P0 defects are closed;
- documentation and Notion are synchronized to the verified state.

Until device testing, the maximum honest state is **Static PASS / Runtime pending**.
