# Deep review — V8–V12 (origin/main..HEAD)

**Date:** 2026-07-11  
**Scope:** 10 commits ahead of `origin/main` (working tree clean; no uncommitted changes)  
**Method:** 6 parallel read-only reviewer subagents + orchestrator verification of top bugs  

**Commits reviewed:**

| SHA | Summary |
|-----|---------|
| 7602d15 | V10 autopilot fail-closed + empty catalog fallbacks |
| ac257ad | V8 LiveUserProviderHarness + TTFU |
| 2581789 | V9 selection UX write path |
| cce0630 | V11 continuity / killer execute / code loop |
| 7272c01 | V9 surface gates + control assets |
| 1e37815 | V11 habit/jargon/killer/code closeout |
| 93d46fb | V12 launch-ready program |
| + docs commits | V8–V12 status docs |

**Artifact reports (full detail):**

- Live harness: temp `review-live-harness.md`
- Selection: temp `review-selection.md`
- Habit/killer: temp `review-habit-killer.md`
- Ops/launch: temp `review-ops-launch.md`
- Docs honesty: temp `review-docs-honesty.md`
- UI/i18n: temp `review-ui-i18n.md`

---

## Executive verdict

| Area | Verdict |
|------|---------|
| Implementation volume | Large and real (~105 files, ~8.6k LOC added) |
| Working tree | Clean — nothing uncommitted |
| Honesty at resolver layer | Strong (no silent gemini/telegram invent when unset) |
| Autopilot V10 | Fail-closed correctly |
| Residual close claims | **Overclaim** vs retained evidence on disk |
| Product bugs | Several real P0/P1 bugs in Desktop continuity, selection writers, launch greenwash |
| Launch-ready | **Not ready** (as docs partially admit; gates can still soft-greenwash) |

**Pattern:** code mostly shipped; status language and some gates outrun retained evidence and leave real product bugs.

---

## P0 — Fix first (confirmed)

### 1. Desktop continuity dead wiring — `learningItems` typo
- **File:** `apps/zavorth-desktop/src/shell/DesktopShell.tsx:314,341`
- **Bug:** Uses `props.learningItems` but prop is `learning`. Always `undefined` → memory drafts never enter continuity.
- **Impact:** V11 ritual “pending tasks / drafts on reopen” broken on Desktop.

### 2. Dual preference writers clobber schema
- **Files:** `UserSelectionResolver.writeProviderPreference` vs `ZavorthProviderPreferencePersistenceService`
- **Bug:** UI `directWrite` and governed apply write different schemas to the same JSON file; fields drop (receipts, fallbacks, routeId).
- **Also:** `modelId` cannot be cleared (`null ?? previous`); channel defaults force `desktop`.

### 3. Killer live greenwash
- **Files:** `KillerMissionExecuteService.ts` (`ok: failed === 0`), `killer-missions-run.ts`
- **Bug:** All-blocked live run → `ok: true`, exit 0. Weak signal pass (`len>40` + any one signal). `allowFallback: true`.

### 4. Launch bar greenwash
- **signed dirs:** path existence = “signed”
- **live cells merge:** keeps prior `pass` over latest `fail`; exit can stay 0 after failure
- **live residual:** any single pass cell (probe-only) satisfies launch check
- **On disk now:** multi-step **fail**, `claimsLiveIntelligence: false` (429 quota)

### 5. Docs claim V8/R1/R2 DONE while acceptance boxes open + multi-step fail on disk
- WAVES still has unchecked VR-LIVE-MS / VR-TTFU evidence boxes
- SESSION marks R1/R2 DONE
- Retained `.zavorth/launch-live-cells.json` multi-step fail

### 6. Gemini multi-step spoils answer in user history
- **File:** `LiveUserProviderHarness.ts` ~659–665
- Marker + success token put into user turn before finish → weaker cert than OpenAI/Anthropic

### 7. Personal jargon incomplete
- Settings modules hide Doctor/MCP for personal, but SettingsOverlay always shows MCP; Command Center hard-codes MCP actions

---

## P1 — High priority

| Issue | Where |
|-------|--------|
| Secondary retry on any non-abort error (too broad) | `LlmRuntimeService` |
| `secondaryModelId` dropped by `providerConfig` read path | `providerConfig.ts` |
| Preference API: no CSRF on cookie POST | preference route + apiAuth |
| Anthropic forced-finish consecutive user roles | Live harness |
| Gemini probe model fallback list | Live harness |
| Probe `includes()` labeled “exact” | Live harness |
| Code loop `alignsWithDailyPe: true` hardcoded | `ZavorthCodeDailyLoopService` |
| Day-1 clock race (touch in useEffect after useMemo) | DesktopShell |
| TTFU self-reported timestamps; default providerAlreadyConfigured true | TTFU scripts |
| AIGateway `fallbackModelNames: ['openai','gemini']` residual | catalog |
| V9 DONE vs CORE SHIPPED vs MOSTLY DONE | docs inconsistency |
| V12 “Closes LR-*” while R12–R14 OPEN | docs |
| External Trust-Loop 02 still “próximo trabalho” | `3_DOCUMENTOS_E_PROMPTS` |

---

## What is solid (do not re-litigate)

- `claimsLiveIntelligence` only when multi-step passes (not probe-only)
- No silent Gemini invent in `UserSelectionResolver` when nothing selected
- Autopilot requires explicit `--capability=` / env (fail-closed)
- `fallbackRouteIds: []` on product routes (V10 intent)
- `value:test-all` marks live as `skipped` without `--live` (not pass)
- Preference route has management auth (not fully open)
- Control preference results escaped against XSS
- No working-tree dirt; 10 local commits not yet pushed

---

## Fixes applied (2026-07-11 follow-up)

| Area | Change |
|------|--------|
| Desktop continuity | `learningItems` → `learning`; open-clock in React state |
| Selection write | model clear; atomic write; preserve receipt metadata; no invent channel |
| Preference API | CSRF Origin check; setChannel opt-in; ID validation |
| Killer | `ok` requires all live passes; majority signals; no provider fallback; redact receipts |
| Launch | multi-step required; signed = real files not dirs; latest fail not masked; FAKE day1 tagged |
| Live harness | exact probe token; strict multi-step regex; Gemini no spoil; Anthropic single user turn |
| Personal jargon | Settings + Command Center hide MCP for personal |
| Secondary model | retry only model-scoped errors; `fallbackUsed` includes secondary |
| Code loop | `alignsWithDailyPe` structural; first-ask/review not auto-done |
| Catalog | AIGateway `fallbackModelNames: []` |
| i18n | Control route placeholders pt-BR; onboarding starters localized |

**Tests green:** UserSelectionWrite, LlmSecondary, LiveUserProviderHarness, ValueSurfaces, desktop commandCenter/continuity/jargon.

---

## Residual truth (honest)

| Bar | Reality 2026-07-11 |
|-----|---------------------|
| Value-ready local (V0–V7) | Shipped (prior) |
| V8 harness code | Shipped |
| V8 multi-step retained pass | **NO** (fail/429 on disk) |
| V9 selection core | Shipped with dual-writer bugs |
| V10 autopilot | Shipped fail-closed |
| V11 habit/killer/code | Shipped with Desktop wiring + killer ok bugs |
| V12 launch program scripts | Shipped |
| Launch-ready ops | **OPEN** (day1, real signing, solid live cells) |
| Public announce | **NO** |

*End of deep review summary.*
