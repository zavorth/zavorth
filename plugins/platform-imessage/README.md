# platform-imessage

Soft-fail iMessage / mac-bridge channel plugin. Soft **status** is primary;
send is a permission-gated stub. Reports `IMESSAGE_*` presence only — never
token or script path secret values.

## Env

| Variable                                                              | Purpose              |
| --------------------------------------------------------------------- | -------------------- |
| `IMESSAGE_ENABLED`                                                    | Enable flag presence |
| `IMESSAGE_BRIDGE_MODE`                                                | e.g. `mac-bridge`    |
| `IMESSAGE_BRIDGE_URL` / `IMESSAGE_BRIDGE_SCRIPT` / `IMESSAGE_NODE_ID` | Bridge presence      |
| `IMESSAGE_BRIDGE_TOKEN` / `IMESSAGE_TOKEN`                            | Token presence       |

Presence is reported as booleans; values are never logged or returned.

## Capabilities

- `platform.imessage.status` — tokenPresent / configured / macBridge hints
- `platform.imessage.send` — soft send stub (requests permission)

### Send input

```json
{ "to": "+15555550123", "text": "Hello from Zavorth" }
```

## Permissions

- `network.external` (requested before send)
- `channel.send`
- `secret.read` (optional; presence detection)

## Channel binding

Registers channel id `imessage` via `ctx.registerPlatform` when available,
otherwise `ctx.bindChannel`.

## Receipts

- `platform-imessage.receipt` when soft send is accepted
