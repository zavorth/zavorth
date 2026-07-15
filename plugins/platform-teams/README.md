# platform-teams

Soft-fail Microsoft Teams channel plugin. Reports webhook / credential presence
only — never values. Soft send posts to an incoming webhook when permission is
granted (app-cred path is a soft stub).

## Env

| Variable                                              | Purpose                                 |
| ----------------------------------------------------- | --------------------------------------- |
| `TEAMS_WEBHOOK_URL`                                   | Preferred incoming webhook URL presence |
| `MICROSOFT_TEAMS_WEBHOOK_URL` / `MSTEAMS_WEBHOOK_URL` | Alternate webhook names                 |
| `TEAMS_APP_ID` / `MICROSOFT_TEAMS_APP_ID` + secret    | App credentials presence                |

Presence is reported as booleans; webhook URLs and secrets are never returned.

## Capabilities

- `platform.teams.status` — tokenPresent / configured + setup hints
- `platform.teams.send` — soft webhook POST or app-creds stub

### Send input

```json
{ "text": "Hello from Zavorth", "title": "Optional title" }
```

## Permissions

- `network.external` (requested before send)
- `channel.send`
- `secret.read` (optional; presence detection)

## Channel binding

Registers channel id `teams` via `ctx.registerPlatform` when available,
otherwise `ctx.bindChannel`.

## Receipts

- `platform-teams.receipt` on accepted send
