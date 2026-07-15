# create-zavorth-plugin

Standalone CLI for third-party [Zavorth](https://github.com/) Plugin OS authors.
Scaffolds a minimal `zavorth.plugin-os.v1` package with one capability, kind-based
permissions, and a soft-fail `register(ctx)` entrypoint.

No monorepo TypeScript imports — pure Node.js.

Supports every `moduleKind` from `PluginManifestContract`:
`tool | provider | channel | memory | media | voice | search | diagnostics |
bridge | agent | sandbox | qa | workspace | module`.

## Install

```bash
# From the monorepo (local)
node packages/create-zavorth-plugin/bin/create-zavorth-plugin.js --help

# Or via the repo convenience wrapper
node bin/create-zavorth-plugin.js --help

# After publish
npx create-zavorth-plugin <id> --kind tool
npm create zavorth-plugin@latest -- <id> --kind tool
```

## Usage

```bash
create-zavorth-plugin <id> --kind tool|provider|channel|memory|media|voice|search|diagnostics|bridge|agent|sandbox|qa|workspace|module
create-zavorth-plugin <id> --kind media --dir ./my-plugin
create-zavorth-plugin <id> --kind bridge --dry-run
create-zavorth-plugin <id> --kind tool --yes
create-zavorth-plugin <id> --kind tool --install

# bridge kind: bridge.invoke with modes http|cli|mcp (soft-fail without endpoint)
# monorepo one-shot: zavorth plugins new my-bridge --kind bridge --enable --smoke --yes
```

| Flag        | Meaning                                                                 |
| ----------- | ----------------------------------------------------------------------- |
| `--kind`    | `moduleKind` (default `tool`)                                           |
| `--dir`     | Output directory (default `./<id>` under cwd)                           |
| `--dry-run` | Print files that would be written; write nothing                        |
| `--yes`     | Write files (default when not dry-run; for scripts)                     |
| `--install` | Also copy into `./plugins/<id>` (monorepo) or `./.zavorth/plugins/<id>` |

```bash
# After scaffold
zavorth plugins install ./my-tool --yes
zavorth plugins enable my-tool --yes
zavorth plugins marketplace show my-tool
```

## Generated layout

```
<target>/
  manifest.json   # zavorth.plugin-os.v1, one capability, permissions by kind
  index.js        # register(ctx) + soft-fail bindCapability
  README.md
```

## Permission presets by kind

| Kind                     | Permissions                                                          |
| ------------------------ | -------------------------------------------------------------------- |
| `tool` / `module` / `qa` | `filesystem.read`                                                    |
| `provider`               | `network.external`, `provider.call`, `secret.read` (optional)        |
| `channel`                | `network.external`, `channel.send`                                   |
| `memory`                 | `filesystem.read`, `filesystem.write`, `memory.read`, `memory.write` |
| `media` / `voice`        | `network.external`, `secret.read` (optional)                         |
| `search`                 | `network.external`                                                   |
| `diagnostics`            | `filesystem.read`                                                    |
| `bridge`                 | `network.external`, `filesystem.read`                                |
| `sandbox`                | `process.spawn`, `filesystem.read`                                   |
| `agent` / `workspace`    | `filesystem.read`, `filesystem.write` (optional)                     |

## Capability by kind

| Kind          | Capability id                   |
| ------------- | ------------------------------- |
| `tool`        | `main.run`                      |
| `provider`    | `provider.complete`             |
| `channel`     | `channel.send`                  |
| `memory`      | `memory.read`                   |
| `media`       | `media.run`                     |
| `voice`       | `voice.run`                     |
| `search`      | `search.query`                  |
| `diagnostics` | `diagnostics.status`            |
| `bridge`      | `bridge.forward`                |
| `agent`       | `agent.ping` (+ optional hooks) |
| `sandbox`     | `sandbox.run`                   |
| `qa`          | `qa.check`                      |
| `workspace`   | `workspace.info`                |
| `module`      | `module.run`                    |

## Soft-fail contract

- Invalid plugin ids fail cleanly (no stack dump).
- Generated `index.js` only calls `bindCapability` when present.
- Optional specialized binders (`bindProvider`, `bindChannel`, `bindMemoryBackend`,
  `registerHook`) are wrapped in try/catch and skipped when unavailable.

## Relation to monorepo scaffold

In-repo authors may still use `zavorth plugins new` / `PluginScaffoldService`.
This package is for **third parties** who should not need monorepo access.

Reference examples: `plugins/examples/*` and package
`@zavorth/example-plugins` / `packages/zavorth-example-plugins`.

SDK: `@zavorth/plugin-sdk` (`definePlugin`).

## License

MIT
