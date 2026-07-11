# Unified Closeout Waves — V8–V12

**Status:** `ACTIVE` — V8/V9/V10 DONE; V11/V12 residual
**Last updated:** 2026-07-11  
**Language of this document:** English  
**Product brand:** Trust Loop (not “Proof OS”)

This is the **single executable program** for everything still open after Value-ready (local).  
It unifies residual tables from:

- [SESSION-STATUS-VALUE-AND-DYNAMIC.md](./SESSION-STATUS-VALUE-AND-DYNAMIC.md) (R1–R14)
- [SESSION-STATUS-HANDOFF.md](./SESSION-STATUS-HANDOFF.md)
- [WAVES-VALUE-INTELLIGENCE-HABIT.md](./WAVES-VALUE-INTELLIGENCE-HABIT.md) (V0–V7 foundation)
- [launch-readiness.md](./launch-readiness.md)
- [retention-gate.md](./retention-gate.md)
- External snapshot: `3_DOCUMENTOS_E_PROMPTS/Zavorth-Trust-Loop/02-SESSION-STATUS.md`

Do **not** reopen V0–V7 unless a regression is proven.

---

## Why one unified program

Residuals were split across three lists (value polish, selection honesty, launch ops) and two ID schemes. That caused collisions and partial waves.

| Problem | Fix in this doc |
|---------|-----------------|
| Value **R2** = time-to-first-useful-work | Renamed **VR-TTFU** |
| Retention **R2** = calendar day-1 return | Renamed **LR-DAY1** |
| Value **R1** = live multi-step | Renamed **VR-LIVE-MS** |
| Suggested V8–V11 had scope only, no acceptance | Full wave specs below |
| UI / scripts / catalog still vendor-biased | One selection stack end-to-end |
| i18n partial; hard-coded English/Gemini labels | Device locale + keys for every new surface |

---

## Bar definitions (do not mix)

| Bar | Meaning | Evidence |
|-----|---------|----------|
| **Value-ready (local)** | V0–V7 foundation; dogfood hermetic green | Already DONE |
| **Selection-honest** | No silent Gemini/Telegram/Auto as product default in runtime **or** product UI/ops scripts | Closes with V9 + V10 |
| **Live-quality (credentialed)** | Multi-step tool rounds run with the **user’s** configured provider; measured pass/fail; never greenwashed | Closes with V8 |
| **Habit-closed (product)** | Open → work → reopen tomorrow with real next action (product UX) | Closes with V11 |
| **Launch-ready (ops)** | Calendar day-1 log, signed installers, live cert cells, public announce only after checklist | Closes with V12 |

### Anti-claims (all waves)

- Do not claim **live agent IQ** from hermetic smartness alone.
- Do not claim **launched / shipped publicly** from local hermetic green.
- Do not treat ContinuityBanner / `value:continuity` as **LR-DAY1** closed.
- Do not invent Gemini, Telegram, or aigateway when the user did not choose them.
- Do not mark live cells `pass` without real credentials and exact success tokens.
- Do not use simulated tool rounds and call them live multi-step.
- Do not soft-lie calendar day-1 (`ZAVORTH_ALLOW_FAKE_DAY1` is never product evidence).

---

## Residual map (old IDs → unified)

