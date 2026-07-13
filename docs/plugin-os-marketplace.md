# Plugin OS Marketplace

Product marketplace for discovering and installing Plugin OS packages.

## Commands

```bash
# List curated + bundled (+ remote cache when available)
zavorth plugins marketplace
zavorth plugins marketplace search

# Filter
zavorth plugins marketplace web
zavorth plugins marketplace --curated

# Preview install strategy (bundled copy / URL / materialize)
zavorth plugins marketplace show web-search

# Install (never auto-enables unless --enable)
zavorth plugins install marketplace:web-search --yes
zavorth plugins marketplace install web-search --yes --enable

# Refresh remote catalog cache
export ZAVORTH_PLUGIN_MARKETPLACE_URL=https://example.com/plugin-catalog.json
zavorth plugins marketplace refresh-remote
```

## Install strategy (priority)

1. **Bundled copy** — if `plugins/<id>/manifest.json` exists, copy into `.zavorth/plugins/<id>`
2. **HTTPS URL** — if catalog `source` is `https://...`, download/extract via `PluginUrlInstallService`
3. **Materialize** — soft scaffold under `.zavorth/plugins/<id>` (marketplace stub)

Enable is always explicit (`--enable` or `plugins enable --yes`).

## create-zavorth-plugin

Third-party / local author scaffold (standalone Node, no monorepo TypeScript):

```bash
# From monorepo
node bin/create-zavorth-plugin.js my-tool --kind tool
npm run plugin-os:create -- my-tool --kind search --dir ./plugins/my-tool

# Also copy into monorepo plugins/ or .zavorth/plugins/
node bin/create-zavorth-plugin.js my-tool --kind tool --install

# Via Plugin OS CLI
zavorth plugins create my-tool --kind tool --yes
```

Kinds: `tool | provider | channel | memory | media | voice | search | diagnostics | bridge`

## Service

`src/services/PluginOsMarketplaceService.ts`

- `list()` — curated + remote + on-disk bundled
- `preview(id)` — trust/permissions/install path
- `install(id, { enable?, force? })`
- `refreshRemote()`

## Related

- Curated catalog: `config/plugin-marketplace-curated.json`
- Remote defaults: `config/plugin-os-marketplace.json`
- Example remote catalog: `config/plugin-marketplace-remote.example.json`
- Signed packs: `docs/plugin-os-signed-pack.md`
