# Developer Quickstart

Use this path when you are changing the Zavorth repository.

## 1. Install

```powershell
powershell -ExecutionPolicy Bypass -File install/install.ps1 -Profile Dev
```

Or use the standard local path:

```bash
npm install
npx zavorth setup
```

## 2. Validate Runtime

```bash
npx zavorth status --json
npx zavorth doctor --json
npm test
```

## 3. Check The Workspace

```bash
npm run runtime:check
npm run security:ci
npm run build --silent
```

## 4. Open The ZavorthControl

```text
http://127.0.0.1:33333/control
```

Use the ZavorthControl to inspect runtime, sessions, approvals, nodes, transports and integrations without relying on hidden local state.

## Notes

- `status` and `doctor` are the fastest readiness checks.
- Web, node, channel and transport smokes cover the main operational surfaces.
- `runtime:check`, `security:ci` and `build` are required before publishing changes.
