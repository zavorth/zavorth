# Plan: Fonte de verdade do runtime do dashboard

**Feature ID:** `runtime/dashboard-runtime-source-of-truth`  
**Status:** active

## Arquitetura

- [RuntimeAccessReadinessService.ts](src\services\RuntimeAccessReadinessService.ts)
- [launch-zavorth-supervised.ps1](scripts\launch-zavorth-supervised.ps1)
- [DashboardService.ts](src\services\DashboardService.ts)
- [RuntimeAccessReadinessService.test.ts](tests\services\RuntimeAccessReadinessService.test.ts)

## Mudanca

- cruzar `dashboard-runtime.json` com o lock do worker antes de aceitar a porta anunciada
- manter o fallback para `ZAVORTH_WEB_PORT` quando o snapshot nao pertence ao runtime supervisionado atual
- preservar o comportamento correto quando o worker realmente subiu em porta alternativa por `EADDRINUSE`

## Validacao

- teste unitario cobrindo snapshot divergente
- `npm run build`
- suite direcionada de readiness

