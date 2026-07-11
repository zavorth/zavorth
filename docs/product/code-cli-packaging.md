# Code CLI packaging

How the monorepo ships and develops the **Zavorth terminal CLI** (Code TUI + monorepo capabilities).

**Related:** [AUDIT-code-cli.md](./AUDIT-code-cli.md) · [code-cli-integration.md](./code-cli-integration.md) · [cli-capabilities.md](./cli-capabilities.md)

---

## Product shape

| Surface | Path / package | Role |
|---------|----------------|------|
| **Public bin** | monorepo root `bin/zavorth.js` → npm `bin.zavorth` | **Only** user-facing CLI on PATH |
| **Code workspace** | `packages/code/` (`@zavorth/code`) | Bun workspace home for the coding TUI tree |
| **TUI package** | `packages/code/cli` (`@zavorth/cli`) | Coding shell (OpenTUI); **no** separate public npm bin |
| **Internal agent runtime** | `dist/zavorth-cli.js` | Backend for some delegated `zavorth <cmd>` capabilities — not a second product |

**Policy:** single public bin only. Do not reintroduce `zavorth-code` (or any second coding CLI) on PATH or in root `package.json` `bin`.

---

## Develop (monorepo + Bun)

Primary edit home for the terminal coding experience:

```text
packages/code/          # @zavorth/code — Bun workspaces root
  cli/                  # @zavorth/cli — TUI entry (src/index.ts)
  shared/ plugin/ …
```

From monorepo root:

```powershell
npm run code:install          # bun install --cwd packages/code --ignore-scripts
npm run code:dev              # Bun + packages/code/cli
npm run code:typecheck        # full project preferred (tsgo → tsc → tsconfig.ci → slice)
npm run code:typecheck:full   # reinstall typescript + @tsconfig/bun + tsgo, then check
npm run code:packaging:smoke  # files[] + npm pack dry-run
npm run code:smoke            # workspace smoke under packages/code
node bin/zavorth.js doctor    # monorepo capability (native)
node bin/zavorth.js setup interactive   # native guided setup (template; optional user-local key)
node bin/zavorth.js setup apply         # how to load state/setup.local.env (never prints values)
node bin/zavorth.js           # Code TUI (needs Bun + packages/code)
```

**Approvals (non-loopback gateway):** set `ZAVORTH_MANAGEMENT_TOKEN` (or `ZAVORTH_GATEWAY_TOKEN`) for `zavorth approve grant|deny`.

**Extra provider routing through product gateway:**

```powershell
# Product-hosted default: openai-compatible allowlist + Anthropic → gateway …/v1
# Opt-out (vendor APIs):
# $env:ZAVORTH_ROUTE_PROVIDERS="0"      # or ZAVORTH_PROVIDERS_DIRECT=1
# $env:ZAVORTH_ROUTE_ANTHROPIC="0"      # or ZAVORTH_ANTHROPIC_DIRECT=1
# optional custom Anthropic base when still routing:
# $env:ZAVORTH_ANTHROPIC_BASE_URL="http://localhost:20128/v1"
# Management token (user state only):
# zavorth setup token create
```

```powershell
npm run code:gateway:smoke   # routing logic + soft gateway /v1 probe
```

See [zavorth-runtime-bridge.md](../protocol/zavorth-runtime-bridge.md) for provider routing.

Or inside the workspace:

```powershell
cd packages/code
bun install --ignore-scripts
bun run dev
bun run typecheck
bun run scripts/smoke-code-workspace.mjs
```

## Toolchain contract (stable)

| Layer | Toolchain | Role |
|-------|-----------|------|
| **Root package** | **Node + npm** | Public `zavorth` bin, agent `dist/`, gateway, Control, capabilities |
| **`packages/code`** | **Bun island** | Code TUI sources and workspace deps |

Supported scripts (root):

```powershell
npm run code:install           # bun install under packages/code (dev sources)
npm run code:build             # optional: platform binary (no Bun needed to *run* TUI after)
npm run code:dev
npm run code:typecheck
npm run code:packaging:smoke
npm run code:toolchain:check   # node/npm/bun layout + single bin
npm run code:gateway:smoke
```

**Run TUI without Bun at runtime**

1. **`npm run code:ensure`** (recommended) — if no binary, tries download from release assets, else **one-time Bun build**  
2. **Auto on first `zavorth`:** launch calls ensure when binary is missing (opt-out: `ZAVORTH_CODE_ENSURE=0`)  
3. **`postinstall`:** best-effort ensure (never fails npm install)  
4. **Release CI:** multi-OS binaries go into npm pack + GitHub `code-tui-*.tar.gz`  

**Launch order:** prebuilt binary → ensure → Bun+sources only as last resort (`ZAVORTH_CODE_PREFER_SOURCES=1` forces sources).

`zavorth doctor` / `status` treat Bun as **optional** when a prebuilt binary is present.

Do not reintroduce a second public bin.

---

## Public entry

```text
zavorth                  → Code TUI (default)
zavorth <capability> …   → product capabilities (doctor, setup, …)
zavorth __agent …        → internal agent runtime (maintainer only)
ZAVORTH_LEGACY_CLI=1     → same internal hatch via env
```

