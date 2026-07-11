# Syncing Zavorth Code packages

## Source of truth (cutover)

| Role | Path |
|------|------|
| **Primary (edit here)** | `packages/code/` in monorepo **Zavorth** |
| **Sibling** | `../zavorth-code` — mirror / archive only |

Marker: [SOURCE-OF-TRUTH.md](./SOURCE-OF-TRUTH.md)

## Commands (from monorepo root)

```powershell
# Verify cutover / tree health (CI)
npm run code:sync:check
# → node scripts/sync-zavorth-code-from-sibling.mjs --check

# Export monorepo → sibling mirror
npm run code:export
# → node scripts/sync-zavorth-code-from-sibling.mjs --export

# Reverse import sibling → monorepo (discouraged; overwrites monorepo)
npm run code:sync -- --from-sibling
# or:
# node scripts/sync-zavorth-code-from-sibling.mjs --from-sibling --source "C:\path\to\zavorth-code"
```

Allowlist: `cli`, `shared`, `plugin`, `script`, `sdk-js`, `ui`, `gitlab-auth`, `poe-auth`, `patches`.

## After export / reverse import

1. Skim `SYNC-MANIFEST.json` (`sourceOfTruth: "monorepo"`).
2. Do not commit sibling `node_modules` / `dist`.
3. In monorepo:

```powershell
npm run code:install
npm run code:smoke
npm run code:single-bin:smoke
```

## Develop

```powershell
npm run code:dev
# or
cd packages/code
bun run dev
```

Public entry remains monorepo: `node bin/zavorth.js` / `zavorth`.
