# Product terminal capabilities

How agent-runtime and operator commands surface on the **single public entry** **`zavorth`**, while the default shell remains the **Code TUI**.

Implementation: `bin/lib/zavorth-capabilities.cjs`  
Entry: `bin/zavorth.js` only (`package.json` → `"bin": { "zavorth": "./bin/zavorth.js" }`)

There is **no** second public coding CLI binary.

---

## Model

```text
zavorth                  → Code TUI (coding shell)
zavorth <capability> …   → product capability layer
```

| Strategy | Meaning |
|----------|---------|
| **native** | Implemented in product entry (no agent dist required) |
| **hybrid** | Bare / flags-only command is a **native summary**; some safe positionals stay native; others **delegate** to the agent runtime |
| **delegated** | Same UX as `zavorth <cmd>`; runs the **product agent runtime** (`dist/zavorth-cli.js`) under the same public name |
| **coding-owned** | Not intercepted; passed through to Code TUI / Code yargs |

Delegated is a **product backend**, not a second CLI. Users run `zavorth chat`, `zavorth memory`, etc. — no special hatch.

Maintainer-only direct agent entry (not for daily use):

- `ZAVORTH_AGENT_RUNTIME=1` (compat: `ZAVORTH_LEGACY_CLI=1`)
- `zavorth __agent …`

---

## Clusters

### setup-health

| Command | Strategy | Summary |
|---------|----------|---------|
| `setup` / `init` | **hybrid** | Bare/status native; `interactive` / `apply` / `token` native; other subcommands → agent when dist present |
| `onboard` | **hybrid** | Same native surface as setup for status / interactive / apply |
| `quickstart` | **hybrid** | Same native surface as setup for status / interactive / apply |
| `doctor` / `check` / `diagnose` | **native** | Terminal + runtime readiness |
| `status` / `health` | **native** | Snapshot |
| `home` | **native** | Short status + next step |
| `diagnostics` | **hybrid** | Native inspect snapshot; deeper export via agent when needed |
| `inspect` | **hybrid** | Native product snapshot (health, providers, channels, trust); deeper export via agent when needed |
| `capabilities` / `caps` | **native** | List this inventory |

### models-providers

| Command | Strategy | Summary |
|---------|----------|---------|
| `providers` | **hybrid** | Bare + `list`/`status`/`show`: env + gateway (no secrets). Other subcommands → agent runtime |
| `models` | **hybrid** | Bare + `list`/`status`/`show`: env + specs + allowlist. Other subcommands → agent runtime |

### channels-memory

| Command | Strategy | Summary |
|---------|----------|---------|
| `channels` | **hybrid** | Bare: capability manifests + channel env readiness. Subcommands → agent runtime |
| `memory` | delegated | Memory plane |
| `mnemos` | delegated | Mnemos |

### approvals-trust

| Command | Strategy | Summary |
|---------|----------|---------|
| `approve` | **hybrid** | Bare: local pending estimate from bridge/state + Control URL. Interactive review → agent / Control |
| `trust` | **hybrid** | Bare: network-trust + runtime-permissions summary. Deeper edits → agent / Control |

### operator

Includes: `open` (**native** Control URL), `start`, `ask`, `chat`, `actions`, `swarm`, `workflows`, and other operator helpers.

### coding-owned (not intercepted)

`tui`, `acp`, `pr`, `mcp`, `session`, `serve`, `agent`, `run`, `stats`, `generate`, `github`, `export`, `import`, `debug`, `db`, `plug`, …

---

## Setup security model (native)

Native setup is intentionally careful with secrets:

| Path | Role |
|------|------|
| `data/setup.env.example` | **Template only** (key *names*, comments). Safe if committed; never store live keys here. |
| `data/setup-status.json` | Non-secret readiness / next-step snapshot for the project tree. |
| `$ZAVORTH_HOME/state/setup.local.env` | **User-local secrets** (optional). When `ZAVORTH_HOME` is unset: `~/.local/state/zavorth/setup.local.env` (XDG / Windows equivalent). |
| `$ZAVORTH_HOME/state/setup-preference.json` | Non-secret preferred provider id + key *names* (not values). |

Rules:

1. **Never** write API keys into git-tracked project paths for “convenience.”
2. Non-interactive (`ZAVORTH_SETUP_NONINTERACTIVE=1` or no TTY) writes **template + status only** — no secrets.
3. Interactive TTY may **optionally** paste a key; it is written only to `setup.local.env` under the state dir, with POSIX `chmod 600` when possible (Windows: restrict NTFS ACL manually).
4. The CLI **never prints secret values** (including `zavorth setup apply` and `--json`).
5. `.gitignore` covers `**/.env`, `**/setup.local.env`, and `data/setup.local.env` as defense-in-depth.

Commands:

```text
zavorth setup                 # native status
zavorth setup interactive     # guided; optional user-local key paste
zavorth setup apply           # print how to load setup.local.env (no values)
zavorth setup apply --json    # path + key names only
```

`setup apply` prints shell snippets (bash `set -a; . file; set +a` / PowerShell `Get-Content` → process env). It does not inject into a parent shell by itself — run the printed snippet in your session.

---

## Still delegated (honest residual)

These still require `dist/zavorth-cli.js` (or Control UI) for full UX:

| Area | Why still delegated |
|------|---------------------|
| `setup` / `onboard` / `quickstart` **agent wizards** | Multi-step Control/studio flows beyond native interactive/apply |
| `providers` / `models` **subcommands** | add/remove/pick/live validation against full agent provider plane |
| `channels` **subcommands** | live wire-up, validation, transport start |
| `approve` / `trust` **subcommands** (beyond grant/deny list) | interactive review, lease mutation, policy edits |
| `memory` / `mnemos` | memory plane runtime |
| Most **operator** helpers (`ask`, `chat`, `tasks`, …) | full agent session / harness |

Bare **`zavorth providers`**, **`models`**, **`channels`**, **`approve`**, **`trust`**, and **`setup` / `interactive` / `apply`** no longer need the agent dist for a useful native surface.

---

## Smoke / tests

```powershell
npm run code:single-bin:smoke
npm run code:capabilities:smoke
npm run code:entry:smoke
npx jest tests/cli/ZavorthCapabilities.test.ts --runInBand
```

---

## Related

- [code-cli-integration.md](./code-cli-integration.md)
- [zavorth-runtime-bridge.md](../protocol/zavorth-runtime-bridge.md)
- [surfaces-code-control-desktop.md](./surfaces-code-control-desktop.md)
