# github

First-party Zavorth Plugin OS bridge for GitHub CLI.

## Capabilities

- `github.status` — gh auth / token presence
- `github.pr.list` — `{ repo?, limit? }`
- `github.issue.list` — `{ repo?, limit? }`

Requires `gh` on PATH (or clear setup guidance when missing). Soft-fail only.

## Enable

```bash
zavorth plugins enable github --yes
```
