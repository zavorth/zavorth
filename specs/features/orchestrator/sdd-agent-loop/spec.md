# Spec: Loop SDD orientado por papeis

**Feature ID:** `orchestrator/sdd-agent-loop`  
**Status:** active

## Problema

- o Zavorth ja tem SDD transversal, mas ainda nao possui um loop operacional proprio para conduzir uma feature por papeis bem definidos
- sem isso, `spec.md`, `plan.md` e `tasks.md` existem, mas continuam dependendo de coordenacao manual demais

## Objetivo

- criar um nucleo pequeno de orquestracao SDD com quatro papeis:
  - `Spec Agent`
  - `Planner Agent`
  - `Execution Agent`
  - `Review Agent`
- cada papel deve operar sobre uma feature concreta e sobre arquivos de controle previsiveis

## Requisitos

- cada feature deve poder ter `run-state.json` e `handoff.md`
- o loop deve ler `spec.md`, `plan.md` e `tasks.md`
- o sistema deve decidir automaticamente o proximo papel sugerido
- o sistema deve expor um CLI simples para inspecionar e iniciar o loop
- o loop deve poder rodar como workflow nativo do Zavorth, sem criar um motor paralelo
- a integracao deve preservar o `WorkflowRunService` como trilha oficial da execucao
- a primeira versao deve ser conservadora: uma etapa SDD por vez, com retomada segura

## Criterios De Aceitacao

- uma feature real do Zavorth pode ser inspecionada pelo loop
- o loop consegue sugerir o proximo papel e o write-scope
- o pipeline consegue executar um papel SDD como workflow nativo `sdd`
- o handoff da etapa concluida volta para a feature e atualiza o proximo papel sugerido
- build e testes direcionados passam
