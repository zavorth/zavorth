# search-exa

Dedicated **Exa** neural search for Zavorth Plugin OS.

`web-search` may already try Exa as one of several backends; this package is the
**explicit** Exa module with its own capability ids.

## Env

| Variable      | Purpose                                      |
| ------------- | -------------------------------------------- |
| `EXA_API_KEY` | Required for query (presence only in status) |

Status reports **presence only** — never secret values.

## Capabilities

| Capability          | Usage                               |
| ------------------- | ----------------------------------- |
| `search.exa.status` | Key presence + host (`api.exa.ai`)  |
| `search.exa.query`  | `{ query\|q, limit?, numResults? }` |

### Query response shape

```json
{
  "ok": true,
  "backend": "exa",
  "results": [{ "title": "...", "url": "https://...", "snippet": "..." }]
}
```

Calls `POST https://api.exa.ai/search` with `type: "auto"` and optional short
text contents for snippets.

## Specialized registrar

When `ctx.registerWebSearchProvider` exists, the plugin registers:

| Field        | Value              |
| ------------ | ------------------ |
| id           | `exa`              |
| capabilityId | `search.exa.query` |
| kind         | `web_search`       |

## Safety

- Requests `network.external` before any HTTP call
- Soft-fail when key missing, permission denied, or HTTP errors
- Never returns or logs API key values
- Pure Node (`node:https`), no extra deps

## Enable

```bash
zavorth plugins enable search-exa --yes
```
