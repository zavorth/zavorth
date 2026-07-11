# Value program baseline

Baseline for the Value Waves program (`WAVES-VALUE-INTELLIGENCE-HABIT.md`).

## Metrics

| Metric | Target | How measured |
|--------|--------|----------------|
| Agent smartness missions | 100% pass hermetic | `npm run agent:smartness:check` |
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
| Memory | autoExtract no longer silently promotes |
| Continuity | `DailyReturnContinuityService` |
| First-win desktop ask | `DESKTOP_ONBOARDING_STARTER_ASK` |

## Anti-claims

- Hermetic smartness is not a live LLM IQ leaderboard.
- Chat ready is not full platform certification.
- Day-1 eligibility is a product model; calendar R2 launch residual may still need operator evidence.
