# Node Mesh Live Native

Zavorth Node Mesh lets desktop, mobile, browser and headless companions pair with the local runtime, publish live heartbeats, receive governed work and return receipts without bypassing policy.

## What Is Live Now

- `LiveNodeRegistryService` keeps the in-memory live session map and recent event stream.
- `NodeHeartbeatService` records pairing claims, heartbeats, completed work and capability drift.
- `NodeCapabilityReapprovalService` blocks a paired node when it declares a new capability that was not previously approved.
- `NodeInvokeService` queues work for paired nodes and emits live delivery events.
- `nodes` is a native LLM tool for listing, describing, previewing and queueing governed node work.
- Dashboard exposes live state through:
  - `GET /api/node-mesh/live/snapshot`
  - `GET /api/node-mesh/live/events`
  - `POST /api/node-mesh/live/disconnect`
- Live dashboard endpoints require the Dashboard token or JWT. EventSource clients may pass `?token=<dashboard-token>` because native EventSource cannot set custom headers.

## Safety Rules

- Pairing and live heartbeats never serialize shared secrets.
- New capability declarations require reapproval before more work is delivered.
- Node invocations remain queued/governed work. They are not direct host execution.
- Delivery receipts are emitted for queue and completion events.
- Live session state is memory-only. Durable state stays in the Node Mesh registry and invocation store.

## Local Companion

Start the runtime:

```bash
zavorth start
```

Create or inspect a pairing draft through the CLI/dashboard, then launch a local host:

```bash
npm run nodes:host -- --passcode "<node-id>:<pairing-code>" --base-url http://127.0.0.1:18789 --node-id "<node-id>"
```

For the packaged companion wrapper:

```bash
npm run companion:start -- --passcode "<node-id>:<pairing-code>" --base-url http://127.0.0.1:18789 --node-id "<node-id>"
```

## LLM Tool Usage

The native tool is named `nodes`.

Safe awareness:

```json
{ "action": "live" }
```

Preview a governed invocation:

```json
{
  "action": "preview",
  "nodeId": "desktop-node",
  "capabilityId": "files.read",
  "nodeAction": "inspect",
  "payloadJson": "{\"path\":\"README.md\"}"
}
```

Queue governed work:

```json
{
  "action": "invoke",
  "nodeId": "desktop-node",
  "capabilityId": "files.read",
  "nodeAction": "inspect",
  "payloadJson": "{\"path\":\"README.md\"}"
}
```

## Capability Reapproval Flow

1. A node pairs with approved capabilities, for example `files.read`.
2. Later it heartbeats with `files.read` plus `screen.capture`.
3. Zavorth blocks the node, records a reapproval-required event and stops delivery.
4. The operator approves the new allowlist through the Node Mesh capability UI/API.
5. The node can receive work again only within the approved capability set.

## Tests

Focused tests:

```bash
npx jest tests/services/LiveNodeRegistryService.test.ts tests/services/NodeCapabilityReapprovalService.test.ts tests/tools/NodeMeshTool.test.ts tests/services/NodeHeartbeatService.test.ts tests/services/NodeInvokeService.test.ts --runInBand
```

Runtime check:

```bash
npm run runtime:check --silent
```
