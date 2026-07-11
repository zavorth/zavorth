# Session status — Value program + dynamic selection

**Last updated:** 2026-07-11  
**Repo path (docs):** `docs/product/`  
**Primary index:** [WAVES-VALUE-INTELLIGENCE-HABIT.md](./WAVES-VALUE-INTELLIGENCE-HABIT.md)  
**How to test:** [HOW-TO-TEST-VALUE.md](./HOW-TO-TEST-VALUE.md)  
**Baseline inventory:** [value-baseline.md](./value-baseline.md)  
**Roadmap pointer:** [../ROADMAP.md](../ROADMAP.md)

This file is the handoff log for agents and humans: what we already shipped in this workstream, and what still needs doing.

---

## 1. What we already did (saved / shipped)

### 1.1 Diagnosis (A–E)

| Bucket | Finding | Outcome |
|--------|---------|---------|
| A Intelligence | Runtime multi-step exists; quality not product-measured | Hermetic scoreboard + honest labels |
| B Wow | Day-0 without keys = Trust Loop static | Demo scripts + first-win ask |
| C Daily habit | Approvals strong; start/loop incomplete | Happy path, chatReady, start→ops-go |
| D Audiences | Experience skins vs runtime mismatch | business/power manifests + map |
| E Solicitations | Governance ahead of delight/live | Narrative rebalance + residual honesty |

### 1.2 Value Waves V0–V7 (foundation)

| Wave | Delivered |
|------|-----------|
| V0 | Waves doc, baseline, ROADMAP link |
| V1 | `AgentSmartnessService`, recovery plan, eval tool hermetic-only honesty |
| V2 | Daily PE `chatReady` / `happyPath`; CLI start live |
| V3 | Demo scripts, desktop starter ask, empty-state CTAs |
| V4 | Profile manifests business/power; experience→runtime map |
| V5 | Draft-only autoExtract; draft store; promote after remember |
| V6 | Continuity model + Desktop ContinuityBanner |
| V7 | Product story order: utility → habit → trust |

### 1.3 Testability pack

| Item | Path / command |
|------|----------------|
| Suite | `npm run value:test-all` |
| Live optional | `npm run value:test-all -- --live` |
| Memory drafts CLI | `npm run value:memory-drafts` / `zavorth memory-drafts` |
| Killer prompts | `npm run value:killer` |
| Continuity check | `npm run value:continuity -- --check` |
| Guide | `docs/product/HOW-TO-TEST-VALUE.md` |

### 1.4 Honesty / security audit fixes

- No fake “live multi-step pass” on file existence
- Live probe requires exact token `ZAVORTH_LIVE_OK` (not loose `ok`/`pass`)
- Suite marks live as `skipped` without `--live` (does not greenwash)
- Hermetic scoreboard labeled `hermetic-unit`, `claimsLiveIntelligence: false`
- Draft promote: remember first, then status; actor ownership; caps/secret filter
- Tool error recovery text clamped; tighter transient error matching
- `zavorth go` no longer shadowed by live Goal Plane intercept

### 1.5 Dynamic user selection (anti-hardcode)

**Rule:** never invent Gemini, Telegram, or aigateway when the user has not chosen.

| Delivered | Detail |
|-----------|--------|
| `UserSelectionResolver` | Provider/model/secondary/fallbacks/channel from env + preference only |
| `providerConfig` | No forced aigateway/gemini default |
| Removed product `\|\| 'gemini'` in `src/` | Planners, chat, LLM runtime, control plane, CLI, web, self-mod, etc. |
| Fallback chains | Empty product default; only user-configured order |
| Channel checklist | `connect-channel` optional (not Telegram-first) |
| Workspace LLM strategy | Configured provider + user fallbacks only |

**How the user commands selection**

```bash
# Primary provider/model
zavorth providers switch
# or env: LLM_PROVIDER, ZAVORTH_MODEL_ID, ZAVORTH_SECONDARY_MODEL_ID
# fallbacks: ZAVORTH_PROVIDER_FALLBACK_ORDER / ZAVORTH_ECHO_LLM_FALLBACK_ORDER

# Optional primary channel
# ZAVORTH_PRIMARY_CHANNEL=discord
# or data/runtime/channel-selection-preferences.json
```

### 1.6 Key commits (reference)

Recent mainline work in this stream included (among others):

- Value waves foundation / testability pack  
- Honesty + security harden of value gates  
- `fix(runtime): honor user provider and channel selection only` (`1535f2c` and successors on main)

Always confirm with `git log --oneline -15`.

---

## 2. What still needs to be done (residual)

### P0 — Product feel / intelligence

| # | Work | Status | Why / notes |
|---|------|--------|-------------|
| R1 | **Live multi-step tool harness** (real tool rounds with *user-selected* provider) | **DONE (V8)** | Live multi-step pass; `claimsLiveIntelligence: true` only then |
| R2 | **First useful work &lt; 3 min** measured with *user’s* provider already set | **DONE (V8)** | Wall-clock TTFU ~15.4s from timed live multi-step session |
| R3 | **Desktop reopen continuity ritual** (pending tasks from yesterday, one primary next action) | **DONE (V11)** | DesktopShell + ContinuityBanner + DailyReturnContinuityService |

