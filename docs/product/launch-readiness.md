# Launch readiness (honest)

This document is a **readiness map**, not a public launch announcement.

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
- **Retention R2** (`day1Return`) — calendar day-1 return only
- **Live provider/channel certification** without credentials
- **Public launch announce** — intentionally out of scope for this gate

## Operator checklist before any public claim

1. `npm run residual:waves:check`
2. `npm run dogfood:hermetic` (or day0 + matrix expand)
3. `npm run security:ci`
4. Confirm R2 only after real next-day return
5. Confirm signed artifacts exist before store language

## Anti-claims

- Do **not** say “launch complete / shipped” based only on local hermetic gates.
- Do **not** invent live cert or day-1 retention.
