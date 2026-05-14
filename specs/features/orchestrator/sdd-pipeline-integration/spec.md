# Spec: Integracao do loop SDD ao pipeline nativo

**Feature ID:** `orchestrator/sdd-pipeline-integration`  
**Status:** draft

## Problema

O Zavorth ja possui um loop SDD orientado por papeis via `SddFeatureWorkspaceService`, `SddAgentRoleService`, `SddOrchestratorService` e CLI local. Porem, esse loop ainda nao esta conectado ao runtime nativo de workflows e pipelines. Isso cria duas trilhas paralelas: uma de especificacao/estado e outra de execucao.

## Objetivo

Adicionar uma primeira integracao entre o loop SDD e o runtime nativo do Zavorth para que uma feature SDD possa ser operada como um fluxo rastreado, com run persistido, etapa atual definida pelo estado da feature e handoff sincronizado apos execucao bem-sucedida.

## Requisitos

1. O `WorkflowRunService` deve aceitar um workflow `sdd`.
2. O `MultiAgentPipeline` deve conseguir executar a etapa SDD atual de uma feature a partir do `featureId`.
3. A etapa executada deve ser derivada do `SddOrchestratorService.inspect(featureId)`.
4. A execucao deve preservar rastreabilidade em `workflow_run_id`, `run-state.json` e `handoff.md`.
5. A integracao nao deve quebrar os workflows existentes (`review`, `ship`, `research`).

## Criterios de aceitacao

- Existe um metodo publico para rodar uma etapa SDD no pipeline nativo.
- A execucao cria um workflow run persistido com `workflow_name = sdd`.
- O stage ativo usa `Spec/Planner/Execution/Review` conforme o `nextRole` da feature.
- Em caso de sucesso, o handoff da feature e atualizado.
- Em caso de falha, o run fica consistente e os fluxos existentes continuam passando.
