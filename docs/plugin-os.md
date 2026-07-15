# Zavorth Plugin OS

Plugin OS is the **first-party extension runtime for Zavorth**. Packages declare a
`zavorth.plugin-os.v1` manifest, expose capabilities, and are discovered,
loaded, and wired into the agent tool registry without taking down core boot.

> **Brand rule:** Extension is **Zavorth Plugin OS**, not third-party agent brands.
> Use Zavorth-native names (`@zavorth/plugin-sdk`, `create-zavorth-plugin`,
> `@zavorth/example-plugins`, `plugins/examples/*`). Do not introduce foreign
> agent-framework branding in plugin ids, package names, or docs.
>
> **Roadmap:** brand-agnostic skill + plugin ecosystem growth is tracked in
> [ecosystem-extension-waves.md](./product/ecosystem-extension-waves.md)
> (`config/ecosystem-extension-waves.json`).

## Quick start

```bash
# List discovered plugins
zavorth plugins list

# Enable a first-party package
zavorth plugins enable web-search --yes

# Recommend packages for an intent (CLI)
zavorth plugins route "search the web for release notes"

# Agent tool (never auto-enables)
# tool: plugin_recommend  intent="search the web"
```

## Design overview

| Concern        | Behavior                                                           |
| -------------- | ------------------------------------------------------------------ |
| Contract       | `zavorth.plugin-os.v1` (`PluginManifestContract`)                  |
| Soft-fail load | Broken plugins never crash bootstrap                               |
| Trust          | Declared permissions + policy + optional signatures                |
| Routing        | `plugin_recommend` / suggest — never auto-enables                  |
| Authoring      | `definePlugin` from `@zavorth/plugin-sdk` or plain `register(ctx)` |

### moduleKinds

Every package declares exactly one `moduleKind` from:

| Kind          | Typical bind                                      | Notes                             |
| ------------- | ------------------------------------------------- | --------------------------------- |
| `tool`        | `bindCapability` / `bindTool`                     | Default generic tool              |
| `provider`    | `bindProvider` + `complete`                       | Soft complete stub when offline   |
| `channel`     | `bindChannel` + `send`                            | Soft send; no network by default  |
| `memory`      | `bindMemoryBackend`                               | read/write backend                |
| `media`       | `bindCapability` (+ specialized media registrars) | Image / video / vision packs      |
| `voice`       | `bindCapability`                                  | STT/TTS style surfaces            |
| `search`      | `bindCapability` / `registerWebSearchProvider`    | Web / API search                  |
| `diagnostics` | `bindCapability`                                  | Status / doctor style             |
| `bridge`      | `bindCapability`                                  | Outbound bridge forward           |
| `agent`       | `bindCapability` + `registerHook`                 | Hooks + agent-facing caps         |
| `sandbox`     | `bindCapability`                                  | Sandboxed local exec (high trust) |
| `qa`          | `bindCapability`                                  | Checks / verification             |
| `workspace`   | `bindCapability`                                  | Workspace-scoped utilities        |
| `module`      | `bindCapability`                                  | Generic fallback kind             |

Contract source: `src/contracts/core/PluginManifestContract.ts`.

## Manifest

Required shape (see `PluginManifestContract`):

- `schemaVersion`: `zavorth.plugin-os.v1`
- `id`, `label`, `version`, `moduleKind`
- `capabilities[]` with `id` / `intent` / `label`
- `entrypoint.module` + `exportName` (default `register`)
- `lifecycle.actions` must include `invoke`
- `policy.defaultTrust` (`review` | `trusted` | `blocked`)

Entrypoint style (CommonJS recommended for Jest / loaders):

```js
function register(ctx) {
  // Soft-fail: only bind when helper exists
  if (typeof ctx.bindCapability === 'function') {
    ctx.bindCapability('demo.run', async ({ input }) => {
      return { output: { ok: true, echo: input } };
    });
  }
}
module.exports = { register };
```

Or with the SDK (`definePlugin` from `@zavorth/plugin-sdk`):

