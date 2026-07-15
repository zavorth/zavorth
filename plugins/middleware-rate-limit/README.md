# middleware-rate-limit

trust fabric — in-memory **sliding window** rate limit via `registerMiddleware` / `registerHook`.

Soft guidance only. Emits `middleware.rate_limit.exceeded`; never hard-throws. `block: true` still log-only.

## Config

`.zavorth/middleware-rate-limit/config.json`

```json
{ "limit": 60, "windowMs": 60000, "block": false }
```

## Capabilities

- `middleware.ratelimit.status` — `{ limit, windowMs, counts }`
- `middleware.ratelimit.configure` — `{ limit?, windowMs?, block? }`
- `middleware.ratelimit.check` — `{ key? }` → `{ ok, allowed, remaining }`

## Hook

- `tool.before_execute` — soft count per tool key

## Enable

```bash
zavorth plugins enable middleware-rate-limit --yes
```
