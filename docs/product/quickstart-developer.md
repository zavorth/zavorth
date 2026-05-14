# Developer Quickstart

Use this path when you are changing the Zavorth repository.

## 1. Install

```powershell
powershell -ExecutionPolicy Bypass -File install/install.ps1 -Profile Dev
```

Or use the standard local path:

```bash
npm install
npm run setup
```

## 2. Validate Runtime

```bash
npm run status -- --json
npm run doctor -- --json
npm test
```

## 3. Run The Core QA Path

```bash
npm run test:web:smoke
npm run test:nodes:smoke
npm run test:channels:smoke
npm run test:transports:smoke
npm run runtime:check
npm run security:secrets
```

## 4. Open The Dashboard

```text
http://127.0.0.1:33333/dashboard
```

Use the dashboard to inspect runtime, sessions, approvals, nodes, transports and integrations without relying on hidden local state.

## Notes

- `status` and `doctor` are the fastest readiness checks.
- Web, node, channel and transport smokes cover the main operational surfaces.
- `runtime:check` and `security:secrets` are required before publishing changes.
