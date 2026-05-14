# Plan

1. Ligar `SharedSurfaceCommandService` ao `ZavorthTenantGovernanceActionService`.
2. Adicionar parsing seguro para `/tenants run <tenantId> <actionId>` e forma implicita `<tenantId> <actionId>`.
3. Reaproveitar o workflow controller quando disponivel para `start-onboarding-review` e `start-tenant-audit`.
4. Alinhar ajuda, catalogo e CLI com a nova sintaxe.
5. Cobrir com testes focados e build.
