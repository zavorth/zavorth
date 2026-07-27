# Free-text purity matrix

Hard product rule for Zavorth agent-first surfaces:

| Input | Owner |
| --- | --- |
| Free text (chat NL, any language) | **LLM + tools**; never keyword-to-feature |
| Slash commands / CLI tokens | Deterministic |
| Buttons / callback data | Deterministic |
| Structured metadata / tool ids | Deterministic |

Related: [agent-tool-routing.md](./agent-tool-routing.md), [telegram-agent-first.md](./telegram-agent-first.md), [learned-knowledge-plane.md](./learned-knowledge-plane.md).

## Forbidden on free-text chat dispatch

| Pattern | Why forbidden | Guard |
| --- | --- | --- |
| Keyword or regex packs that map NL phrases to product features | Steals turn from agent | Hygiene and honesty tests |
| Free-text approve/reject phrases | Dangerous side effect without slash/button | `UniversalApprovalIntentResolver` and residual tests |
| Free-text team/swarm requests | Compiles or launches without structured intent | `AgentTeamCompilerService.isTeamIntent` |
| Free-text UX feature routing | Bypasses slash/CLI | `UserExperienceIntentRouter`, `parseRuntimeMaintenanceIntent` no-op |
| Explicit profile tokens treated as chat intent | Deterministic tokens leaking into free text | Keep profile tokens in CLI/API contracts only |
| Free-text bridge operations | Privileged control | Slash/API only |
| Free-text local inspector steal | Capability hijack | Surface operational intent |
| Pack pillar weights from free-text keywords | Retrieve bias as fake intent | `equalPillarWeights` / `noKeywordIntentRouting` |
| Auth treating free-text ops phrases as privileged shortcuts | Escalation surface | Slash-only privileged auth guard |

## Allowed

| Pattern | Why allowed | Notes |
| --- | --- | --- |
| Slash/CLI explicit tokens | Deterministic operator contract | Zavorth-native names |
| Structured decision / ref / callback data | UI buttons and APIs | Not free-text NLU |
| Free-text args after an explicit slash | Slash owns the feature | Example: `/files downloads` |
| Store FTS / similarity / keyword search inside memory engines | Retrieval quality | Not product feature activation |
| Continuity hints to the LLM | Does not steal the turn | Hint only |
| `/invoke` keyword helpers | Invoked only after explicit slash/API | Not chat free-text intercept |
| Secret-keyword blockers / pairing codes | Security gates | Not feature routing |

## Hot-path files

| File | Invariant |
| --- | --- |
| `src/services/UserExperienceIntentRouter.ts` | Structural signals only |
| `src/services/learned-knowledge/LearnedKnowledgePlaneService.ts` | Equal pillars; store rank only |
| `src/runtime/agent/AgentTeamCompilerService.ts` | Structured team intent only |
| `src/runtime/agent/UniversalApprovalIntentResolver.ts` | Slash/structured approve only |
| `src/domain/surface/.../SharedSurfacePresentationCommandPack.ts` | `parseRuntimeMaintenanceIntent` returns null |
| `src/cli/ZavorthCliRegistryExperience.ts` | Profile tokens only |
| `src/ai-gateway/.../experienceRouteSupport.ts` | Profile tokens only |
| `src/gateways/channels/telegram/AuthGuard.ts` | Privileged equals slash only |
| `src/domain/surface/.../SurfaceAgentFirstMode.ts` | Free text always goes to the agent |

## How to verify

```bash
npx jest tests/services/honesty/FreeTextFeatureActivationResiduals.test.ts --no-coverage
npm run purity:hygiene
npx jest tests/hygiene/FreeTextFeatureRoutingHygiene.test.ts --no-coverage
npm run purity:package-c
```

## When adding a new feature

1. Prefer tool and/or slash/CLI entry.
2. Never add a free-text phrase dictionary that activates the feature.
3. If you need heuristics, they may hint the model, never steal the turn.
4. Extend the hygiene test watchlist if you touch free-text dispatch.
5. Keep default product strings English on critical paths.

## Path / PII hygiene

| Rule | Enforcement |
| --- | --- |
| No absolute host paths in hub/advanced/story JSON | `toPublicPath` / project-relative or `(external)/name` |
| Vault walk stays under vault root | `scanVaultInventory` realpath containment |
| Dream last-run receipt has no free-text session body | counts and status only |
| API 500 bodies | stable codes, not raw exception messages |
