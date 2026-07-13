# notify-outbox

Local notification outbox with optional Slack/Discord webhook delivery.

## Why it exists

Messaging is table stakes for team alerts after CI. Local-first enqueue always works; webhook deliver is opt-in and approval-gated.

## Capabilities

| Capability | Usage |
|------------|--------|
| `notify.enqueue` | `{ title, body?, channel?, severity? }` |
| `notify.list` | `{ status?, limit? }` |
| `notify.deliver` | `{ id? }` or `{ all: true }` — needs permission |
| `notify.status` | Counts + webhook **presence** (no URLs) |

## Env (optional)

| Variable | Purpose |
|----------|---------|
| `SLACK_WEBHOOK_URL` | Slack incoming webhook |
| `DISCORD_WEBHOOK_URL` | Discord webhook |
| `ZAVORTH_NOTIFY_WEBHOOK_URL` | Generic HTTPS webhook |

## Safety

- HTTPS only; blocks localhost/private hosts
- Never logs webhook URLs
- Deliver requires `network.external` permission

## Enable

```bash
zavorth plugins enable notify-outbox --yes
```
