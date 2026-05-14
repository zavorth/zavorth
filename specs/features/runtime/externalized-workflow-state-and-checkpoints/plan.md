# Plan: Externalized workflow state and checkpoints

**Feature ID:** `runtime/externalized-workflow-state-and-checkpoints`  
**Status:** completed

## 1. Arquitetura

- Componentes principais: `WorkflowRunService` passa a delegar persistencia para `WorkflowExternalizedStateService`.
- Mudancas de fluxo: cada mutacao relevante de run gera um novo checkpoint append-only e atualiza um ledger resumido.
- Riscos arquiteturais: drift entre o snapshot do run, o arquivo legacy e a trilha append-only.

## 2. Arquivos E Modulos

- `src/services/WorkflowRunService.ts`
- `src/services/WorkflowExternalizedStateService.ts`
- `tests/services/WorkflowRunService.test.ts`
- `tests/services/WorkflowExternalizedStateService.test.ts`

## 3. Dados, Estado E Memoria

- Persistencia: diretório por run com `state.json`, `checkpoints.ndjson` e `ledger.json`, mantendo `<runId>.json` como compatibilidade.
- Runtime state: `externalized_state` vira parte do snapshot do workflow.
- Sessao/tenant: paths e hashes entram nos metadados de task para continuidade e observabilidade.

## 4. Seguranca

- Boundaries: checkpoint nunca substitui checkpoint anterior; apenas anexa.
- Permissoes: nenhum segredo novo entra nesses artefatos além do que a run ja carrega hoje.
- Validacoes: leitura prefere `state.json`; se falhar, degrada para o arquivo de compatibilidade.

## 5. Validacao

- Build: `npm run build`
- Testes: `WorkflowRunService` e `WorkflowExternalizedStateService`
- Smoke operacional: criar run, interromper e restaurar a partir do estado externalizado

## 6. Rollout

- Sequencia de entrega: introduzir o novo layout mantendo compatibilidade com o arquivo legacy.
- Criticoes de parada: corrupcao de ledger, falha em restaurar run ou hash chain inconsistente.
- Rollback: voltar a ler apenas o `<runId>.json` enquanto mantemos os artefatos novos sem uso critico.
