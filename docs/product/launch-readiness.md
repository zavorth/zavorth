# Launch readiness (honest)

This document is a **readiness map**, not a public launch announcement.

## Value-ready (local) vs Launch-ready (ops)

| Bar | What it means |
|-----|----------------|
| **Value-ready (local)** | Waves V0–V7 foundation: useful intelligence, daily path, honest wow, audiences wired, memory integrity, day-1 hooks, narrative rebalanced. Hermetic gates green; honesty intact. Safe to dogfood locally. **Not** a public launch claim. |
| **Launch-ready (ops)** | Residual below: signing, live credentialed cells, calendar R2, public announce assets. |

See also [ROADMAP.md](../ROADMAP.md) and [WAVES-VALUE-INTELLIGENCE-HABIT.md](./WAVES-VALUE-INTELLIGENCE-HABIT.md).

## Product-local ready (when green)

| Area | Gate / evidence | Status intent |
|------|-----------------|---------------|
| Security packaging | `npm run security:ci` | Required |
| Installer readiness | `installer-readiness:check`, `installer-release:check` | npm-package mode |
| Code packaging | `code:packaging:smoke` | Required |
| Dogfood catalog | `dogfood:missions:check` (110) | Required |
| Wave 2 docs | `wave2:docs:check` | Required |
| Wave 3 honesty | `wave3:launch:check` | Required |
| Retention soft | `retention-log --check --soft` | R1+R3; R2 pending |
| Host + gateway | doctor + gateway port when ops starts them | Local ops |

## Residual / ops-only (not claimed done here)

- **Code signing / store assets** (desktop installers, notarization, store listings)
- **CI release asset upload** to public channels
- **Retention calendar R2** (`day1Return`) — real next UTC day return only (see honesty note below)
- **Live provider/channel certification** without credentials
- **Public launch announce** — intentionally out of scope for this gate

## R2 honesty (product UX vs calendar residual)

| Claim | Status |
|-------|--------|
| Day-1 **product** continuity (banner, last session, next action, eligibility model) | Implemented — `DailyReturnContinuityService`, Desktop ContinuityBanner/storage; `npm run value:continuity -- --check` |
| Launch **calendar** R2 in retention log | Ops residual until a real later-calendar-day return is recorded |

Do **not** close launch readiness by equating hermetic continuity checks with calendar R2. Soft retention (`--check --soft`) can be green with R2 still pending. How to pass R2 without soft-lie: [retention-gate.md](./retention-gate.md).

## Operator checklist before any public claim

1. `npm run residual:waves:check`
2. `npm run dogfood:hermetic` (or day0 + matrix expand)
3. `npm run security:ci`
4. Confirm calendar R2 only after real next-day return (product continuity UX alone is not enough)
5. Confirm signed artifacts exist before store language

## Anti-claims

- Do **not** say “launch complete / shipped” based only on local hermetic gates.
- Do **not** invent live cert or day-1 calendar retention.
- Do **not** treat ContinuityBanner / `value:continuity` pass as calendar R2 complete.
