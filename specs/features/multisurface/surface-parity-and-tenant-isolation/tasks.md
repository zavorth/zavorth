# Tasks: Paridade multisurface e isolamento por tenant

**Feature ID:** `multisurface/surface-parity-and-tenant-isolation`  
**Status:** active

## Entrega

- [x] T1. Refinar `spec.md` para explicitar tenancy, surfaces e readiness
- [x] T2. Refinar `plan.md` com arquivos reais, riscos e sequencia de rollout
- [x] T3. Definir o subconjunto oficial de comandos `surface-agnostic`
- [x] T4. Garantir que `CoreOrchestrator` e `SharedSurfaceCommandService` sejam a fonte de verdade desses comandos
- [ ] T5. Fechar `pending_onboarding` do tenant compartilhado do Discord com rollout por canal
- [x] T6. Fortalecer continuidade cross-surface com filtro explicito por `tenantId`
- [x] T7. Cobrir regressao em `CoreOrchestrator`, `SurfaceTaskDispatchService`, `SessionContinuityService`, `RuntimeAccessReadinessService` e `DiscordGateway`
- [x] T8. Validar `build`, `ops:access` e diagnostics antes de promover novas surfaces
- [ ] T9. Atualizar docs operacionais e de surfaces quando o piloto do Discord estiver fechado

## Nota

- T5 e T9 continuam dependentes do rollout externo por canal no Discord (`DISCORD_ALLOWED_CHANNEL_IDS`). O runtime, os testes e a documentacao ja refletem corretamente esse bloqueio como `pending_onboarding`.
