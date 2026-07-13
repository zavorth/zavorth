# pr-ship

Ship loop plugin: branch status → diff → review checklist → PR draft/create.

## Why it exists

Daily developer flow for ticket → diff → review → PR:

1. See what changed (`pr.ship.status` / `pr.ship.diff`)
2. Heuristic review (`pr.ship.checklist`)
3. Draft description (`pr.ship.draft`)
4. Optional create via `gh` with approval (`pr.ship.create`)

## Capabilities

| Capability | Notes |
|------------|--------|
| `pr.ship.status` | Branch, dirty files, open PR |
| `pr.ship.diff` | Diffstat + truncated patch |
| `pr.ship.checklist` | Secrets, tests, migrations, CI, auth heuristics |
| `pr.ship.draft` | Local title/body only |
| `pr.ship.create` | `gh pr create` — permission gated |

## Safety

- Soft-fail without git/gh
- Never auto-push
- Create requires `network.external` permission

## Enable

```bash
zavorth plugins enable pr-ship --yes
```
