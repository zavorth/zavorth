# platform-slack

Soft-fail Slack Web API channel plugin. Reports token presence only — never
token values. Outbound send uses HTTPS `slack.com/api/chat.postMessage` when
permission is granted.

## Env

- `SLACK_BOT_TOKEN` or `SLACK_TOKEN` (required for send)
- Presence is reported as a boolean; values are never logged or returned

## Capabilities

- `platform.slack.status` — token presence + setup hints
- `platform.slack.send` — soft send via Slack `chat.postMessage`

### Send input

```json
{ "channel": "C01234567", "text": "Hello from Zavorth" }
```

Aliases: `channelId` / `channel_id` / `to` for channel; `message` / `body` / `content` for text.

## Permissions

- `network.external` (requested before send)
- `channel.send`
- `secret.read` (optional; presence detection)

## Channel binding

Registers channel id `slack` via `ctx.registerPlatform` when available,
otherwise `ctx.bindChannel`.

## Receipts

- `platform-slack.receipt` on successful send
