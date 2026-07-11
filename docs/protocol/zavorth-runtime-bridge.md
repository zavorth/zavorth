# Zavorth monorepo runtime bridge

**Purpose:** Formal contract for hosting the **Code TUI** as the terminal shell while the **monorepo gateway/runtime** remains the policy and execution authority when launched from the monorepo entry.

**Product shape:**

```text
User → bin/zavorth (monorepo entry)
       → injects monorepo runtime env + runtime-bridge.json
       → Code TUI (shell / UX)
            ↳ policy / approvals / gateway truth = monorepo ai-gateway
            ↳ ops-bridge / companion-* file bridges stay valid for Control/Desktop
```

This is **not** a second CLI. The TUI remains the only interactive shell; monorepo runtime is **behind** it.

**Related:**

- Code file bridges: [zavorth-code-bridge.md](./zavorth-code-bridge.md)
- Merge program (archived): [code-cli-integration.md](../archive/product/code-cli-integration.md)
- Implementation (Node, no TS build): `scripts/lib/zavorth-runtime-bridge.mjs`
- TUI reader: `packages/code/cli/src/util/host-runtime.ts`

---

## Roles

| Actor | Role |
|-------|------|
| Monorepo entry (`bin/zavorth.js`) | Detect monorepo host, call `buildTuiChildEnv` + `writeRuntimeBridge`, spawn Code TUI |
| Code TUI | Shell UX; reads env / `runtime-bridge.json` for gateway URL + policy authority |
| Monorepo ai-gateway | Policy / approvals / provider execution truth when `policyAuthority=gateway` |
| Control / Desktop | Continue reading **ops-bridge** / companion files only — **do not** depend on `runtime-bridge.json` for chrome |

---

## Environment variables (injected into TUI child)

When the monorepo launcher starts the Code TUI, it **must** set:

| Variable | Value / meaning |
|----------|-----------------|
| `ZAVORTH_RUNTIME_SOURCE` | `monorepo` — hosted by monorepo entry |
| `ZAVORTH_WORKSPACE_ROOT` | Absolute path to monorepo root |
| `ZAVORTH_GATEWAY_BASE_URL` | Resolved gateway base URL (see order below) |
| `ZAVORTH_POLICY_AUTHORITY` | `gateway` — policy/approvals truth is monorepo gateway when integrated |
| `ZAVORTH_CODE_FROM_WORKSPACE` | `1` — flag for tooling / smoke / diagnostics |

Additional vars already used by monorepo (`ZavorthGateway_BASE_URL`, `BASE_URL`, `NEXT_PUBLIC_BASE_URL`) may exist in the parent env and participate in **resolution**; the launcher still writes the canonical `ZAVORTH_GATEWAY_BASE_URL` into the child env.

---

## Gateway URL resolution order

Implemented by `resolveGatewayBaseUrl(env)`:

1. `env.ZAVORTH_GATEWAY_BASE_URL` **or** `env.ZavorthGateway_BASE_URL`  
   (monorepo gateway historically uses `ZavorthGateway_BASE_URL` in `src/ai-gateway/shared/utils/resolveGatewayBaseUrl.ts` — both are accepted)
2. `env.BASE_URL` / `env.NEXT_PUBLIC_BASE_URL`
3. Default: `http://localhost:20128` (same as monorepo `DEFAULT_ZavorthGateway_BASE_URL`)

Trailing slashes are stripped. Empty/whitespace values are skipped.

---

## State file: `runtime-bridge.json`

**Location:** same state directory as ops/companion bridges:

- `$ZAVORTH_HOME/state` when `ZAVORTH_HOME` (or legacy `MIMOCODE_HOME`) is set absolute
- else `$XDG_STATE_HOME/zavorth` (or `~/.local/state/zavorth`)

**Separate file** from `ops-bridge.json` so Control/Desktop ops readers are not broken.

### Schema (version 1)

```json
{
  "version": 1,
  "updatedAt": 1710000000000,
  "source": "monorepo",
  "entry": "code-tui",
  "product": "zavorth-terminal",
  "monorepoRoot": "C:/path/to/Zavorth",
  "gatewayBaseUrl": "http://localhost:20128",
  "policyAuthority": "gateway",
  "bridges": {
    "ops": "ops-bridge.json",
    "companion": "companion-bridge.json",
    "companionStatus": "companion-status.json"
  }
}
```