```js
const { definePlugin } = require('@zavorth/plugin-sdk');

const plugin = definePlugin({
  id: 'demo',
  kind: 'tool',
  summary: 'Demo tool',
  tools: {
    'main.run': async ({ input }) => ({
      output: { ok: true, echo: input || {} },
    }),
  },
  permissions: 'auto',
});

module.exports = {
  register: plugin.register,
  manifest: plugin.manifest,
};
```

Inside the monorepo you may also `import { definePlugin } from 'zavorth/plugin-sdk'`.

## Discovery sources

| Kind      | Default path                                            | Priority |
| --------- | ------------------------------------------------------- | -------- |
| bundled   | `<project>/plugins` (+ `plugins/examples` when scanned) | highest  |
| workspace | `<workspace>/.zavorth/plugins`                          | medium   |
| user      | `~/.zavorth/plugins`                                    | lowest   |

A package is **loadEligible** only when it is selected (wins conflicts),
valid + compatible, installed, enabled, and not blocked.

Marketplace install paths (`marketplace:<id>`, remote catalog, signed packs)
resolve into workspace/user plugin dirs after review.

## Bootstrap catalog

Before runtime bootstrap, `PluginOsBootstrapCatalogService` marks first-party
packages from `config/plugin-marketplace-curated.json` as installed+enabled.

Config: `config/plugin-os-bootstrap.json`

| Field                  | Default | Meaning                                |
| ---------------------- | ------- | -------------------------------------- |
| `autoEnableFirstParty` | `true`  | Enable `tier: first-party` packages    |
| `autoEnableExamples`   | `false` | Enable example packages                |
| `respectUserDisable`   | `true`  | Do not re-enable user-disabled plugins |
| `excludeIds`           | `[]`    | Never auto-enable these ids            |
| `includeIds`           | `[]`    | Force-include extra ids                |

Disable with `ZAVORTH_PLUGIN_OS_BOOTSTRAP=0` or
`ZAVORTH_PLUGIN_OS_RUNTIME=0` (skips full Plugin OS bootstrap).

## Agent routing

- **Tool** `plugin_recommend` — keyword ranking via `PluginRouterService`,
  optional LLM re-rank (`useLlm: true` or `ZAVORTH_PLUGIN_ROUTER_LLM=1`).
- **Plugin** `plugin-router-ai` — capability `router.recommend` / `router.explain`.
- **Never auto-enables.** Returns `enableHint` commands only.

## MCP bridge

First-party plugin `mcp-bridge`:

| Capability        | Role                                      |
| ----------------- | ----------------------------------------- |
| `mcp.list`        | List `config/mcp-servers.json`            |
| `mcp.status`      | Status for one server id                  |
| `mcp.materialize` | Write `.zavorth/plugins/mcp-<id>` package |
| `mcp.invoke`      | Live invoke via `McpRuntimeService`       |

Materialized packages expose `mcp.invoke` / `mcp.status` for a single server.
Live invoke is wired through `PluginOsMcpRuntimeAccess` so plugins call the
same `McpRuntimeService` instance created at tool-runtime bootstrap.

```bash
zavorth plugins mcp list
zavorth plugins mcp materialize filesystem --yes
zavorth plugins enable mcp-filesystem --yes
```

## Forge / self-mod

```bash
zavorth plugins forge plan "uppercase echo tool"
zavorth plugins forge apply .zavorth/plugin-forge/previews/<id>-<stamp> --yes
# optional: --enable
```

Apply always writes:

- `.zavorth/plugin-forge/receipts/<pluginId>-<stamp>.json`
- append line to `.zavorth/receipts/plugins.jsonl` (`kind: plugin.forge.apply`)

Receipts include `packageDigest` (sha256 of package tree) and harness results.
Forge never auto-enables unless `--enable` is passed.

## Hot reload & watch

- `PluginHotReloadService` / CLI `plugins dev`
- `PluginOsRuntimeWatchService` watches package dirs after bootstrap

## HTTP / control plane

- `/api/plugin-os` via `PluginOsHttpApiService`
- Desktop plane: Plugin OS panel when the control surface is enabled

