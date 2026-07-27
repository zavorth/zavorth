# Plugin OS — release checklist (post group-0–group-8)

Last local verification: run `npm run qa:plugin-os` and `packages/plugin-sdk` `npm run publish:check`.

## Gate A — Local quality (no network side effects)

| Step | Command | Expected |
|------|---------|----------|
| 1. Plugin OS QA | `npm run qa:plugin-os` | 30 suites green + SDK harness OK |
| 2. SDK publish ritual | `cd packages/plugin-sdk && npm run publish:check` | build + harness + `npm publish --dry-run` OK |
| 3. Atlas refresh | `node scripts/generate-plugin-atlas.mjs` | updates `docs/generated/plugin-atlas.{md,json}` |
| 4. Scaffold smoke | `node bin/create-zavorth-plugin.js release-smoke --kind tool --dry-run` | exit 0 |

## Gate B — SDK publish (needs credentials + approval)

**Do not run until you intend a public npm release.**

```bash
cd packages/plugin-sdk
# confirm version in package.json (e.g. 0.3.0) and CHANGELOG
npm run publish:check

# from monorepo root (after commit):
git tag plugin-sdk-v0.3.0
git push origin plugin-sdk-v0.3.0
# CI workflow publishes on tag plugin-sdk-v*
```

Verify:

```bash
npm view @zavorth/plugin-sdk version
```

## Gate C — Remote marketplace host (ops)

1. Host a JSON catalog over **HTTPS** (public host, not localhost/private).
2. Shape: array of entries (see `config/plugin-marketplace-remote.example.json` and `docs/plugin-os-signed-pack.md`).
3. Prefer signed packages (`signed`, `digest`, `signature` fields).
4. Point runtimes at it:

```bash
export ZAVORTH_PLUGIN_MARKETPLACE_URL=https://your.cdn/plugin-catalog.json
```

5. In Zavorth: refresh remote marketplace (control plane / CLI path that calls `refreshRemote`).

## Gate D — Atlas “public” surface (optional)

| Option | Action |
|--------|--------|
| Docs site | Publish `docs/generated/plugin-atlas.md` into the public docs tree |
| Static CDN | Serve `docs/generated/plugin-atlas.json` as the community map |
| Regenerate on CI | Add job: `node scripts/generate-plugin-atlas.mjs` on main |

## Gate E — Product enablement (operator)

```bash
# recommended coding baseline
# (onboarding profile)
# daily-ops pack plugins already first-party

# optional packs
# providers | platforms | memory | media | browser-search | trust | lifestyle | full
```

Third-party author path:

```bash
node bin/create-zavorth-plugin.js acme-tool --kind tool
# or after SDK publish:
# npx create-zavorth-plugin acme-tool --kind tool
zavorth plugins install ./acme-tool --yes
zavorth plugins enable acme-tool --yes
```

## Status legend

| Status | Meaning |
|--------|---------|
| **Local ready** | Code + tests + dry-run gates green in this workspace |
| **Publish pending** | Needs human: npm token, git tag push, hosted catalog URL |
| **Done in product** | Groups group-0–group-8 shipped in monorepo |

## Snapshot (implementation)

- First-party plugins: ~50 (+ 6 examples)
- Groups group-0–group-8: shipped (`config/plugin-os-capability-groups.json`)
- Onboarding profiles: minimal, core, recommended, daily-ops, providers, platforms, memory, media, browser-search, trust, lifestyle, full
- Ecosystem: atlas, signed-pack doc, create-zavorth-plugin, SDK 0.3.0, capability packs for suggest
