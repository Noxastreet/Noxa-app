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

### Claude Code

- inspect and modify the repository;
- implement scoped tasks;
- run available static checks;
- report changed files, assumptions, limitations and validation evidence;
- avoid broad autonomous redesigns or unrelated refactors.

### ChatGPT

- clarify product intent and UX behavior;
- define architecture and acceptance criteria;
- produce implementation briefs;
- review diffs, UI evidence and runtime results;
- maintain cross-feature consistency and documentation.

### Product owner

- chooses priorities and approves product behavior;
- performs or coordinates physical-device validation;
- authorizes production migrations, secrets, releases and destructive operations;
- decides when a limitation is acceptable.

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
