# plugin-router-ai

Recommend Plugin OS packages for a natural-language intent.

## Capabilities

- `router.recommend` — `{ intent, limit?, useLlm?, candidates? }`
- `router.explain` — `{ pluginId }`

Never auto-enables plugins. Optional LLM re-rank via `ZAVORTH_PLUGIN_ROUTER_LLM=1` (service path).

## CLI

```bash
zavorth plugins recommend "I need web search"
```

## Enable

```bash
zavorth plugins enable plugin-router-ai --yes
```
