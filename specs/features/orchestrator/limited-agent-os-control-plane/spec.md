# Spec: Limited Agent OS Control Plane

**Feature ID:** `orchestrator/limited-agent-os-control-plane`  
**Status:** completed  
**Escopo:** `specs/features/orchestrator/limited-agent-os-control-plane`

## Problema

- o Zavorth ja tinha loop SDD, teams e workflows, mas ainda faltava uma leitura oficial de `agent operating system` limitado
- o loop SDD ainda aceitava `featureId` permissivo demais e o write scope do papel ficava mais no prompt do que no plano

## Objetivo

- formalizar um `agent OS` limitado por cima do SDD/workflows
- endurecer guardrails basicos do loop SDD
- expor papeis e loops oficiais como parte do plano de controle do Zavorth

## Requisitos

- existir snapshot oficial do `agent OS` limitado
- `/workflow sdd` nao deve rodar em feature desconhecida
- o `write scope` do papel precisa aparecer no plano da etapa
- o rollout inicial continua serial, humano e controlado
