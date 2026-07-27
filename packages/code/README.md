# Zavorth Code (in monorepo)

**Product:** Zavorth Code — terminal coding agent (CLI/TUI)
**Role:** monorepo’s public terminal shell via root bin **`zavorth` only**.
**Source of truth:** **this folder** — [SOURCE-OF-TRUTH.md](./SOURCE-OF-TRUTH.md)
**Plan / audit:** [code-cli-integration.md](../../docs/product/code-cli-integration.md) · [AUDIT-code-cli.md](../../docs/product/AUDIT-code-cli.md)

## Layout

```text
packages/code/
  SOURCE-OF-TRUTH.md
  SYNC.md
  SYNC-MANIFEST.json
  cli/       # coding TUI — launched by monorepo bin/zavorth.js
  shared/
  plugin/
  script/
  sdk-js/
  …
```

## Binary policy

| Command | Meaning |
|---------|---------|
| **`zavorth`** (monorepo root) | Sole public CLI → this TUI + monorepo capabilities |

No separate public `zavorth-code` bin. Agent `dist/zavorth-cli.js` is an internal backend for some delegated commands only.

## Develop (primary)

```powershell
# From monorepo root
npm run code:install
npm run code:dev
npm run code:smoke
npm run code:cutover:smoke
node bin/zavorth.js doctor
```

Or:

```powershell
cd packages/code
bun install --ignore-scripts   # Windows without VS C++ tools
bun run dev
bun run scripts/smoke-code-workspace.mjs
```

## Sibling repo

Sibling `../zavorth-code` is **mirror / archive**, not the edit home.

```powershell
# Push monorepo → sibling
npm run code:export

# Reverse import (discouraged)
npm run code:sync -- --from-sibling
```

See [SYNC.md](./SYNC.md).

## Not included

`app`, `desktop`, `console`, `web` from the historical Code monorepo stay **out** (not Control / not monorepo Desktop).

## Bridge

File bridge with Control/Desktop: `docs/protocol/zavorth-code-bridge.md`
Monorepo runtime host: `docs/protocol/zavorth-runtime-bridge.md`