| Old ID | Unified ID | Wave | Priority | One-line outcome |
|--------|------------|------|----------|------------------|
| R1 | **VR-LIVE-MS** | V8 | P0 | Real multi-step tool harness with user-selected provider |
| R2 (value) | **VR-TTFU** | V8 | P0 | First useful work measured &lt; 3 min (provider already set) |
| R3 | **VR-RITUAL** | V11 | P0 | Reopen ritual: yesterday work + one primary next action |
| R4 | **VR-UI-LEGACY** | V9 | P1 | No “Auto / Gemini” product copy in shells |
| R5 | **VR-AUTOPILOT** | V10 | P1 | Autopilot requires explicit capability / user selection |
| R6 | **VR-CATALOG-FB** | V10 | P1 | Catalog fallbacks empty unless user policy |
| R7 | **VR-CHANNEL-UI** | V9 | P1 | Primary channel writable from Desktop/Control |
| R8 | **VR-SECONDARY** | V9 | P1 | Secondary model applied on every chat fail path |
| R9 | **VR-NONDEV** | V11 | P2 | Personal home free of ops jargon |
| R10 | **VR-KILLER-RUN** | V11 | P2 | One killer demo executed + receipt per audience (credentialed) |
| R11 | **VR-CODE-LOOP** | V11 | P2 | Zavorth Code shares the same daily PE loop semantics |
| R12 | **LR-DAY1** | V12 | P3 | Real calendar day-1 return in retention log |
| R13 | **LR-SIGN** | V12 | P3 | Signed desktop/installers / store assets |
| R14 | **LR-CELLS** | V12 | P3 | Live credentialed provider/channel certification cells |
| (handoff) | **LR-ANNOUNCE** | V12 | P3 | Public announcement only after V12 checklist |
| V4-c | **VR-JARGON** | V11 | P2 | Audience-gated copy (personal hides Doctor/Policy Broker) |

---

## Cross-cutting rules (every wave)

### 1) User selection only

- Resolve provider / model / secondary / channel only via `UserSelectionResolver` + preference files + env the user set.
- Prefer empty product defaults over vendor defaults.
- Fail closed with a clear, localized message when nothing is configured.

### 2) i18n + device language

| Surface | Source of truth | Rule |
|---------|-----------------|------|
| Core / CLI | `src/i18n` YAML (`en-US`, `pt-BR`, …) + `localeDetector` | `ZAVORTH_LANG` → OS locale → `en-US` |
| Desktop | `apps/zavorth-desktop` i18n maps + `navigator.language` | All new UI strings via keys; no hard-coded English in components |
| Control | `locale.ts` default `system` (`navigator.languages`) | Same keys for pickers, errors, empty states |
| New gates / CLI output for humans | Core i18n namespaces | Machine JSON may stay English keys; user-facing text must be localized |

**Acceptance for every wave that touches UI or CLI human text:**

- [ ] New strings have keys in **en-US** and **pt-BR** (minimum product pair).
- [ ] Default locale follows **device/OS language** when user has not overridden.
- [ ] `npm run i18n:check` stays green.
- [ ] No new hard-coded `"Auto / Gemini"`, vendor names as defaults, or English-only banners.

### 3) Real results only

| Kind | Allowed | Forbidden |
|------|---------|-----------|
| Hermetic unit | Yes, labeled `hermetic-unit` | Claiming live IQ |
| Live probe | Yes, exact success token | Loose `ok` / `pass` |
| Live multi-step | Real tool rounds with configured provider | Simulated rounds labeled live |
| Killer execution | Real chat/tool run + receipt file | Catalog list as “executed” |
| Day-1 retention | Real later calendar day | Clock forge for launch claims |

### 4) Connected stack (one preference graph)

```
User device locale
        │
        ▼
 i18n (Desktop / Control / CLI)
        │
        ▼
 Selection UX (primary / secondary / channel)  ──write──► preference JSON
        │
        ▼
 UserSelectionResolver  ──read──► runtime chat + tool loop + live harness
        │
        ▼
 Daily PE (chatReady / happyPath) + Continuity ritual + Code loop
        │
        ▼
 Gates: value:test-all · smartness (hermetic + live) · i18n · retention · launch
```

---

## Global progress

