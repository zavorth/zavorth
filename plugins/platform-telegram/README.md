# platform-telegram

Soft-fail Telegram Bot API channel plugin. Reports token presence only — never
token values. Outbound send uses HTTPS `api.telegram.org` when permission is
granted.

## Env

- `TELEGRAM_BOT_TOKEN` or `TELEGRAM_TOKEN` (required for send)
- Presence is reported as a boolean; values are never logged or returned

## Capabilities

- `platform.telegram.status` — token presence + setup hints
- `platform.telegram.send` — soft send via Bot API `sendMessage`

### Send input

```json
{ "chatId": "123456789", "text": "Hello from Zavorth" }
```

Aliases: `chat_id`, `message` / `body` / `content` for text.

## Permissions

- `network.external` (requested before send)
- `channel.send`
- `secret.read` (optional; presence detection)

## Channel binding

Registers channel id `telegram` via `ctx.registerPlatform` when available,
otherwise `ctx.bindChannel`.

## Receipts

- `platform-telegram.receipt` on successful send
