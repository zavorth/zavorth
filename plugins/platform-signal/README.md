# platform-signal

Soft-fail Signal channel plugin. Reports `SIGNAL_*` transport/token presence
only — never values. Soft send is permission-gated.

## Env

| Variable                                                       | Purpose              |
| -------------------------------------------------------------- | -------------------- |
| `SIGNAL_ACCOUNT_NUMBER`                                        | Bot account presence |
| `SIGNAL_JSONRPC_URL` / `SIGNAL_CLI_PATH` / `SIGNAL_BRIDGE_URL` | Transport presence   |
| `SIGNAL_BRIDGE_TOKEN` / `SIGNAL_TOKEN` / `SIGNAL_ACCESS_TOKEN` | Token presence       |

Presence is reported as booleans; values are never logged or returned.

## Capabilities

- `platform.signal.status` — tokenPresent / configured + setup hints
- `platform.signal.send` — soft send (requests `network.external` or `channel.send`)

### Send input

```json
{ "to": "+15555559876", "text": "Hello from Zavorth" }
```

## Permissions

- `network.external` (requested before send)
- `channel.send`
- `secret.read` (optional; presence detection)

## Channel binding

Registers channel id `signal` via `ctx.registerPlatform` when available,
otherwise `ctx.bindChannel`.

## Receipts

- `platform-signal.receipt` when soft send is accepted
