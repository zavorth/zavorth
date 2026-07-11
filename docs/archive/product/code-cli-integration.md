> Archived from public docs tree on 2026-07-11. Historical program notes — not current user documentation.

# Zavorth terminal CLI: Code TUI replaces monorepo agent CLI

**Decision (revised):** Option **C — replacement**  
Bring the **Zavorth Code coding CLI/TUI** into this monorepo as the **only** terminal product, then **retire** the legacy monorepo agent CLI surface. Runtime tools, policy, and gateway stay in the monorepo; they are **hosted behind / inside** the Code TUI, not exposed as a second user-facing CLI forever.

**Date:** 2026-07-10 (revised from 2026-07-09 dual-bin plan)  
**Status:** Fases A–**G** done (monorepo source of truth + single public bin + capabilities)

**Related:** [surfaces-code-control-desktop.md](../../product/surfaces-code-control-desktop.md) · **Audit:** [AUDIT-code-cli.md](./AUDIT-code-cli.md)

---

## Intent (product truth)

```text
ANTES
  monorepo:  zavorth  →  CLI agent legada (Node, src/zavorth-cli + registry enorme)
  sibling:   zavorth  →  TUI coding (Bun / OpenTUI)

DEPOIS (alvo)
  monorepo:  zavorth  →  TUI do Code (nativa)
                    + runtime / tools / gateway monorepo por baixo
  um bin no PATH:    zavorth
  sem segundo CLI de coding eterno (zavorth-code só como alias transitório)
  app / desktop / web do Code: fora deste programa
  Control e Desktop: continuam produtos separados (não são a TUI)
```

This is **not** “two CLIs side by side with a dispatcher.”  
This is **swap the terminal shell**, migrate monorepo capabilities into that shell, **delete** the old public CLI.

---

## Goals

1. **One terminal entry:** bare `zavorth` = Code TUI (OpenTUI session + coding workflows).
2. **Native home:** Code CLI packages live inside the monorepo (not forever a disconnected sibling tree).
3. **Absorb monorepo power:** tools, setup, doctor, channels, approvals, memory, gateway hooks, etc. become capabilities **of** that TUI (subcommands, slash commands, or internal runtime calls)—not a second `zavorth` binary.
4. **Selective merge only:** coding CLI packages; **never** Code `app` / `desktop` / `console` / `web` as Control or Desktop.
5. **Keep Control ≠ Desktop ≠ terminal CLI.** Desktop visual product is **not** redesigned by this program; at most it keeps bridge/status integration.
6. **Preserve bridges** (`ops-bridge` / `companion-*`) while the shell changes.
7. **Retire legacy public CLI:** `src/zavorth-cli.ts` user-facing path, dual bin policy, and “agent CLI forever” docs go away after cutover.

## Non-goals

- Do **not** merge Code web/desktop/console into Control or into `apps/zavorth-desktop`.
- Do **not** make Control “the coding TUI.”
- Do **not** keep two permanent user-facing CLIs (`zavorth` + `zavorth-code`) as the end state.
- Do **not** delete the sibling `zavorth-code` repo on day one (dual-track until monorepo is source of truth).
- Do **not** redesign Desktop chrome as part of this program.

---

## Binary policy (end state vs transition)

| Phase | What users run | Notes |
|-------|----------------|--------|
| **End state** | **`zavorth`** only | Points at Code TUI + monorepo runtime behind it |
| **Transition (today)** | `zavorth` = legacy agent CLI; `zavorth-code` / `zavorth code` = Code TUI | Dual-bin was a **scaffold**, not the goal |
| **Deprecation window** | Optional alias `zavorth-code` → same process as `zavorth` | Remove after docs/scripts migrate |

```text
END STATE
  zavorth           →  Code TUI entry (native monorepo)
  (optional)        →  internal modules under packages/… or src/runtime
  NO second coding CLI product
```

---

## Architecture target

```text
┌─────────────────────────────────────────────────────────────┐
│  zavorth  (single public CLI)                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Code TUI shell  (OpenTUI, session, prompt, coding UX) │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │                              │
│  ┌───────────────────────────▼───────────────────────────┐  │
│  │  Monorepo runtime surface (not a second CLI)          │  │
│  │  tools · policy · gateway · memory · channels · …     │  │
│  │  (today largely under src/, ai-gateway, services)     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                              │
         │ bridge files (optional)      │ HTTP / local APIs
         ▼                              ▼
   Control / Desktop              gateway / providers
```

