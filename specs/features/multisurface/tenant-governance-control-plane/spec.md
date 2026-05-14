# Tenant Governance Control Plane

## Problem

O Zavorth ja resolve e persiste contexto de tenant no runtime, mas a governanca por tenant ainda fica espalhada entre readiness, diagnostics e policy. Falta uma surface explicita para operador enxergar quais tenants existem, quais estao prontos e quais ainda estao fail-closed.

## Goal

Expor um control plane de governanca por tenant no `/app` e nas rotas web protegidas, com leitura unificada de tenants observados, onboarding pendente, public server mode e allowlists.

## Acceptance

- Existe um snapshot canonico de governanca por tenant no backend.
- O web app protegido consegue ler esse snapshot por rota dedicada.
- O `/app` mostra resumo, pendencias e tenants recentes sem depender de configuracao manual de Discord.
- A implementacao nasce com testes focados e build limpo.
