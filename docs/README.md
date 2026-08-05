# NOXA Project Documentation

This directory is the repository-owned source of truth for product, design, architecture, execution and AI-agent context.

## Reading order

1. `CURRENT_STATE.md` — verified status and immediate next action.
2. `PRODUCT.md` — product identity, value and scope.
3. `ARCHITECTURE.md` — technical stack and architectural rules.
4. `UI_RULES.md` — mandatory UX/UI principles.
5. `ROADMAP.md` — ordered execution stages and Definition of Done.
6. `AI_CONTEXT.md` — operating contract for Claude Code, ChatGPT, Codex and other agents.

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
