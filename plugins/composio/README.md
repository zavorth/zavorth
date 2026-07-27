# composio

Governed Composio connector for Zavorth Plugin OS.

## Env

```bash
COMPOSIO_API_KEY=...
# optional
COMPOSIO_BASE_URL=https://backend.composio.dev
```

## Tools

- `composio_status`
- `composio_doctor`
- `composio_preview`
- `composio_execute` (approval-gated)

Also available via Action Harness:

```bash
zavorth actions preview integration.connectors.doctor --args connectorId=composio
```
