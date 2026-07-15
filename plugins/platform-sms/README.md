# platform-sms

Soft-fail SMS channel plugin (Twilio-style). Reports
`TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` presence only — never values.
Outbound send uses Twilio Messages API when permission is granted.

## Env

| Variable                                     | Purpose              |
| -------------------------------------------- | -------------------- |
| `TWILIO_ACCOUNT_SID`                         | Account SID presence |
| `TWILIO_AUTH_TOKEN`                          | Auth token presence  |
| `TWILIO_FROM_NUMBER` / `TWILIO_PHONE_NUMBER` | Default From number  |

Presence is reported as booleans; SID/token values are never logged or returned.

## Capabilities

- `platform.sms.status` — tokenPresent / configured / sidPresent
- `platform.sms.send` — soft send via Twilio REST

### Send input

```json
{ "to": "+15555559876", "text": "Hello from Zavorth", "from": "+15555550123" }
```

## Permissions

- `network.external` (requested before send)
- `channel.send`
- `secret.read` (optional; presence detection)

## Channel binding

Registers channel id `sms` via `ctx.registerPlatform` when available,
otherwise `ctx.bindChannel`.

## Receipts

- `platform-sms.receipt` on successful send
