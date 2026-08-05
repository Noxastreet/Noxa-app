# NOXA — AI Execution Playbook

**Status:** Mandatory operating protocol  
**Companion documents:**

1. `AGENTS.md`
2. `docs/MVP_COMPLETION_MASTER.md`
3. `docs/MVP_SCREEN_ACTION_REGISTER.md`
4. `docs/AI_CONTEXT.md`
5. `docs/CURRENT_STATE.md`
6. relevant domain/design specification

The purpose of this playbook is to make ChatGPT, Claude Design and Claude Code behave as one controlled delivery system without relying on conversational memory.

## 1. Session bootstrap

At the beginning of every significant Claude Code or Claude Design session, use this prompt:

```text
You are working on NOXA.

Before proposing or changing anything:

1. Read AGENTS.md.
2. Read docs/MVP_COMPLETION_MASTER.md.
3. Read docs/MVP_SCREEN_ACTION_REGISTER.md.
4. Read docs/AI_EXECUTION_PLAYBOOK.md.
5. Read docs/AI_CONTEXT.md and docs/CURRENT_STATE.md.
6. Read the relevant product, design and domain specifications.
7. Inspect the current Git branch, exact HEAD, working tree and open PR.
8. Treat GitHub code/PR evidence as implementation truth and Notion as product/design planning.
9. Report any conflict before acting.
10. State:
   - verified branch and HEAD;
   - current PR;
   - task classification: MVP / Frozen / Rejected;
   - exact files likely affected;
   - user-visible outcome;
   - risks;
   - checks;
   - runtime validation that will remain deferred.

Do not write code or redesign until this startup report is complete.

Global restrictions:
- do not merge;
- do not force-push;
- do not expose or commit secrets;
- do not apply production Supabase changes;
- do not mutate production Mapbox resources;
- do not add scope;
- do not improve Frozen/V2 routes;
- keep each logical checkpoint as a separate commit.
```

This prompt is not optional merely because the agent remembers a previous conversation.

## 2. Operating model

### Product decision loop

`Product owner → ChatGPT brief → Claude Design → ChatGPT design review → design freeze → Claude Code → ChatGPT diff review → static evidence → later device evidence`

### Technical truth loop

`inspect current branch → make one scoped change → static checks → commit → push → update draft PR → review → continue`

### Documentation loop

`verified state change → update repository docs → update Notion link/status summary`

Never update a status from intention alone.

## 3. Task brief format

Every task sent to Claude Design or Claude Code must include:

```text
TASK
One sentence describing the user-visible outcome.

WHY
The exact user problem and canonical rule.

CLASSIFICATION
MVP / Frozen / Rejected.

IN SCOPE
Explicit files, screens, states and behavior.

OUT OF SCOPE
Features, routes, data changes and redesigns that must not occur.

SOURCE CONTRACT
Repository docs and approved design artifacts to read.

CURRENT VERIFIED STATE
Branch, HEAD, PR and existing implementation evidence.

ACCEPTANCE CRITERIA
Observable, testable requirements.

CHECKS
Static checks and runtime evidence required/deferred.

COMMIT
Exact logical checkpoint and expected commit message shape.

STOP CONDITIONS
Conflicts, production mutations, secret needs, dependency additions,
architecture changes or scope expansion require stopping for approval.
```

## 4. Claude Design master audit prompt

Use this at the start of each design wave, not for the entire app in one uncontrolled canvas.