| Wave | Name | Priority | Status | Depends on | Closes |
|------|------|----------|--------|------------|--------|
| **V8** | Live quality + time-to-value | P0 | `DONE` (credentialed multi-step + TTFU measured) | V0–V7, selection resolver | VR-LIVE-MS, VR-TTFU, feeds LR-CELLS |
| **V9** | Selection UX complete | P1 | `DONE` | V8 may run in parallel | VR-UI-LEGACY, VR-CHANNEL-UI, VR-SECONDARY |
| **V10** | Neutral ops defaults | P1 | `DONE` | parallel with V9 | VR-AUTOPILOT, VR-CATALOG-FB |
| **V11** | Habit + audiences closeout | P0/P2 | `IN PROGRESS` | V8 path + V9 preferred | VR-RITUAL, VR-NONDEV, VR-JARGON, VR-KILLER-RUN, VR-CODE-LOOP |
| **V12** | Launch residual | P3 | `LOCKED` until V8 live path honest | V8 (for cells), product habit optional | LR-DAY1, LR-SIGN, LR-CELLS, LR-ANNOUNCE |

**Recommended order**

```
(V8 ∥ V9 ∥ V10) → V11 → V12
```

- **V8, V9, V10** can run in parallel (different owners / worktrees).
- **V11** benefits from V9 (localized selection) but can start ritual/jargon without it.
- **V12** must not claim live cells until V8 multi-step harness is real; signing and calendar day-1 can proceed independently once process owners exist.

---

# Wave V8 — Live quality + time-to-value

| Field | Value |
|-------|--------|
| **ID** | V8 |
| **Priority** | P0 |
| **Status** | `DONE` |
| **Closes** | VR-LIVE-MS, VR-TTFU |
| **Feeds** | LR-CELLS (V12) |
| **Buckets** | A (intelligence), C (habit) |

### Objective

Prove the agent does **real multi-step tool work** with the **provider the user chose**, and measure **first useful work under 3 minutes** when that provider is already configured. No vendor hardcode. No simulated live pass.

### Problems it closes

- `AgentSmartnessLiveService` multi-step stays `blocked` after probe.
- Live probe path is Gemini-key biased (`probe-live-llm.mjs` / GEMINI-oriented gate).
- Time-to-first-useful-work is documented, not measured.

### In scope

1. **Live multi-step harness (user provider only)**  
   - Extend `AgentSmartnessLiveService.runLiveMultiStepCheck` to run real tool rounds via existing production loop (`AgentRunNativeToolLoopService` or thin harness over the same path).  
   - Provider/model/secondary from `UserSelectionResolver` only.  
   - If no provider configured → `skipped` / fail closed with localized reason (not Gemini invent).  
   - Success requires real tool call(s) + model response; exact token / structured result (same honesty bar as `ZAVORTH_LIVE_OK` for probes).  
   - Label results: `live-multi-step`, `claimsLiveIntelligence: true` **only** when that path passes.

2. **Deprecate vendor-only automated pass**  
   - Automated live path must accept any configured provider with valid credentials (OpenAI, Anthropic, Gemini, custom, …).  
   - Gemini remains a **selectable** route, never the silent default.

3. **First useful work timer (VR-TTFU)**  
   - Measure: Desktop (or CLI start surface) open with `providerReady` already true → first successful assistant reply that completes a useful ask (starter ask or killer safe prompt).  
   - Target: **&lt; 180s** wall clock.  
   - Gate: script under `value:test-all` optional live/timer step, or dogfood receipt with timestamps.  
   - Without provider preconfigured → step `skipped` (setup time does not count against the 3 min product claim).

4. **Docs honesty**  
   - Update `HOW-TO-TEST-VALUE.md`: remove “Gemini key only” as the sole live path; document user-provider multi-step.  
   - Update `value-baseline.md` metrics row for TTFU + live multi-step status.

### Out of scope

- Signing, store, public announce (V12).  
- Full 29-channel live matrix.  
- Replacing hermetic smartness (keep hermetic scoreboard).

### Code anchors

