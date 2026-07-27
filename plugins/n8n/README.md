# n8n

Governed n8n connector for Zavorth Plugin OS.

## Env

```bash
N8N_BASE_URL=http://127.0.0.1:5678
N8N_API_KEY=...
N8N_EXECUTE_URL=http://127.0.0.1:5678/webhook/...
```

## Tools

- `n8n_status`
- `n8n_doctor`
- `n8n_preview`
- `n8n_execute` (approval-gated)

Also available via Action Harness:

```bash
zavorth actions preview integration.connectors.doctor --args connectorId=n8n
```
