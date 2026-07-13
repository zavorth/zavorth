# Agent permissions (standard model)

Zavorth uses the **same permission model as common coding agents (session / always / deny)** — not a custom “security product”.

## User-facing choices

| Choice | Meaning |
|--------|---------|
| **Run / Once** | Allow this time only |
| **Session** | Allow for this session (and soft workspace grant when safe) |
| **Always** | Remember for this tool/pattern (persisted) |
| **Deny** | Block (remembered for the session to avoid spam) |

No TOTP. No 6-digit codes. One clear decision path on **every** surface.

## Evaluation

```
safe / no approval needed     → allow
always rule match             → allow
session allow match           → allow
workspace temporary grant     → allow (up to grant risk)
else sensitive                → ask
session deny match            → deny
```

## Code

| Piece | Path |
|-------|------|
| Contract | `src/contracts/permission/AgentPermissionContract.ts` |
| Service | `src/services/permission/AgentPermissionService.ts` |
| Agent gateway | `ZavorthAgentGateway.approve({ choice })` |
| Desktop UI | Review + in-thread: Run · Session · Always · Deny |
| Persist always | `data/runtime/agent-permissions/always.json` |

## Surfaces

Desktop, experience API, Control, Telegram callbacks → same `choice` vocabulary (`once|session|always|deny`).
Adapters only render buttons; policy lives in `AgentPermissionService`.

### Clickable surfaces (confirmed)

Zavorth already has a **surface-agnostic response model**:

| Piece | Role |
|-------|------|
| `SurfaceResponse` + `SurfaceResponseAction` | Actions with `callbackData` / `command` |
| `renderSurfaceResponseForTarget(target)` | Telegram/Discord → native buttons; CLI/plain → text list |
| `replyWithTelegramSurfaceResponse` | Sends text + `inline_keyboard` when surface supports it |

Approval prompts are built with `buildAgentPermissionApprovalResponse()` so:

- **Telegram / Discord** → clickable Run once · Session · Always · Deny
- **CLI / chat-only** → same choices as slash commands in the message body

### Telegram callbacks

```
task:once:<taskId>
task:session:<taskId>
task:always:<taskId>
task:deny:<taskId>
```

Legacy still accepted: `task:approve:<id>` → once, `task:reject:<id>` → deny.

Slash (any surface):

```
/approve <taskId> once|session|always
/reject <taskId>
```


## Related friction reducers (yours)

- Workspace session grant / developer mode (`WorkspaceSessionGrantCache`)
- Trust workspace
- Skill consent (install path — separate from tool run permissions)
