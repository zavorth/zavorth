# dashboard-auth-token

Wave 6 trust fabric — **bearer token** provider surface for control-plane soft simulation.

Does **not** replace a real auth server. Token presence only; values are never returned.

## Env

- `DASHBOARD_AUTH_TOKEN` (preferred)
- `ZAVORTH_DASHBOARD_TOKEN` (fallback)

## Capabilities

- `dashboard.auth.token.status` — token presence (boolean / env source flags)
- `dashboard.auth.token.verify` — `{ token|bearer|authorization }` → `{ ok, authenticated }`
- `dashboard.auth.token.headerHint` — `{ header: 'Authorization', format: 'Bearer <token>' }`

## Enable

```bash
zavorth plugins enable dashboard-auth-token --yes
```
