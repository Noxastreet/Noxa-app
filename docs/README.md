# NOXA Project Documentation

This directory is the repository-owned source of truth for product, design, architecture, execution and AI-agent context.

## Reading order

1. `CURRENT_STATE.md` — verified status and immediate next action.
2. `PRODUCT.md` — product identity, value and scope.
3. `ARCHITECTURE.md` — technical stack and architectural rules.
4. `UI_RULES.md` — mandatory UX/UI principles.
5. `VISUAL_ARCHITECTURE_V2.md` — approved visual-layer contract for Onboarding, Home/Map, Event Detail, Garage/Vehicle and Active Drive; read alongside `UI_RULES.md`, not instead of it.
6. `ROADMAP.md` — ordered execution stages and Definition of Done.
7. `AI_CONTEXT.md` — operating contract for Claude Code, ChatGPT, Codex and other agents.

Reconciliation evidence for Visual Architecture V2 against the current codebase lives in `audit/VISUAL_V2_RECONCILIATION.md`. `GROUP_DRIVE.md` is the canonical Group Drive architecture (documentation only, no application code yet); `audit/PR135_CONTRACT_RECONCILIATION.md` records which decisions from the former `feat/home-map-floating-card-foundation` integration branch (PR #135) were preserved, superseded, or left as open product decisions.

## Source-of-truth hierarchy

1. Runtime evidence on a physical device or native development build.
2. Code merged into `main`.
3. GitHub CI and pull-request evidence.
4. Production Supabase evidence.
5. Repository documentation in `docs/`.
6. Notion and design planning artifacts.

A mockup, branch, commit or pull request alone does not prove that a feature works.

## Migration note

The initial content was consolidated from the NOXA Notion Control Center, Master Execution Plan and Claude Code project context on 5 August 2026. Database-level exports from Roadmap, Design Bible, Screen Bible, Component Library and Feature Pipeline should be normalized into dedicated files instead of copied as raw Notion tables.
