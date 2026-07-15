# platform-email

Soft-fail email / SMTP channel plugin. Reports `EMAIL_*` / `SMTP_*` presence
only — never secret values. Outbound send is a **permission-gated soft stub**.

## Env

| Variable                        | Purpose                           |
| ------------------------------- | --------------------------------- |
| `EMAIL_SMTP_HOST` / `SMTP_HOST` | SMTP hostname presence            |
| `EMAIL_SMTP_USER` / `SMTP_USER` | SMTP user presence                |
| `EMAIL_SMTP_PASS` / `SMTP_PASS` | SMTP password presence            |
| `EMAIL_API_KEY` / `EMAIL_TOKEN` | Optional alternate token presence |

Status reports booleans only; values are never logged or returned.

## Capabilities

- `platform.email.status` — configured / tokenPresent + setup hints
- `platform.email.send` — soft send stub (requests `network.external` or `channel.send`)

### Send input

```json
{ "to": "you@example.com", "subject": "Hello", "text": "From Zavorth" }
```

## Permissions

- `network.external` (requested before send)
- `channel.send` (fallback permission request)
- `secret.read` (optional; presence detection)

## Channel binding

Registers channel id `email` via `ctx.registerPlatform` when available,
otherwise `ctx.bindChannel`.

## Receipts

- `platform-email.receipt` when the soft stub accepts a send
