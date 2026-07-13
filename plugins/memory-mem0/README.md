# memory-mem0 (Wave 3)

Soft-fail remote [mem0](https://mem0.ai) memory backend for Zavorth Plugin OS.

## Env

| Variable | Purpose |
|----------|---------|
| `MEM0_API_KEY` | Required for add / search / get |
| `MEM0_BASE_URL` | Optional (default host `api.mem0.ai`) |
| `MEM0_USER_ID` | Optional default user scope |

Status reports **presence only** (`keyPresent`, `baseHost`) — never secret values or full URLs with credentials.

## Capabilities

- `memory.mem0.status` — key/base host presence, setup tips
- `memory.mem0.add` — `{ text\|content\|value, userId?, messages? }`
- `memory.mem0.search` — `{ query, userId?, limit? }`
- `memory.mem0.get` — `{ id\|memoryId?, userId?, limit? }`

Also registers `bindMemoryBackend` (`id: memory-mem0`):

| Backend op | Capability path |
|------------|-----------------|
| write | add |
| search | search |
| read | get (or search when `query` is provided) |

## Safety

- Requests `network.external` before any HTTP call
- Soft-fail when key missing, permission denied, or HTTP errors
- Default base is HTTPS (`https://api.mem0.ai`)
- Custom `MEM0_BASE_URL` must be `http(s)` and non-private (SSRF-safe)
- Never echoes API keys

## Enable

```bash
zavorth plugins enable memory-mem0 --yes
```
