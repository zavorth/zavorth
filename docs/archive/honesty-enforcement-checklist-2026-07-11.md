# P11 — Honesty enforcement checklist (2026-07-11)

Goal: no surface shows Ready/Live without proof. Catalog ≠ live.

## Checklist

- [x] **Desktop `classifyReadiness`** — status alone never grants live; remove `available`/`ready`/`ok`/`healthy`/`active` from auto-live set
- [x] **`readinessFromProvider`** — only `connected === true` or explicit `liveReady`; bare `ready` → catalog/available
- [x] **`readinessFromTool`** — status includes ready/trust → available/muted unless `liveReady`
- [x] **Shared `classifyHonestReadiness`** — `src/services/honesty/ReadinessHonesty.ts` (+ monorepo tests)
- [x] **Control `classifyControlReadiness`** — verified already honest (tests pass)
- [x] **Command Center** — provider statusLabel: Live / Catalog only / Needs setup (never bare Ready)
- [x] **CockpitDashboard** — reviewed; softened Ready language; operational ≠ live proof
- [x] **qualityBar / trustShip** — regression for status-only not live
- [x] **DESIGN.md / QUALITY.md** — Ready/Live requires live proof boolean
- [x] **Product doc** — `docs/product/honesty-readiness.md`
- [x] **providerLiveCount wiring** — DesktopShell from `runtimeCapabilities.providers.connected`
- [x] **SkillsPanel / SkillsView** — route through `readinessFromTool`; Live tab not bare Ready

## Residual

- Settings module chrome still uses operational counts (e.g. “N active”), not Live certification.
- Statusbar uses process-local “Runtime online” (not provider Live).
- Constellation requires `liveReady` for Live; agent process motion may still show live while running.
