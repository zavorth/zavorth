# search-firecrawl

Soft-fail **Firecrawl** extract/scrape (and optional search) for Zavorth Plugin OS.

## Env

| Variable             | Purpose                                                 |
| -------------------- | ------------------------------------------------------- |
| `FIRECRAWL_API_KEY`  | Required for scrape/search (presence only in status)    |
| `FIRECRAWL_BASE_URL` | Optional API base (default `https://api.firecrawl.dev`) |

Status reports **key presence** and **base host only** — never secret values.

Custom `FIRECRAWL_BASE_URL` must be **HTTPS** and a **public** host (no localhost/private).

## Capabilities

| Capability                | Usage                                                     |
| ------------------------- | --------------------------------------------------------- |
| `search.firecrawl.status` | Key presence + base host                                  |
| `search.firecrawl.scrape` | `{ url, formats? }` → `POST {base}/v1/scrape`             |
| `search.firecrawl.search` | `{ query\|q, limit? }` → soft-try `POST {base}/v1/search` |

### Scrape

- Auth: `Bearer FIRECRAWL_API_KEY`
- Default `formats`: `["markdown"]`
- **SSRF**: scrape target must be a public **HTTPS** URL (blocks localhost, private IPv4, link-local, `*.local`)

### Search

Soft-tries Firecrawl search when the account/API supports it. On failure, returns a tip to use `search.firecrawl.scrape` with a known public URL instead.

## Specialized registrar

When `ctx.registerWebSearchProvider` exists, the plugin registers:

| Field        | Value                     |
| ------------ | ------------------------- |
| id           | `firecrawl`               |
| capabilityId | `search.firecrawl.search` |
| kind         | `web_search`              |

## Safety

- Requests `network.external` before any HTTP call
- Soft-fail when key missing, permission denied, or HTTP errors
- Never returns or logs API key values
- SSRF guards on scrape targets and API base host
- Pure Node (`node:https` / `node:http`), no extra deps

## Enable

```bash
zavorth plugins enable search-firecrawl --yes
```
