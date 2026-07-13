# Zavorth Plugin OS

Plugin OS is the first-party extension runtime for Zavorth. Packages declare a
`zavorth.plugin-os.v1` manifest, expose capabilities, and are discovered,
loaded, and wired into the agent tool registry without taking down core boot.

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
  ctx.bindCapability('demo.run', async ({ input }) => {
    return { output: { ok: true, echo: input } };
  });
}
module.exports = { register };
```

Or with the SDK:

```ts
import { definePlugin } from '@zavorth/plugin-sdk';
export default definePlugin({
  id: 'demo',
  register(ctx) { /* ... */ },
});
```

## Discovery sources

| Kind | Default path | Priority |
|------|--------------|----------|
| bundled | `<project>/plugins` | highest |
| workspace | `<workspace>/.zavorth/plugins` | medium |
| user | `~/.zavorth/plugins` | lowest |

A package is **loadEligible** only when it is selected (wins conflicts),
valid + compatible, installed, enabled, and not blocked.

## Bootstrap catalog

Before runtime bootstrap, `PluginOsBootstrapCatalogService` marks first-party
packages from `config/plugin-marketplace-curated.json` as installed+enabled.

Config: `config/plugin-os-bootstrap.json`

| Field | Default | Meaning |
|-------|---------|---------|
| `autoEnableFirstParty` | `true` | Enable `tier: first-party` packages |
| `autoEnableExamples` | `false` | Enable example packages |
| `respectUserDisable` | `true` | Do not re-enable user-disabled plugins |
| `excludeIds` | `[]` | Never auto-enable these ids |
| `includeIds` | `[]` | Force-include extra ids |

Disable with `ZAVORTH_PLUGIN_OS_BOOTSTRAP=0` or
`ZAVORTH_PLUGIN_OS_RUNTIME=0` (skips full Plugin OS bootstrap).

## Agent routing

- **Tool** `plugin_recommend` — keyword ranking via `PluginRouterService`,
  optional LLM re-rank (`useLlm: true` or `ZAVORTH_PLUGIN_ROUTER_LLM=1`).
- **Plugin** `plugin-router-ai` — capability `router.recommend` / `router.explain`.
- **Never auto-enables.** Returns `enableHint` commands only.

## MCP bridge

First-party plugin `mcp-bridge`:

| Capability | Role |
|------------|------|
| `mcp.list` | List `config/mcp-servers.json` |
| `mcp.status` | Status for one server id |
| `mcp.materialize` | Write `.zavorth/plugins/mcp-<id>` package |
| `mcp.invoke` | Live invoke via `McpRuntimeService` |

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

**Wave 1 provider pack:** `provider-openai-compatible`, `provider-anthropic`,
`provider-xai`, `provider-gemini`, `provider-status`.

**Wave 2 platform pack:** `platform-telegram`, `platform-discord`,
`platform-whatsapp`, `platform-webhook`.

**Wave 3 memory pack:** `memory-local`, `memory-honcho`, `memory-file-journal`,
`memory-vector-local`, `memory-mem0` (+ `session-recall` indexes local stores).

**Wave 4 media pack:** `media-image-gen`, `media-vision`, `media-tts`,
`media-transcription`, `media-video-gen` (optional profile `media`).

**Wave 5 browser & search:** `web-search` (multi-backend + status),
`browser-playwright`, `browser-cdp`, `search-exa`, `search-firecrawl`
(profile `browser-search`).

**Wave 6 trust fabric:** `secret-source-env`, `secret-source-file`,
`dashboard-auth-basic`, `dashboard-auth-token`, `context-engine-bridge`,
`middleware-rate-limit` (profile `trust`).

**Wave 7 lifestyle & demos:** `spotify-soft`, `demo-showcase` (profile
`lifestyle`; optional).

**Wave 8 ecosystem:** Plugin Atlas (`docs/generated/plugin-atlas.md`), signed
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

Examples (`hello-world`, `example-*`) stay opt-in.

### Specialized register API (Wave 0)

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

| Area | Path |
|------|------|
| Contracts | `src/contracts/PluginManifestContract.ts`, `PluginRuntimeContract.ts` |
| Runtime | `src/services/PluginRuntimeService.ts` |
| Specialized register_* (W0) | `src/services/PluginSpecializedRegistrars.ts` |
| Gap waves plan | `docs/plugin-os-gap-closure-waves.md` |
| Bootstrap | `src/bootstrap/bootstrapToolRuntime.ts` |
| Catalog | `src/services/PluginOsBootstrapCatalogService.ts` |
| Router tool | `src/tools/PluginRecommendTool.ts` |
| MCP access | `src/services/PluginOsMcpRuntimeAccess.ts` |
| SDK export | `src/sdk/plugin-os.ts` |
| Packages | `plugins/*`, `packages/plugin-sdk` |

## Environment flags

| Variable | Effect |
|----------|--------|
| `ZAVORTH_PLUGIN_OS_RUNTIME=0` | Skip Plugin OS bootstrap |
| `ZAVORTH_PLUGIN_OS_BOOTSTRAP=0` | Skip first-party auto-enable catalog |
| `ZAVORTH_PLUGIN_ROUTER_LLM=1` | Prefer LLM re-rank for recommendations |
| `ZAVORTH_PLUGIN_FORGE_LLM=1` | Optional LLM assist for forge index.js |
| `ZAVORTH_PLUGIN_ED25519_PRIVATE_KEY` | Sign packages with ed25519 |
| `ZAVORTH_PLUGIN_HMAC_SECRET` | Sign packages with HMAC |

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

| Method | Path | Role |
|--------|------|------|
| GET | `/api/plugin-os` | Enriched control-plane snapshot (plugins + metrics + curated) |
| GET | `/api/plugin-os/metrics` | Observability funnel only |
| GET | `/api/plugin-os/marketplace` | Curated catalog with enable state |
| GET | `/api/plugin-os/agent-surface` | Prompt block + hints |
| POST | `/api/plugin-os/actions` | `enable` / `disable` / `recommend` / `catalog-apply` / `metrics-persist` / … |

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

| Profile | Meaning |
|---------|---------|
| `minimal` | router + security + mcp-bridge |
| `core` | first-party without optional/credential-heavy |
| `recommended` | first-party minus gmail/linear/notion (default) |
| `full` | every first-party plugin |

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

| Variable | Effect |
|----------|--------|
| `ZAVORTH_PLUGIN_OS_PROMPT=0` | Disable prompt injection |
| `injectAgentSurface: false` in onboarding config | Same, config-side |

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

| Mode | Behavior |
|------|----------|
| `off` | No injection |
| `compact` | Short health + enabled list |
| `standard` | Full agent-surface prompt block |
| `full` | Prompt block + hints + deep links |
| `ab` | Sample % of minutes (canary) |

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

See `packages/plugin-sdk/RELEASE.md`.

```bash
cd packages/plugin-sdk
npm run check
# bump version + changelog, then:
git tag plugin-sdk-v0.2.0 && git push origin plugin-sdk-v0.2.0
```

Tag **must** equal `plugin-sdk-v` + `package.json` version.
