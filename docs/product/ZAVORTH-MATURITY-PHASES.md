# Zavorth Maturity Phases

> Working plan for production reliability improvements.
> Created: 2026-07-12
> Status: **Phase 8 DONE** — maturity plan complete (phases 1–8); post-plan readiness gate available

Principles:

1. **Do not reinvent** what already exists (failover pieces, cost route, approvals).
2. **User-owned stack only** — never invent product-default vendors/models.
3. **Hot path first** — chat / agent / CLI must feel the change.
4. **Wire before rewrite** — prefer connecting existing modules over big-bang refactors.

---

## Phase overview

| Phase | Name | Goal | Status |
|-------|------|------|--------|
| **1** | Hot-path provider fallback + circuit breaker | Reliable answers when primary provider fails, using **user** fallbacks only | **DONE** |
| **2** | Cost route on user stack | Background/cheap routes only among models the user configured; savings visible | **DONE** |
| **3** | Session persistence SQLite | Replace JSON-file “SQLite-like” session store with real better-sqlite3 + migrations | **DONE** |
| **4** | SwarmV2 decomposition | Split ~2k-line monolith (planner / executor / budget / persistence) without behavior change | **DONE** |
| **5** | Cron NL expansion | Expand PT/EN natural schedule phrases (build on existing `parseSchedule`) | **DONE** |
| **6** | Memory backend contract v2 | Richer `IMemoryBackend` (metadata, filters, soft delete) with backward-compatible adapters | **DONE** |
| **7** | Desktop auto-update | electron-updater + signing when shipping installers | **DONE** |
| **8** | Dashboard React (incremental) | Optional product investment; no big-bang | **DONE** |

---

## Phase 1 — Hot-path fallback + circuit breaker

### Problem

- Pieces exist: `ModelFallbackChain`, `CircuitBreaker`, user `fallbackProviderIds`, agent `allowFallback: true`.
- Gaps:
  - `LlmRuntimeService` only falls back when `allowFallback === true` (opt-in for non-agent callers).
  - Provider chain often collapses to a single provider if selection fallbacks are empty or not parsed (`provider:model`).
  - Gateway `CircuitBreaker` is **not** consulted on the agent LLM hot path.
  - Open/failed providers can be retried immediately without cooldown.

### Done when

- [x] Doc written (this file)
- [x] Default: fallback **on** unless explicitly `allowFallback: false` or `allowProviderFallback: false`
  - Runtime: `LlmRuntimeService` uses `options?.allowFallback !== false`
  - Agent: `AgentRunLlmRequestBuilder` maps `allowProviderFallback === false` → `allowFallback: false`
- [x] Provider chain = primary + **user** secondary/fallbacks only (no product catalog)
  - `UserStackProviderChain` + empty `DEFAULT_FALLBACK_ORDER`
- [x] Parse `provider` and `provider:model` entries from user fallback list
- [x] Per-provider circuit breaker skips OPEN circuits; records failures/successes
  - `ProviderHotPathCircuitBreaker` (in-process; no gateway SQLite coupling)
- [x] Receipt/metadata shows attempts + whether fallback was used
  - `route.attempts` / `fallbackUsed` + metadata `userStackFallback` / `circuitBreakers`
- [x] Unit tests for chain resolution + breaker skip
  - `tests/services/llm/UserStackProviderChain.test.ts`
  - `tests/services/llm/ProviderHotPathCircuitBreaker.test.ts`
- [x] No invented OpenAI/Anthropic defaults

### Out of scope for Phase 1

- Cost routing polish (Phase 2)
- Session SQLite (Phase 3)
- Swarm split (Phase 4)

### Primary files

- `src/services/llm/LlmRuntimeService.ts`
- `src/services/llm/UserStackProviderChain.ts` (new)
- `src/services/llm/ProviderHotPathCircuitBreaker.ts` (new thin adapter)
- `src/runtime/agent/AgentRunLlmRequestBuilder.ts` (confirm defaults)
- `tests/services/llm/*` (new)

---

## Phase 2 — Cost route on user stack

### Problem

- `AgentRunCostEffortRouting` classified background work but only switched models via `ZAVORTH_BACKGROUND_MODEL` env.
- Did not pick the cheapest hop from the **user** secondary/fallback stack.

### Done when

- [x] Cheap hop resolver uses user stack only (`UserStackCostRoute`)
- [x] Background route suggests secondary / fallbacks (heuristic cheapness), never invents vendors
- [x] Env background model only if stack empty or model/provider is on-stack
- [x] Session usage notes include `cost-route:background|standard|premium`
- [x] Cost savings dashboard counts background route calls + updated hint
- [x] Unit tests

