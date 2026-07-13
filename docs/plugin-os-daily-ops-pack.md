# Plugin OS — Daily Ops pack

Seven first-party plugins aimed at **accessibility** (zero-to-productive) and
**daily developer loops**: durable tasks, session recall, PR/CI ship path, secrets
hygiene, and team notify.

## Research drivers (summary)

| Market signal | Gap Zavorth closes |
|---------------|--------------------|
| Durable `todo` / kanban | Multi-step work dies without a durable board |
| Session / receipt search | Agents re-ask what already happened |
| Messaging / Discord / Slack | No first-party notify path without MCP |
| PR assist + review checklist | Ship loop is fragmented |
| Post-ship CI status | CI status after ship is a constant question |
| Security posture tables | Secrets leaks vs dangerous-code patterns are different |
| Onboarding churn | Silent missing `gh`/git/env kills trust |

## Pack inventory

| Plugin | Flow | Local-only? |
|--------|------|-------------|
| `workspace-doctor` | First-run / “why is this broken?” | Yes (env presence only) |
| `task-board` | Plan → doing → done across turns | Yes |
| `pr-ship` | Diff → checklist → draft → create PR | Needs `git`/`gh` (soft-fail) |
| `ci-watch` | “Did Actions pass?” | Needs `gh` (soft-fail) |
| `secrets-guardian` | Leak scan + tool write hook | Yes |
| `session-recall` | Search `.zavorth` receipts/memory | Yes |
| `notify-outbox` | Queue alerts; optional Slack/Discord | Enqueue yes; deliver optional |

## Canonical user journeys

### 1. New machine / open repo

1. `doctor.run` → nextSteps
2. `doctor.env` → which SaaS keys exist (names only)
3. Enable recommended profile

### 2. Multi-step agent task

1. `task.create` / board status
2. Work with tools/plugins
3. `task.complete` + optional `notify.enqueue`

### 3. Ship a change

1. `pr.prepare` / checklist
2. `pr.create` (no auto-push)
3. `ci.status` until green
4. Optional outbox notify

## Related

- [Plugin OS](./plugin-os.md)
- [Gap closure waves](./plugin-os-gap-closure-waves.md)
- [Marketplace](./plugin-os-marketplace.md)
