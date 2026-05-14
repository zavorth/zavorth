# Plan: Tamper-evident audit trail

**Feature ID:** `security/tamper-evident-audit-trail`  
**Status:** completed

## 1. Arquitetura

- Componentes principais: `AuditLogger` continua como API e delega o encadeamento para `SecurityAuditTrailService`.
- Mudancas de fluxo: todo `AuditEvent` bem-sucedido no SQLite tambem produz um registro encadeado em arquivo.
- Riscos arquiteturais: duplicacao de dados sensiveis, falhas de I/O bloqueando operacao e drift entre banco e trilha.

## 2. Arquivos E Modulos

- `src/monitoring/AuditLogger.ts`
- `src/monitoring/SecurityAuditTrailService.ts`
- `src/config/index.ts`
- `tests/monitoring/SecurityAuditTrailService.test.ts`
- `tests/monitoring/AuditLogger.test.ts`

## 3. Dados, Estado E Memoria

- Persistencia: `events.ndjson`, `ledger.json` e `security-audit-last.json`
- Runtime state: status resumido da ultima escrita de auditoria
- Sessao/tenant: sem mudar boundaries; a trilha segue a task/evento existente

## 4. Seguranca

- Boundaries: hashear `user_input`, `policy_violations`, `execution_summary` e `metadata`.
- Permissoes: escrita local apenas em diretório de runtime.
- Validacoes: testes de hash chain, status e degradacao controlada.

## 5. Validacao

- Build: `npm run build`
- Testes: `SecurityAuditTrailService` e `AuditLogger`
- Smoke operacional: append de approval decision e permission decision

## 6. Rollout

- Sequencia de entrega: ativar a trilha por baixo do `AuditLogger` mantendo o SQLite intacto.
- Criticoes de parada: append falhando, status file ausente ou cadeia sem hash anterior.
- Rollback: manter apenas o log SQL e desativar a escrita da trilha se necessario.