**Shell** = UX from zavorth-code CLI.  
**Brain** = monorepo runtime.  
**Not** = forever spawning a second binary for daily use.

---

## What moves (selective package set)

From sibling `../zavorth-code` into monorepo (already scaffolded under `packages/code/`):

| Source | Destination | Why |
|--------|-------------|-----|
| `packages/cli` | `packages/code/cli` | Coding TUI + agent loop |
| `packages/shared` | `packages/code/shared` | Path/state helpers |
| `packages/plugin` | `packages/code/plugin` | Plugin API for TUI |
| `packages/script` | `packages/code/script` | Build/dev scripts |
| `packages/sdk/js` | `packages/code/sdk-js` | SDK client |

**Explicitly excluded forever from this program:** `app`, `desktop`, `console`, `web`, `storybook`, `enterprise`, `slack`, …

**Later (replacement phases):** layout may flatten (e.g. `packages/cli` or `packages/zavorth-terminal`) once dual-track ends; name is secondary to “one `zavorth` entry.”

---

## What is retired (legacy monorepo CLI)

After capability parity is acceptable:

| Legacy surface | Fate |
|----------------|------|
| Public path `bin/zavorth.js` → `dist/zavorth-cli.js` as **the** product | Replaced by Code TUI entry |
| User-facing `src/zavorth-cli.ts` / large command registry as daily UX | Removed or reduced to **internal** modules / tests only |
| Dual permanent bins (`zavorth` + `zavorth-code`) | End state: one bin |
| Docs that say “agent CLI stays `zavorth`, coding is `zavorth-code`” | Superseded by this file |

**Not retired:** gateway, Control, Desktop, domain services, security policy, bridges—those remain monorepo property; they **plug into** the new shell.

---

## Already landed (keep as material; reframe)

Work done under the old dual-bin plan is **reusable scaffolding**, not the finished product:

| Item | Status | Role under Option C |
|------|--------|---------------------|
| Stage 0–1: decision docs, `packages/code/`, `code:sync` | Done | Still needed to bring TUI tree in |
| Stage 2: Bun workspace under `packages/code` | Done | Keep until entry is unified |
| Stage 3: bridges + surfaces pointer | Mostly done | Keep bridges; rewrite binary story |
| Stage 4: `zavorth code` / `bin/zavorth-code.js` dispatcher | Done | **Transitional only** — delete or collapse once `zavorth` = TUI |
| Dual-bin policy as end state | **Superseded** | Do not treat as success criterion |

Commands that still help during transition:

```powershell
npm run code:sync
npm run code:install
npm run code:dev
npm run code:smoke
npm run code:dispatch:smoke   # transitional dual entry
node bin/zavorth-code.js --version
```

---

## Program phases (Option C)

### Stage A — Decision & docs — **DONE (this revision)**

- [x] Product choice: **replace** legacy monorepo CLI with Code TUI
- [x] End-state binary: single **`zavorth`**
- [x] Allowlist / denylist (CLI only; no Code app/desktop/web)
- [x] Explicit non-goal: permanent two-CLI coexistence
- [x] Mark dual-bin Stage 4 as transitional scaffolding

### Stage B — Native TUI home (monorepo owns the tree)

- [x] Scaffold + sync tooling (`packages/code/`, `code:sync`)
- [x] Bun install path for Code packages
- [ ] Make monorepo **primary** edit path for TUI (stop treating sibling as required for daily work)
- [ ] CI: typecheck/test for Code CLI from monorepo root scripts
- [ ] Freeze feature work on sibling except sync/export until cutover policy says otherwise

### Stage C — Single entry: `zavorth` → Code TUI — **DONE**

- [x] Root `bin/zavorth` launches Code TUI (Bun monorepo entry or built artifact)
- [x] Legacy agent CLI available only under an explicit escape hatch during migration, e.g. `zavorth legacy …` or `ZAVORTH_LEGACY_CLI=1` (optional, time-boxed)
- [x] Collapse or remove permanent `zavorth-code` bin (alias OK briefly) — `bin/zavorth-code.js` is a thin wrapper over shared `bin/lib/launch-code-tui.cjs`
- [x] Help/onboarding docs: one command, one product — this file + launcher messages; broader docs still lag transitional wording
- [x] Smoke: `zavorth --version` / cold start from monorepo root — `npm run code:entry:smoke` (`scripts/smoke-entry-tui.mjs`)

