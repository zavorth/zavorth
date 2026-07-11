# Value program baseline

Baseline for the Value Waves program (`WAVES-VALUE-INTELLIGENCE-HABIT.md`).

## Metrics

| Metric | Target | How measured |
|--------|--------|----------------|
| Agent smartness missions | 100% pass hermetic | `npm run agent:smartness:check` |
| Live multi-step (user provider) | Implementation ready; close only with retained credentialed real-tool evidence | `npm run agent:smartness:live -- --live` (`claimsLiveIntelligence` only when probe and multi-step pass) |
| Time-to-first-useful-work | Structural path ready; &lt; 180s when measured with provider preconfigured | `npm run value:ttfu -- --check` / `--record` |
| Chat ready without full platform setup | Provider done ⇒ chatReady | Daily product experience snapshot |
| `zavorth start` | Opens daily surface (not guide-only) | CLI routes to `ops-go` |
| Experience profiles | business/power compile to runtime manifests | ProfileManifestService |
| Memory auto-extract | Draft-only by default | MemoryService.autoExtract |
| Day-1 return model | Eligible when reopen next calendar day | DailyReturnContinuityService |

## Inventory (code)

| Area | State |
|------|--------|
| Smartness scoreboard | `src/services/agent-smartness/AgentSmartnessService.ts` |
| Daily happy path | `ZavorthDailyProductExperienceService` (`chatReady`, `happyPath`) |
| CLI start | Live for open/start via `ops-go`; connect/learn/tools are read-only live surfaces |
| Profiles | `config/profile-manifests/{business,power}.json` + experience map |
| Memory | autoExtract draft-only; promote via `MemoryService.promoteMemoryDraft` |
| Continuity | `DailyReturnContinuityService` + Desktop ContinuityBanner |
| First-win desktop ask | `DESKTOP_ONBOARDING_STARTER_ASK` |
| User selection (no silent Gemini/Telegram) | `src/services/UserSelectionResolver.ts` + preference files under `data/runtime/` |
| Live user-provider harness | `src/services/agent-smartness/LiveUserProviderHarness.ts` |
| TTFU service | `src/services/agent-smartness/TimeToFirstUsefulWorkService.ts` |
| Autopilot capability selection (no silent gemini-cli) | `src/services/CapabilityAutopilotSelection.ts` |

## Status log

Full done/residual: [SESSION-STATUS-VALUE-AND-DYNAMIC.md](./SESSION-STATUS-VALUE-AND-DYNAMIC.md)

## Memory write-path (summary)

See full table in [concepts/memory.md](./concepts/memory.md#write-path-classification).

| Class | Examples |
|-------|----------|
| Silent ok | Empty-memory honest reply; working context reads |
| Draft-only | `autoExtract` default; `MemoryDraftStoreService` pending items |
| Promote / approval | `promoteMemoryDraft`; high-impact learning plane |
| Forbidden | Silent durable extract; invent recall; store raw secrets |

## Anti-claims

- Hermetic smartness is not a live LLM IQ leaderboard (`agent:smartness:check` ≠ live IQ).
- Live multi-step IQ needs credentials + `npm run agent:smartness:live -- --live`; only then may `claimsLiveIntelligence` be true.
- TTFU structural pass is not a measured under-3-minute claim (needs `--record` with provider preconfigured).
- Chat ready is not full platform certification.
- Day-1 eligibility is a product model; calendar R2 launch residual may still need operator evidence.
