# NOXA Project Documentation

This directory is the repository-owned source of truth for product, design, architecture, execution and AI-agent context.

## Mandatory execution reading order

1. `MVP_COMPLETION_MASTER.md` — complete MVP audit, scope, route inventory, quality gates and ordered completion program.
2. `MVP_SCREEN_ACTION_REGISTER.md` — target contract for every known MVP screen, control, action and state.
3. `AI_EXECUTION_PLAYBOOK.md` — shared operating protocol and prompts for ChatGPT, Claude Design and Claude Code.
4. `CURRENT_STATE.md` — verified status, active integration work and immediate next checkpoint.
5. `PRODUCT.md` — product identity, value and scope.
6. `ARCHITECTURE.md` — technical stack and architectural rules.
7. `UI_RULES.md` — mandatory UX/UI principles.
8. `ROADMAP.md` — execution stages and Definition of Done.
9. `AI_CONTEXT.md` — role boundaries, evidence hierarchy and completion-report contract.

## Domain and design specifications

Read the relevant specification before touching a domain:

- `GROUP_DRIVE.md` — Group Drive architecture, privacy model, state machines and phased delivery plan.
- `ai-design-library/` — product constitution, Home/Map MVP, screen plan, MVP/V2 boundary and component-library policy.
- `design/NOXA_APPLE_DESIGN_STANDARD.md` — interaction and visual quality standard.
- `design/NOXA_MAP_UX_SIMPLIFICATION_PLAN.md` — Home/Map simplification intent.
- `security/` — Live Drive security audit and production migration runbooks.

## Source-of-truth hierarchy

1. Runtime evidence on a physical device or native development build.
2. Code merged into `main`.
3. GitHub CI and pull-request evidence.
4. Production Supabase evidence.
5. Repository documentation in `docs/`.
6. Notion and design planning artifacts.

For intentionally accumulated work in an active integration branch, its exact branch/HEAD/PR is the working implementation snapshot, but it is not `Done` and must not be represented as merged or runtime-verified.

A mockup, branch, commit, pull request, passing lint or documentation claim alone does not prove that a feature works.

## Documentation synchronization rule

- GitHub records technical truth and executable contracts.
- Notion records product/design planning and high-level progress.
- When they disagree, use the evidence hierarchy above and update the stale lower-level source.
- Every completed checkpoint must update `CURRENT_STATE.md` and any affected screen/component status.