### Primary files

- `src/services/llm/UserStackCostRoute.ts`
- `src/runtime/agent/AgentRunCostEffortRouting.ts`
- `src/runtime/agent/AgentRunLlmRuntimeExecutor.ts`
- `src/services/CostSavingsDashboardService.ts`
- `tests/services/llm/UserStackCostRoute.test.ts`
- `tests/runtime/agent/AgentRunCostEffortRouting.test.ts`

---


## Phase 3 — Session SQLite

### Problem

- `SessionPersistenceStore` claimed SQLite but used JSON files under `sessions/` + `memory/`.

### Done when

- [x] Real better-sqlite3 file (`sessions.sqlite` under dbPath dir, or explicit `.db` path)
- [x] WAL + foreign-friendly pragmas
- [x] schema_version table + version constant
- [x] One-time migration from legacy JSON layout
- [x] Public API unchanged (async save/load/list/delete/memory/stats) + `close()` / `searchMemory()` / `getDbFilePath()`
- [x] FTS5 content search (with LIKE fallback)
- [x] Tests green (store + PersistentMemoryBridge)

### Primary files

- `src/runtime/sessions/SessionPersistenceStore.ts`
- `src/runtime/sessions/PersistentMemoryBridge.ts` (close store on destroy)
- `tests/runtime/sessions/SessionPersistenceStore.test.ts`

---

## Phase 4 — SwarmV2 decomposition

### Problem

- `src/agents/SwarmV2Service.ts` was a ~2k-line monolith mixing types, budget, planner, persistence, metrics, and orchestration.

### Done when

- [x] Extract modules under `src/agents/swarm-v2/`:
  - `SwarmV2Types.ts` — exported types + `SWARM_V2_OFFICIAL_CONTRACT_VERSION`
  - `SwarmV2Budget.ts` — token budget snapshot/risk/estimate helpers (pure)
  - `SwarmV2Planner.ts` — role selection (sync heuristic + async LLM), library defaults, tool/role helpers
  - `SwarmV2Persistence.ts` — role library file read/write/normalize/path
  - `SwarmV2Metrics.ts` — official metrics, replay insights, benchmark, tool execution snapshot
- [x] `SwarmV2Service.ts` remains facade at `src/agents/SwarmV2Service.ts` (orchestration + re-exports)
- [x] Public API unchanged (`SwarmV2Service`, `ExperimentalSwarmV2Service`, type re-exports)
- [x] Behavior-preserving: unit tests green
  - `tests/services/SwarmV2Service.test.ts`
  - `tests/services/V2CompatibilityAliases.test.ts`
  - `tests/services/ExperimentalSwarmV2Service.test.ts`

### Primary files

- `src/agents/SwarmV2Service.ts` (facade)
- `src/agents/swarm-v2/*` (modules)
- `src/services/SwarmV2Service.ts` (compat re-export)

---

## Phase 5 — Cron NL expansion

### Problem

- Schedule parsing was split across `SchedulerService`, governed registry, and autonomy plane.
- Natural language coverage was thin (mostly canonical `every Xm` / `daily HH:mm`).
- Autonomy plane treated cron/NL as opaque (+1 min stub) without shared PT/EN phrases.

### Done when

- [x] Shared `NaturalScheduleParser` (PT + EN) under `src/services/scheduling/`
- [x] Phrases: intervals, daily, weekly, 5-field cron; accents stripped
- [x] `SchedulerService.parseSchedule` / `calculateNextRun` delegate to shared parser
- [x] Governed scheduled-task registry uses same parser (`weekly` / `cron` kinds)
- [x] `AutonomySchedulePlane` resolves NL intervalMs + next-run via parser
- [x] Unit tests green (`NaturalScheduleParser` + SchedulerService NL cases)

### Primary files

- `src/services/scheduling/NaturalScheduleParser.ts`
- `src/services/SchedulerService.ts`
- `src/services/ZavorthGovernedScheduledTaskRegistryService.ts`
- `src/services/AutonomySchedulePlane.ts`
- `src/contracts/scheduler/ZavorthScheduledTaskContract.ts` (`weekly` | `cron` kinds)
- `tests/services/scheduling/NaturalScheduleParser.test.ts`
- `tests/services/SchedulerService.test.ts`

### Out of scope for Phase 5

- Full cron engine (seconds, TZ DBs, last-day-of-month)
- Memory backend (Phase 6)

---

## Phase 6 — Memory backend contract v2

### Problem

- `IMemoryBackend` was string-only (`addMemory` / `searchMemory` → `string[]`).
- No shared metadata, filters, soft delete, or structured hits across local / Mem0.
- Callers could not feature-detect richer backends safely.

