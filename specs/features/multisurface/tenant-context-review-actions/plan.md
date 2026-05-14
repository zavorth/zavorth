# Plan

1. Estender o snapshot de governanca por tenant com contexto suficiente para consultar memory/session plane.
2. Atualizar `ZavorthTenantGovernanceActionService` para suportar `review-memoryplane` e `review-sessions`.
3. Propagar essas acoes no endpoint web e no demo do `/app`, com navegacao para `workspace/history`.
4. Cobrir com testes focados de service e web.