| Area | Path |
|------|------|
| Live service | `src/services/agent-smartness/AgentSmartnessLiveService.ts` |
| Live CLI | `scripts/agent-smartness-live-run.ts` |
| Probe | `scripts/probe-live-llm.mjs` → generalize or replace |
| Tool loop | `src/runtime/agent/AgentRunNativeToolLoopService.ts` |
| Selection | `src/services/UserSelectionResolver.ts` |
| Daily PE | `src/services/ZavorthDailyProductExperienceService.ts` |
| Desktop first-win | `apps/zavorth-desktop/src/onboarding/desktopOnboarding.ts` |

### Acceptance criteria

- [x] Provider-neutral production-runtime path and real tool-round contract are implemented and covered hermetically, including a custom/compatible provider.
- [ ] Run and retain at least one credentialed multi-step cell with the user's selected provider; only that evidence may close VR-LIVE-MS.
- [x] With no provider: multi-step is **blocked** — never invents Gemini.
- [x] Hermetic `agent:smartness:check` still green; still `claimsLiveIntelligence: false` for hermetic path.
- [x] TTFU recorder and structural gate exist (`value:ttfu`); &lt;3 min claim remains disabled without a real record.
- [ ] Record a real preconfigured-provider session under 180 seconds before closing VR-TTFU.
- [x] `HOW-TO-TEST-VALUE.md` and residual tables updated; no Gemini-as-policy language.
- [x] Operator-facing CLI notes in English; no new hard-coded product UI vendor defaults.

### Prove

```bash
npm run value:test-all
npm run agent:smartness:check
npm run agent:smartness:live -- --live   # requires user keys; no vendor invent
npm run value:ttfu -- --check
```

### Handoff log

| Date | Note |
|------|------|
| 2026-07-11 | Wave specified. |
| 2026-07-11 | Implemented `LiveUserProviderHarness` direct cells for OpenAI/Anthropic/Gemini plus a provider-neutral path through the production `LlmRuntimeService` for custom/compatible providers. Selection uses the injected environment consistently; no-selection evidence has no invented provider family. Probe-only success cannot certify live intelligence. `TimeToFirstUsefulWorkService` + `value:ttfu` and structural gates are present. |
| 2026-07-11 | **DONE evidence:** `agent:smartness:live -- --live` multi-step pass (`claimsLiveIntelligence: true`); wall-clock TTFU record ~15.4s under 180s budget (`value:ttfu -- --record` from timed live run). Forced finish turn after tool result for flaky model token format. |

---

# Wave V9 — Selection UX complete

| Field | Value |
|-------|--------|
| **ID** | V9 |
| **Priority** | P1 |
| **Status** | `DONE` |
| **Closes** | VR-UI-LEGACY, VR-CHANNEL-UI, VR-SECONDARY |
| **Buckets** | D (audiences), honesty |

### Objective

Make primary provider, secondary model, and primary channel **first-class product controls** on Desktop and Control, bound to the same preference files the runtime already reads. Remove legacy “Auto / Gemini” product copy. All labels follow **device language**.

### Problems it closes

- Static assets still show `Auto / Gemini` (`assets/*/scripts/pages.js`, control public copies).
- Desktop has model picker for session model, not durable primary/secondary/channel writers.
- Secondary model preference fields exist; not every chat path uses them on primary failure.
- No app UI hits `writeChannelPreference`.

### In scope

1. **Remove legacy vendor copy**  
   - Replace hard-coded `Auto / Gemini` with neutral “Configured route” / live bound label from selection.  
   - Cover: `assets/zavorth-control`, `assets/command-center`, control vite shell public copies, any generated mirror.

2. **Desktop selection settings**  
   - UI to set: primary provider, primary model, secondary model, primary channel.  
   - Persist via existing services (`ZavorthProviderPreferencePersistenceService`, channel preference writer on `UserSelectionResolver`).  
   - Reflect current selection on open (no silent default vendor).

3. **Control selection settings**  
   - Same three controls (provider/model/secondary/channel) bound to preference files, not prompt-projection only.