### Done when

- [x] Contract types: `MemoryRecord`, `MemoryMetadata`, `MemoryQueryFilter`, `MemoryHit`, delete modes
- [x] v1 methods kept; optional v2 methods on `IMemoryBackend` (`contractVersion?: 1|2`)
- [x] `asMemoryBackendV2` / `MemoryBackendCompatAdapter` for pure v1 backends
- [x] `LocalMemoryBackend` full v2; `MemoryService` `deleted_at` + `metadata_json` + soft/hard/restore
- [x] `Mem0MemoryBackend` best-effort v2 (metadata forward, local soft-delete index)
- [x] `MemoryRuntimeService` structured add/search/delete/list APIs
- [x] Unit tests green under `tests/services/memory/`

### Primary files

- `src/services/memory/IMemoryBackend.ts`
- `src/services/memory/MemoryBackendCompat.ts`
- `src/services/memory/LocalMemoryBackend.ts`
- `src/services/memory/Mem0MemoryBackend.ts`
- `src/services/memory/MemoryRuntimeService.ts`
- `src/services/MemoryService.ts`
- `tests/services/memory/IMemoryBackend.v2.test.ts`
- `tests/services/memory/MemoryRuntimeService.test.ts`

### Out of scope for Phase 6

- Full vector DB swap / Mem0 multi-tenant admin
- Desktop auto-update (Phase 7)

---

## Phase 7 — Desktop auto-update

### Problem

- Desktop had a **GitHub Releases** check channel that opened the browser (honest, no silent install).
- Packaged installers lacked **electron-updater** in-app download/install.
- electron-builder had no **publish** / signing hints for shipping.

### Done when

- [x] `electron-updater` bridge (`desktop-electron-updater.cjs`) with injectable autoUpdater for tests
- [x] Enabled only when packaged (dev keeps GitHub-manual path)
- [x] `desktop-updates.cjs` prefers electron-updater for check/download/install; falls back to GitHub
- [x] Signing status helper + env docs (`desktop-update-signing.cjs`, `npm run signing:status`)
- [x] electron-builder: GitHub publish, win timestamp/sha256, mac entitlements plist
- [x] Scripts: `package:release`, `package:publish`, `signing:status`
- [x] UI source `electron-updater` + unit tests green
- [x] Production readiness script (no certs required): `production:readiness` / monorepo `desktop:production-readiness`

### Primary files

- `apps/zavorth-desktop/electron/desktop-electron-updater.cjs`
- `apps/zavorth-desktop/electron/desktop-update-signing.cjs`
- `apps/zavorth-desktop/electron/desktop-updates.cjs`
- `apps/zavorth-desktop/electron/main.cjs`
- `apps/zavorth-desktop/package.json`
- `apps/zavorth-desktop/build/entitlements.mac.plist`
- `apps/zavorth-desktop/src/desktop-state/desktopUpdate.ts`
- `apps/zavorth-desktop/scripts/desktop-production-readiness.mjs`
- `apps/zavorth-desktop/PRODUCTION.md`

### Verify without certs / publish

```bash
# apps/zavorth-desktop
npm run signing:status
npm run production:readiness
npm run package:release   # local installers, publish never
# monorepo root
npm run desktop:production-readiness
npm run desktop:test:electron-unit
```

`package:publish` needs `GH_TOKEN` and is for shipping, not local smoke. Unsigned installers are OK locally; shipping needs signing env (below).

### Shipping env (do not commit secrets)

- `GH_TOKEN` / `GITHUB_TOKEN` — publish to GitHub Releases
- `CSC_LINK` / `CSC_KEY_PASSWORD` (or `WIN_CSC_LINK`) — code sign
- `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID` — notarize
- `ZAVORTH_UPDATE_FEED_URL` — optional generic feed
- `ZAVORTH_UPDATE_DISABLE_ELECTRON_UPDATER=true` — force GitHub-manual channel

### Out of scope for Phase 7

- Purchasing/storing real certs in-repo
- Dashboard React rewrite (Phase 8)

---

## Phase 8 — Dashboard React (incremental)

### Problem

- Control dashboard mixed large HTML string templates (`pages.ts`) with a few React surfaces on `/control`.
- Primary dock sectors (Work / Review / Proof) and several “More” tabs still relied on static HTML fragments.
- Risk of a big-bang React rewrite of the whole shell.

### Done when