## First-party catalog

Curated list lives in `config/plugin-marketplace-curated.json` (`tier: first-party`):

**Core integrations:** `web-search`, `github`, `memory-local`, `memory-honcho`,
`cost-tracker`, `browser-playwright`, `security-guidance`, `plugin-router-ai`,
`session-scratch-janitor`, `selfmod-plugin-forge`, `mcp-bridge`, `gmail`,
`calendar`, `linear`, `notion`.

**Daily Ops pack** (accessibility + ship loop): `workspace-doctor`, `task-board`,
`pr-ship`, `ci-watch`, `secrets-guardian`, `session-recall`, `notify-outbox`.

**Provider pack:** `provider-openai-compatible`, `provider-anthropic`,
`provider-xai`, `provider-gemini`, `provider-status`.

**Platform pack:** `platform-telegram`, `platform-discord`,
`platform-whatsapp`, `platform-webhook`.

**Memory pack:** `memory-local`, `memory-honcho`, `memory-file-journal`,
`memory-vector-local`, `memory-mem0` (+ `session-recall` indexes local stores).

**Media pack:** `media-image-gen`, `media-vision`, `media-tts`,
`media-transcription`, `media-video-gen` (optional profile `media`).

**browser & search:** `web-search` (multi-backend + status),
`browser-playwright`, `browser-cdp`, `search-exa`, `search-firecrawl`
(profile `browser-search`).

**Trust fabric:** `secret-source-env`, `secret-source-file`,
`dashboard-auth-basic`, `dashboard-auth-token`, `context-engine-bridge`,
`middleware-rate-limit` (profile `trust`).

**Lifestyle & demos:** `spotify-soft`, `demo-showcase` (profile
`lifestyle`; optional).

**Ecosystem:** Plugin Atlas (`docs/generated/plugin-atlas.md`), signed
pack format (`docs/plugin-os-signed-pack.md`), `create-zavorth-plugin` CLI,
`@zavorth/plugin-sdk` 0.3.0 publish ritual, wave packs for suggest
(`config/plugin-os-wave-packs.json`), profile `daily-ops`.

**Release ops:** [plugin-os-release-checklist.md](./plugin-os-release-checklist.md)
(`npm run qa:plugin-os`, SDK `publish:check`, atlas regenerate, marketplace host).

**Marketplace product:** [plugin-os-marketplace.md](./plugin-os-marketplace.md)
(`zavorth plugins marketplace`, `install marketplace:<id>`, `create-zavorth-plugin`).

**Agent harness (P0–P3):** [agent-harness-readiness.md](./agent-harness-readiness.md)
(same toolRuntime on experience/CLI, Plugin OS ready wait, exposure profiles,
security catalog for plugins, credential hints, skill-tool reconcile,
zavorth_action guidance, remote marketplace export).

**Host marketplace:** [plugin-os-marketplace-hosting.md](./plugin-os-marketplace-hosting.md)
(`npm run plugin-os:export-marketplace`).

See [plugin-os-daily-ops-pack.md](./plugin-os-daily-ops-pack.md) and the full
gap-closure roadmap [plugin-os-gap-closure-waves.md](./plugin-os-gap-closure-waves.md)
(`config/plugin-os-gap-waves.json`).

Examples (`hello-world`, `example-*`) stay **opt-in** (`autoEnableExamples: false`).

## Authoring plugins

### First-party (monorepo) — &lt; 5 CLI steps

One-shot path (scaffold + enable + harness):

```bash
# 1–3) scaffold, enable (trusted local), smoke harness
zavorth plugins new my-tool --kind tool --enable --smoke --yes

# 4) inspect
zavorth plugins inspect my-tool

# 5 optional) disable when done
zavorth plugins disable my-tool --yes
```

Bridge (generic HTTP / CLI / MCP, soft-fail without endpoint):

```bash
zavorth plugins new my-bridge --kind bridge --enable --smoke --yes
```

From an experience skill draft:

```bash
zavorth plugins promote-from-skill 1 --dry-run
zavorth plugins promote-from-skill 1
# or: zavorth learn promote 1 --kind plugin
```

Manual steps still work:

```bash
zavorth plugins new my-tool --kind tool --yes
zavorth plugins scaffold my-tool --kind media --yes
```

1. Keep `manifest.json` capabilities in sync with `index.js` binds.
2. Prefer soft-fail: check helpers (`bindCapability`, `bindProvider`, …) before use.
3. Add a behavior/validation test under `tests/plugins/` when shipping a pack.
4. Register in `config/plugin-marketplace-curated.json` with `tier: first-party` only
   when the package is production-ready and bootstrap-safe.

### Bridge template (`moduleKind: bridge`)

- Capability `bridge.invoke` (alias `bridge.forward`): modes `http` | `cli` | `mcp`.
- Soft-fails when `url` / `command` / `mcpServer` (or env `ZAVORTH_BRIDGE_*`) is missing.
- Scaffold does **not** perform outbound fetch or process spawn — planned responses only.
- Example: `plugins/examples/example-bridge`.

### Third-party

1. Scaffold outside the monorepo:

   ```bash
   npx create-zavorth-plugin acme-search --kind search --dir ./acme-search
   # or monorepo wrapper:
   node bin/create-zavorth-plugin.js acme-search --kind search
   ```

2. Author with `@zavorth/plugin-sdk` for presets + inference:

   ```bash
   npm install @zavorth/plugin-sdk
   ```

3. Clone patterns from examples:

   | Resource        | Path / package                                                  |
   | --------------- | --------------------------------------------------------------- |
   | Example trees   | `plugins/examples/*`                                            |
   | Reference index | `@zavorth/example-plugins` (`packages/zavorth-example-plugins`) |
   | Scaffold CLI    | `create-zavorth-plugin`                                         |
   | SDK release     | `packages/plugin-sdk/RELEASE.md`                                |

4. Install into a Zavorth workspace:

   ```bash
   zavorth plugins install ./acme-search --yes
   zavorth plugins enable acme-search --yes
   zavorth plugins test ./acme-search
   zavorth plugins preview acme-search
   ```

5. For marketplace distribution, use signed packs
   ([plugin-os-signed-pack.md](./plugin-os-signed-pack.md)).

### Channel and provider patterns

**Channel** (`moduleKind: channel`):

- Declare capability `channel.send` (or domain-specific send id).
- Prefer `ctx.bindChannel({ id, capabilityId, label, send })`.
- `send` should soft-complete: return `{ ok, delivered, payload }` without
  throwing when network is disabled or credentials are missing.
- Example: `plugins/examples/example-channel`, first-party `platform-*`.

**Provider** (`moduleKind: provider`):

- Declare capability `provider.complete`.
- Prefer `ctx.bindProvider({ id, capabilityId, name, complete })`.
- `complete` soft-completes offline: return a stub `{ ok, text, request }` rather
  than hard-failing bootstrap when keys are absent.
- Status capabilities should report **key presence only** (never secret values).
- Example: `plugins/examples/example-provider`, first-party `provider-*`.

### Reference examples by moduleKind

| Id                  | moduleKind  | Path                                 |
| ------------------- | ----------- | ------------------------------------ |
| `hello-world`       | tool        | `plugins/examples/hello-world`       |
| `example-channel`   | channel     | `plugins/examples/example-channel`   |
| `example-provider`  | provider    | `plugins/examples/example-provider`  |
| `example-memory`    | memory      | `plugins/examples/example-memory`    |
| `example-hook`      | agent       | `plugins/examples/example-hook`      |
| `example-auxiliary` | diagnostics | `plugins/examples/example-auxiliary` |
| `example-media`     | media       | `plugins/examples/example-media`     |
| `example-voice`     | voice       | `plugins/examples/example-voice`     |
| `example-search`    | search      | `plugins/examples/example-search`    |
| `example-bridge`    | bridge      | `plugins/examples/example-bridge`    |
| `example-sandbox`   | sandbox     | `plugins/examples/example-sandbox`   |
| `example-qa`        | qa          | `plugins/examples/example-qa`        |
| `example-workspace` | workspace   | `plugins/examples/example-workspace` |