4. **Secondary model on chat paths**  
   - When primary fails (transient / auth / route down), apply secondary from preference on Desktop, CLI chat, and Control chat entry points that route LLM.  
   - No new hard-coded vendor secondary.

5. **i18n**  
   - All picker labels, helper text, empty states, errors via Desktop/Control/core keys.  
   - Locale = system/device unless user override.

### Out of scope

- Autopilot script defaults (V10).  
- Catalog mesh surgery beyond display of current selection (V10).  
- Signing (V12).

### Code anchors

| Area | Path |
|------|------|
| Resolver | `src/services/UserSelectionResolver.ts` |
| Provider prefs | `src/services/ZavorthProviderPreferencePersistenceService.ts`, `src/config/sections/providerConfig.ts` |
| Desktop picker | `apps/zavorth-desktop/src/components/ModelPickerDialog.tsx` → extend or add Settings module |
| Desktop settings | `apps/zavorth-desktop/src/settings/settingsModules.ts` |
| Control | `apps/zavorth-control-vite-shell/src/pages.ts`, `dashboard-live-view.ts`, `locale.ts` |
| Legacy assets | `assets/zavorth-control/scripts/pages.js`, `assets/command-center/scripts/pages.js` |

### Acceptance criteria

- [x] No product UI string `Auto / Gemini` as active-route default in the canonical Control shell or its runtime/legacy mirrors; regression-covered.
- [x] User can set primary + secondary + channel from Desktop **and** Control; files update; restart/reload honors them.
- [x] CLI `providers switch` / env still work; UI writes the same resolver files.
- [x] Automated test covers preference write → resolver read → route identity.
- [x] Secondary model is applied before provider fallback and receipt evidence is asserted hermetically.
- [x] `npm run i18n:check` green; Desktop picker uses device-language i18n and Control uses its system-locale layer.

### Prove

```bash
npm run value:test-all
npm run i18n:check
# Manual: Desktop + Control change primary/secondary/channel → chat uses selection
```

### Handoff log

| Date | Note |
|------|------|
| 2026-07-11 | Wave specified. Not started. |
| 2026-07-11 | **DONE.** Desktop and Control use the canonical `UserSelectionCatalog`; both persist primary provider, primary/secondary model and channel through `/api/providers/preference`. The previously orphaned Control binding is active. Cross-surface, write→resolve and secondary-model retry tests pass. Picker UI uses neutral design-system states and localized copy. Control bundle split reduced the main entry from ~551 kB to ~240 kB. |

---

# Wave V10 — Neutral ops defaults

| Field | Value |
|-------|--------|
| **ID** | V10 |
| **Priority** | P1 |
| **Status** | `DONE` |
| **Closes** | VR-AUTOPILOT, VR-CATALOG-FB |
| **Buckets** | honesty, ops |

### Objective

Ops tooling and mesh catalog must not smuggle Gemini as the product default. Explicit capability or user policy only.

### Problems it closes

- Many `scripts/capability-autopilot*.ts` default `executor-gemini-cli`.
- Provider manifests set `fallbackRouteIds` including `gemini` as mesh fallback.

### In scope

1. **Autopilot**  
   - Require `--capability=` **or** resolve from user selection / env.  
   - Fail closed with clear message if missing.  
   - Update tests to pass explicit capability fixtures (fixtures may still use gemini-cli as a **named** test capability, not as silent default).

2. **Catalog fallbacks**  
   - Product default for `fallbackRouteIds`: empty or user-policy only.  
   - Keep Gemini as an available **route** entry where the vendor exists; do not auto-chain to it without user fallback order.  
   - Align with `UserSelectionResolver` fallback lists.

3. **Docs**  
   - Operator notes: how to pass capability; how user fallbacks work.

### Out of scope

- Product UI pickers (V9).  
- Live multi-step (V8).

### Code anchors

| Area | Path |
|------|------|
| Autopilot scripts | `scripts/capability-autopilot*.ts` |
| Autopilot tests | `tests/services/CapabilityAutopilot*.test.ts` |
| Manifests | `src/services/providers/catalog/manifests/coreProviders.ts`, `localAndCustomProviders.ts` |

