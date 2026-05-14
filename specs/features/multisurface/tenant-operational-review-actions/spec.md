# Spec

- Feature: `multisurface/tenant-operational-review-actions`
- Status: `implemented`

## Objective

Transformar recipes de tenant selecionadas em acoes operacionais seguras de verdade, priorizando workflows de review e mantendo mutacoes sensiveis fora do escopo padrao.

## Requirements

- Tenants compartilhados devem poder iniciar workflows de review guiados a partir do `/app`.
- O backend deve ser a fonte de verdade para decidir quando uma acao de tenant apenas inspeciona e quando ela realmente dispara um fluxo operacional.
- O rollout deve permanecer seguro por default: esta fatia pode iniciar workflows de review, mas nao deve aplicar mudancas sensiveis automaticamente.
- O mesmo comportamento deve aparecer de forma coerente em snapshot, endpoint web e demo.

## Acceptance

- `ZavorthTenantGovernanceService` expoe actions de review operacional por tenant quando isso fizer sentido.
- `ZavorthTenantGovernanceActionService` consegue iniciar workflows de onboarding/auditoria por tenant.
- `POST /api/web/tenants/actions` responde `202` quando a acao guiada dispara um workflow.
- O `/app` continua com fallback seguro para actions `compose`.
- Testes focados e build passam.
