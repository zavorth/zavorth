# browser-cdp

soft-fail Chrome DevTools Protocol (CDP) attach for browser automation **without Playwright**.

Pure Node.js HTTP client against Chrome’s debug endpoints. Soft-fails when CDP is missing, network permission is denied, or the endpoint is unreachable.

## Capabilities

| id                     | Purpose                                                             |
| ---------------------- | ------------------------------------------------------------------- |
| `browser.cdp.status`   | Configured? **host only** (never full secrets), message, setup tips |
| `browser.cdp.version`  | Soft `GET {cdp}/json/version`                                       |
| `browser.cdp.targets`  | Soft `GET {cdp}/json/list` → `{ id, title, type, url }[]`           |
| `browser.cdp.navigate` | Soft open via HTTP `{cdp}/json/new?{url}` (no WebSocket)            |

## Env (presence / host only in status)

- `CDP_URL` or `BROWSER_CDP_URL` — e.g. `http://127.0.0.1:9222`
- Status reports **host** only; full URL values are never returned

## Setup

```bash
# Start Chrome with remote debugging
chrome --remote-debugging-port=9222
# or: chromium --remote-debugging-port=9222

# Point the plugin at the debug port
set CDP_URL=http://127.0.0.1:9222
# optional alias: BROWSER_CDP_URL
```

Localhost attach is intentional for local browser debugging. The plugin requests `network.local` for local hosts and `network.external` for non-local CDP hosts before any fetch.

## Navigate notes

Full CDP command streams need a WebSocket; this plugin stays **HTTP-only**:

- Opens a new tab with `GET` (then `PUT` fallback) `/json/new?{url}`
- Optional `targetId` best-effort activates via `/json/activate/{id}` then still uses `/json/new`
- No Playwright dependency

## Permissions

- `network.local` (optional) — localhost CDP
- `network.external` (optional) — remote CDP host
- `process.spawn` (optional, unused on the pure HTTP path)

## Enable

```bash
zavorth plugins enable browser-cdp --yes
```

## Specialized registrar

When the host exposes `ctx.registerBrowserProvider`, the plugin registers:

- `id`: `browser-cdp`
- `capabilityId`: `browser.cdp.navigate`
- `kind`: `browser`