### Acceptance criteria

- [x] Running autopilot without capability/selection fails closed (no silent gemini-cli).
- [x] Grep for default `executor-gemini-cli` assignment shows none outside explicit fixtures/docs/registry lists.
- [x] Product catalog fallbacks do not force gemini when user has empty fallback policy.
- [x] Unit coverage in `LiveUserProviderHarness.test.ts` (V10 section).

### Prove

```bash
# expect fail closed without capability
npx tsx scripts/capability-autopilot-preflight.ts
# expect run with explicit capability
npx tsx scripts/capability-autopilot-preflight.ts --capability=executor-gemini-cli
npm run value:test-all
```

### Handoff log

| Date | Note |
|------|------|
| 2026-07-11 | Wave specified. |
| 2026-07-11 | V9 started: replaced vendor-biased active-route copy with the saved configured route across the canonical Control shell and five served/mirrored assets. Added a cross-mirror regression test. Durable primary + secondary + channel writers in Desktop and Control remain open. |
| 2026-07-11 | V9 core shipped: `UserSelectionCatalog` + `writeProviderPreference` / channel writers; Desktop `UserRouteSelectionPanel`; Control model-preference form (primary/secondary/channel); API `directWrite`; LlmRuntime secondary model retry; shared onboarding provider ids. Full i18n polish of all picker strings still residual. |
| 2026-07-11 | **DONE.** `CapabilityAutopilotSelection` + all capability-autopilot* scripts fail closed; core/local `fallbackRouteIds: []`. |

---

# Wave V11 — Habit + audiences closeout

| Field | Value |
|-------|--------|
| **ID** | V11 |
| **Priority** | P0 (ritual) / P2 (polish) |
| **Status** | `READY` |
| **Closes** | VR-RITUAL, VR-NONDEV, VR-JARGON, VR-KILLER-RUN, VR-CODE-LOOP |
| **Depends on** | V6 UX exists; V8 for honest killer execution; V9 preferred for selection copy |
| **Buckets** | B, C, D |

### Objective

Close the daily habit loop as a **product**, not only a banner model: reopen shows real yesterday context and one next action; personal users see plain language; killer demos can actually run with receipts; Zavorth Code shares the same daily loop semantics.

### Problems it closes

- Continuity banner exists; “pending tasks from yesterday + one primary next action” incomplete.
- Personal home still exposes Doctor / runtime jargon.
- Killer missions are prompt catalogs only.
- Code surface loop still split from Desktop/Control PE.

### In scope

1. **Reopen ritual (VR-RITUAL)**  
   - Enrich `DailyReturnContinuityService` + Desktop `ContinuityBanner`:  
     - summarize pending approvals / unfinished work from last session when available;  
     - single primary next action (localized);  
     - CTA opens that action (not generic home only).  
   - Keep honesty: synthetic clock OK for unit tests; does **not** close LR-DAY1.

2. **Non-dev language (VR-NONDEV + VR-JARGON)**  
   - Audience-gated copy: personal hides “Doctor”, “Policy Broker”, npm-style instructions on first-run home.  
   - Developer/power retain operator language.  
   - All via i18n keys; device locale.

3. **Killer demo execution (VR-KILLER-RUN)**  
   - Optional credentialed runner: take catalog prompt → run through real chat/tool path with user provider → write receipt under `data/product/` or dogfood log.  
   - Without keys: catalog list remains; status `skipped`, never fake pass.  
   - One recorded path per audience (developer / personal / privacy) when live enabled.

4. **Zavorth Code daily loop (VR-CODE-LOOP)**  
   - Map Code open → provider ready → first ask → review to the same Daily PE snapshot fields (`chatReady` / `happyPath` semantics).  
   - Document single daily loop across Desktop / Control / Code in `surfaces-code-control-desktop.md` + `daily-use-trail.md`.  
   - Bridge already exists (`useCodeBridge`, control code-bridge-ui); unify **product meaning**, not rewrite Code from scratch.

