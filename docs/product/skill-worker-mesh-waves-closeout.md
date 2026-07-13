# Skill + Worker mesh waves closeout (W0–W10)

Temporary planning lived outside the repo and was closed after W9 hard-delete of free-text intent-regex. This page keeps the **product decisions** and **code anchors** permanently.

## Product model (frozen)

| Concept | Meaning |
|---------|---------|
| **Skill** | Instruction / procedure material (not an executor by itself) |
| **Tool / Plugin** | What actually executes |
| **Worker** | External process or subagent with health + invoke + receipt |
| **Install / Register** | Generic path / URL / command — no competitor brand hardcoding |

Principles: brand-agnostic contracts · preview before mutate · receipt always · soft-fail · **agent-first free text** · deterministic only for slash + `callback_data`.

## Wave map (shipped)

| Wave | Name | Outcome |
|------|------|---------|
| **W0** | Contracts | `ZavorthSkillWorkerMeshContract` types + glossary + gates |
| **W1** | Skill pipeline | preview → consent → apply → receipt (`SkillInstallPipelineService`) |
| **W2** | Trust by evidence | `SkillTrustScoreService` safe/daily/power; no competitor whitelist |
| **W3** | Skill ↔ executor | `SkillExecutorBindingService` direct/alias/gateway/unresolved |
| **W4** | Worker mesh | `WorkerMeshService` + health + invoke |
| **W5** | Delegation router | `WorkerDelegationRouterService` local vs worker |
| **W6** | Discovery | `SkillWorkerDiscoveryService` + search/scan |
| **W7** | Surface / CLI | daily-ops exposure of marketplace + agent_manager; product docs |
| **W8** | QA gate | `npm run qa:skill-worker-mesh` + brand denylist + demo |
| **W9** | Telegram agent-first | Free text → agent; **intent-regex hard-deleted**; slash + callbacks only |
| **W10** | Temp cleanup | Essentials migrated here; temporary wave folder removed |

## W9 free-text routing (authoritative)

| Input | Path |
|-------|------|
| `/approve`, `/reject`, `/undo`, … | Deterministic slash |
| `task:approve\|reject\|undo:<id>` | Deterministic callbacks |
| Free text (any language) | Agent gateway (LLM + tools) |

- Default: agent-first ON for Telegram (no env).
- Free-text natural parsers are stubs (always null); preDispatch never runs them.
- Optional: `ZAVORTH_TELEGRAM_AGENT_FIRST=0` → parse-only free text (**still no regex**).
- Optional: `ZAVORTH_SURFACE_AGENT_FIRST=1` → agent-first on all platforms.
- **Removed:** `ZAVORTH_TELEGRAM_LEGACY_NATURAL` (no restore of intent-regex).
- **Post-W9 cleanup:** preDispatch context is minimal; free-text mesh/session/task-variation packs **deleted from the repo** (not just unwired).

Details: [telegram-agent-first.md](./telegram-agent-first.md).

## Code anchors

| Area | Path |
|------|------|
| Mesh contract | `src/contracts/skill/ZavorthSkillWorkerMeshContract.ts` |
| Skill install | `src/services/SkillInstallPipelineService.ts` |
| Skill trust | `src/services/SkillTrustScoreService.ts` |
| Skill binding | `src/services/SkillExecutorBindingService.ts` |
| Worker mesh | `src/services/WorkerMeshService.ts` |
| Delegation | `src/services/WorkerDelegationRouterService.ts` |
| Discovery | `src/services/SkillWorkerDiscoveryService.ts` |
| Agent-first mode | `src/domain/surface/presentation/shared-surface/SurfaceAgentFirstMode.ts` |
| Pre-dispatch | `src/domain/surface/presentation/shared-surface/SharedSurfaceCommandDispatch.ts` |
| Marketplace tool | `src/tools/ZavorthSkillMarketplaceTool.ts` |
| Agent manager | `src/tools/AgentManagerTool.ts` |

## Related product docs

- [skills-universal-install.md](./skills-universal-install.md)
- [workers-mesh.md](./workers-mesh.md)
- [skill-worker-mesh-qa-gate.md](./skill-worker-mesh-qa-gate.md)
- [telegram-agent-first.md](./telegram-agent-first.md)

## Out of scope (intentionally)

- Competitor brand whitelists as product features
- Full monorepo i18n rewrite
- Production remote marketplace signing (ops track)
