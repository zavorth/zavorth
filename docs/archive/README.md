# Docs archive

Historical notes kept out of the main docs tree so public documentation stays launch-ready.
These files are **not** current user documentation. Prefer live product docs under `docs/product/`, `docs/protocol/`, and the root of `docs/`.

| File | Original location | Why archived |
| --- | --- | --- |
| [audit_report.md](./audit_report.md) | `docs/archive/` (earlier) | Security audit certification write-up for specific modules (policy engine, TimeMachine, vector store, Electron bridge). Milestone phase labels stripped. |
| [CLI-VISUAL-OVERHAUL-PLAN.md](./CLI-VISUAL-OVERHAUL-PLAN.md) | `docs/CLI-VISUAL-OVERHAUL-PLAN.md` | Internal CLI visual overhaul plan (palette/logo/theme file checklist). Not user-facing product docs. |
| [product/AUDIT-code-cli.md](./product/AUDIT-code-cli.md) | `docs/product/AUDIT-code-cli.md` | Program audit for Code CLI monorepo merge (Option C). Historical tracker, not product help. |
| [product/code-cli-integration.md](./product/code-cli-integration.md) | `docs/product/code-cli-integration.md` | Phase A–G merge plan for Code TUI replacement. Historical program notes. |
| [root/AUDIT_STATUS.md](./root/AUDIT_STATUS.md) | repo root `AUDIT_STATUS.md` | Point-in-time audit plan status scoreboard. |
| [root/audit_report.md](./root/audit_report.md) | repo root `audit_report.md` | Root copy of module security audit / QA certification notes (phase-labeled). |
| `root/AUDIT_FIX_LOG.md` (local only) | repo root `AUDIT_FIX_LOG.md` | Session audit fix log. Root path is gitignored; local archive copy may exist under `docs/archive/root/` but is not committed. |
| `root/dashboard-final-delivery-*.md` (local only) | repo root | Delivery brief noise; gitignored by pattern `dashboard-final-delivery*`. |

## Conventions

- Each archived file starts with:  
  `> Archived from public docs tree on 2026-07-11. Historical program notes — not current user documentation.`
- Do **not** delete archive content permanently; move further only within `docs/archive/`.
- User-facing CLI packaging stays at [`docs/product/code-cli-packaging.md`](../product/code-cli-packaging.md).
- Old public paths were removed after archival; full text lives only under this archive tree.
