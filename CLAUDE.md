@AGENTS.md

# NOXA Claude Code entry point

Before any significant work, read in this order:

1. `docs/MVP_COMPLETION_MASTER.md`
2. `docs/MVP_SCREEN_ACTION_REGISTER.md`
3. `docs/AI_EXECUTION_PLAYBOOK.md`
4. `docs/AI_CONTEXT.md`
5. `docs/CURRENT_STATE.md`
6. `docs/PRODUCT.md`
7. `docs/ARCHITECTURE.md`
8. `docs/UI_RULES.md`
9. `docs/ROADMAP.md`
10. the relevant domain/design specification, including `docs/GROUP_DRIVE.md` when applicable

Then inspect the actual current branch, exact HEAD, working tree and open pull request before proposing changes.

Treat physical/native runtime evidence and code merged in `main` as the highest implementation evidence. For work intentionally accumulated in the active integration branch, inspect that branch and its draft PR rather than assuming `main` already contains the change.

Keep work scoped, reversible and evidence-based. Never perform production migrations, destructive operations, secret/OAuth changes, Mapbox account mutations, store submission, release or merge without explicit approval.
