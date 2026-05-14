# WebSocket Protocol v1

Status: **experimental**.

REST v1 is the canonical public API. WebSocket support is reserved for streaming, live cockpit updates and future interactive clients.

## Envelope

```json
{
  "id": "req-123",
  "type": "command.request",
  "payload": {}
}
```

## Event Types

- `runtime.status`;
- `message.created`;
- `mission.updated`;
- `approval.request`;
- `tool.updated`;
- `receipt.ready`;
- `snapshot.updated`;
- `heartbeat`;
- `error`.

The same event names are used by the canonical SSE projection at
`GET /api/v1/events?stream=true`.

## Compatibility

The WebSocket surface should remain versioned and should not replace REST for stable integrations until it is explicitly promoted.

Recommended path today:

- REST v1: [/docs/protocol/rest-v1.md](/docs/protocol/rest-v1.md);
- TypeScript/Python clients: [/docs/protocol/sdk-usage.md](/docs/protocol/sdk-usage.md).
