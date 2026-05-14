# Plan: Continuidade de sessao tenant-aware

**Feature ID:** `multisurface/tenant-aware-session-continuity`  
**Status:** active

## Arquitetura

- [SessionContinuityService.ts](src\services\SessionContinuityService.ts)
- [TenantContextService.ts](src\services\TenantContextService.ts)
- [TaskRepository.ts](src\storage\TaskRepository.ts)
- [SessionContinuityService.test.ts](tests\services\SessionContinuityService.test.ts)

## Mudanca

- aplicar filtro por tenant tambem nos fallbacks `getRecentTasksByUsers`, `getRecentTasks` e `getRecentTasksByChat`
- preservar o caminho otimizado quando o loader tenant-aware existe

## Validacao

- teste cobrindo mixed tenants em fallback
- regressao da continuidade do Discord
- `npm run build`