### Out of scope

- Calendar retention LR-DAY1 (V12).  
- Store signing (V12).  
- Multi-agent swarm demos.

### Code anchors

| Area | Path |
|------|------|
| Continuity | `src/services/DailyReturnContinuityService.ts`, `apps/zavorth-desktop/src/components/ContinuityBanner.tsx`, `continuityStorage.ts` |
| Continuity gate | `scripts/continuity-return-run.ts` |
| i18n Desktop | `apps/zavorth-desktop/src/i18n.ts` |
| Onboarding audience | `apps/zavorth-desktop/src/onboarding/desktopOnboarding.ts` |
| Killer catalog | `src/services/KillerMissionCatalogService.ts`, `scripts/killer-missions-run.ts` |
| Code bridge | `apps/zavorth-desktop/src/desktop-state/useCodeBridge.ts`, `packages/code/`, `docs/protocol/zavorth-code-bridge.md` |
| Daily PE | `src/contracts/ui/ZavorthDailyProductExperienceContract.ts` |

### Acceptance criteria

- [ ] Reopen with yesterday pending work shows **one** primary next action with working CTA.
- [ ] Personal audience first-run / home avoids Doctor / Policy Broker / npm jargon (test or snapshot).
- [ ] `value:killer -- --execute` (or documented flag) either runs live with receipt or `skipped` honestly.
- [ ] Code daily path documented + PE fields aligned; no claim that Code is a separate product island for “open → work”.
- [ ] i18n green; continuity strings no English-only hardcode without keys.

### Prove

```bash
npm run value:continuity -- --check
npm run value:killer
# optional: npm run value:killer -- --execute --live   # keys required
npm run zavorth:daily-product-experience:check
npm run i18n:check
npm run value:test-all
```

### Handoff log

| Date | Note |
|------|------|
| 2026-07-11 | Wave specified. Not started. |

---

# Wave V12 — Launch residual

| Field | Value |
|-------|--------|
| **ID** | V12 |
| **Priority** | P3 (ops) |
| **Status** | `LOCKED` until V8 multi-step path is honest for live cells; signing/day-1 can prepare earlier |
| **Closes** | LR-DAY1, LR-SIGN, LR-CELLS, LR-ANNOUNCE |
| **Buckets** | E (solicitations × reality), ops |

### Objective

Reach **Launch-ready (ops)** without lying: real day-1 return, signed artifacts, credentialed live cells, then public announce.

### Problems it closes

- Retention calendar day-1 still open (`retention-log` / `day1Return`).
- Signing / notarization / store assets residual.
- Live certification cells not complete.
- Public announcement blocked by checklist.

### In scope

1. **LR-DAY1** — Real return on a **later UTC calendar day**; `node scripts/retention-log.mjs --day1-return` per [retention-gate.md](./retention-gate.md). Never soft-lie.

2. **LR-SIGN** — Desktop code signing, notarization where required, installer release assets, store listing assets. Use `ops-signing-readiness`, installer checks; only claim signed when artifacts exist.

3. **LR-CELLS** — Provider/channel certification with real keys; multi-step uses V8 harness. Catalog ≠ Live remains law. Matrix in `certified-live-matrix.md` (or equivalent) updated with real results.

4. **LR-ANNOUNCE** — Public channel announcement **only after** operator checklist:

   1. `npm run residual:waves:check`  
   2. `npm run dogfood:hermetic`  
   3. `npm run security:ci`  
   4. LR-DAY1 recorded (real next day)  
   5. Signed artifacts exist before any store language  
   6. Live cells documented (pass or explicit not-in-this-release)

### Out of scope

- Rebuilding value foundation.  
- Marketing campaign content beyond announce gate.  
- Claiming launch from hermetic-only green.

