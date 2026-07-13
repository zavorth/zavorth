# task-board

Local kanban/todo board for agent multi-step work. No Linear/Jira account required.

## Why it exists

Long multi-step work needs a durable board so tasks survive crashes and restarts. Task Board gives Zavorth that daily planning surface with receipts under `.zavorth/task-board/`.

## Columns

`backlog` → `doing` → `blocked` → `done`

## Capabilities

| Capability | Usage |
|------------|--------|
| `task.status` | Counts per column |
| `task.list` | `{ column?, limit? }` |
| `task.add` | `{ title, column?, priority?, tags?, notes? }` |
| `task.move` | `{ id, column }` |
| `task.complete` | `{ id }` |

## Safety

- Workspace-local JSON only
- No network
- Soft-fail on I/O errors

## Enable

```bash
zavorth plugins enable task-board --yes
```
