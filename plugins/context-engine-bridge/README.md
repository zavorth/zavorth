# context-engine-bridge

trust fabric — soft bridge to core **ContextEngine** when resolvable from the monorepo.

Uses browser-playwright-style `tryLoad`. Soft-fails with `not_configured` when unavailable.

## Capabilities

- `context.engine.status` — available? + setup tips
- `context.engine.snapshot` — soft `getSnapshot` / `getState` / `summarize` / `getStats`
- `context.engine.recall` — soft `recall` / `search` / `find` with `{ query }`
- `context.engine.stats` — soft stats

## Enable

```bash
zavorth plugins enable context-engine-bridge --yes
```