### P1 — Dynamic selection polish

| # | Work | Status | Why / notes |
|---|------|--------|-------------|
| R4 | **UI shells** legacy “Auto / Gemini” | **MOSTLY DONE (V9)** | Configured route + Control form; keep watching mirrors |
| R5 | **Capability autopilot scripts** default `executor-gemini-cli` | **DONE (V10)** | `requireAutopilotCapabilityId` — fail closed without `--capability=` / env |
| R6 | **Catalog fallbackRouteIds** list gemini in core/local manifests | **DONE (V10)** | Product default empty; user policy only |
| R7 | **Channel preference write path in product UI** | **DONE (V9 core)** | Desktop + Control write `channel-selection-preferences.json` |
| R8 | **Secondary model in chat routing** | **DONE (V9 core)** | Preference field + LlmRuntime secondary retry on primary model fail |

### P2 — Audiences / wow / non-dev

| # | Work | Status | Why / notes |
|---|------|--------|-------------|
| R9 | Non-dev path fully free of npm/doctor jargon in first run | **DONE (V11)** | Personal settings hide Doctor/MCP; plain labels |
| R10 | One killer demo **executed and recorded** per audience | **DONE (V11)** | Live 3/3 via `value:killer -- --execute --live` |
| R11 | Code surface unified daily loop | **DONE (V11)** | Code loop service + daily-use-trail three-surface table |

### P3 — Launch / ops (not value-local)

| # | Work | Why |
|---|------|-----|
| R12 | Retention R2 real calendar day-1 | launch-readiness residual |
| R13 | Signed desktop/installers, store assets | launch-readiness residual |
| R14 | Live credentialed provider/channel certification cells | catalog ≠ live honesty |

---

## 3. Unified next waves (V8–V12) — executable program

**Canonical program (full acceptance criteria, code anchors, i18n rules, ID disambiguation):**

→ **[WAVES-UNIFIED-CLOSEOUT.md](./WAVES-UNIFIED-CLOSEOUT.md)**

| Wave | Name | Closes (unified IDs) | Priority | Status |
|------|------|----------------------|----------|--------|
| **V8** | Live quality + time-to-value | VR-LIVE-MS, VR-TTFU (old R1, value-R2) | P0 | **DONE** (live multi-step + TTFU ~15s) |
| **V9** | Selection UX complete | VR-UI-LEGACY, VR-CHANNEL-UI, VR-SECONDARY (R4, R7, R8) | P1 | **CORE SHIPPED** |
| **V10** | Neutral ops defaults | VR-AUTOPILOT, VR-CATALOG-FB (R5, R6) | P1 | **DONE** |
| **V11** | Habit + audiences closeout | VR-RITUAL, VR-NONDEV, VR-KILLER-RUN, VR-CODE-LOOP (R3, R9–R11) | P0/P2 | **DONE** |
| **V12** | Launch residual | LR-DAY1, LR-SIGN, LR-CELLS, LR-ANNOUNCE (R12–R14) | P3 | residual |

**Order:** `(V8 ∥ V9 ∥ V10) → V11 → V12` — **V8–V11 done 2026-07-11; next is V12 launch residual**
**Naming note:** value residual “R2” (TTFU) ≠ retention/launch “R2” (calendar day-1 = **LR-DAY1** / old R12).

---

## 4. Commands for any agent continuing

```bash
# Honesty + value suite (local)
npm run value:test-all

# Hermetic agent unit scoreboard
npm run agent:smartness:check

# Optional live (uses user keys; does not invent provider)
npm run value:test-all -- --live

# Read this status + waves
# docs/product/SESSION-STATUS-VALUE-AND-DYNAMIC.md
# docs/product/WAVES-VALUE-INTELLIGENCE-HABIT.md
```

**Do not claim:** public launch, live multi-step auto-certified, or “default model is Gemini” as product policy.

---

## 5. Folder map (where docs live)

```
1_PROJETOS_ATIVOS/Zavorth/docs/product/
├── SESSION-STATUS-VALUE-AND-DYNAMIC.md   ← this file (done + residual)
├── WAVES-VALUE-INTELLIGENCE-HABIT.md     ← executable waves V0–V7
├── HOW-TO-TEST-VALUE.md                  ← how to test
├── value-baseline.md                     ← inventory + metrics
├── demo-scripts.md                       ← honest demos A/B/C
├── launch-readiness.md                   ← ops residual
└── ...
docs/ROADMAP.md                           ← high-level pointer
docs/daily-use-trail.md                   ← short daily path
docs/product-story.md                     ← value order narrative
```

---

*End of session status. Update residual table when a residual item ships.*
