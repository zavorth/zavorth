# selfmod-plugin-forge

First-party Plugin OS wrapper around `PluginForgeService`.

## Capabilities

- `forge.plan` — `{ intent, id? }` generate a preview under `.zavorth/plugin-forge/previews/`
- `forge.apply` — `{ previewDir, approved }` copy preview only when approved

## CLI

```bash
zavorth plugins forge plan "I need a tool that echoes uppercase"
zavorth plugins forge apply <previewDir> --yes
zavorth plugins forge "<intent>" --apply --yes
```

Never mutates production packages without `approved` / `--yes`.
