# Zavorth Code bridge (Control / Desktop / companion)

File-based bridge between **Zavorth Code CLI** (repo `zavorth-code`) and this monorepo’s operator surfaces.

**Canonical contract (writer + schemas):**
[`zavorth-code/docs/bridge-contract.md`](../../../zavorth-code/docs/bridge-contract.md)
*(sibling checkout: `1_PROJETOS_ATIVOS/zavorth-code/docs/bridge-contract.md`)*

This doc is the **monorepo-side pointer** for Control, Desktop, and companion implementers. Prefer the Code contract for field definitions; keep this file aligned when paths or roles change.

---

## State files

Under Zavorth **state** dir (`$ZAVORTH_HOME/state` or `$XDG_STATE_HOME/zavorth`):

| File | Written by | Read by |
|------|------------|---------|
| `ops-bridge.json` | Code CLI TUI | Control, Desktop, companion |
| `companion-bridge.json` | Code CLI TUI | Control, Desktop, companion |
| `companion-status.json` | Control / Desktop / companion | Code CLI TUI |

### Code locations (reference)

| Concern | Path in `zavorth-code` |
|---------|------------------------|
| Companion write/read | `packages/cli/src/cli/cmd/tui/util/companion-bridge.ts` |
| Ops snapshot + write | `packages/cli/src/cli/cmd/tui/util/ops-bridge.ts` |
| Home pulse write | `packages/cli/src/cli/cmd/tui/routes/WelcomeBox.tsx` |
| App continuous ops write | `packages/cli/src/cli/cmd/tui/app.tsx` |

---

## Consume (Control / Desktop)

1. Resolve state dir the same way Code does (`ZAVORTH_HOME` → `state/`, else XDG state + `zavorth`).
2. Read `ops-bridge.json` for readiness:
   - `ready`, `providerReady`, `approvals`, `sessions`
   - `checks[]` for doctor-style rows
   - `headline` / `nextAction` for human summary
   - Treat old `updatedAt` as stale (suggest 60–120s soft window).
3. Read `companion-bridge.json` for last Code pulse / session hint.
4. While your process is up, write `companion-status.json`:

```json
{
  "lastSeen": 1710000000000,
  "name": "Desktop"
}
```

Code marks companion **online** if `lastSeen` is within **60 seconds**.

5. For real control (approve, chat, missions), use gateway REST/WebSocket — not these files.

### Production HTTP (Control on gateway)

When Control is served from the ai-gateway (static shell or Next), poll:

| Method | Path | Behavior |
|--------|------|----------|
| **GET** | `/api/code-bridge` | JSON summary (`label`, `tone`, `ops`, …); also heartbeats `companion-status` as Control |
| **POST** | `/api/code-bridge` | Explicit heartbeat body `{ "name": "Zavorth Control" }` |

Implementation:

- Route: `src/ai-gateway/app/api/code-bridge/route.ts`
- Lib: `src/ai-gateway/lib/codeBridge.ts`
- Auth: `requireManagementAuth` (loopback / local Control allowed)

Vite Control shell fetch order: Desktop IPC → **`/api/code-bridge`** → `/__zavorth/code-bridge` (dev-only middleware).

### UI: click chip for checks panel

Operator chrome shows a compact **Code** chip (Control top bar / Desktop statusbar). **Click the chip** to open a quiet checks panel (not a full doctor page):

| Shown | Source |
|-------|--------|
| label, detail, tone | summary from `summarizeCodeBridge` / `GET /api/code-bridge` |
| ops.ready, providerReady, approvals, sessions, modelLabel | `ops-bridge.json` fields on the summary |
| checks[] rows (● ok / △ fail) | `ops.checks` when present |
| nextAction, headline | ops snapshot |
| stateDir | muted truncated path |

Panel behavior: fixed overlay, close via **×**, **Escape**, or click outside. While open, Control re-paints panel body on each bridge poll; Desktop re-renders from the same `useCodeBridge` poll. Keep chrome muted — no green status slabs.

### Multi-host / CORS (production)

When Control is hosted on a different origin than the ai-gateway:

| Side | Knob | Notes |
|------|------|--------|
| **Gateway** | `CORS_ORIGIN` (or `NEXT_PUBLIC_APP_ORIGIN` / `ZAVORTH_PUBLIC_BASE_URL`) | Shared via `src/ai-gateway/shared/utils/cors.ts`. Applied to `OPTIONS` + GET/POST on `/api/code-bridge`. |
| **Control shell** | Base URL override (see below) | Used as prefix for `/api/code-bridge` and fallback `/__zavorth/code-bridge`. |

Control base URL resolution order (`apps/zavorth-control-vite-shell/src/code-bridge-ui.ts` → `resolveCodeBridgeBaseUrl()`):

1. `window.__ZAVORTH_CODE_BRIDGE_URL__` (string)
2. `localStorage.getItem('zavorth.codeBridge.baseUrl')`
3. `<meta name="zavorth-code-bridge-url" content="https://gateway.example">`
4. Relative same-origin (empty base)

Example meta tag:

```html
<meta name="zavorth-code-bridge-url" content="https://gateway.example.com" />
```

Optional local helper (this monorepo):

```bash
node scripts/lib/zavorth-code-bridge.mjs
node scripts/lib/zavorth-code-bridge.mjs --smoke
# or require/import read helpers from that module
```

### QA / tests

```bash
# Node smoke suite (isolated ZAVORTH_HOME) + Jest unit tests
npm run qa:code-bridge

# Pieces:
node scripts/code-bridge-suite.mjs
npx jest tests/ai-gateway/codeBridge --runInBand
node scripts/smoke-code-bridge-api.mjs
# Optional live gateway:
node scripts/smoke-code-bridge-api.mjs --url http://127.0.0.1:3001
```

CI: lightweight job **Code Bridge QA** in `.github/workflows/lint.yml` runs `npm run qa:code-bridge`.

---

## Product boundaries

- **Code CLI** remains the canonical **coding** surface.
- **Control** = dashboard/control plane in this monorepo (Code `packages/app` / `console` were **removed**).
- **Desktop** = `apps/zavorth-desktop` (Code `packages/desktop` was **removed**).
- CLI: `zavorth web` → Control; `zavorth desktop` → official Desktop path.
- Bridges are **selective integration** — not a blind monorepo merge of full Code trees.

See [surfaces-code-control-desktop.md](../product/surfaces-code-control-desktop.md).

---

## Non-goals

- Not RPC.
- Not Control API replacement.
- Not message/tool streaming between products.
