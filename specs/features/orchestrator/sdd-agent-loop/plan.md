# Plan: Loop SDD orientado por papeis

**Feature ID:** `orchestrator/sdd-agent-loop`  
**Status:** active

## Arquitetura

- [SddFeatureWorkspaceService.ts](src\services\SddFeatureWorkspaceService.ts)
- [SddAgentRoleService.ts](src\services\SddAgentRoleService.ts)
- [SddOrchestratorService.ts](src\services\SddOrchestratorService.ts)
- [WorkflowRunService.ts](src\services\WorkflowRunService.ts)
- [MultiAgentPipeline.ts](src\services\MultiAgentPipeline.ts)
- [sdd-loop.ts](scripts\sdd-loop.ts)
- [SddFeatureWorkspaceService.test.ts](tests\services\SddFeatureWorkspaceService.test.ts)
- [SddOrchestratorService.test.ts](tests\services\SddOrchestratorService.test.ts)
- [WorkflowRunService.test.ts](tests\services\WorkflowRunService.test.ts)
- [MultiAgentPipeline.test.ts](tests\services\MultiAgentPipeline.test.ts)

## Mudanca

- adicionar um workspace service para inspecionar a feature e seus artefatos SDD
- adicionar um role service para traduzir o estado da feature em `Spec/Planner/Execution/Review`
- adicionar um orquestrador minimo que cria/atualiza estado do loop e devolve um work order
- adicionar um CLI para uso local via feature id
- integrar o loop ao `WorkflowRunService` como workflow nativo `sdd`
- integrar o `MultiAgentPipeline` para executar uma etapa SDD por vez e sincronizar o `handoff`

## Validacao

- testes unitarios do workspace
- testes do orquestrador
- testes do workflow run e do pipeline
- `npm run build`

