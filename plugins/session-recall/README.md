# session-recall

Search past receipts, memory, and Plugin OS ledgers under `.zavorth`.

## Why it exists

Competitors ship `session_search` / long-term memory so agents do not re-ask what already happened. Session Recall is local-first, soft-fail, and needs no SaaS.

## Capabilities

| Capability | Usage |
|------------|--------|
| `recall.search` | `{ query, limit? }` |
| `recall.recent` | Recently modified artifacts |
| `recall.sources` | Indexed `.zavorth/*` dirs |

## Sources (examples)

- `receipts`, `memory-local`, `task-board`, `cost-tracker`
- `security-guidance`, `secrets-guardian`, `calendar`, `plugin-os`

## Safety

- Read-only
- Skips large binaries
- Snippets only — does not dump entire files

## Enable

```bash
zavorth plugins enable session-recall --yes
```
