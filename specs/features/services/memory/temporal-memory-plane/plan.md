# Plan: Temporal Memory Plane

**Feature ID:** `services/memory/temporal-memory-plane`  
**Status:** completed

## Arquitetura

- estender [ZavorthMemoryPlaneService.ts](src\services\ZavorthMemoryPlaneService.ts) em vez de substituir o plano atual
- reutilizar `MemoryService`, `GatewaySessionReadModelService` e `WorkspaceOperationalMemoryService`
- manter o snapshot rapido honesto e deixar o snapshot completo calcular timeline e conflitos

## Mudanca

- adicionar `timeline.recent`, `timeline.conflicts` e `latestHistoricalAt`
- materializar historico persistente em `user_memory_history` sem quebrar a tabela `user_memory`
- calcular conflitos por chave com base em memorias atuais, relevantes e historicas
- promover esses sinais para o `/app`, demo web e endpoints oficiais de dashboard/web

## Arquivos Principais

- [ZavorthMemoryPlaneService.ts](src\services\ZavorthMemoryPlaneService.ts)
- [MemoryService.ts](src\services\MemoryService.ts)
- [app.js](vercel-web\app.js)
- [DashboardService.ts](src\services\DashboardService.ts)
- [WebAppSurfaceRouteService.ts](src\services\WebAppSurfaceRouteService.ts)

## Validacao

- [ZavorthMemoryPlaneService.test.ts](tests\services\ZavorthMemoryPlaneService.test.ts)
- [DashboardMemoryPlane.test.ts](tests\services\DashboardMemoryPlane.test.ts)
- [WebAppMemoryPlane.test.ts](tests\services\WebAppMemoryPlane.test.ts)
- [DashboardService.test.ts](tests\services\DashboardService.test.ts)
- `npm run build`

## Rollout

- rollout incremental, sem trocar o formato base de memoria usado pelas surfaces
- fallback simples: continuar servindo o snapshot sem timeline caso a camada temporal falhe

