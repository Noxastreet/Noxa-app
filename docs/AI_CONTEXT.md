# NOXA — AI Agent Context

This document is the common operating contract for Claude Code, Claude Design, ChatGPT, Codex and other agents working on NOXA.

## Mandatory bootstrap

Before proposing or changing anything:

1. Read `AGENTS.md`.
2. Read `docs/MVP_COMPLETION_MASTER.md`.
3. Read `docs/MVP_SCREEN_ACTION_REGISTER.md`.
4. Read `docs/AI_EXECUTION_PLAYBOOK.md`.
5. Read `docs/CURRENT_STATE.md`.
6. Read the product, architecture, UI and domain documents relevant to the task.
7. Inspect the actual current branch, exact HEAD, working tree and open pull request.
8. Inspect production Supabase only when the task depends on production behavior.
9. Report conflicts before acting.
10. Define one measurable outcome, validation plan and rollback path.

Do not infer `Done` from plans, generated design, code presence, static checks or an open pull request.

## Responsibilities

### Claude Design

- translate approved product behavior into visual and interaction specifications;
- design complete state coverage, not isolated hero screenshots;
- use the canonical information architecture, tokens and component family;
- document navigation, hierarchy, motion, accessibility and responsive behavior;
- report conflicts instead of inventing product decisions;
- never authorize code, database, production or account mutations.

### Claude Code

- inspect and modify the repository;
- implement only the approved scoped checkpoint;
- preserve working behavior outside scope;
- run available static checks;
- report exact changed files, assumptions, limitations and evidence;
- avoid autonomous broad redesigns, speculative abstractions and unrelated refactors.

### ChatGPT

- maintain product intent, architecture, UX behavior and cross-feature consistency;
- create scoped briefs and acceptance criteria;
- review design packages, diffs, documentation and runtime evidence;
- resolve ambiguity using the source-of-truth hierarchy;
- keep the MVP boundary and execution sequence controlled.

### Product owner

- chooses priorities and approves product behavior;
- authorizes production migrations, secrets, external account mutations, releases and destructive operations;
- purchases/configures distribution accounts and devices when the static release candidate is ready;
- performs or coordinates physical-device validation;
- decides whether a documented limitation is acceptable.

## Source-of-truth hierarchy

1. physical-device/native runtime evidence;
2. code merged in `main`;
3. GitHub CI and pull-request evidence;
4. production Supabase evidence;
5. repository documentation;
6. Notion and generated design artifacts;
7. conversational memory.

For work intentionally accumulated in an active integration branch, inspect its exact branch/HEAD/PR. It may be the current working implementation snapshot, but it remains unmerged and runtime-unverified until evidence says otherwise.

## Scope discipline

- One checkpoint has one measurable user-visible or documentation outcome.
- Do not mix visual polish, architecture refactoring, backend mutation and new behavior unless technically inseparable.
- Preserve existing routes, auth, Mapbox, personal Live Drive and Supabase behavior unless the brief explicitly changes them.
- Prefer shared primitives where repetition is proven.
- Do not add a dependency without an approved reason, maintenance assessment and rollback.
- Frozen/V2 modules remain frozen unless product explicitly promotes them.
- Never fabricate users, activity, density, urgency or successful runtime evidence.

## UX/UI discipline

- Follow `docs/UI_RULES.md`, `AGENTS.md` and the master screen/action contracts.
- One primary action per interaction level.
- Every screen requires loading, empty, error and relevant offline/permission states.
- Every control requires deterministic behavior, disabled/loading treatment and accessibility semantics.
- Respect safe areas, keyboard, long text, text scaling, small Android layouts and Reduced Motion.
- Privacy and driving safety override decorative ambition.
- “Make it premium” must be translated into measurable hierarchy, spacing, geometry, typography, motion and removal.

## Group Drive

Group Drive is a new self-contained domain governed by `docs/GROUP_DRIVE.md`.

It does not reuse or extend:

- `driver_locations`;
- the personal four-hour Live Drive in `src/lib/liveDrive.ts`;
- `events`;
- `crew_convoys`;
- `event-route`;
- the general Home/Map runtime.

The approved design is currently a reviewed v1.1 package with a final v1.1.1 micro-correction still required before implementation. Do not implement Group Drive UI, schema, RLS, realtime, routing or map integration outside its documented phases and approved design contract.

## Safety and production controls

Never perform without explicit approval:

- production database migration or destructive SQL;
- production data cleanup;
- secret/token/OAuth-provider changes;
- Mapbox token, style, dataset, tileset, billing or account mutation;
- store submission or production release;
- force-push to `main`;
- merge of the active draft PR;
- deletion of rollback branches or user data.

A public client Mapbox token may be used only through the existing approved application configuration. Never print or expose token values.

## Required completion report

Every implementation checkpoint must report:

- verified branch, starting HEAD and resulting HEAD;
- task outcome;
- changed files;
- user-visible behavior changed;
- checks executed and results;
- runtime validation performed or deferred;
- known limitations;
- rollback instructions;
- documentation/Notion updates;
- whether the PR remains draft and whether merge is authorized.

Use only verified facts.
