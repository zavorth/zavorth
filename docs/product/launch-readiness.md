# Launch readiness (honest)

This document is a **readiness map**, not a public launch announcement.

## Value-ready (local) vs Launch-ready (ops)

| Bar | What it means |
|-----|----------------|
| **Value-ready (local)** | Waves V0–V11: useful intelligence, daily path, honest wow, audiences, memory integrity, day-1 product UX, selection honesty, live multi-step harness, habit closeout. Hermetic gates green. Safe to dogfood locally. **Not** a public launch claim. |
| **Launch-ready (ops)** | Calendar R2 + signed installers + live cells recorded + operator checklist green. |

See also [ROADMAP.md](../ROADMAP.md), [agent-tool-routing.md](./agent-tool-routing.md), [certified-live-matrix.md](./certified-live-matrix.md).

## Product-local ready (when green)

| Area | Gate / evidence | Status intent |
|------|-----------------|---------------|
| Value suite | `npm run value:test-all` | Required |
| Security packaging | `npm run security:ci` | Required before public claim |
| Installer readiness | `installer-readiness:check`, `installer-release:check` | npm-package mode |
| Code packaging | `code:packaging:smoke` | Required |
| Dogfood catalog | `dogfood:missions:check` (110) | Required |
| Wave 2 docs | `wave2:docs:check` | Required |
| Wave 3 honesty | `wave3:launch:check` | Required |
| Retention soft | `retention-log --check --soft` | R1+R3; R2 may still pending |
| Signing packaging | `npm run ops:signing:check` | Structural scripts OK |
| Live cells file | `npm run launch:live-cells -- --live` | Credentialed evidence |
| Launch checklist | `npm run launch:ready:check` | Honest aggregate |

## Residual / ops-only (not claimed done from hermetic alone)

| Residual | How to close | Honest if open |
|----------|--------------|----------------|
| **Calendar R2** (`day1Return`) | Later UTC day after R1: `node scripts/retention-log.mjs --day1-return` | Product continuity UX can be ready while R2 open |
| **Signed installers / notarization / store** | Ops certs → `dist-release` / `release-assets`; then `ops:signing:check -- --require-signed` | Packaging scripts OK ≠ store launch |
| **Channel live certs** | Real tokens per channel | Adapter present ≠ live |
| **Public announce** | Only after `launch:ready:check` exit 0 **and** human review | Never automatic |

## R2 honesty (product UX vs calendar residual)

| Claim | Status |
|-------|--------|
| Day-1 **product** continuity (banner, last session, next action, eligibility model) | Implemented — V6/V11 |
| Launch **calendar** R2 in retention log | Ops residual until real later-calendar-day return |

Do **not** close launch readiness by equating hermetic continuity checks with calendar R2. Soft retention (`--check --soft`) can be green with R2 still pending. How to pass R2 without soft-lie: [retention-gate.md](./retention-gate.md).

## Operator checklist before any public claim

```bash
npm run residual:waves:check
npm run dogfood:hermetic          # or day0 + matrix expand
npm run security:ci
npm run launch:live-cells -- --live
npm run ops:signing:check
npm run launch:ready:check -- --require-full   # exit 0 only when launch bar is green
node scripts/retention-log.mjs --check         # full R1+R2+R3
```

Manual confirmations:

1. Calendar R2 only after **real** next UTC day return (not ContinuityBanner alone)
2. Signed artifacts + notarization before any store language
3. Live cells documented in `certified-live-matrix.md` / `.zavorth/launch-live-cells.json`
4. Explicit human decision to announce (script never posts)

## Anti-claims

- Do **not** say “launch complete / shipped” based only on local hermetic gates.
- Do **not** invent live cert or day-1 calendar retention.
- Do **not** treat ContinuityBanner / `value:continuity` pass as calendar R2 complete.
- Do **not** treat `ops:signing:check` (structural) as signed store release.
- Do **not** treat `launch:ready:check` exit **2** as launch-ready (exit 2 = product OK, ops residual).

## V12 wave status stance

Wave **V12** delivers the residual **program** (gates, matrix, signing report, live-cell recorder, announce checklist).  
**Launch-ready (ops)** is a separate bar that stays red until calendar R2 + signed assets + full check exit 0.
