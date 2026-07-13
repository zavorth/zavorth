# Hosting a remote Plugin OS marketplace (P3)

Local first-party plugins work without hosting. Remote marketplace is optional
ecosystem scale: partners and extra machines consume the same catalog URL.

## Export catalog from this monorepo

```bash
node scripts/export-plugin-marketplace-remote.mjs
# writes:
#   docs/generated/plugin-marketplace-remote.json
#   docs/generated/plugin-marketplace-remote.entries.json

# with package base URLs:
node scripts/export-plugin-marketplace-remote.mjs --base-url https://cdn.example.com/plugins
```

## Host

1. Serve **HTTPS** JSON (public host; not localhost/private IP — SSRF guards).
2. Prefer the **flat array** file (`.entries.json`) if your client expects a bare list.
3. Optionally host `.tgz` packages per plugin id and set `--base-url`.
4. Point runtimes:

```bash
export ZAVORTH_PLUGIN_MARKETPLACE_URL=https://cdn.example.com/plugin-catalog.json
zavorth plugins marketplace refresh-remote
zavorth plugins marketplace
zavorth plugins marketplace show web-search
zavorth plugins install marketplace:web-search --yes
```

## Install behavior (unchanged)

1. Bundled copy from `plugins/<id>` when present
2. HTTPS package download when `source` is https
3. Soft materialize under `.zavorth/plugins/`

Enable is never automatic without `--enable`.

## Security

- See `docs/plugin-os-signed-pack.md` for signatures/digests.
- Catalog fetch is HTTPS-only with private-host blocking.

## Related

- Product CLI: `docs/plugin-os-marketplace.md`
- Agent harness: `docs/agent-harness-readiness.md`
