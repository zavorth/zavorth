# workspace-doctor

First-party **accessibility** plugin: one-shot health for a Zavorth workspace.

## Why it exists

New users bounce when tools fail silently (`gh` missing, no git repo, empty env). Doctor returns a structured report and **nextSteps** without requiring credentials or network.

## Capabilities

| Capability | Input | Output |
|------------|--------|--------|
| `doctor.run` | `{ deep? }` | Full check report + nextSteps |
| `doctor.env` | `{}` | Integration env key **presence** only (never values) |

## Checks

- Node runtime
- `git`, `gh`, `docker` on PATH (soft-fail)
- Workspace paths (`.zavorth`, `plugins/`, `package.json`)
- Git repository detection
- First-party plugin package count
- Known integration env profiles

## Safety

- No network
- Never prints secret values
- Soft-fail on every probe

## Enable

```bash
zavorth plugins enable workspace-doctor --yes
```
