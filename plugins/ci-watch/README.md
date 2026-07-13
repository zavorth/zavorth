# ci-watch

Read-only GitHub Actions status for the current branch via `gh`.

## Why it exists

After `pr-ship`, the next question is always “did CI pass?”. This plugin closes that loop without leaving the agent.

## Capabilities

| Capability | Usage |
|------------|--------|
| `ci.status` | `{ branch?, limit?, repo? }` |
| `ci.latest` | Latest run for branch |
| `ci.failed` | Recent failures |

## Safety

- Soft-fail without `gh`
- No workflow dispatch / cancel (read-only)
- Network only through authenticated `gh`

## Enable

```bash
zavorth plugins enable ci-watch --yes
```