### Stage D — Runtime behind the TUI (not a second CLI) — **DONE (contract layer)**

**Status: DONE at contract / hosting layer** (2026-07-10)

What landed: monorepo **hosts** the TUI with a formal runtime contract (env + `runtime-bridge.json` + ops diagnostic). This is **not** yet full LLM/approvals traffic routed through monorepo gateway (that deep wire continues in Stage E / follow-ups).

- [x] Define integration contract: env + file bridge; policy authority declared as gateway
  - See `docs/protocol/zavorth-runtime-bridge.md`
- [x] Wire **hosting** contract into launcher + TUI reader
  - Env: `ZAVORTH_RUNTIME_SOURCE`, `ZAVORTH_GATEWAY_BASE_URL`, `ZAVORTH_POLICY_AUTHORITY=gateway`, …
  - Writer: `scripts/lib/zavorth-runtime-bridge.mjs` (+ CJS launcher write via `--write`)
  - TUI reader: `packages/code/cli/src/util/host-runtime.ts`
  - Ops check row `monorepo-runtime` (diagnostic only)
- [x] Prefer **one declared execution truth** (`policyAuthority: "gateway"` when monorepo-hosted)
  - **Partial wire (2026-07-10):** monorepo-hosted `zavorth` provider injects OpenAI-compatible `baseURL` → `${ZAVORTH_GATEWAY_BASE_URL}/v1` when options.baseURL is unset (see protocol “TUI consumption”)
  - **Honest gap:** non-`zavorth` providers, approvals/tool policy, and full provider mesh still use TUI-local stacks
- [x] Keep file bridge compatible where Desktop/Control still watch Code status
  - Separate `runtime-bridge.json` (does not alter `ops-bridge.json` v1 required fields)
- Smoke: `npm run code:runtime-bridge:smoke` · Jest: `tests/cli/ZavorthRuntimeBridge.test.ts`

### Stage E — Migrate monorepo CLI capabilities into the shell — **DONE**

User-facing agent commands work on bare **`zavorth <cmd>`** via the monorepo capability layer (no `legacy` required for daily use). Default empty `zavorth` remains Code TUI.

| Capability cluster | Examples | Strategy |
|--------------------|----------|----------|
| Setup / health | `setup`, `doctor`, `status`, `home` | native health + delegated setup |
| Models / providers | `providers`, `models` | **hybrid** bare summary (env+gateway); subcommands → agent runtime |
| Channels / memory | `channels`, `memory`, `mnemos` | **hybrid** channels inventory; memory/mnemos delegated |
| Approvals / trust | `approve`, `trust` | **hybrid** local pending/policy summary; interactive → agent/Control |
| Coding workflows | default TUI, `run`/`mcp`/… | coding-owned (not intercepted) |
| Operator escapes | `open` native; rest delegated | `legacy` still available |

- [x] Inventory: [cli-capabilities.md](../../product/cli-capabilities.md) + `bin/lib/zavorth-capabilities.cjs`
- [x] Migrate by cluster: entry routing in `bin/zavorth.js`; native `doctor`/`status`/`home`/`open`/`capabilities`
- [x] Deprecate daily `legacy` requirement: delegated commands run agent dist under the same public names
- Smoke: `npm run code:capabilities:smoke` · Jest: `tests/cli/ZavorthCapabilities.test.ts`

**Honest gap:** delegated commands still execute `dist/zavorth-cli.js` (not full in-process rewrite). That is intentional until deeper runtime embedding; UX is already one entry.

### Stage F — Delete legacy public CLI — **DONE**

- [x] Public entry is only `bin/zavorth.js` → Code TUI + monorepo capabilities
- [x] Removed public `bin.zavorth-code` / `bin/zavorth-code.js` (no second product on PATH)
- [x] `@zavorth/cli` no longer declares a separate npm `bin`
- [x] Agent `dist/zavorth-cli.js` is **internal** (delegated capabilities + maintainer hatch `ZAVORTH_LEGACY_CLI` / `zavorth __agent` / compat `legacy`)
- [x] Dual-bin smokes reframed; `npm run code:single-bin:smoke`
- [x] Docs: single-bin product story (this file, surfaces, capabilities inventory)
**Not deleted:** `src/zavorth-cli.ts` source / dist remain as **backend** for delegated commands until deeper embedding.

### Stage G — Cutover & cleanup — **DONE**

