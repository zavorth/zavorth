# Spec

- Feature: `multisurface/tenant-action-recipes`
- Status: `implemented`

## Objective

Transformar a governanca por tenant em um plano acionavel, com recipes e guided actions reais por tenant, sem abrir mutacoes inseguras por padrao.

## Requirements

- Cada tenant observado deve poder expor actions/recipes coerentes com seu status de governanca.
- Tenants publicos pendentes ou restritos devem priorizar onboarding, allowlists e revisao de channels/workflows.
- A mesma fonte de verdade deve alimentar `/tenants` e o `/app`.
- O plano deve permanecer seguro por default: actions nesta fatia podem navegar, atualizar snapshots e carregar comandos uteis, mas nao devem abrir escrita sensivel automatica por engano.

## Acceptance

- `ZavorthTenantGovernanceService` gera `actions` e `recipe` por tenant, alem de `featuredRecipes`.
- `/tenants` mostra recipes e comandos uteis fora do web.
- O `/app` mostra cards de recipes por tenant com acao principal real (`Executar agora`) e fallback de comando.
- Testes focados e build passam.
