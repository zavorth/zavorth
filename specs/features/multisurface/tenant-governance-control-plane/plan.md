# Plan

1. Criar um servico `ZavorthTenantGovernanceService` em cima de `TenantRegistryService`.
2. Ligar o servico ao `DashboardService`, `WebAppService` e `WebAppSurfaceRouteService`.
3. Expor `/api/web/tenants` como rota protegida.
4. Mostrar governanca de tenants no `/app` com resumo, distribuicao por superficie e tenants recentes.
5. Cobrir backend, rota web e bundle do `/app` com testes focados.
