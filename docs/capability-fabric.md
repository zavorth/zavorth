# Universal Capability Fabric

Zavorth does not depend on a static third-party storefront for skills or plugins.
It **discovers, classifies, quarantines, and enables** capabilities from any
compatible source under one governed plane.

## What it covers

| Kind | Default trust | Enable rule |
| --- | --- | --- |
| **skill** | Instruction pack | Preview → approve → materialize |
| **plugin** | Higher trust if executable | Quarantine first; enable held until explicit allow |
| **mcp** | Disabled candidate | Materialize disabled; separate enable approval |

## Sources (any of)

- local directory
- archive (zip/tarball path)
- HTTPS URL (scraped/staged into quarantine)
- git-style HTTPS repository URL (staged for review)

No product brand is required. Classification is structural (`SKILL.md`,
`plugin.json`, `mcp.json`, executable markers, secret-like content).

## CLI

```bash
# Preview (default)
zavorth absorb ./packs/my-skill
zavorth absorb skill ./packs/my-skill --preview
zavorth absorb plugin ./packs/my-plugin --preview
zavorth absorb mcp ./packs/my-mcp --preview
zavorth absorb https://example.com/skill-page --kind skill --preview

# Apply with consent
zavorth absorb ./packs/my-skill --apply --consent
zavorth absorb plugin ./packs/my-plugin --apply --consent --allow-executable

# Universal workspace import (structural only; optional --profile risk report)
zavorth import-workspace ./any-agent-home --preview
zavorth import-workspace ./any-agent-home --profile auto --preview
zavorth import-workspace ./any-agent-home --apply --consent
zavorth migrate ./any-agent-home --preview
zavorth migrate ./any-agent-home --apply --consent
zavorth migrate --auto --preview
```

See also: [Workspace migration](./product/migration-workspace.md) (profile flags, secrets policy).

## Action Harness

| Action id | Purpose |
| --- | --- |
| `skills.absorb` | Skill path/URL intake |
| `plugins.absorb` | Plugin pack intake |
| `mcp.intake` | MCP pack intake (disabled) |
| `capabilities.absorb` | Auto-classify skill/plugin/mcp |
| `workspace.import` | Structural workspace home import |

Natural phrases that should route here:

- “pega essa skill da web e instala com preview”
- “absorve esse plugin da pasta”
- “importa o home do meu agente antigo”
- “adiciona esse MCP desabilitado para eu revisar”

## Workspace import profiles (structural)

These are **shapes**, not product names:

- `identity-markdown-home`
- `skill-centric-home`
- `memory-centric-home`
- `config-centric-home`
- `plugin-centric-home`
- `mixed-agent-home`
- `opaque-or-empty`

Signals include identity/soul/user/agents markdown, skills/memory/plugins/config
directories, mcp manifests, and generic workspace config files.

### Optional migration profile labels (`--profile`)

On top of universal structural import, `import-workspace` may attach a risk report
using structure fingerprints: `auto`, `generic` / `generic-agent-home`,
`openclaw-home`, `hermes-home`. These labels are optional and never required to import.
Details: [Workspace migration](./product/migration-workspace.md).

## Safety invariants

1. Preview before mutate.
2. Apply requires explicit consent.
3. Secret-like files never auto-import.
4. MCP starts disabled.
5. Executable plugins stay held without higher-trust allow.
6. Receipts never serialize raw secrets.
7. Catalog / quarantine ≠ live readiness.
8. Brand-agnostic detection only.

## Related

- [Capabilities](./capabilities.md)
- [Capabilities and plugins](./capabilities-and-plugins.md)
- [Skills product guide](./product/skills/index.md)
- [Security](./security.md)
