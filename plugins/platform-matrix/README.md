# platform-matrix

Soft-fail Matrix Client-Server API channel plugin. Reports homeserver + access
token presence only — never values. Outbound send uses HTTPS Matrix CS API when
permission is granted.

## Env

- `MATRIX_HOMESERVER` or `MATRIX_BASE_URL` (required)
- `MATRIX_ACCESS_TOKEN` (required)
- `MATRIX_DEFAULT_ROOM_ID` (optional default room)

Presence is reported as booleans; values are never logged or returned.

## Capabilities

- `platform.matrix.status` — configured / tokenPresent + setup hints
- `platform.matrix.send` — soft send via `PUT /_matrix/client/v3/rooms/{roomId}/send/...`

### Send input

```json
{ "roomId": "!abc:example.com", "text": "Hello from Zavorth" }
```

Aliases: `room_id` / `room` / `to` for room; `message` / `body` / `content` for text.

## Permissions

- `network.external` (requested before send)
- `channel.send`
- `secret.read` (optional; presence detection)

## Channel binding

Registers channel id `matrix` via `ctx.registerPlatform` when available,
otherwise `ctx.bindChannel`.

## Receipts

- `platform-matrix.receipt` on successful send
