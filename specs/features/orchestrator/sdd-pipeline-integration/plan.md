# Plan: Integracao do loop SDD ao pipeline nativo

**Feature ID:** `orchestrator/sdd-pipeline-integration`

## Escopo tecnico

- Estender `WorkflowRunService` para aceitar `sdd` e expor um helper pequeno para semear estado de stages quando necessario.
- Integrar `MultiAgentPipeline` ao `SddOrchestratorService` por injecao opcional.
- Adicionar um metodo dedicado para executar a etapa SDD atual de uma feature.
- Ajustar descricoes e mensagens para o novo workflow.
- Cobrir com testes direcionados em pipeline e workflow run service.

## Arquivos alvo

- [WorkflowRunService.ts](src\services\WorkflowRunService.ts)
- [MultiAgentPipeline.ts](src\services\MultiAgentPipeline.ts)
- [WorkflowRunService.test.ts](tests\services\WorkflowRunService.test.ts)
- [MultiAgentPipeline.test.ts](tests\services\MultiAgentPipeline.test.ts)

## Validacao

- testes direcionados de `WorkflowRunService`
- testes direcionados de `MultiAgentPipeline`
- `npm run build`

## Riscos

- ampliar `WorkflowKind` sem querer expor `sdd` como workflow generico em superficies que ainda nao entendem `featureId`
- introduzir uma segunda forma de handoff SDD sem sincronizar com `run-state.json`

## Mitigacao

- manter `runSddWorkflow` como metodo dedicado, separado de `runWorkflow`
- usar `SddOrchestratorService.inspect/handoff` como fonte de verdade do estado da feature

