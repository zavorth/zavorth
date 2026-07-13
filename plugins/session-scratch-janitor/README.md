# Session Scratch Janitor

Zavorth Plugin OS package that tracks ephemeral workspace files and previews cleanup.

| Aspect | Behavior |
|---|---|
| Manifest | Plugin OS `manifest.json` (`zavorth.plugin-os.v1`) |
| Hooks | `tool.after_execute` / `agent.after_turn` / `shutdown.before` |
| Scope | Only allowlisted Zavorth paths under the workspace |
| Ledger | JSONL ledger + dry-run receipts |
| Interface | Capabilities `ephemera.status` / `ephemera.sweep` |
| Safety | Dry-run by default; apply needs permission |

## Allowed roots

- `<workspace>/.zavorth/scratch/`
- `<workspace>/data/temp/`
- `<workspace>/tmp/`
- `<workspace>/temp/`

Name hints: `scratch-*`, `tmp-*`, `*.tmp`, `zavorth-ephemeral-*`, etc.

## Install (operator)

```bash
zavorth plugins install ./plugins/session-scratch-janitor --yes
zavorth plugins enable session-scratch-janitor --yes
zavorth plugins inspect session-scratch-janitor
zavorth plugins os
```

## Capabilities

- `ephemera.status` — ledger + active tracks
- `ephemera.sweep` — dry-run by default; `{ "apply": true }` only after permission grant

## Safety

- Paths outside allowlisted roots are ignored
- Ledger directory is never deleted by the plugin
- Apply mode requires `filesystem.write` via `requestPermission`
- Hook failures never throw into the agent loop
