# Plan: Workflow audit hash chain

**Feature ID:** `security/workflow-audit-hash-chain`  
**Status:** completed

## 1. Arquitetura

- Componentes principais: `WorkflowExternalizedStateService` gera hash chain por checkpoint e `WorkflowRunService` fornece eventos canonicos.
- Mudancas de fluxo: cada transicao relevante do workflow persiste um evento nomeado e encadeado.
- Riscos arquiteturais: serializacao instavel, nomes de evento inconsistentes e perda do hash anterior.

## 2. Arquivos E Modulos

- `src/services/WorkflowExternalizedStateService.ts`
- `src/services/WorkflowRunService.ts`
- `tests/services/WorkflowRunService.test.ts`
- `tests/services/WorkflowExternalizedStateService.test.ts`

## 3. Dados, Estado E Memoria

- Persistencia: a trilha fica em `checkpoints.ndjson` e `ledger.json`.
- Runtime state: o snapshot do run recebe resumo da cadeia em `externalized_state`.
- Sessao/tenant: sem mudanca de boundary; apenas mais metadados operacionais.

## 4. Seguranca

- Boundaries: hashes calculados sem depender do campo `externalized_state`.
- Permissoes: a trilha e local ao diretório de workflow run.
- Validacoes: testes precisam provar encadeamento e nomes de evento canonicos.

## 5. Validacao

- Build: `npm run build`
- Testes: cobertura de checkpoints, ledger e aprovacoes/rejeicoes
- Smoke operacional: criar, interromper, aprovar ou rejeitar e restaurar run

## 6. Rollout

- Sequencia de entrega: ativar hash chain junto com a persistencia externalizada.
- Criticoes de parada: checkpoint sem hash, ledger sem ultimo evento ou nomes quebrados de evento.
- Rollback: continuar com a persistencia externalizada mesmo se a trilha detalhada for despriorizada na leitura.
