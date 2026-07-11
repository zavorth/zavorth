# Product surfaces: Code, Control, Desktop

Official product-surface policy for the Zavorth monorepo and its relationship to **Zavorth Code**.

Use this page when naming packages, writing docs, choosing where to implement UI, or planning integration with the coding CLI.

---

## Three-way split

| Product | Role | Canonical home |
|---------|------|----------------|
| **Zavorth Code** | Coding agent **terminal** (CLI/TUI) | External monorepo `1_PROJETOS_ATIVOS/zavorth-code` (binary `zavorth`, package `@zavorth/cli`, source `packages/cli`). Future merge path into this monorepo is possible but not required by default. |
| **Zavorth Control** | **Dashboard / control plane** | This monorepo — control shell (e.g. `apps/zavorth-control-vite-shell`), `/control`, web control docs and operator browser UI. |
| **Zavorth Desktop** | **Operator desktop app** | This monorepo — `apps/zavorth-desktop` (and related setup such as `apps/zavorth-setup`). |

These are **three products**, not three names for one UI.

### Unified daily loop (product meaning)

All three surfaces share the same **open → provider ready → first ask → review** semantics via Daily PE / selection preferences:

| Surface | Projection / entry |
|---------|---------------------|
| Desktop | Daily PE + ContinuityBanner + chat |
| Control | Daily PE cards + Settings route pickers |
| Code | `npm run value:code-loop` → `ZavorthCodeDailyLoopService` (same `UserSelectionResolver` prefs) |

```bash
npm run value:code-loop -- --check
```

```text
Zavorth Code     →  terminal coding agent (CLI/TUI)
Zavorth Control  →  browser dashboard / control plane
Zavorth Desktop  →  native/operator desktop shell
```

---

## Zavorth Control

**Control** is the dashboard and control plane:

- Operator state, approvals, providers, channels, memory, receipts.
- Browser surface (default mental model: `/control`).
- Control shell and related web control documentation in this monorepo.
- Shares the **same governed runtime** as CLI and channels; it does not reimplement policy.

**Control is not:**

- The coding CLI/TUI from `zavorth-code`.
- `zavorth-code/packages/app`, `packages/desktop`, or `packages/console`.
- Zavorth Desktop (`apps/zavorth-desktop`).

---

## Zavorth Desktop

**Desktop** is the operator desktop application:

- Daily operator shell: chat, approvals, receipts, local-first affordances.
- Lives at `apps/zavorth-desktop` (plus install/setup companions as documented).
- Parity and readiness matrices: [desktop-surface-parity.md](./desktop-surface-parity.md).

**Desktop is not:**

- “Code Web” or a rebrand of `zavorth-code/packages/app`.
- Zavorth Control (browser control plane), even when feature parity overlaps.
- The frozen Electron package inside `zavorth-code` (`packages/desktop`).

Do not open competing desktop feature work in `zavorth-code/packages/desktop`.

---

## Zavorth Code (CLI)

**Code** is the coding agent in the terminal:

| Field | Value |
|-------|--------|
| Product | Zavorth Code |
| Binary | `zavorth` |
| Package | `@zavorth/cli` |
| Source | `zavorth-code/packages/cli` |
| Repo map | `zavorth-code/PRODUCT.md` |

Code is the **coding** surface: multi-file edits, TUI sessions, repo-local agent workflows. It may talk to the same Zavorth runtime/gateway when integrated, but product ownership and primary development stay on the Code CLI unless an explicit destination plan says otherwise.

**Inside `zavorth-code` (do not treat as Control or Desktop):**

| Package | Policy |
|---------|--------|
| `packages/cli` | Canonical Code product |
| `packages/app` | Freeze; not Control; optional future “Code Web” only after decision |
| `packages/desktop` | Freeze; do not compete with `apps/zavorth-desktop` |
| `packages/console` | Freeze; not Control |

---

## Integration surface (bridges)

Cross-product wiring uses **bridges and ops**, not package renames:

- Companion / node pairing and runtime hooks (companion-bridge style paths, node mesh, ops scripts).
- Shared runtime API, gateway control API, and policy — one execution truth for CLI, Control, Desktop, and channels.
- Selective integration: expose contracts Code and Desktop need; do **not** blind-merge entire trees from `zavorth-code` into Control or Desktop.

| Do | Do not |
|----|--------|
| Integrate via runtime APIs, companion hooks, ops bridges | Copy Control into `zavorth-code` and call it Control |
| Keep Code CLI as coding entry | Rebrand Code `app` / `console` as Control |
| Keep Desktop in `apps/zavorth-desktop` | Revive `zavorth-code/packages/desktop` as the Desktop product |
| Document merge destinations explicitly | Assume every `zavorth-code` package will land under `/control` |

---

## Naming rules (hard)

1. **Control** = dashboard / control plane in this monorepo only.
2. **Desktop** = `apps/zavorth-desktop` (and documented setup), not Code’s frozen desktop package.
3. **Code** = coding CLI/TUI from `zavorth-code` (or a future explicit merge of that CLI).
4. **Do not rebrand Code packages as Control** — including `app`, `console`, and any future “Code Web”.
5. Overlapping capabilities (chat, approvals, status) may exist on multiple surfaces; **product names stay distinct**.

---

## Related docs

| Doc | Purpose |
|-----|---------|
| [product-direction.md](../product-direction.md) | Product principles; short surfaces pointer |
| [desktop-surface-parity.md](./desktop-surface-parity.md) | Desktop vs `/control` vs CLI capability matrix |
| [interfaces/zavorthcontrol.md](./interfaces/zavorthcontrol.md) | Operator-facing Control overview |
| `zavorth-code/PRODUCT.md` | Product map for the Code monorepo |

---

## One-line policy

**Code codes in the terminal; Control operates in the browser; Desktop is the native operator shell — integrate through bridges, never by renaming Code packages into Control.**
