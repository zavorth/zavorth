# memory-honcho

Optional Honcho-style memory wrapper for Zavorth Plugin OS.

## Capabilities

- `memory.honcho.status` — available / not_configured
- `memory.honcho.profile` — `{ userId }`
- `memory.honcho.search` — `{ userId?, query?, limit? }`

Soft-fail: if `MemoryHonchoService` cannot be required from monorepo paths, status returns setup guidance and other capabilities report `not_configured`.

## Enable

```bash
zavorth plugins enable memory-honcho --yes
```
