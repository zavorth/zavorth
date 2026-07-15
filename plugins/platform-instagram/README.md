# platform-instagram

Soft-fail Instagram channel plugin. Reports `INSTAGRAM_*` token presence only —
never values. Soft send is permission-gated.

## Env

| Variable                                                                     | Purpose                     |
| ---------------------------------------------------------------------------- | --------------------------- |
| `INSTAGRAM_ACCESS_TOKEN` / `INSTAGRAM_TOKEN` / `INSTAGRAM_PAGE_ACCESS_TOKEN` | Token presence              |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` / `INSTAGRAM_ACCOUNT_ID`                     | Account presence (optional) |

Presence is reported as booleans; values are never logged or returned.

## Capabilities

- `platform.instagram.status` — tokenPresent / configured
- `platform.instagram.send` — soft send (requests `network.external`)

### Send input

```json
{ "to": "1784...", "text": "Hello from Zavorth" }
```

## Permissions

- `network.external` (requested before send)
- `channel.send`
- `secret.read` (optional; presence detection)

## Channel binding

Registers channel id `instagram` via `ctx.registerPlatform` when available,
otherwise `ctx.bindChannel`.

## Receipts

- `platform-instagram.receipt` when soft send is accepted