- npm install of the **root** package exposes **`zavorth` only**.
- Launch: `bin/zavorth.js` → capabilities → `launch-code-tui.cjs` resolves Code via:
  1. `ZAVORTH_CODE_BIN`
  2. `ZAVORTH_CODE_ROOT` or `packages/code` next to the install (published tree)
  3. Optional PATH binary that is **not** a recursive zavorth shim

---

## What ships in the root npm tarball

| Included | Purpose |
|----------|---------|
| `bin/` | Public entry `zavorth` + launch libs |
| `packages/code/cli/src/**` (+ package.json, script, assets) | Code TUI sources |
| `packages/code/cli/dist/**` | Prebuilt Code TUI binaries (filled by release CI) |
| `packages/code/shared`, `plugin`, `script`, `sdk-js`, `patches` | Workspace deps sources |
| `scripts/lib/zavorth-runtime-bridge.mjs`, `zavorth-approvals.mjs`, … | Host bridge + approvals |
| `dist/` | Internal agent runtime for remaining delegated commands |

| Omitted | Why |
|---------|-----|
| `packages/code/ui/**` | Not required for terminal TUI |
| `packages/code/**/node_modules` | Install with Bun after pack |
| Second public bin | Never |

### Install modes

**A — Published package (ships TUI sources)**  
`npm install` / pack includes `packages/code`. After install:

```powershell
npm run code:install   # or: bun install --cwd packages/code --ignore-scripts
zavorth                # needs Bun on PATH
```

Optional overrides: `ZAVORTH_CODE_ROOT`, `ZAVORTH_CODE_BIN`.

**B — Separate `@zavorth/cli` (optional later)**  
Root depends on a published workspace package without a second PATH bin.

**C — Full product clone**  
Git clone + root `npm install` + `code:install` for gateway/Control/desktop development.

Smoke: `npm run code:packaging:smoke` · `npm run code:toolchain:check`

---

## Windows note

On Windows (especially without full Visual C++ build tools), native deps under the Code workspace often fail during install scripts.

Prefer:

```powershell
bun install --ignore-scripts
# or from monorepo root:
npm run code:install
```

`packages/code` `postinstall` already tolerates `fix-node-pty` failure (`|| true`). Prefer `--ignore-scripts` when install noise or native compile blocks bootstrap; run targeted fix scripts only when you need pty features.

**Typecheck on Windows:** use the monorepo wrappers (path-safe; works with spaces in the workspace path):

```powershell
npm run code:typecheck        # prefer full project
npm run code:typecheck:full   # repair toolchain then full project
```

| Step | What runs |
|------|-----------|
| 1 | `bun run typecheck` in `packages/code` (`tsgo --noEmit` via `@zavorth/cli`) |
| 2 | If `tsgo` / native-preview is missing or broken after `bun install --ignore-scripts`, install **only** `typescript@5.8.2`, `@tsconfig/bun@1.0.9`, and `@typescript/native-preview` into `packages/code/cli` (does not re-enable all install scripts for native addons) |
| 3 | Fallback `tsc --noEmit -p tsconfig.json` then `-p tsconfig.ci.json` (standalone full `src/**` check: `skipLibCheck`, no `@tsconfig/bun` / `customConditions` / Effect language-service plugin) |
| 4 | Narrow slice `-p tsconfig.typecheck.json` (`host-runtime` + d.ts) |

**Policy:**

- **CI (`CI=true`):** hard-fail if the full project check fails or the toolchain is missing. Slice success is **not** enough unless `ZAVORTH_TYPECHECK_ALLOW_SLICE=1` (debug only).
- **Local:** always try full first. If only the slice passes, exit 0 with a warning (or set `ZAVORTH_TYPECHECK_ALLOW_SLICE=1` explicitly). Prefer fixing deps with `npm run code:typecheck:full` so full `tsgo` works.

Observed Windows failure after `bun install --ignore-scripts` or after a workspace rename (stale junctions under `cli/node_modules`):

```text
Cannot find module '.../packages/code/cli/node_modules/@typescript/native-preview/bin/tsgo.js'
# or: Unable to resolve @typescript/native-preview-win32-x64
```

Repair: `npm run code:typecheck:full` (or reinstall the workspace without broken junctions). Prefer the Linux **code-workspace** job in `.github/workflows/code-cli.yml` as the hard gate (`bun run --cwd packages/code typecheck`, fail on error). Do not weaken single-bin or cutover policy because of host-local typecheck gaps.

---

## CI gates

Workflow: [`.github/workflows/code-cli.yml`](../../.github/workflows/code-cli.yml)

| Job | Checks |
|-----|--------|
| **Cutover + single-bin gates** | `code:cutover:smoke`, `code:single-bin:smoke`, entry / capabilities / runtime-bridge smokes |
| **Code Bun workspace** | `bun install --ignore-scripts` under `packages/code`, workspace smoke, **typecheck** |

Paths in CI and scripts must use `packages/code` (not a legacy `packages/zavorth-code` path).

---

## Checklist before packaging changes

- [ ] Root `bin` still **only** `zavorth`
- [ ] No new public coding bin name
- [ ] `@zavorth/cli` does not gain a competing `bin` for end users
- [ ] If adding `packages/code` to `files`, document Bun/runtime requirements
- [ ] Cutover + single-bin smokes still pass
- [ ] Windows install story mentions `--ignore-scripts` when needed
