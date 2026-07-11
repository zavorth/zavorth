# Honesty readiness (catalog ≠ live)

**Rule:** no surface shows **Ready** / **Live** without proof. Catalog presence is not live.

## Proof requirement

- **Live** requires an explicit boolean: `liveReady === true` (or an equivalent connection proof such as `connected === true` for providers).
- Status strings alone (`ready`, `available`, `ok`, `healthy`, `active`, `live`, `connected`, `trusted`) **never** grant Live.
- Configured / catalog-only → **Available** / **Catalog only** / **Needs setup** (muted or warning), never Live.

## Surfaces audited (P11 — 2026-07-11)

| Surface | Location | Status |
| --- | --- | --- |
| Desktop readiness classifier | `apps/zavorth-desktop/src/desktop-state/readiness.ts` | **Fixed** — status-only never live; `available`/`ready`/`ok`/`healthy`/`active` removed from auto-live set |
| Provider helper | `readinessFromProvider` | **Fixed** — only `connected === true` or `liveReady`; bare `ready` is catalog |
| Tool helper | `readinessFromTool` | **Fixed** — status `ready`/`trusted` is available/muted unless `liveReady` |
| Shared monorepo helper | `src/services/honesty/ReadinessHonesty.ts` | **Added** — same rules; keep in sync with desktop |
| Control Proof OS | `src/services/control/ControlProofOsModel.ts` (`classifyControlReadiness`) | **Already honest** — live only via `liveReady`; covered by `tests/control/ProofOsModel.test.ts` |
| Command Center providers label | `apps/zavorth-desktop/src/command-center/commandCenter.ts` | **Fixed** — `Live` / `Catalog only` / `Needs setup` (never bare Ready from count) |
| Command Center `providerLiveCount` wiring | `apps/zavorth-desktop/src/shell/DesktopShell.tsx` | **Fixed** — from `runtimeCapabilities.providers.connected` |
| Skills panel / view | `SkillsPanel.tsx`, `SkillsView.tsx` | **Fixed** — badges via `readinessFromTool`; Live tab requires live state |
| Cockpit dashboard | `apps/zavorth-desktop/src/components/CockpitDashboard.tsx` | **Reviewed** — no longer claims “Pronto/Ready”; operational signal uses “Runtime online” + connection present, not bare Live |

## Labels to prefer

| Condition | Label |
| --- | --- |
| `liveReady === true` (or proven connection) | Live |
| Count/catalog only | Catalog only / Available |
| Missing config | Needs setup |
| Policy / hard stop | Blocked |

## Tests

- Desktop: `apps/zavorth-desktop/tests/qualityBar.test.ts`, `trustShip.test.ts`, `commandCenterHonesty.test.ts`, `constellationLayout.test.ts`
- Monorepo: `tests/services/honesty/ReadinessHonesty.test.ts`
- Control: `tests/control/ProofOsModel.test.ts`

## Remaining risks

- Settings modules may still show operational counts (e.g. “N active”) — chrome, not Live certification of provider health checks.
- WorkspaceRuntimeReadinessCard uses API workspace flags (`ready` boolean for provider/model/autonomy/policy) — separate from catalog Live badges.
- Desktop UI still hard-codes many English strings in components; monorepo YAML (`proof-os.honesty.*`) is the product-namespace source of truth for CLI/control.
