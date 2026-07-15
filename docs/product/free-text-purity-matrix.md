# Free-text purity matrix

Hard product rule for Zavorth agent-first surfaces:

| Input                             | Owner                                   |
| --------------------------------- | --------------------------------------- |
| Free text (chat NL, any language) | **LLM + tools** — never keyword→feature |
| Slash commands / CLI tokens       | Deterministic                           |
| Buttons / callback_data           | Deterministic                           |
| Structured metadata / tool ids    | Deterministic                           |

Related: [agent-tool-routing.md](./agent-tool-routing.md) · [telegram-agent-first.md](./telegram-agent-first.md) · [learned-knowledge-plane.md](./learned-knowledge-plane.md).

---

## Forbidden (must never reappear on free-text chat dispatch)

| Pattern                                                                    | Why forbidden                               | Guard                                                               |
| -------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------- |
| Keyword/regex packs that map NL phrases to product features                | Steals turn from agent                      | Hygiene + honesty tests                                             |
| Free-text approve/reject (`aprovo`, `pode continuar`, bare `sim`)          | Dangerous side effect without slash/button  | `UniversalApprovalIntentResolver` + residuals test                  |
| Free-text team/swarm (“equipe de agentes”, “use 300 agents”)               | Compiles/launches without structured intent | `AgentTeamCompilerService.isTeamIntent`                             |
| Free-text UX feature routing (`resuma`, `link`, reload/autorepair phrases) | Bypasses slash/CLI                          | `UserExperienceIntentRouter`, `parseRuntimeMaintenanceIntent` no-op |
| Free-text profile style (`resuma impacto` → executive)                     | Feature via phrase                          | CLI/API `--profile` tokens only                                     |
| Free-text bridge ops (`abrir zavorth bridge`)                              | Privileged control                          | Slash `/ag_*` only                                                  |
| Free-text local-inspector steal (folder/file phrases)                      | Capability hijack                           | Surface operational intent                                          |
| Pack pillar weights from free-text keywords                                | Retrieve bias as fake intent                | `equalPillarWeights` / `noKeywordIntentRouting`                     |
| Auth treating free-text ops phrases as privileged shortcuts                | Escalation surface                          | `AuthGuard` slash-only privileged                                   |

## Allowed (intentional)

| Pattern                                                                                 | Why allowed                           | Notes                           |
| --------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------- |
| Slash/CLI explicit tokens (`/approve`, `/knowledge story`, `zavorth learn forget <id>`) | Deterministic operator contract       | Zavorth-native names            |
| Structured `decision` / `ref` / `callback_data`                                         | UI buttons & APIs                     | Not free-text NLU               |
| Free-text **args after** an explicit slash                                              | Slash owns the feature                | e.g. `/files downloads`         |
| Store FTS / similarity / keyword search **inside** memory engines                       | Retrieval quality                     | Not product feature activation  |
| Continuity _hints_ to the LLM                                                           | Does not steal turn or activate packs | e.g. continuation intent signal |
| Engineering Core / `/invoke` keyword helpers                                            | Invoked only after explicit slash/API | Not chat free-text intercept    |
| Secret-keyword blockers / pairing codes                                                 | Security gates                        | Not feature routing             |
| Explicit profile tokens (`--profile executive`, bare `executive` CLI arg)               | Deterministic                         | Not “resuma impacto e decisão”  |

## Hot-path files (regression watchlist)

| File                                                             | Invariant                              |
| ---------------------------------------------------------------- | -------------------------------------- |
| `src/services/UserExperienceIntentRouter.ts`                     | Structural signals only                |
| `src/services/learned-knowledge/LearnedKnowledgePlaneService.ts` | Equal pillars; store rank only         |
| `src/runtime/agent/AgentTeamCompilerService.ts`                  | Structured team intent only            |
| `src/runtime/agent/UniversalApprovalIntentResolver.ts`           | Slash/structured approve only          |
| `src/domain/surface/.../SharedSurfacePresentationCommandPack.ts` | `parseRuntimeMaintenanceIntent` → null |
| `src/cli/ZavorthCliRegistryExperience.ts`                        | Profile tokens only                    |
| `src/ai-gateway/.../experienceRouteSupport.ts`                   | Profile tokens only                    |
| `src/gateways/channels/telegram/AuthGuard.ts`                    | Privileged = slash only                |
| `src/domain/surface/.../SurfaceAgentFirstMode.ts`                | Free text always agent                 |

## How to verify

```bash
# Runtime honesty residuals
npx jest tests/services/honesty/FreeTextFeatureActivationResiduals.test.ts --no-coverage

# Static hygiene (forbidden patterns on hot paths)
npm run purity:hygiene
# or
npx jest tests/hygiene/FreeTextFeatureRoutingHygiene.test.ts --no-coverage

# Full Package C gate
npm run purity:package-c
```

## When adding a new feature

1. Prefer **tool** and/or **slash/CLI** entry.
2. Never add a free-text phrase dictionary that activates the feature.
3. If you need heuristics, they may **hint the model**, never steal the turn.
4. Extend the hygiene test watchlist if you touch free-text dispatch.
5. Keep default product strings **English** on critical paths (i18n via locale files / `labelPt` only when intentional).

## Path / PII hygiene (hub + Advanced API)

| Rule                                                 | Enforcement                                                          |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| No absolute host paths in hub/advanced/story JSON    | `toPublicPath` / project-relative or `(external)/name`               |
| Vault walk stays under vault root                    | `scanVaultInventory` realpath containment                            |
| Dream last-run receipt has no free-text session body | counts + status only                                                 |
| API 500 bodies                                       | stable codes (`knowledge_hub_failed`, …), not raw exception messages |
