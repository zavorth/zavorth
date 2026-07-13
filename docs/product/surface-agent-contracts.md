# Surface agent contracts (all surfaces equal)

**No surface is product-primary.** Telegram, Desktop, Control, CLI, Discord, web, API, and future channels are adapters over the same three contracts.

Contract version: `2026-07-13.surface-agent-contracts-v1`

## Contracts

| Id | Name | Rule |
|----|------|------|
| **C1** | Power action | Free text → agent + tools. Slash/callbacks stay deterministic. |
| **C2** | High-risk trust | High-risk never auto-approves. **Simple explicit Approve** (one click) + receipt. **No TOTP / 6-digit codes.** Temporary grants / reduced friction stay as separate product systems. |
| **C3** | Skill extend | Preview → consent → apply → receipt. `force` is operator-gated. |

## Code

| Piece | Path |
|-------|------|
| Types | `src/contracts/surface/SurfaceAgentContract.ts` |
| Evaluation | `src/services/surface/SurfaceAgentContractService.ts` |
| Agent-first routing | `src/domain/surface/presentation/shared-surface/SurfaceAgentFirstMode.ts` |
| High-risk gate | `src/services/HighRiskConfirmationService.ts` (`assertApprovalGate`) |
| Task approve (all surfaces) | `src/orchestrator/ApprovalManager.ts` |
| Permission approve (API/Desktop) | `src/services/PermissionService.ts` |
| Presentation decide (CLI/UI) | `src/services/approval/ApprovalPresentationService.ts` |
| Shared adapter helper | `src/services/surface/SurfaceApprovalGate.ts` |
| Desktop experience approvals | `ExperienceCoreService` → `ZavorthAgentGateway.approve` |
| Desktop host commands HIGH/CRITICAL | `HostCommandApprovalService.resolve` |
| Skill pipeline | `src/services/SkillInstallPipelineService.ts` |

## Env

| Variable | Effect |
|----------|--------|
| *(unset)* | Agent-first **ON** for every surface |
| `ZAVORTH_SURFACE_AGENT_FIRST=0` | Agent-first **OFF** globally |
| `ZAVORTH_TELEGRAM_AGENT_FIRST=0` | Agent-first **OFF** on Telegram only |
| `ZAVORTH_SKILL_ALLOW_FORCE=1` | Allows skill install `force` (operator) |
| `ZAVORTH_SKILL_OPERATOR_MODE=1` | Operator mode (force / sign / trust mutations) |


## Tests

```bash
npx jest tests/contracts/SurfaceAgentContract.test.ts \
  tests/services/SurfaceAgentContractService.test.ts \
  tests/security/SurfaceAgentContract.security-audit.test.ts \
  tests/integration/SurfaceAgentContract.user-journey.test.ts \
  tests/domain/surface/SurfaceAgentFirstMode.test.ts \
  --forceExit --testPathIgnorePatterns=[] --runInBand
```

## Adapter note

Challenge **delivery** (Telegram force_reply, Desktop modal, CLI prompt) may differ.
**Policy** (must approve, never auto-approve high-risk, consent for install) must not.