### Code / ops anchors

| Area | Path |
|------|------|
| Launch map | `docs/product/launch-readiness.md` |
| Retention | `docs/product/retention-gate.md`, `scripts/retention-log.mjs` |
| Signing | `scripts/ops-signing-readiness.mjs`, installer readiness scripts |
| Live cert | `docs/product/certified-live-matrix.md`, `agent:smartness:live` |

### Acceptance criteria

- [ ] LR-DAY1 closed with real calendar evidence (not ContinuityBanner alone).
- [ ] Signed installers/assets exist for the release you announce.
- [ ] Live cells either pass under user credentials or are explicitly listed “not claimed this release”.
- [ ] No public “launched” language before checklist complete.
- [ ] [launch-readiness.md](./launch-readiness.md) residual section updated honestly.

### Prove

```bash
npm run residual:waves:check
npm run dogfood:hermetic
npm run security:ci
node scripts/retention-log.mjs --check
# day1 only after real next calendar day:
# node scripts/retention-log.mjs --day1-return
```

### Handoff log

| Date | Note |
|------|------|
| 2026-07-11 | Wave specified. Locked for full closeout until V8 live multi-step is real. |

---

## Execution board (for agents)

### Parallel track A — Intelligence (V8)

1. Generalize live probe to user provider.  
2. Wire multi-step harness to production tool loop.  
3. Add TTFU measurement gate.  
4. Update HOW-TO-TEST + baseline.  
5. i18n messages + prove commands.

### Parallel track B — Selection (V9 + V10)

1. V10: strip autopilot defaults + catalog fallbacks (fast, low UI risk).  
2. V9: kill Auto/Gemini copy → Desktop/Control pickers → secondary on chat paths.  
3. i18n + preference write tests.

### Parallel track C — Habit (V11)

1. Ritual enrichment (pending + one action).  
2. Audience jargon gating.  
3. Killer execute + receipt.  
4. Code PE alignment + docs.

### Serial track D — Launch (V12)

1. Prepare signing pipeline.  
2. After V8: live cells.  
3. Calendar day-1 when operator returns next day.  
4. Announce only after checklist.

---

## Definition of done for the unified program

| Checkpoint | Required |
|------------|----------|
| V8 DONE | Credentialed multi-step evidence retained; real TTFU measured under 180s; hermetic still honest |
| V9 DONE | Pickers write prefs; no Auto/Gemini product default copy; secondary wired; i18n |
| V10 DONE | Autopilot + catalog neutral |
| V11 DONE | Ritual + non-dev + killer execute path + Code loop semantics |
| V12 DONE | LR-DAY1 + LR-SIGN + LR-CELLS + announce gate |
| **Program complete** | Selection-honest + Live-quality + Habit-closed + Launch-ready — each claim backed by gate evidence |

---

## Related docs

| Doc | Role after this program |
|-----|-------------------------|
| [WAVES-VALUE-INTELLIGENCE-HABIT.md](./WAVES-VALUE-INTELLIGENCE-HABIT.md) | V0–V7 foundation (DONE) |
| [SESSION-STATUS-VALUE-AND-DYNAMIC.md](./SESSION-STATUS-VALUE-AND-DYNAMIC.md) | Residual log; points here for V8+ |
| [SESSION-STATUS-HANDOFF.md](./SESSION-STATUS-HANDOFF.md) | Trust Loop + value handoff |
| [HOW-TO-TEST-VALUE.md](./HOW-TO-TEST-VALUE.md) | Update as V8–V11 ship |
| [launch-readiness.md](./launch-readiness.md) | V12 residual honesty |
| [../ROADMAP.md](../ROADMAP.md) | High-level pointer |
| External | `Zavorth-Trust-Loop/02-SESSION-STATUS.md` |

---

*Update the global progress table and handoff logs when a wave ships. Mark residual IDs closed in SESSION-STATUS-VALUE-AND-DYNAMIC.md in the same change.*
