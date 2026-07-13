# memory-local

Workspace-local key/value memory for Zavorth Plugin OS.

## Store

`<workspace>/.zavorth/memory-local/store.json`

## Capabilities

- `memory.write` — `{ key, value, tags? }`
- `memory.search` — `{ query, limit? }`
- `memory.get` — `{ key }`

Also registers `bindMemoryBackend` for the memory module path.

## Enable

```bash
zavorth plugins enable memory-local --yes
```
