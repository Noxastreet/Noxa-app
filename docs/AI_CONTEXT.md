# NOXA — AI Agent Context

This document is the common operating contract for Claude Code, ChatGPT, Codex and other engineering agents.

## Before changing code

1. Read `AGENTS.md` and this file.
2. Read `docs/CURRENT_STATE.md`.
3. Inspect the latest `main` and recent relevant pull requests.
4. Read the product, architecture and UI rules relevant to the task.
5. Determine the verified current state; do not infer Done from plans or mockups.
6. Define a minimal scope, validation plan and rollback path.

## Responsibilities

### Product owner

- makes final product decisions;
- chooses priorities and approves product behavior;
- authorizes production migrations, secrets, releases and destructive operations;
- performs or coordinates physical-device validation and accepts runtime evidence;
- decides when a limitation is acceptable.

### ChatGPT

- maintains product and UX coherence;
- defines architecture;
- owns privacy and safety contracts;
- defines acceptance criteria;
- produces implementation briefs;
- reviews design packages, diffs, UI evidence and runtime results;
- maintains cross-feature consistency and documentation.

### Claude Design

- produces the approved visual architecture;
- specifies screen composition and information hierarchy;
- specifies interaction flows;
- specifies component behavior, including all required states;
- specifies motion and accessibility design;
- runs design correction passes against approved contracts.

Claude Design must **not** autonomously:

- change product scope;
- invent new features;
- change backend architecture;
- change privacy architecture;
- change the database, Mapbox or Supabase;
- implement application code;
- override a contract approved by the Product Owner or ChatGPT.

A design package expresses approved intent. It is never evidence that a screen works.

### Claude Code

- inspects the real repository before acting;
- implements approved scoped tasks;
- runs available static checks;
- reports changed files, assumptions, limitations and exact validation evidence;
- avoids broad autonomous redesigns or unrelated refactors.

## Source-of-truth hierarchy

1. physical-device/native runtime evidence;
2. code merged in `main`;
3. CI and pull-request evidence;
4. production Supabase evidence;
5. repository docs;
6. Notion and design planning.

Conflicts are resolved in favor of the higher-ranked evidence. Update lower-ranked documentation after verification.

## Scope discipline

- One task should have one measurable outcome.
- Do not combine visual polishing, architecture refactoring and new feature behavior without necessity.
- Preserve working product behavior unless the task explicitly changes it.
- Prefer reusable primitives when repetition is proven, not speculative abstraction.
- Do not introduce dependencies without documenting the reason and maintenance cost.

## UX/UI discipline

- Preserve the established information architecture unless evidence shows it is wrong.
- Fix overlap, spacing, safe-area, keyboard, transparency and hierarchy issues systematically.
- Use the rules in `docs/UI_RULES.md` and the existing design tokens/components.
- Do not use “make it premium” as an implementation specification; translate it into measurable layout, state and motion requirements.
- `docs/VISUAL_ARCHITECTURE_V2.md` (status: approved for implementation) is the canonical visual-layer contract for Onboarding, Home/Map, Event Detail, Garage/Vehicle and Active Drive. Read it and `docs/audit/VISUAL_V2_RECONCILIATION.md` before touching any of those five screens. It operates inside `docs/UI_RULES.md` and the product laws — it does not override them.

## Safety and production controls

Never perform the following without explicit approval:

- production database migrations;
- destructive SQL or data cleanup;
- secret or OAuth-provider changes;
- store submission or production release;
- force-push to `main`;
- deletion of rollback branches or user data.

## Required completion report

Every implementation response should include:

- task outcome;
- changed files;
- checks executed and their results;
- runtime validation performed or still required;
- known limitations;
- rollback instructions;
- recommended documentation updates.
