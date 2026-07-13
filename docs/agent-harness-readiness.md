# Agent harness readiness (P0 / P1)

This document describes how product agent entrypoints share one tool harness
and wait for Plugin OS before serving runs.

## P0 — Same toolRuntime + wait + exposure

### Shared tool harness

| Entrypoint | toolRuntime |
|------------|-------------|
| CLI (`ZavorthCliCommandHelpers`) | `createBootstrapToolRuntime` + await Plugin OS ready |
| Foundation host | `createBootstrapToolRuntime` → `ZavorthAgentGateway` |
| Experience / control API | `getExperienceCoreService` now bootstraps tools and passes `toolRuntime` |

Experience await:

```ts
await ensureExperienceAgentReady(); // waitForPluginOsReady
```

### Plugin OS ready handle

`src/services/PluginOsAgentReadiness.ts`

- `setPluginOsReadyPromise` from `bootstrapToolRuntime`
- `waitForPluginOsReady({ timeoutMs })` — soft timeout (default 15s), never throws

### Exposure profiles

Env: `ZAVORTH_TOOL_EXPOSURE_PROFILE=safe|daily-ops|full`
Default for CLI/experience when unset: **`daily-ops`**.

| Profile | Max tools | Notes |
|---------|-----------|--------|
| `safe` | 12 | Baseline always-safe set |
| `daily-ops` | 24 | Search, doctor, PR/CI, tasks, memory, plugin_recommend/suggest |
| `full` | 40 | Safe + review (no confirmation) + daily-ops prefs |

Implementation: `src/runtime/agent/tools/ToolExposureProfile.ts`
Used by: `AgentRunNativeToolLoopService.resolveNativeTools`

## P1 — Security + wire adapters + credentials

### Security catalog

- Explicit: `plugin_recommend`, `plugin_suggest`
- Dynamic: `plugin.*` and first-party aliases (`search_query`, etc.)
- Wire-time: `PluginRuntimeService` registers capability tools with explicit security defs

### Channel / memory / provider wire

Bootstrap now passes soft stores from `PluginOsWireAdapterStores` so plugin
`bindChannel` / `bindMemoryBackend` / `bindProvider` are **captured**, not dropped.

### Credential hints

`AgentHarnessCredentialHints` injects a **presence-only** readiness block into
agent system prompts (never secret values).

## P2 — Skills + tool mental model

- After Plugin OS wire, `SkillToolRegistryBridge.reconcileSkillToolsWithRegistry`
  drops phantom skill tool names from the Cognitive Firewall map and redirects
  empty categories to `zavorth_action` / `plugin_suggest` / workspace tools.
- System prompt includes `AgentToolModelGuidance`: when to use **direct tools**
  vs **zavorth_action** (lookup → preview → apply with approval).

## W7 — Skill + worker product surface

With `ZAVORTH_TOOL_EXPOSURE_PROFILE=daily-ops` (CLI/experience default when unset
is often forced to daily-ops), prefer exposing:

| Tool | Role |
|------|------|
| `zavorth_skill_marketplace` | search/preview/install/receipt/trust |
| `agent_manager` | workers/health/invoke/route/scan/register |
| `zavorth_delegate` | internal subagent task graph |
| `plugin_suggest` / `plugin_recommend` | missing capability discovery |
| `zavorth_action` | governed product gateway |

Docs:

- [skills-universal-install.md](./product/skills-universal-install.md)
- [workers-mesh.md](./product/workers-mesh.md)

Credential readiness also reports skill trust + exposure profile **presence only**
(no secrets).

### W8 QA gate

```bash
npm run qa:skill-worker-mesh
```

See [skill-worker-mesh-qa-gate.md](./product/skill-worker-mesh-qa-gate.md) before starting Telegram agent-first (W9).

## P3 — Remote marketplace host pack

```bash
npm run plugin-os:export-marketplace
# or: node scripts/export-plugin-marketplace-remote.mjs --base-url https://cdn.example.com/plugins
```

See `docs/plugin-os-marketplace-hosting.md`.

## Kill switches

| Env | Effect |
|-----|--------|
| `ZAVORTH_PLUGIN_OS_RUNTIME=0` | Skip Plugin OS bootstrap |
| `ZAVORTH_PLUGIN_OS_READY_TIMEOUT_MS` | Wait budget for ready |
| `ZAVORTH_TOOL_EXPOSURE_PROFILE` | safe / daily-ops / full |
| `ZAVORTH_PLUGIN_OS_PROMPT=0` | Skip plugin prompt injection |
