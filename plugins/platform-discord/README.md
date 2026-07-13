# platform-discord (Wave 2)

Soft-fail Discord Bot REST channel plugin. Reports token presence only — never
token values. Outbound send uses HTTPS `discord.com/api/v10` when permission is
granted.

## Env

- `DISCORD_BOT_TOKEN` (required for send)
- Presence is reported as a boolean; values are never logged or returned

## Capabilities

- `platform.discord.status` — token presence + setup hints
- `platform.discord.send` — soft send via Discord REST `POST /channels/{id}/messages`

### Send input

```json
{ "channelId": "123456789012345678", "content": "Hello from Zavorth" }
```

Aliases: `channel_id`, `text` / `message` / `body` for content.

## Permissions

- `network.external` (requested before send)
- `channel.send`
- `secret.read` (optional; presence detection)

## Channel binding

Registers channel id `discord` via `ctx.registerPlatform` when available,
otherwise `ctx.bindChannel`.

## Receipts

- `platform-discord.receipt` on successful send
