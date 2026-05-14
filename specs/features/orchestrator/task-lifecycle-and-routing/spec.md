# Spec: Ciclo de vida de task e roteamento

**Feature ID:** `orchestrator/task-lifecycle-and-routing`  
**Status:** active  
**Escopo:** `specs/features/orchestrator/task-lifecycle-and-routing`

## 1. Problema

O Zavorth precisa transformar pedidos livres em tarefas rastreaveis, seguras e roteadas para o executor ou fluxo correto.

## 2. Objetivo

Manter um lifecycle de task consistente, com risco, contexto, executor, rollback e retomada.

## 3. Requisitos Funcionais

- RF-01: cada pedido relevante deve gerar task persistida e auditavel.
- RF-02: o orquestrador deve classificar intencao, risco e executor sugerido.
- RF-03: a task deve sobreviver a follow-up, retomada e recovery.

## 4. Requisitos De Seguranca

- RS-01: tarefas nao podem escalar para execucao real sem policy e permission check.
- RS-02: tasks de tenants diferentes devem permanecer isoladas.
- RS-03: roteamento deve preservar contexto de trusted boundary.

## 5. Impacto Por Superficie

- Telegram: entrada principal historica.
- Discord: entrada publica controlada por policy.
- Web: continuidade de sessao e tasks do `/app`.
- Runtime supervisionado: recovery e replay de tasks no boot.

## 6. Tenancy E Governanca

- Tenant impactado: pessoal e compartilhado.
- Policy profile: depende da superficie e do workspace.
- Owner/operator implications: aprovacoes permanecem bindadas ao tenant/task.

## 7. Observabilidade E Operacao

- Logs: criacao, parsing, roteamento e falha de task.
- Auditoria: input, policy, approvals e execucao.
- Health/readiness: tasks zumbis e stale tasks.
- Rollout: incremental por fluxo.
- Rollback: restaurar comportamento de roteamento anterior quando houver regressao.

## 8. Criterios De Aceitacao

- CA-01: tasks mantem status coerente do inicio ao fim.
- CA-02: executor escolhido reflete risco e contexto.
- CA-03: recovery nao perde task valida.

## 9. Nao Objetivos

- NO-01: swarm complexo por padrao.
- NO-02: mercado descentralizado de agentes neste estagio.

## 10. Open Questions

- Q-01: quando externalizar checkpoint de task de forma mais file-centric?
