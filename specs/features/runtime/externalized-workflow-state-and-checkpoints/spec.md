# Spec: Externalized workflow state and checkpoints

**Feature ID:** `runtime/externalized-workflow-state-and-checkpoints`  
**Status:** completed  
**Escopo:** `specs/features/runtime/externalized-workflow-state-and-checkpoints`

## 1. Problema

O Zavorth ja persistia workflow runs em arquivos JSON simples, mas ainda sem um estado externalizado por run, sem checkpoints append-only e sem retomada robusta quando a compatibilidade legacy falha ou fica incompleta.

## 2. Objetivo

Criar uma camada canônica de estado externalizado por workflow run, com diretório proprio, snapshot de estado, checkpoints append-only e restauração consistente para retomada real de runs longos.

## 3. Requisitos Funcionais

- RF-01: cada workflow run persistido deve possuir um diretório dedicado com `state.json`, `checkpoints.ndjson` e `ledger.json`.
- RF-02: `WorkflowRunService` deve restaurar runs preferindo o estado externalizado e cair para o arquivo de compatibilidade apenas como fallback.
- RF-03: metadados de task e superfícies devem receber os caminhos e sinais principais do estado externalizado.

## 4. Requisitos De Seguranca

- RS-01: a escrita deve ser append-only para checkpoints, evitando sobrescrever a trilha incremental.
- RS-02: o runtime nao pode depender exclusivamente do arquivo compatível legacy para retomar um workflow run.
- RS-03: falhas de persistência nao podem derrubar o workflow em memoria; a run deve continuar com degradacao controlada.

## 5. Impacto Por Superficie

- Telegram: retomada mais fiel de workflows pausados.
- Discord: handoff operacional preserva paths e hashes para runs sensiveis.
- Web: o runtime passa a ter base para exibir estado resumivel por workflow.
- Runtime supervisionado: recovery real apos restart/crash do host ou worker.

## 6. Tenancy E Governanca

- Tenant impactado: todos os tenants que acionam workflows.
- Policy profile: mantem isolamento por run/workspace/tenant ja definido no workflow.
- Owner/operator implications: aprovacoes futuras passam a ter trilha de retomada mais confiavel.

## 7. Observabilidade E Operacao

- Logs: eventos de persistencia e restauracao de workflow run.
- Auditoria: checkpoints encadeados por evento.
- Health/readiness: a camada de workflow state precisa ser observavel sem depender de memoria local.
- Rollout: manter arquivo legacy `<runId>.json` enquanto o novo layout amadurece.
- Rollback: ler apenas o arquivo de compatibilidade caso a leitura do estado externalizado falhe.

## 8. Criterios De Aceitacao

- CA-01: criar e interromper um workflow gera `state.json`, `checkpoints.ndjson`, `ledger.json` e o arquivo legacy.
- CA-02: `getRun()` continua restaurando a run mesmo se o arquivo legacy sumir, desde que `state.json` exista.
- CA-03: metadados de task incluem diretório, arquivos e hash mais recente da cadeia.

## 9. Nao Objetivos

- NO-01: expor UI completa de replay detalhado nesta mesma fatia.
- NO-02: substituir toda a auditoria geral do Zavorth por esta trilha de workflow.

## 10. Open Questions

- Q-01: quando promover essa trilha para snapshots operacionais e dashboard de workflows?
