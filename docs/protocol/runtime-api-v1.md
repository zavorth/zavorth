# Runtime API v1

Runtime API v1 is the stable local contract for GUI surfaces such as the Web
ZavorthControl, future Desktop/Tauri clients and mobile control clients.

The rule is simple: visual clients can observe, request and approve through
this API, but they do not become execution runtimes. Mutations stay inside the
governed Zavorth runtime and must pass through the Policy Broker.

## Envelope

All canonical GUI endpoints return:

```json
{
  "ok": true,
  "data": {},
  "error": null,
  "traceId": "api_..."
}
```

Errors use the same envelope with `ok: false`, `data: null`, a structured
`error.code` and a `traceId`.

## Core Endpoints

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| `GET` | `/api/v1/status` | Runtime status, version, gateway and health summary. | public |
| `GET` | `/api/v1/health` | Fast or live operational health. | public |
| `GET` | `/api/v1/providers` | Provider Mesh projection with honest readiness. | token |
| `GET` | `/api/v1/channels` | Channel Mesh projection with actions and setup state. | token |
| `GET` | `/api/v1/approvals` | Pending or historical approvals. | token |
| `GET` | `/api/v1/receipts` | Visual receipt projection. | token |
| `GET` | `/api/v1/missions` | Mission projection for active or previewed work. | token |
| `POST` | `/api/v1/chat` | Creates a mission preview by default; live submission requires explicit `live: true`. | token |
| `GET` | `/api/v1/events` | Canonical runtime events or SSE stream when `stream=true`. | token |

## Governed Actions

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/approvals/:id/approve` | Applies a scoped approval decision. |
| `POST` | `/api/v1/approvals/:id/deny` | Denies a scoped approval decision. |
| `POST` | `/api/v1/missions/:id/cancel` | Requests cancellation through the supervised runtime. |
| `POST` | `/api/v1/providers/:id/test` | Runs a provider preview probe, or a live probe only when explicitly confirmed. |
| `POST` | `/api/v1/channels/:id/action` | Executes read-safe channel actions, or blocks sensitive actions until confirmed. |

Every governed action returns a `governed-action-v1` payload with a policy
receipt and these safety guarantees:

- `controllerMutatedDirectly: false`
- `policyBrokerEvaluated: true`
- `rawSecretsSerialized: false`

## ZavorthControl Adapter

The Web ZavorthControl uses internal web-safe routes as a thin adapter over Runtime
API v1:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/web/zavorthControl/contracts-v1` | Reads the canonical Runtime API v1 projection for the current zavorthControl context. |
| `GET` | `/api/web/zavorthControl/events-v1` | Reads canonical Runtime API v1 events for the active session. |
| `GET` | `/api/web/zavorthControl/gui-readiness-v1` | Reads daily-use GUI readiness for future visual clients. |
| `POST` | `/api/web/zavorthControl/chat-v1` | Delegates mission preview and explicit live chat submission to Runtime API v1. |
| `POST` | `/api/web/zavorthControl/actions` | Delegates approval, mission, provider and channel actions to Runtime API v1. |

These routes exist so browser UI code does not need direct access to internals
or raw API tokens. They do not execute work themselves. They delegate to
`CanonicalPublicApiService`, and mutable work still returns governed action
receipts.

The zavorthControl does not execute actions by itself. It only displays state,
submits requests and renders decisions while the governed runtime performs all
execution checks.

## Mission And Chat

The ZavorthControl mission composer is preview-first:

- `Preview mission` sends `{ "live": false }` to `/api/web/zavorthControl/chat-v1`.
- `Submit live` sends `{ "live": true }` explicitly, but the response may still be `approval_required`, `dry_run_only` or `blocked`.
- Mission rows are read from Runtime API v1 contracts before legacy task snapshots.
- Mission cancellation uses `/api/web/zavorthControl/actions` with `action: "mission.cancel"`.

The chat response includes the mission, visual receipt and a `flow` block. The
flow block tells clients whether preview-first was enforced, whether an
approval gate exists and which canonical events to watch: `mission.updated`,
`approval.request` and `receipt.ready`.

