# Zavorth Desktop — Surface Parity Matrix

**Trust & Ship + daily path**
Goal: make Desktop the daily surface with honest readiness, receipts, and a non-dev install path.

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Ready on Desktop for daily use |
| 🟡 | Partial / local-first / needs runtime projection |
| ❌ | Not on Desktop yet (use CLI or `/control`) |

## Feature matrix

| Capability | Desktop | Web `/control` | CLI | Notes |
|------------|---------|----------------|-----|-------|
| Chat / ask | ✅ | ✅ | ✅ | Desktop is intended daily surface |
| Approvals | ✅ | ✅ | ✅ | Review hub + sidebar badge + modals |
| Approvals in-thread | ✅ | 🟡 | 🟡 | `InThreadApprovalCard` + activity strip in chat |
| Receipts / proof | ✅ | 🟡 | ✅ | Desktop local ledger + snapshot merge + Proof timeline |
| Memory | ✅ | ✅ | ✅ | Forget/update + encryption actions |
| Providers setup | ✅ | ✅ | ✅ | Onboarding + settings; readiness badges |
| Channels doctor | 🟡 | ✅ | ✅ | Setup/test wired; doctor depth varies |
| Skills list | ✅ | ✅ | ✅ | From runtime tools panel |
| Marketplace install | 🟡 | ✅ | ✅ | Desktop hits `/api/marketplace/skills` when available |
| Workboard | 🟡 | 🟡 | ❌ | Local board + optional runtime projection |
| Files browse/attach | ✅ | 🟡 | ✅ | Trusted folders only |
| Terminal multi-tab | ✅ | ❌ | ✅ | Multi-tab chrome + agent activity banner; live PTY still needs runtime session |
| Terminal / PTY live | 🟡 | ❌ | ✅ | Logs + PTY tabs; PTY needs runtime session |
| Automations / cron | 🟡 | 🟡 | ✅ | Desktop automations bridge when present |
| Agents / subagents | 🟡 | 🟡 | ✅ | Desktop local list + runtime hooks |
| Agents strip | 🟡 | 🟡 | ❌ | Panel + activity affordances; not a full multi-agent strip yet |
| Profiles | ✅ | 🟡 | ✅ | Experience profiles + custom prompts |
| Analytics | 🟡 | ✅ | 🟡 | Panel present; needs runtime usage data |
| Voice dictation | ✅ | 🟡 | ❌ | Mic + Ctrl+Shift+Space hotkey |
| Voice companion (agent/) | 🟡 | ❌ | ❌ | Start/status from Settings; tray/wake-word process when agent package present |
| Wake word companion | ❌ | ❌ | ❌ | `agent/` companion still separate |
| Install / update UI | ✅ | ❌ | ✅ | Check / download / defer / install via Setup / rollback info + optional manifest URL |
| Notifications | ✅ | ❌ | ❌ | Approval / run done / offline |
| Telemetry (local opt-in) | ✅ | ❌ | ❌ | No prompt/secret export |
| Workboard runtime sync | 🟡→✅ hybrid | 🟡 | ❌ | Local board + runtime projection merge + push mutations via runtime-state action |

## Desktop agent surfaces

Surfaces that make Desktop feel like an agent IDE (chat-first, trust-aware):

| Surface | Status | Where |
|---------|--------|-------|
| Status stack | ✅ | `composer/composerStatus` + `ComposerStatusStack` |
| Plan card | ✅ | `thread/planCard` + `PlanCardView` |
| Open-from-chat | ✅ | `thread/openFromChat` + `ToolCallBlock` → right rail |
| Queue | ✅ | `composer/composerQueue` + shell auto-dequeue |
| Session chrome | ✅ | `session/sessionChrome` + sidebar menu |
| Review ship bar | ✅ | `shell/reviewRailModel` + git right rail |
| Hunk approval | 🟡 | Diff rail / review model present; per-hunk decisions still thinner than `/control` |
| Trusted operator | 🟡 | Onboarding hint + settings; topbar badge path partial |
| Run timeline | 🟡 | Proof timeline + inline activity; full run timeline still evolving |
| Agent strip | 🟡 | Agents panel + terminal agent activity; dedicated strip partial |
| CC wizards | 🟡 | Command Center domain hero cards + channel setup wizard |

## Readiness contract (product rule)

Catalog support ≠ live readiness.

Desktop labels:

- **Live ready** — proven connected / tested
- **Needs setup** — configurable but incomplete
- **Available** — catalog only
- **Blocked** — policy or error

## Non-dev path (target)

1. Install **Zavorth Setup** (Tauri)
2. Setup installs/updates local runtime + prepares token
3. Open **Zavorth Desktop**
4. First-run onboarding if needed
5. Daily: chat → plan → approve risk → receipt

## Remaining optional gaps

- Full silent auto-update with signed packages (needs productized release CDN + code signing)
- Full wake-word DSP inside Desktop (companion process remains the tray agent)
- Perfect 1:1 visual parity with every `/control` ops page
- Channels doctor depth parity with `/control`
- Full multi-agent strip and per-hunk review depth

## Definition of done for Trust & Ship + partials fix

- [x] Receipts panel exists and records local proof
- [x] Readiness classification helpers + UI usage
- [x] Runtime offline banner with Start / Repair / Setup / Logs
- [x] Native notifications for high-value events
- [x] Update check / download / defer / install / rollback surface
- [x] Local telemetry opt-in (no prompts)
- [x] Workboard hybrid sync (local + runtime projection + push)
- [x] Voice hotkey + companion start/status bridge
- [x] Smoke journey covers receipts, workboard, updates, voice affordance
- [x] This parity matrix documented
- [x] Approvals in-thread on daily chat path
- [x] Terminal multi-tab chrome on Desktop
