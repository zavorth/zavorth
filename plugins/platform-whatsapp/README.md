# platform-whatsapp

Wave 2 platform pack — soft-fail **WhatsApp Cloud API** channel for outbound text messages.

## Why it exists

WhatsApp is a common agent messaging surface. This plugin wraps Meta's Cloud API with Plugin OS channel bindings, approval-gated network access, and secret-safe status (presence only).

## Capabilities

| Capability | Usage |
|------------|--------|
| `platform.whatsapp.status` | `{}` — token + phone number id **presence** (never values) |
| `platform.whatsapp.send` | `{ to\|phone, text\|message\|body, phoneNumberId? }` |

Channel binding: `id: whatsapp` → `platform.whatsapp.send`.

## Env (optional)

| Variable | Purpose |
|----------|---------|
| `WHATSAPP_TOKEN` | Preferred Cloud API access token |
| `WHATSAPP_CLOUD_TOKEN` | Alternate token name |
| `META_WHATSAPP_TOKEN` | Alternate token name |
| `WHATSAPP_PHONE_NUMBER_ID` | Default phone number id for `/messages` |

Status reports presence only — tokens and ids are never returned.

## Send behavior

- Soft-fail if token or phone number id is missing
- Requests `network.external` before any HTTPS call
- `POST https://graph.facebook.com/v19.0/{phoneNumberId}/messages`
- Body: `{ messaging_product: "whatsapp", to, type: "text", text: { body } }`
- `phoneNumberId` may be passed per-call; otherwise uses env

## Safety

- Never logs or returns token values
- Soft-fail on missing config, denied permission, or API errors
- Requires approval / `network.external` for live send

## Enable

```bash
zavorth plugins enable platform-whatsapp --yes
```