Index package: [`packages/zavorth-example-plugins`](../packages/zavorth-example-plugins/README.md)
(`@zavorth/example-plugins`).

### Specialized register API

In addition to `bindCapability` / `bindTool` / `bindChannel` / `bindProvider` /
`bindMemoryBackend` / `registerHook`, Plugin OS exposes specialized register helpers:

`registerPlatform`, `registerWebSearchProvider`, `registerBrowserProvider`,
`registerImageGenProvider`, `registerVideoGenProvider`, `registerTtsProvider`,
`registerTranscriptionProvider`, `registerSecretSource`,
`registerDashboardAuthProvider`, `registerContextEngine`, `registerMiddleware`,
`registerSkill`, `registerCliCommand`, `registerAuxiliaryTask`,
`registerSlackActionHandler`.

These preserve Zavorth trust (declared capabilities, permissions, soft-fail).

## Safety model

- Soft-fail load: a broken plugin does not crash bootstrap
- Sandbox / trust via `PluginSandboxPolicyService` + state bridge
- Signatures: HMAC / ed25519 via `PluginSignatureService`
- Approval gates for high-risk capabilities (send mail, forge apply, …)
- MCP tools still go through MCP tool policy approval

## Related code

| Area                     | Path                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Contracts                | `src/contracts/PluginManifestContract.ts`, `PluginRuntimeContract.ts`                                                          |
| Runtime                  | `src/services/PluginRuntimeService.ts`                                                                                         |
| Specialized register\_\* | `src/services/PluginSpecializedRegistrars.ts`                                                                                  |
| Gap waves plan           | `docs/plugin-os-gap-closure-waves.md`                                                                                          |
| Bootstrap                | `src/bootstrap/bootstrapToolRuntime.ts`                                                                                        |
| Catalog                  | `src/services/PluginOsBootstrapCatalogService.ts`                                                                              |
| Router tool              | `src/tools/PluginRecommendTool.ts`                                                                                             |
| MCP access               | `src/services/PluginOsMcpRuntimeAccess.ts`                                                                                     |
| SDK export               | `src/sdk/plugin-os.ts`                                                                                                         |
| Packages                 | `plugins/*`, `plugins/examples/*`, `packages/plugin-sdk`, `packages/create-zavorth-plugin`, `packages/zavorth-example-plugins` |

## Environment flags

| Variable                             | Effect                                 |
| ------------------------------------ | -------------------------------------- |
| `ZAVORTH_PLUGIN_OS_RUNTIME=0`        | Skip Plugin OS bootstrap               |
| `ZAVORTH_PLUGIN_OS_BOOTSTRAP=0`      | Skip first-party auto-enable catalog   |
| `ZAVORTH_PLUGIN_ROUTER_LLM=1`        | Prefer LLM re-rank for recommendations |
| `ZAVORTH_PLUGIN_FORGE_LLM=1`         | Optional LLM assist for forge index.js |
| `ZAVORTH_PLUGIN_ED25519_PRIVATE_KEY` | Sign packages with ed25519             |
| `ZAVORTH_PLUGIN_HMAC_SECRET`         | Sign packages with HMAC                |

## Operations plane

### Observability

```bash
zavorth plugins metrics
zavorth plugins metrics --persist
zavorth plugins plane          # includes funnel + curated marketplace
zavorth plugins agent-surface  # compact prompt block for agents
```

On runtime bootstrap, metrics are written to:

- `.zavorth/receipts/plugin-os-metrics.json`
- `.zavorth/receipts/plugin-os-bootstrap-last.json`
- append line on `.zavorth/receipts/plugins.jsonl` (`kind: plugin.os.metrics`)

### HTTP API