## Events

Canonical event types:

- `runtime.status`
- `message.created`
- `mission.updated`
- `approval.request`
- `tool.updated`
- `receipt.ready`
- `snapshot.updated`
- `heartbeat`
- `error`

The intended approval flow for GUI clients is:

1. Receive `approval.request`.
2. Show a human-readable preview and risk.
3. Call the approve or deny endpoint.
4. Continue observing events until `receipt.ready`.

## Approval And Receipt UX

ZavorthControl surfaces should render approvals as an inbox, not as raw permission
rows. `GET /api/v1/approvals` returns both raw permission records and an
`approvalCards` projection for user-facing decisions.

Each card should show:

- scoped approval id;
- risk;
- policy;
- declared files or target;
- approve once, deny, preview, rollback and receipt actions.

Receipts should be shown as readable cards with status, summary and
rollback state. `GET /api/v1/receipts` returns a `trustUx` projection as well,
so clients can render the same simple/advanced trust language without
reinterpreting raw receipts.

Approving an approval does not execute the target action directly. The target
action still has to pass the runtime gate, policy and receipt flow.

## Provider And Channel Readiness

ZavorthControl provider and channel panels should prefer Runtime API v1 contracts:

- provider rows from `/api/v1/providers`;
- provider live-readiness matrix from `/api/v1/providers.data.readinessMatrix`;
- channel rows from `/api/v1/channels`;
- provider tests delegated through `/api/web/zavorthControl/actions` with `action: "provider.test"`;
- channel actions delegated through `/api/web/zavorthControl/actions` with `action: "channel.action"`.

The panels must render readiness honestly. A listed provider or channel is not
ready unless the contract says it is ready. Catalog support is not live readiness.
Default routing requires live readiness and `defaultRouteAllowed: true`.

Preview tests are safe. Live provider probes and sensitive channel actions
still require explicit confirmation and Policy Broker receipts.

## Subagents, Skills, Scheduler And Perception

Runtime API v1 exposes these capabilities as governed projections:

- `subagents.spawn` is available for explicit read-only requests and emits receipts.
- live subagent workers are limited by role, depth, children, tools, cost and policy.
- natural invocation can route to subagents, skills or sandbox lifecycle plans.
- imported and first-party skills are instruction-only by default.
- support files in imported skills are not executable tools.
- scheduled tasks may run only through governed scheduler scope and the Execution Gateway.
- PC, browser and Android perception may be routed naturally for read-only context.
- browser control, Android tap/type/install/uninstall and terminal automation remain approval-gated.
- visual artifacts are redacted and carried by receipt-safe references.

## ZavorthControl And CLI Surface Rules

`/control` is the only user-facing web surface for daily operation. It is a
projection and request surface, not an executor:

- the first screen starts with the operator greeting and mission composer;
- readiness is summarized, not turned into a wall of diagnostics;
- approvals, receipts and the mission timeline appear as compact daily-use sections;
- advanced runtime details stay collapsed by default;
- maintenance shells are not linked from the normal zavorthControl flow;
- mutable execution stays in the governed runtime.

The CLI is the official terminal surface for onboarding, diagnostics, missions,
receipts, schedules, skills, agents, providers and channels. CLI projections do
not execute mutations by themselves. Writes, network, device control and live
channel actions stay inside the governed runtime and Policy Broker path.

## Daily-Use GUI Readiness

Daily-use GUI readiness covers status, health, providers, channels, approvals, receipts, missions, chat, events and governed actions.

Use these checks when changing Runtime API v1 or the user-facing runtime path:

```bash
npm run runtime-api-v1:check
npm run daily:certify --silent
npm run runtime:check
npm run security:secrets
```

The checks verify:

- canonical v1 endpoint envelopes;
- approval request to approval decision to receipt readiness flow;
- provider and channel readiness honesty;
- policy denial for sensitive actions;
- chat creating a traceable mission preview without live execution by default;
- live chat being blocked until approval, sandbox and policy state allow it;
- `/control`, CLI and API projecting the same governed runtime truth.
