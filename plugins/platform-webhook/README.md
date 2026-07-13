# platform-webhook

Wave 2 platform pack — soft-fail generic **HTTPS outbound webhook** channel (Slack-style or raw JSON).

## Why it exists

Many integrations are “just POST JSON somewhere.” This channel wraps a configured webhook URL (or a safe per-call override) with Plugin OS channel bindings, SSRF checks, and secret-safe status.

## Capabilities

| Capability | Usage |
|------------|--------|
| `platform.webhook.status` | `{}` — webhook URL **presence** (never the URL value) |
| `platform.webhook.send` | `{ text, title?, severity?, payload?, url? }` |

Channel binding: `id: webhook` → `platform.webhook.send`.

## Env (optional)

| Variable | Purpose |
|----------|---------|
| `ZAVORTH_PLATFORM_WEBHOOK_URL` | Preferred default HTTPS webhook |
| `PLATFORM_WEBHOOK_URL` | Alternate env name |

Status reports presence only — URLs are never returned.

## Send behavior

- Soft-fail if no configured URL and no `input.url`
- Requests `network.external` before any HTTPS call
- POST JSON: `{ text, title?, severity?, ...payload? }`
- `input.url` override accepted **only** when HTTPS and not private/localhost (SSRF-safe)

## SSRF rules

Copied in spirit from `notify-outbox`:

- HTTPS only
- Block `localhost`, `127.0.0.1`, `::1`
- Block `*.local`
- Block `10.*`, `192.168.*`, `172.16–31.*`
- Block `169.254.169.254` (and `0.0.0.0`)

## Safety

- Never logs or returns webhook URL values
- Soft-fail on missing config, denied permission, rejected URL, or HTTP errors
- Requires approval / `network.external` for live send

## Enable

```bash
zavorth plugins enable platform-webhook --yes
```
