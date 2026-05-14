# Spec: Temporal Memory Plane

**Feature ID:** `services/memory/temporal-memory-plane`  
**Status:** completed  
**Escopo:** `specs/features/services/memory/temporal-memory-plane`

## Problema

- o Zavorth ja tinha replay, memoria persistente e sinais de workspace, mas ainda tratava tudo como contexto plano
- isso escondia quando um fato mudou, qual parte era historica e o que ainda era valido para continuidade

## Objetivo

- tornar o `memory plane` explicitamente temporal
- diferenciar fatos atuais de historicos
- manter conflitos visiveis quando uma mesma chave muda ao longo do tempo

## Requisitos

- distinguir `current` vs `historical` no snapshot oficial de memoria
- expor `timelineEvents`, `historicalEvents` e `changedFacts`
- manter conflitos em `timeline.conflicts` sem apagar o fato mais recente
- refletir essa leitura no `/memoryplane`, no `/app` e nas surfaces operacionais

## Entrega Implementada

- [ZavorthMemoryPlaneService.ts](src\services\ZavorthMemoryPlaneService.ts) agora produz `timeline`, `conflicts` e `latestHistoricalAt`
- [MemoryService.ts](src\services\MemoryService.ts) agora persiste historico em `user_memory_history`, preservando fatos `superseded` e `forgotten`
- o `/app` mostra memoria temporal e fatos que mudaram em [app.js](vercel-web\app.js)
- endpoints operacionais e web seguem servindo o snapshot oficial via [DashboardService.ts](src\services\DashboardService.ts) e [WebAppSurfaceRouteService.ts](src\services\WebAppSurfaceRouteService.ts)

## Criterios De Aceitacao

- follow-up consegue mostrar contexto historico sem contaminar tenants
- o operador consegue enxergar fatos que mudaram
- a camada continua leve o suficiente para `buildSnapshotFast`

