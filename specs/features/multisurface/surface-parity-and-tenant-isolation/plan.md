# Plan: Paridade multisurface e isolamento por tenant

**Feature ID:** `multisurface/surface-parity-and-tenant-isolation`  
**Status:** active

## 1. Arquitetura

- Componentes principais:
  - [CoreOrchestrator.ts](src\core\CoreOrchestrator.ts)
  - [SurfaceTaskDispatchService.ts](src\services\SurfaceTaskDispatchService.ts)
  - [TenantContextService.ts](src\services\TenantContextService.ts)
  - [TenantRegistryService.ts](src\services\TenantRegistryService.ts)
  - [SessionContinuityService.ts](src\services\SessionContinuityService.ts)
  - [SharedSurfaceCommandService.ts](src\services\SharedSurfaceCommandService.ts)
  - [DiscordGateway.ts](src\gateways\DiscordGateway.ts)
  - [WebAppService.ts](src\services\WebAppService.ts)
  - [RuntimeAccessReadinessService.ts](src\services\RuntimeAccessReadinessService.ts)
  - [RuntimeDiagnosticsService.ts](src\services\RuntimeDiagnosticsService.ts)
- Mudancas de fluxo:
  - toda entrada de superficie deve passar por um contrato compartilhado de dispatch antes de tocar tasking
  - o tenant deve ser resolvido no ingresso, persistido no registry e reaproveitado por session continuity, approvals e readiness
  - comandos compartilhados devem sair do gateway especifico e depender do core e do `SharedSurfaceCommandService`
  - readiness e diagnostics devem refletir claramente se uma superficie esta operacional, parcialmente pronta ou bloqueada por onboarding/policy
- Riscos arquiteturais:
  - divergencia entre policy de superficie e policy de tenant
  - surfaces secundarias herdando poder demais do Telegram
  - drift entre contract shared-command e comportamento real de Discord/Web
  - onboarding parcial gerando falso positivo de prontidao

## 2. Arquivos E Modulos

- `src/core/CoreOrchestrator.ts`
- `src/services/SurfaceTaskDispatchService.ts`
- `src/services/TenantContextService.ts`
- `src/services/TenantRegistryService.ts`
- `src/services/SessionContinuityService.ts`
- `src/services/SharedSurfaceCommandService.ts`
- `src/gateways/DiscordGateway.ts`
- `src/services/WebAppService.ts`
- `src/services/RuntimeAccessReadinessService.ts`
- `src/services/RuntimeDiagnosticsService.ts`
- `tests/core/CoreOrchestrator.test.ts`
- `tests/services/SurfaceTaskDispatchService.test.ts`
- `tests/services/TenantRegistryService.test.ts`
- `tests/services/SessionContinuityService.test.ts`
- `tests/services/RuntimeAccessReadinessService.test.ts`
- `tests/gateways/DiscordGateway.test.ts`
- `docs/06-telegram.md`
- `docs/07-web.md`
- `docs/09-operations.md`

## 3. Dados, Estado E Memoria

- Persistencia:
  - tenant registry em `data/runtime/tenant-registry.json`
  - metadata de task e permission com `tenant_context`, `tenant_id`, `policy_profile` e `surface_identity`
- Runtime state:
  - `runtime-diagnostics.json`
  - `discord-bridge-status.json`
  - lock files do host/worker
- Sessao/tenant:
  - sessao precisa ser bindada a `tenantId`, `runtimeUserId`, `sourceUserId`, `chatId/channelId` e `scopeId`
  - continuidade cross-surface deve preservar boundary `personal` vs `shared`
  - onboarding pendente precisa ser refletido como estado explicito, nao como observacao informal

## 4. Seguranca

- Boundaries:
  - `shared` vs `personal`
  - `private` vs `tenant` isolation mode
  - `publicServerMode` como hardening extra para Discord
- Permissoes:
  - approvals e operacao sensivel permanecem bindadas a `tenantId + task + actor`
  - comandos operacionais em superficies publicas continuam owner/operator gated
- Validacoes:
  - bloqueio fail-closed quando guild/channel/owner/onboarding estiverem incompletos
  - readiness e diagnostics nao podem marcar superficie como pronta se o tenant ainda estiver em `pending_onboarding`
  - session continuity deve filtrar contexto por tenant quando houver boundary compartilhado

## 5. Validacao

- Build:
  - `npm run build`
- Testes:
  - foco em `CoreOrchestrator`, `SurfaceTaskDispatchService`, `TenantRegistryService`, `SessionContinuityService`, `RuntimeAccessReadinessService`, `DiscordGateway`
- Smoke operacional:
  - `npm run ops:access`
  - validar `runtime-diagnostics.json`
  - validar onboarding/policy no tenant compartilhado do Discord sem abrir comandos fora da allowlist

## 6. Rollout

- Sequencia de entrega:
  1. consolidar o contrato multisurface no core e no dispatcher
  2. endurecer tenancy/readiness/diagnostics
  3. abrir piloto concreto em `discord/public-channel-rollout`
  4. fechar paridade minima de comandos compartilhados
- Criticos de parada:
  - qualquer regressao que misture tenants
  - readiness marcando `ready` com onboarding pendente
  - Discord/Web aceitando comando fora da policy definida
- Rollback:
  - ability to disable uma superficie ou exposure sem derrubar o runtime inteiro
  - preservar Telegram e `/app` operator path como rotas de recuperacao

