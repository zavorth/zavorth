# REST Protocol v1

REST v1 is the preferred public integration surface for external clients.

## Base URL

Local default:

```text
http://127.0.0.1:33333
```

## Principles

- expose stable product contracts, not internal controllers;
- keep responses JSON-serializable;
- include honest readiness rather than false success;
- require policy and approval for sensitive actions;
- preserve correlation identifiers where possible.

## Common Endpoints

```text
GET /api/v1/status
GET /api/v1/health
GET /api/v1/providers
GET /api/v1/channels
GET /api/v1/approvals
GET /api/v1/receipts
GET /api/v1/missions
POST /api/v1/chat
GET /api/v1/events
POST /api/v1/approvals/:id/approve
POST /api/v1/approvals/:id/deny
POST /api/v1/missions/:id/cancel
POST /api/v1/providers/:id/test
POST /api/v1/channels/:id/action
```

Endpoint availability depends on the runtime profile and enabled surfaces.

## Canonical Envelope

New `/api/v1/*` product endpoints return the same envelope shape:

```json
{
  "ok": true,
  "data": {},
  "error": null,
  "traceId": "api_..."
}
```

Sensitive collections such as providers, channels, approvals, receipts, missions and chat require public API authentication. Status and health stay public because they do not expose secrets or execution authority.

`POST /api/v1/chat` is preview-first. It creates a mission projection by default and only submits to the live web conversation runtime when the caller explicitly sets `live: true` or `execute: true`.

`GET /api/v1/events` returns a snapshot envelope by default. Use `?stream=true` or `Accept: text/event-stream` for canonical SSE events:

```text
runtime.status
message.created
mission.updated
approval.request
tool.updated
receipt.ready
snapshot.updated
heartbeat
error
```

Event payloads are projection-only. Approval cards and desktop clients must call the governed approval APIs for decisions; they must not execute actions directly from an event.

## Governed Action APIs

Action endpoints return `surface: "governed-action-v1"` inside the canonical envelope. Controllers do not mutate runtime state directly. They evaluate the request with the Policy Broker, delegate to the owning service when allowed, and return a receipt for the decision.

```text
POST /api/v1/approvals/:id/approve
POST /api/v1/approvals/:id/deny
POST /api/v1/missions/:id/cancel
POST /api/v1/providers/:id/test
POST /api/v1/channels/:id/action
```

Examples:

```json
{ "note": "Looks safe." }
```

```json
{ "live": true, "approved": true }
```

```json
{ "actionId": "status" }
```

Sensitive channel actions and live provider probes can return `status: "needs_approval"` instead of executing. A future GUI should render that state as an approval card, not retry hidden mutations.

## ZavorthControl Adapter

The web ZavorthControl has a stable contract adapter at:

```text
GET /api/web/zavorthControl/contracts-v1
```

The same contract is also embedded in `GET /api/web/zavorthControl` as `contractsV1`. It mirrors runtime, health, providers, channels, approvals, receipts and missions from the canonical `/api/v1/*` projections. The adapter is projection-only and has no execution authority; action buttons must call the governed action APIs above.

## Error Shape

Errors should be machine-readable and human-explainable:

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "policy_denied",
    "message": "The requested action requires approval.",
    "details": {}
  },
  "traceId": "api_..."
}
```

## Security

Clients must not send raw provider keys, channel tokens or personal secrets in normal request bodies. Prefer references, local secure storage and approval flows.

Sensitive requests should be evaluated by the Policy Broker before execution.