- [x] Vite shell: React SSR islands for **Work**, **Review**, **Proof** (`DashboardReactIslands` + `mountDashboardReactIslands`)
- [x] Islands keep existing `data-*` hooks for `runtime-bridge` / `dashboard-live-view`
- [x] Next `/control` shell: remaining inactive sectors as React surfaces (channels, sessions, agents, cron, docs + review/proof)
- [x] Dual hooks (`data-dashboard-*` + `data-zavorthControl-*`) on Work/Review for bridge compatibility
- [x] Registry marks React island sector ids
- [x] Contract tests green (`DashboardReactPhase8.test.ts`)
- [x] **No big-bang**: Inbox HTML/React Terminal, other pages HTML, live bridge unchanged

### Primary files

- `apps/zavorth-control-vite-shell/src/react/DashboardReactIslands.tsx`
- `apps/zavorth-control-vite-shell/src/react/mountDashboardReactIslands.ts`
- `apps/zavorth-control-vite-shell/src/pages.ts`
- `apps/zavorth-control-vite-shell/src/dashboard-surface-registry.ts`
- `src/ai-gateway/app/(zavorthControl)/control/ZavorthControlSurfaces.tsx`
- `src/ai-gateway/app/(zavorthControl)/control/LegacyZavorthControlShell.tsx`
- `tests/ai-gateway/zavorthControl/DashboardReactPhase8.test.ts`

### Out of scope for Phase 8

- Full SPA rewrite / drop of `runtime-bridge`
- Replacing Desktop Electron UI
- Pixel-perfect redesign of every sector

---

## Post-plan production gate

In-repo gate for maturity post-plan items. Does **not** require secrets, live network publish, or full monorepo CI.

```bash
npm run maturity:production-readiness          # human summary (exit 0)
npm run maturity:production-readiness:json     # JSON report (exit 0)
npm run maturity:production-readiness:strict   # non-zero if required checks fail
```

**CI (path-filtered, lightweight):** `.github/workflows/maturity-production-readiness.yml` runs the strict gate plus related Jest contracts (`MaturityProductionReadiness.test.ts`, `DashboardReactPhase8.test.ts`) on push/PR when maturity paths change, and via `workflow_dispatch`. It is not full monorepo CI.

**Required checks (fail in `--strict`):** phase doc Phase 8 / 1–8 DONE, React island sources, desktop updater modules, memory v2 files, `NaturalScheduleParser`, session SQLite wiring, root gate scripts.

**Advisory only (warn):** rebuilt Vite shell artifact (`data-react-dashboard-island` under `src/zavorth-control/public/zavorth-control-vite-shell` — run `npm run zavorth-control-vite:build` if missing), desktop code-signing env (boolean readiness only), `electron-updater` dependency, `GH_TOKEN` / `GITHUB_TOKEN` present (boolean only — value never printed).

### Still operator-owned

| Item | Why |
|------|-----|
| Code-signing certs (`CSC_LINK` / platform keys) | Secrets; not in repo |
| Notarization (`APPLE_ID`, app password, team id) | Secrets; macOS shipping only |
| `GH_TOKEN` / `GITHUB_TOKEN` | Publish installers to GitHub Releases |
| Vite shell rebuild | Local/CI artifact: `npm run zavorth-control-vite:build` |
| Live network publish / full monorepo CI | Outside this gate’s scope |

Implementation: `scripts/maturity-production-readiness.mjs` (exports `runMaturityProductionReadiness`).

---

## Changelog

| Date | Note |
|------|------|
| 2026-07-12 | CI workflow: maturity-production-readiness.yml (strict gate + related tests) |
| 2026-07-12 | Post-plan production readiness gate + npm scripts |
| 2026-07-12 | Plan created; Phase 1 started |
| 2026-07-12 | Phase 1 done: user-stack chain, default fallback, hot-path CB, tests |
| 2026-07-12 | Phase 2 done: cheap hop from user stack, cost-route ledger notes, dashboard |
| 2026-07-12 | Phase 3 done: SessionPersistenceStore → better-sqlite3 WAL + JSON migrate |
| 2026-07-12 | Phase 1 hot-path: user stack chain, default allowFallback, in-process CB, tests green |
| 2026-07-12 | Phase 4 done: SwarmV2Service decomposed into swarm-v2 modules; facade + tests green |
| 2026-07-12 | Phase 5 done: NaturalScheduleParser PT/EN shared across scheduler, registry, autonomy plane |
| 2026-07-12 | Phase 6 done: IMemoryBackend v2 (metadata/filters/soft-delete) + compat adapters |
| 2026-07-12 | Phase 7 done: electron-updater bridge + signing/publish config; GitHub fallback kept |
| 2026-07-12 | Phase 7 post-plan: production:readiness + monorepo desktop:* scripts (no certs) |
| 2026-07-12 | Phase 8 done: React islands (Work/Review/Proof) + expanded /control React surfaces |