```text
You are the NOXA Design execution agent.

Read:
- AGENTS.md
- docs/MVP_COMPLETION_MASTER.md
- docs/MVP_SCREEN_ACTION_REGISTER.md
- docs/AI_EXECUTION_PLAYBOOK.md
- docs/UI_RULES.md
- docs/design/NOXA_APPLE_DESIGN_STANDARD.md
- docs/ai-design-library/*
- the relevant current GitHub screens/components
- the relevant Notion Design Bible, Screen Bible and Component Library

Goal:
Produce an implementation-grade visual and interaction package for the assigned MVP wave.
Preserve working product behavior unless the brief explicitly changes it.

For every assigned screen provide:
1. job-to-be-done;
2. deterministic entry and exit;
3. information hierarchy;
4. exactly one primary action per level;
5. all secondary and destructive actions;
6. default, loading, empty, partial, error, offline, permission and stale states where applicable;
7. keyboard, small Android, safe area, long text and large text behavior;
8. component mapping to existing Noxa primitives;
9. only justified new components;
10. motion purpose and Reduced Motion alternative;
11. accessibility labels/reading order/touch targets;
12. privacy and trust treatment;
13. conflicts with current code/docs;
14. explicit Claude Code handoff.

Visual rules:
- dark, calm, premium, automotive;
- near-monochrome with controlled accent;
- space and typography create hierarchy;
- no game HUD, cyberpunk, decorative glow, random gradients or dense glass;
- no copying competitor visual identity;
- map and real data remain visually dominant;
- no fake activity or exact speed.

Do not:
- write application code;
- change database or API contracts;
- invent backend fields;
- promote Frozen/V2 modules;
- redesign unrelated screens;
- assume a current component is behavior-complete merely because its file exists.

Deliver:
- rationale;
- flow diagram;
- high-fidelity frames for every required state;
- component/state inventory;
- responsive/accessibility/motion specification;
- unresolved questions;
- a concise implementation handoff.

Stop when a product, privacy, navigation or data conflict is discovered and surface it.
```

## 5. Claude Code initial repository audit prompt

This is the first Claude Code task after this documentation checkpoint.

```text
Perform a documentation-only exact-source audit of the current NOXA branch.

Read all mandatory documents first and verify branch/HEAD/PR.

Do not change application behavior.

Create or update:
docs/audit/CURRENT_ROUTE_ACTION_DATA_INVENTORY.md

Inventory every file under app/ plus the supporting screens/components that own behavior.

For each route/surface record:
- route and owning component;
- reachable-from routes;
- every button, icon button, Pressable, Touchable, list-row tap, map tap and gesture;
- visible label/accessibility label;
- handler/function;
- navigation destination or mutation;
- every permission request;
- every destructive operation;
- Supabase tables, RPCs, storage buckets and edge functions;
- realtime/background tasks;
- mock-data imports;
- loading/empty/error/offline/stale states;
- MVP/Frozen/Quarantine classification from docs/MVP_COMPLETION_MASTER.md;
- mismatch against docs/MVP_SCREEN_ACTION_REGISTER.md;
- risk level.

Also produce:
- an import/reference list for root components/, constants/theme.ts, *.backup and src/data/mock*;
- a route reachability graph;
- a list of raw backend error surfaces;
- a list of duplicate visual primitives;
- a list of files over 800 lines or with mixed domain responsibilities;
- a list of secrets/configuration hazards without printing values.

Run:
npx tsc --noEmit -p tsconfig.json
npm run lint
npx expo-doctor
git diff --check

Commit only the audit documentation:
docs: add exact current route and action inventory

Do not:
- edit application code;
- delete files;
- change dependencies;
- change Supabase or Mapbox;
- update production;
- merge.

Return the commit SHA and concise findings. Stop if the branch HEAD differs from the verified PR head or if required repository access is incomplete.
```

## 6. Claude Code implementation prompt

Use one prompt per approved checkpoint.

```text
Implement the approved NOXA task below.

First perform the mandatory session bootstrap and compare the task with:
- docs/MVP_COMPLETION_MASTER.md
- docs/MVP_SCREEN_ACTION_REGISTER.md
- docs/audit/CURRENT_ROUTE_ACTION_DATA_INVENTORY.md
- the approved design package
- current branch/PR diff

[INSERT TASK BRIEF]

Engineering requirements:
- preserve unrelated runtime behavior;
- reuse src/components/ui and src/theme;
- no one-off duplicate primitives;
- implement all states in the brief;
- sanitize user-facing errors;
- preserve accessibility and safe areas;
- no release-path mock data unless the task is explicitly a mock presentation phase;
- no exact speed;
- no secret output;
- no production mutation;
- no dependency addition without stopping for approval.

Before committing:
- inspect diff for scope creep;
- run TypeScript, lint, Expo Doctor and diff check;
- report any check not executable;
- update only documentation whose verified state changed.

Commit as one logical checkpoint.
Push to the current integration branch and update the draft PR.
Do not merge.

Completion report:
- outcome;
- changed files;
- behavior changed/preserved;
- checks and exact results;
- runtime validation deferred;
- limitations;
- rollback;
- commit SHA;
- whether the task is safe to continue, not whether the PR is ready to merge.
```

