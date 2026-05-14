# Plan: Limited Agent OS Control Plane

**Feature ID:** `orchestrator/limited-agent-os-control-plane`  
**Status:** completed

## Arquitetura

- criar um service proprio para o snapshot do agent OS limitado
- reutilizar `ZavorthTeamCatalogService` como fonte de loops
- reaproveitar o loop SDD existente como nucleo do agent OS
- endurecer `SddOrchestratorService` e `MultiAgentPipeline`

## Primeira Fatia

- `ZavorthAgentOperatingSystemService.ts`
- gate para `featureId` desconhecida em `/workflow sdd`
- `writeScope` promovido para `WorkflowStageDefinition` e `PlanStep.file_targets`
- ordem mais segura do sync SDD antes de marcar etapa concluida

## Validacao

- `ZavorthAgentOperatingSystemService.test.ts`
- `MultiAgentPipeline.test.ts`
- `TelegramPipelineController.test.ts`
- `ZavorthCapabilityCatalogService.test.ts`
- `npm run build`
