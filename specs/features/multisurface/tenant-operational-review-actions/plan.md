# Plan

## Scope

- evoluir `tenant recipes` de inspecao guiada para `review workflows` seguros
- manter `memoryplane` e `sessions` em modo `compose`
- reaproveitar o `workflowController` ja existente no runtime web

## Implementation Notes

- ampliar `ZavorthTenantGovernanceService` com action ids de review operacional
- ligar `ZavorthTenantGovernanceActionService` ao `workflowController`
- devolver `status=started` quando a acao iniciar workflow real
- alinhar `WebAppSurfaceRouteService`, `DashboardService`, demo e testes

## Risks

- drift entre recipes do snapshot e capabilities reais do backend
- fluxo web sem runtime anexado precisa continuar falhando de forma segura
- actions operacionais nao devem sugerir mutacao automatica sem review
