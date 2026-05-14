# Spec: Workflow audit hash chain

**Feature ID:** `security/workflow-audit-hash-chain`  
**Status:** completed  
**Escopo:** `specs/features/security/workflow-audit-hash-chain`

## 1. Problema

Workflows longos do Zavorth precisam de uma trilha tamper-evident minima para retomada, debugging e auditoria operacional. O log SQL geral sozinho nao garante uma cadeia clara entre estados intermediarios de um workflow run.

## 2. Objetivo

Anexar uma hash chain simples e deterministicamente reconstituivel a cada checkpoint de workflow run, reduzindo risco de drift silencioso entre estado atual e trilha historica.

## 3. Requisitos Funcionais

- RF-01: cada checkpoint precisa carregar `state_hash`, `previous_chain_hash` e `chain_hash`.
- RF-02: `ledger.json` deve apontar para o ultimo checkpoint e ultimo hash da cadeia.
- RF-03: eventos de aprovacao, interrupcao e conclusao precisam gerar nomes canonicos de evento na trilha.

## 4. Requisitos De Seguranca

- RS-01: a cadeia deve ser derivada de serializacao estável do estado do run.
- RS-02: cada novo checkpoint precisa depender explicitamente do hash anterior.
- RS-03: fallbacks nao podem apagar a informacao do ultimo hash conhecido.

## 5. Impacto Por Superficie

- Telegram: operadores conseguem retomar runs com trilha mais confiavel.
- Discord: comandos operacionais passam a ter base para auditoria de workflows.
- Web: o app passa a ter fundamento para mostrar integridade resumida do run.
- Runtime supervisionado: facilita diagnostico apos restart ou autorepair.

## 6. Tenancy E Governanca

- Tenant impactado: workflows de todos os tenants.
- Policy profile: auditoria restrita ao escopo da run.
- Owner/operator implications: aprovacoes e rejeicoes ganham evento canônico persistido.

## 7. Observabilidade E Operacao

- Logs: ultimo evento e ultimo chain hash por run.
- Auditoria: `checkpoints.ndjson` e `ledger.json`.
- Health/readiness: divergencia entre estado e ledger deve aparecer como degradacao futura.
- Rollout: embutido na persistencia nova do workflow run.
- Rollback: manter arquivo legacy e leitura tolerante.

## 8. Criterios De Aceitacao

- CA-01: cada checkpoint aponta para o hash anterior da cadeia.
- CA-02: o ledger reflete o ultimo evento e ultimo hash canonicos.
- CA-03: eventos de approval decision persistem `stage_approved` e `stage_rejected`, sem nomes quebrados.

## 9. Nao Objetivos

- NO-01: substituir o `AuditLogger` SQL inteiro nesta mesma entrega.
- NO-02: implementar assinatura criptografica externa ou Merkle tree completa agora.

## 10. Open Questions

- Q-01: em qual fatia promover essa trilha para auditoria transversal de tasks, approvals e mutations fora dos workflows?