## 7. Design review gate

ChatGPT reviews each package against:

- product job;
- one-primary-action rule;
- progressive disclosure;
- navigation determinism;
- state completeness;
- privacy boundary;
- driving safety;
- small Android and large text;
- component reuse;
- NOXA visual character;
- no V2 leakage;
- no unsupported data assumption.

Possible outcomes:

- **PASS** — design can be frozen.
- **PASS WITH MICRO-CORRECTIONS** — same direction, limited corrections.
- **REQUEST CHANGES** — product/privacy/navigation conflict.
- **REJECT** — scope or visual direction contradicts NOXA.

Claude Code receives only reviewed/frozen design contracts.

## 8. Code review gate

ChatGPT reviews:

- exact head SHA and diff;
- changed-file scope;
- architecture and state ownership;
- data/privacy implications;
- navigation and lifecycle cleanup;
- accessibility;
- error/empty/loading behavior;
- static check evidence;
- undocumented assumptions;
- rollback.

A static review can approve continuation but cannot declare device-dependent work Done.

## 9. Commit and PR protocol

- Use the current long-lived integration branch unless product explicitly changes the strategy.
- Keep one draft PR.
- Each logical stage is a separate commit/checkpoint.
- Never mix docs, foundation refactor, screen redesign, backend migration and production application in one commit.
- Before every mutation, verify the remote PR head.
- Do not rebase/force-push without approval.
- Do not merge before the required physical-device evidence.
- Update the PR body when accumulated scope changes materially.

Recommended commit prefixes:

- `docs:`
- `refactor(ui):`
- `feat(auth):`
- `feat(map):`
- `feat(events):`
- `feat(crews):`
- `feat(garage):`
- `feat(profile):`
- `feat(settings):`
- `feat(group-drive):`
- `fix:`

## 10. Notion synchronization rule

GitHub contains the complete canonical execution documents.

Notion should contain:

- current focus;
- links to canonical GitHub docs/PR;
- per-screen/product status;
- design artifacts;
- device/production evidence.

Do not duplicate the entire master audit into multiple Notion databases. Duplication creates drift.

After a verified checkpoint:

1. update GitHub documentation if the contract/state changed;
2. update Notion status/link/evidence;
3. record the exact commit/PR;
4. never mark Android PASS without physical evidence.

## 11. Required agent completion report

```text
OUTCOME
What changed for the user or documentation.

VERIFIED CONTEXT
Branch, HEAD before, PR.

CHANGED FILES
Exact paths.

BEHAVIOR
Changed, added and explicitly preserved behavior.

CHECKS
Commands and results.

RUNTIME
What was tested and what remains deferred.

DATA/PRIVACY
Tables, RLS, permissions, location or identity impact.

LIMITATIONS
Known gaps and accepted deferrals.

ROLLBACK
Exact revert path.

COMMIT
SHA and PR head after push.

NEXT CHECKPOINT
One scoped recommendation only.
```

## 12. Stop conditions

The agent must stop and request approval when:

- current branch/head differs from the task snapshot;
- canonical sources conflict in a way that changes behavior;
- a production migration/deployment is required;
- a secret/token scope change is required;
- a new dependency is proposed;
- a Frozen/V2 feature appears necessary for MVP;
- user data would be deleted or transformed;
- a working privacy/access rule would be broadened;
- a broad redesign/refactor exceeds the assigned checkpoint;
- an external account or billing resource would be mutated.

Stopping is correct behavior; silently improvising is not.