| Field | Type | Notes |
|-------|------|-------|
| `version` | `1` | Schema version |
| `updatedAt` | number (ms epoch) | Write time |
| `source` | `"monorepo"` | Host identity |
| `entry` | `"code-tui"` | Shell entry class |
| `product` | `"zavorth-terminal"` | Product label for diagnostics |
| `monorepoRoot` | string (absolute) | Monorepo project root |
| `gatewayBaseUrl` | string | Resolved base URL, no trailing slash |
| `policyAuthority` | `"gateway"` | Policy truth |
| `bridges` | object | Filenames of sibling Code bridges (not full paths) |

**Write:** atomic tmp + rename (same pattern as `scripts/lib/zavorth-code-bridge.mjs`).

---

## Module API (`scripts/lib/zavorth-runtime-bridge.mjs`)

| Export | Behavior |
|--------|----------|
| `DEFAULT_GATEWAY_BASE_URL` | `'http://localhost:20128'` |
| `resolveStateDir(env)` | Align with code-bridge state dir |
| `resolveGatewayBaseUrl(env)` | Resolution order above |
| `resolveMonorepoRuntimeContract({ projectRoot, env })` | Plain object matching JSON (no write) |
| `writeRuntimeBridge({ projectRoot, env })` | Atomic write; returns payload |
| `buildTuiChildEnv({ projectRoot, env })` | `{ ...env, ZAVORTH_RUNTIME_SOURCE, … }` |
| `runtimeBridgePath(env)` | Absolute path to `runtime-bridge.json` |
| `readRuntimeBridge(env)` | Best-effort parse or `undefined` |

### CLI

```bash
node scripts/lib/zavorth-runtime-bridge.mjs --json   # print contract
node scripts/lib/zavorth-runtime-bridge.mjs --write  # write runtime-bridge.json
```

Optional: `--root <path>` overrides monorepo root (default: repo root relative to this script).

---

## How the monorepo entry should call this

Canonical implementation lives in this module. Launchers **must** use it rather than hand-rolling env vars.

```js
// bin/zavorth.js (illustrative)
const path = require("node:path")
// Prefer shared launcher helpers that mirror this module when CJS cannot import ESM directly.

const projectRoot = path.resolve(__dirname, "..")

// 1) Persist contract (best-effort)
// writeRuntimeBridge({ projectRoot, env: process.env })

// 2) Spawn Code TUI with injected authority env
// const childEnv = buildTuiChildEnv({ projectRoot, env: process.env })
// spawn(tuiCommand, tuiArgs, { env: childEnv, stdio: "inherit" })
```

**Rules:**

1. Always apply monorepo child env when launching the TUI from monorepo entry.
2. Prefer writing `runtime-bridge.json` on each successful monorepo-hosted launch (best-effort if state dir unwritable).
3. Do **not** invent a parallel set of env names; this module is the source of truth.
4. Do **not** mutate `ops-bridge.json` schema for monorepo metadata.

---

## TUI side (`host-runtime.ts`)

Lightweight helpers (env first, optional file):

| Function | Behavior |
|----------|----------|
| `isProductHosted(env?)` | `ZAVORTH_RUNTIME_SOURCE === 'monorepo'` **or** `ZAVORTH_CODE_FROM_WORKSPACE === '1'` **or** `runtime-bridge.json` `source === 'monorepo'` |
| `getProductGatewayBaseUrl(env?)` | Env resolution + file fallback + default |
| `productOpenAiCompatibleBaseUrl(env?)` | Gateway root + `/v1` (no double suffix) for AI SDK openai-compatible clients |
| `resolveOpenAiCompatibleBaseUrl({ existingBaseUrl, env })` | Explicit `baseURL` wins; else monorepo `/v1` when hosted; else `undefined` (standalone) |
| `withProductProviderBaseUrl(options, env?)` | Injects `baseURL` into provider options only when monorepo-hosted and missing |
| `getHostRuntimeSummary(env?)` | Short label/detail for ops checks |
| `readRuntimeBridgeFile()` | Best-effort read from state dir |