| Method | Path                           | Role                                                                         |
| ------ | ------------------------------ | ---------------------------------------------------------------------------- |
| GET    | `/api/plugin-os`               | Enriched control-plane snapshot (plugins + metrics + curated)                |
| GET    | `/api/plugin-os/metrics`       | Observability funnel only                                                    |
| GET    | `/api/plugin-os/marketplace`   | Curated catalog with enable state                                            |
| GET    | `/api/plugin-os/agent-surface` | Prompt block + hints                                                         |
| POST   | `/api/plugin-os/actions`       | `enable` / `disable` / `recommend` / `catalog-apply` / `metrics-persist` / … |

`recommend` is read-only (no `approved` required). Mutating actions need `approved: true`.

### Desktop

Extensions → **Plugin OS** tab:

- health / funnel / first-party / MCP / forge receipt counters
- curated **Marketplace** filter with enable/disable
- recommend intent box (notice with top matches, no auto-enable)
- **Apply bootstrap catalog** button

### SDK CI

`packages/plugin-sdk`:

```bash
npm run check   # build + test + harness
npm run harness # definePlugin register + inference smoke
```

GitHub workflow `.github/workflows/publish-plugin-sdk.yml` runs harness + dry-run publish on PRs that touch the package.

## Telemetry, onboarding, prompt injection

### Aggregated telemetry

```bash
zavorth plugins telemetry
zavorth plugins telemetry 24 --sample
```

Ledger: `.zavorth/receipts/plugin-os-telemetry.jsonl`

Events: `sample`, `bootstrap`, `recommend`, `enable`, `disable`, `catalog-apply`, `onboarding`, `prompt-inject`.

HTTP: `GET /api/plugin-os/telemetry?hours=168` · action `telemetry-sample`.

### Onboarding profiles

Config: `config/plugin-os-onboarding.json`
State: `.zavorth/plugin-os-onboarding.json`

| Profile       | Meaning                                         |
| ------------- | ----------------------------------------------- |
| `minimal`     | router + security + mcp-bridge                  |
| `core`        | first-party without optional/credential-heavy   |
| `recommended` | first-party minus gmail/linear/notion (default) |
| `full`        | every first-party plugin                        |

Optional ids (opt-in): `gmail`, `linear`, `notion`, `browser-playwright`, `memory-honcho`.

```bash
zavorth plugins onboarding status
zavorth plugins onboarding plan recommended --optional gmail
zavorth plugins onboarding apply recommended --optional gmail --yes
```

HTTP: `GET /api/plugin-os/onboarding` · actions `onboarding-plan` / `onboarding-apply` / `onboarding-undo` (mutating actions need `approved: true`).

```bash
zavorth plugins onboarding undo --yes   # disables last onboarding enabledIds; keeps packages
```

## Daily use

### Suggest-to-enable

When a capability may be missing:

```bash
zavorth plugins suggest "search the web"
# tool: plugin_suggest intent="search the web"
```

Returns a primary plugin with UI actions **Enable** / **Recommend only** / **Dismiss**.
Never auto-enables.

HTTP: `POST /api/plugin-os/actions` `{ "action": "suggest", "intent": "..." }`
GET is not required — desktop uses the same action from the recommend box.

### Compact inject by default

Product default inject mode is **compact**.
`full` / `ab` in production are blocked unless `ZAVORTH_PLUGIN_OS_PROMPT_ALLOW_FULL=1`.

```bash
zavorth plugins inject-mode
zavorth plugins inject-mode compact
```

Prefs: `.zavorth/plugin-os-prompt.json`

### Human activity timeline

```bash
zavorth plugins receipts
zavorth plugins receipts 20
```

HTTP: `GET /api/plugin-os/receipts?limit=20`
Examples: `Plugin forge applied foo at Jul 12, 02:02 PM`.

### Trust polish (permission preview)

Before enable, surfaces can call a read-only permission preview (never auto-enables):

```bash
zavorth plugins preview <id>
# inspect also includes permission / risk lines
```

HTTP action `preview-permissions` with `pluginId` (read-only, no `approved` required).

`PluginOsPermissionPreviewService` returns declared permissions, short risk bullets
(e.g. "May access network"), trust/tier, signature presence, and a
`needsCredentials` heuristic for gmail/linear/notion (and bridge + external network).

