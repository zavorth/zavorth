# Spec: Tamper-evident audit trail

**Feature ID:** `security/tamper-evident-audit-trail`  
**Status:** completed  
**Escopo:** `specs/features/security/tamper-evident-audit-trail`

## 1. Problema

O Zavorth ja registrava auditoria em SQLite, mas ainda sem uma trilha append-only encadeada para approvals, permissoes, bloqueios e mutacoes operacionais. Isso deixa lacunas entre observabilidade e integridade forense.

## 2. Objetivo

Adicionar uma trilha de auditoria tamper-evident por hash chain no `AuditLogger`, cobrindo eventos de seguranca e execucao sem expor dados sensiveis em claro.

## 3. Requisitos Funcionais

- RF-01: cada `AuditEvent` persistido deve gerar um registro encadeado em arquivo append-only.
- RF-02: approvals, permission decisions, security blocks e execucoes precisam entrar automaticamente nessa trilha.
- RF-03: o runtime deve manter um status resumido da trilha em arquivo operacional.

## 4. Requisitos De Seguranca

- RS-01: a trilha nao deve duplicar campos sensiveis em texto claro; ela deve armazenar hashes canonicos desses campos.
- RS-02: cada registro precisa depender do hash anterior da cadeia.
- RS-03: falhas na escrita da trilha nao podem derrubar o Zavorth; o status operacional deve marcar a degradacao.

## 5. Impacto Por Superficie

- Telegram: approvals, rejeicoes, selfmod e execucoes passam a ter trilha encadeada.
- Discord: workflows e futuros comandos operacionais ganham base de auditoria transversal.
- Web: o status operacional passa a refletir a ultima escrita da trilha.
- Runtime supervisionado: falhas de auditoria deixam rastro operacional legivel.

## 6. Tenancy E Governanca

- Tenant impactado: todos os tenants que geram `AuditEvent`.
- Policy profile: auditoria transversal por task, permissao e decisao.
- Owner/operator implications: acoes sensiveis ganham prova encadeada minima.

## 7. Observabilidade E Operacao

- Logs: status do ultimo append e ultima falha.
- Auditoria: `events.ndjson` e `ledger.json`.
- Health/readiness: `security-audit-last.json` reflete sucesso ou falha da trilha.
- Rollout: complementar ao SQLite existente.
- Rollback: manter o SQLite como fonte primaria se a trilha append-only degradar.

## 8. Criterios De Aceitacao

- CA-01: `AuditLogger.logEvent()` gera cadeia append-only sem quebrar a escrita no banco.
- CA-02: `logApprovalDecision()` e `logPermissionDecision()` entram automaticamente na trilha.
- CA-03: o status operacional mostra sucesso ou falha da ultima persistencia.

## 9. Nao Objetivos

- NO-01: substituir o banco SQLite de auditoria.
- NO-02: assinar eventos com chaves externas ou publicar Merkle root fora do host nesta entrega.

## 10. Open Questions

- Q-01: quando expor consulta e replay detalhado dessa trilha diretamente no dashboard?
