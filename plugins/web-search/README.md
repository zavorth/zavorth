# web-search

First-party Zavorth Plugin OS search package.

## Capability

- `search.query` — `{ query, limit? }`

## Backends (in order)

1. `SEARXNG_URL` — SearXNG JSON API
2. `EXA_API_KEY` — Exa search API
3. DuckDuckGo lite HTML parse (best-effort)
4. Structured `no_backend_configured` response with setup tips

Soft-fail: never throws from `register`.

## Enable

```bash
zavorth plugins enable web-search --yes
```
