# dashboard-auth-basic

Wave 6 trust fabric — local **basic-auth** provider surface for control-plane soft simulation.

Does **not** replace a real auth server. Env presence only; passwords are never returned.

## Env

- `DASHBOARD_BASIC_USER`
- `DASHBOARD_BASIC_PASSWORD`

## Capabilities

- `dashboard.auth.basic.status` — `userConfigured` / `passwordConfigured` (booleans only)
- `dashboard.auth.basic.verify` — `{ username, password }` → `{ ok, authenticated }`
- `dashboard.auth.basic.challenge` — Basic realm `zavorth` challenge hint

## Enable

```bash
zavorth plugins enable dashboard-auth-basic --yes
```
