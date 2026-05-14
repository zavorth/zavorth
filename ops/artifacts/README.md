# Ops Artifacts

Esta pasta concentra artefatos gerados que nao fazem parte do estado canonico do runtime.

Mapa recomendado:

- `generated/reports/`: relatorios derivados, auditorias e saidas de diagnostico
- `generated/runtime-logs/`: logs exportados ou relocados da raiz
- `generated/deliveries/`: drafts/finals de entregas temporarias e handoffs

Regra:

- conhecimento duradouro vai para `docs/`
- estado vivo do runtime vai para `data/`
- saida derivada e descartavel vai para `ops/artifacts/generated/`