- [x] Monorepo is **source of truth** for terminal CLI (`packages/code/SOURCE-OF-TRUTH.md`)
- [x] Sibling `zavorth-code` → **mirror/archive** via `npm run code:export` (writes `MIRROR-FROM-MONOREPO.md` on sibling)
- [x] Reverse import only with explicit `--from-sibling` (no silent overwrite of monorepo)
- [x] Sync `--check` + `npm run code:cutover:smoke` + CI workflow `.github/workflows/code-cli.yml`
- [x] Dual-bin notes archived in plan/audit; ownership table remains below
- [x] Desktop not visual-redesigned; Control remains dashboard only

**Deferred (optional):** rename `packages/code` → `packages/cli` branding — not required for cutover.

---

## Mapping: old dual-bin phases → Option C

| Old plan | Outcome under Option C |
|----------|-------------------------|
| Stage 0–2 scaffold/sync/Bun | Keep → feeds Stage B |
| Stage 3 bridges | Keep → Stage D |
| Stage 4 dual dispatcher | Transitional only → superseded by Stage C |
| Old Stage 5–6 dual-repo cutover | Rewritten as Stage G after replacement |

---

## Risk register

| Risk | Mitigation |
|------|------------|
| Users lose legacy CLI commands overnight | Stage E inventory + phased migrate; optional `legacy` hatch |
| Two runtimes / two policies | Stage D contract; one gateway/policy truth |
| Bun vs npm forever | Accept hybrid during B–C; unify entry packaging before F |
| Accidental Control/Desktop pollution | Denylist; PR checklist; no Code app/desktop merge |
| Scope creep into Desktop UI | Explicit non-goal; bridge-only Desktop touches |
| Sibling drift | Stage B primary monorepo; G cutover |
| Huge legacy CLI surface | Cluster migration; do not big-bang delete before E |

---

## PR checklist

- [ ] Does not reintroduce permanent dual user-facing CLIs as the goal
- [ ] Only allowlisted Code packages (no Code web/desktop/console as product)
- [ ] Bridge contract still valid if bridge files touched
- [ ] Binary story matches this doc (transition vs end state labeled)
- [ ] Desktop visual not redesigned “by accident”
- [ ] Smoke for the entry path you claim (`zavorth` TUI and/or transitional alias)
- [ ] If removing legacy commands: inventory + replacement path documented

---

## Commands (while transitional scaffolding exists)

```powershell
# From monorepo root — bring / refresh Code CLI tree
npm run code:sync
npm run code:install

# Run coding TUI (today: still separate entry)
npm run code:dev
# or:
node bin/zavorth-code.js
node bin/zavorth.js code --version   # transitional intercept

# Workspace / dispatch / entry / runtime smokes
npm run code:smoke
npm run code:dispatch:smoke
npm run code:entry:smoke
npm run code:runtime-bridge:smoke
```

**Target commands (single public bin):**

```powershell
zavorth              # Code TUI (default)
zavorth --version
zavorth doctor       # monorepo capability
zavorth setup        # monorepo capability (may use internal agent dist)

npm run code:single-bin:smoke
npm run code:entry:smoke
npm run code:capabilities:smoke
```

---

## Ownership (end state)

| Area | Owner path |
|------|------------|
| **Terminal product (only CLI)** | Code TUI tree in monorepo (`packages/code/cli` until renamed) |
| **Runtime / tools / policy** | Monorepo `src/`, services, gateway — **behind** the TUI, not a second CLI |
| **Control** | `apps/zavorth-control-vite-shell`, control APIs |
| **Desktop** | `apps/zavorth-desktop` (visual product separate) |
| **Bridge** | Code writers + `scripts/lib/zavorth-code-bridge.mjs` + Control/Desktop readers |
| **Legacy agent CLI** | Deprecate → delete (Phases E–F) |

---

## Explicit correction vs previous plan

| Previous (Option B dual-bin) | Now (Option C replacement) |
|------------------------------|----------------------------|
| Two products on PATH forever | One `zavorth` on PATH |
| Agent CLI stays; coding is `zavorth-code` | Code TUI **is** the CLI; agent surface absorbed |
| Stage 4 dispatcher = success | Stage 4 = temporary scaffold |
| “Connect lightly” via spawn | **Replace shell** + wire runtime underneath |

---

*Living plan. Update Stage checkboxes as work lands. Dual-bin implementation remaining in the tree is transitional until Phases C–F complete.*