Desktop enable path shows a notice with the preview summary, then enables after
the explicit enable action. Recommend / preview flows never auto-enable.

### Agent system-prompt injection

`PluginOsPromptInjectionService` appends a compact Plugin OS surface to agent system prompts via:

- `AgentRunLlmRequestBuilder` (primary agent path)
- `DynamicSystemPromptService` (standard/full tiers)

```bash
zavorth plugins agent-surface --inject
```

Kill switches:

| Variable                                         | Effect                   |
| ------------------------------------------------ | ------------------------ |
| `ZAVORTH_PLUGIN_OS_PROMPT=0`                     | Disable prompt injection |
| `injectAgentSurface: false` in onboarding config | Same, config-side        |

## Advanced operations

### Multi-step onboarding wizard

```bash
zavorth plugins wizard start
zavorth plugins wizard next
zavorth plugins wizard profile recommended
zavorth plugins wizard optional gmail
zavorth plugins wizard optional notion --off
zavorth plugins wizard inject ab --sample 25
zavorth plugins wizard apply --yes
```

HTTP: `GET /api/plugin-os/wizard` · actions `wizard-start` / `wizard-next` / `wizard-apply`.

Desktop Plugin OS panel: optional plugin checkboxes + **Onboard recommended**.

### Telemetry history dashboard

```bash
zavorth plugins telemetry history --hours 168 --bucket 6
```

HTTP: `GET /api/plugin-os/telemetry/history?hours=168&bucket=6`

### Prompt inject modes

| Mode       | Behavior                          |
| ---------- | --------------------------------- |
| `off`      | No injection                      |
| `compact`  | Short health + enabled list       |
| `standard` | Full agent-surface prompt block   |
| `full`     | Prompt block + hints + deep links |
| `ab`       | Sample % of minutes (canary)      |

Prefs: `.zavorth/plugin-os-prompt.json`
Env: `ZAVORTH_PLUGIN_OS_PROMPT_MODE`, `ZAVORTH_PLUGIN_OS_PROMPT_SAMPLE`

### Remote curated marketplace

```bash
export ZAVORTH_PLUGIN_MARKETPLACE_URL=https://example.com/plugin-catalog.json
zavorth plugins marketplace refresh-remote
zavorth plugins marketplace --curated
```

Local `config/plugin-marketplace-curated.json` always wins on id conflicts.
Cache: `.zavorth/cache/plugin-marketplace-remote.json`

### Plugin OS QA pack (focused suite)

```bash
npm run qa:plugin-os
# or
node scripts/plugin-os-qa.mjs
```

Runs Plugin OS service/CLI/tool tests + plugin-sdk harness (not the entire monorepo).

### SDK publish path

See [`packages/plugin-sdk/RELEASE.md`](../packages/plugin-sdk/RELEASE.md).

```bash
cd packages/plugin-sdk
npm run publish:check   # build + test + harness + npm publish --dry-run
# bump version + changelog, then:
git tag plugin-sdk-v0.3.0 && git push origin plugin-sdk-v0.3.0
```

Tag **must** equal `plugin-sdk-v` + `package.json` version.

### Plugin CI

| Workflow                                   | Trigger                                       | Role                                                                                     |
| ------------------------------------------ | --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `.github/workflows/plugin-os-plugins.yml`  | `plugins/**`, SDK, create-zavorth-plugin      | Validate manifests, example/first-party tests, pack harness, SDK + create-plugin dry-run |
| `.github/workflows/publish-plugin-sdk.yml` | `packages/plugin-sdk/**`, tag `plugin-sdk-v*` | `publish:check` on PR; npm publish on version tag                                        |

```bash
# Local equivalents
node node_modules/jest/bin/jest.js tests/plugins/examples.validation.test.ts --runInBand
cd packages/plugin-sdk && npm run publish:check
node packages/create-zavorth-plugin/bin/create-zavorth-plugin.js demo --kind sandbox --dry-run
```