Optional ops check (best-effort, does not fail TUI):

```ts
{
  id: "host-runtime",
  ok: true | false,
  label: "Monorepo runtime",
  detail: "<gatewayBaseUrl> · policy=gateway"
}
```

Only appended when monorepo-hosted. Missing bridge file is **not** an error if env already marks monorepo host.

---

## TUI consumption (execution-truth wiring)

What the Code TUI **actually** does with monorepo host metadata today:

### Wired (affects real provider resolution)

| Path | Behavior |
|------|----------|
| Launcher → child env | `ZAVORTH_RUNTIME_SOURCE=monorepo`, `ZAVORTH_GATEWAY_BASE_URL`, `ZAVORTH_POLICY_AUTHORITY=gateway`, `ZAVORTH_WORKSPACE_ROOT`, `ZAVORTH_CODE_FROM_WORKSPACE=1` |
| `runtime-bridge.json` | Written on monorepo launch; TUI can read when env is incomplete |
| Ops / Welcome diagnostic | `monorepo-runtime` check row when hosted (label + gateway URL + policy) |
| **Provider `zavorth` baseURL** | When product-hosted **and** no explicit `baseURL`, injects product OpenAI-compatible base (`…/v1`) |
| **Other openai-compatible providers** | **Automatic when product-hosted** → gateway `…/v1` for allowlist (`openai,openrouter,groq,deepseek,xai` or `ZAVORTH_ROUTE_PROVIDER_IDS`). Opt-out: `ZAVORTH_ROUTE_PROVIDERS=0` or `ZAVORTH_PROVIDERS_DIRECT=1` |
| **Anthropic (`@ai-sdk/anthropic`)** | **Automatic when product-hosted** → gateway `…/v1` (SDK posts `/messages` → **POST /v1/messages**). Opt-out: `ZAVORTH_ROUTE_ANTHROPIC=0` or `ZAVORTH_ANTHROPIC_DIRECT=1` |
| Explicit config | User/config/auth `baseURL` always wins — product host does **not** override |
| Approvals CLI | `zavorth approve` lists via `GET /api/experience/approvals` when gateway up; `grant`/`deny` use `POST …/decision` (loopback auth) |

**Env already injected by launcher:** `ZAVORTH_GATEWAY_BASE_URL` is the canonical gateway root (no trailing slash). The TUI appends `/v1` for OpenAI-compatible and Anthropic SDK baseURLs.

**Standalone Code** (no product host env / bridge): no injection; free `zavorth` catalog URLs and other providers behave as before (Anthropic → vendor API).

### Anthropic product routing (automatic when hosted)

Anthropic uses the **native** SDK (`@ai-sdk/anthropic`). Requests go to `{baseURL}/messages`. The product **ai-gateway** already accepts Claude-format traffic at **POST /v1/messages** (translator + handleChat), so product baseURL is `{gateway}/v1` — the same root as OpenAI-compatible clients.

| Mode | Behavior |
|------|----------|
| **Product-hosted (default)** | Inject gateway `…/v1` as Anthropic SDK `baseURL` when no explicit config `baseURL` |
| **Standalone** (no product host) | Vendor Anthropic API — **no** injection |
| `ZAVORTH_ROUTE_PROVIDERS=1` | Routes openai-compatible allowlist only; **does not** control Anthropic (Anthropic uses its own auto/opt-out gate) |
| `ZAVORTH_ROUTE_ANTHROPIC=0` or `ZAVORTH_ANTHROPIC_DIRECT=1` | **Opt-out:** force vendor API even when product-hosted |
| `ZAVORTH_ANTHROPIC_BASE_URL` | Optional custom base when routing is enabled |
| Explicit config/auth `baseURL` | Always wins |

```powershell
# Product-hosted default: Anthropic → gateway /v1/messages (no flag needed)

# Opt-out → vendor api.anthropic.com:
$env:ZAVORTH_ROUTE_ANTHROPIC="0"
# or:
$env:ZAVORTH_ANTHROPIC_DIRECT="1"

# Optional custom Anthropic base when still routing:
# $env:ZAVORTH_ANTHROPIC_BASE_URL="http://localhost:20128/v1"
```

Implementation: `packages/code/cli/src/util/host-runtime.ts` (`isAnthropicProductRouteEnabled`, `resolveAnthropicCompatibleBaseUrl`) and `provider.ts` (`resolveSDK`). Gateway surface: `src/ai-gateway/app/api/v1/messages/route.ts`.

### Still local / not fully routed through product gateway

| Area | Honest status |
|------|----------------|
| openai / openrouter / groq / … when product-hosted | **Routed** to gateway `/v1` by default (opt-out available) |
| Anthropic when product-hosted | **Routed** to gateway `/v1/messages` by default (opt-out available) |
| Tool permission policy (`policyAuthority=gateway`) | **Dual enforcement**: (1) TUI merges `config/runtime-permissions.json` into every `Permission.ask`; (2) live `POST /api/experience/permissions/evaluate` on the gateway when reachable (same product profile). Remote **deny** always wins; remote down → file merge only. Opt-out remote: `ZAVORTH_POLICY_REMOTE=0`. Fail-closed file miss: `ZAVORTH_POLICY_FALLBACK=fail`. |
| Provider mesh / multi-provider product routing | `zavorth` + openai-compatible allowlist + Anthropic auto when product-hosted |
| Auth / API keys for product gateway | `zavorth setup token` writes management token to user state; loopback approve still works without token |
| Live health of ai-gateway | doctor/status soft-probe; optional smoke hard-fail with `ZAVORTH_SMOKE_REQUIRE_GATEWAY=1` |

Tests (no live gateway):

```bash
# pure helpers (Bun, under packages/code/cli)
bun test test/util/host-runtime.test.ts
bun test test/util/gateway-policy.test.ts

# writer bridge (Jest, monorepo root)
npx jest tests/cli/ZavorthRuntimeBridge.test.ts --runInBand
npm run code:runtime-bridge:smoke
```

### Product policy (gateway authority)

When `ZAVORTH_POLICY_AUTHORITY=gateway` (default if product-hosted):

1. **Local product file:** TUI loads `{ZAVORTH_WORKSPACE_ROOT}/config/runtime-permissions.json` and merges into every tool permission check
2. **Live gateway:** TUI also `POST`s to `/api/experience/permissions/evaluate` (loopback auth ok). **deny** from gateway wins immediately; **allow** can skip the human prompt when local rules do not deny
3. Product rules are applied **last** in the local merge so product `block`/`approval` outrank local `allow`
4. Interactive ask UI remains in the TUI when the decision is `ask`

```powershell
# Fail closed if the product policy file is missing:
$env:ZAVORTH_POLICY_FALLBACK="fail"
# Force local-only permissions even when hosted:
$env:ZAVORTH_POLICY_AUTHORITY="local"
# Disable live HTTP evaluate (file merge only):
$env:ZAVORTH_POLICY_REMOTE="0"
```

---

## Compatibility guarantees

1. **`ops-bridge.json` version 1** required fields for Control/Desktop are unchanged.
2. **`runtime-bridge.json` is additive** — Control/Desktop may ignore it entirely.
3. **Desktop visual product** is not redesigned by this contract.
4. Standalone Code (not launched from monorepo) does not set `ZAVORTH_RUNTIME_SOURCE`; TUI behaves as today.

---

## Smoke / QA

```bash
npm run code:runtime-bridge:smoke
# → node scripts/smoke-runtime-bridge.mjs

npx jest tests/cli/ZavorthRuntimeBridge.test.ts --runInBand
```

Smoke:

1. Resolve contract without write  
2. Write under temp `ZAVORTH_HOME`  
3. Assert file fields  
4. Assert `buildTuiChildEnv` keys  
5. Optional soft HTTP probe to gateway (`/api/code-bridge` or health) — does not fail suite if gateway is down  

---

## Non-goals

- Not a replacement for ops/companion file bridges.
- Not Control API redesign.
- Not Desktop UI work.
- Entry policy lives in `bin/zavorth.js`; this module only supplies runtime helpers.
