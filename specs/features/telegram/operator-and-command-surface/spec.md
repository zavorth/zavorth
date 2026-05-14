# Spec: Superficie de comando do operador

**Feature ID:** `telegram/operator-and-command-surface`  
**Status:** active  
**Escopo:** `specs/features/telegram/operator-and-command-surface`

## 1. Problema

O Zavorth depende de uma superficie de operador clara, previsivel e segura para acionar tarefas, aprovacoes, selfmod e operacao do runtime.

## 2. Objetivo

Padronizar a superficie de comando do operador de modo que a mesma logica possa ser espelhada com seguranca em outras plataformas quando fizer sentido.

## 3. Requisitos Funcionais

- RF-01: comandos principais devem ser claros, agrupados e auditaveis.
- RF-02: comandos operacionais devem permanecer restritos.
- RF-03: a experiencia deve continuar utilizavel para task, approval, changes, autorepair e status.

## 4. Requisitos De Seguranca

- RS-01: nenhuma superficie publica deve herdar cegamente privilegios do Telegram.
- RS-02: respostas e callbacks nao podem vazar estado sensivel.
- RS-03: selfmod, execucao e approvals precisam de trilha auditavel.

## 5. Impacto Por Superficie

- Telegram: superficie primaria do operador.
- Discord: so espelha subconjuntos por policy.
- Web: pode expor controles selecionados e autenticados.
- Runtime supervisionado: comandos devem acionar o plano operacional correto.

## 6. Tenancy E Governanca

- Tenant impactado: principalmente tenants pessoais do operador.
- Policy profile: admin/operator surface.
- Owner/operator implications: owners mantem autoridade maxima; operadores podem receber subset controlado.

## 7. Observabilidade E Operacao

- Logs: comando, callback, approval e falhas.
- Auditoria: operacao e execucao.
- Health/readiness: deve refletir se o operador consegue agir com seguranca.
- Rollout: sempre backward-compatible quando possivel.
- Rollback: preservar comandos essenciais.

## 8. Criterios De Aceitacao

- CA-01: comandos principais continuam funcionais e consistentes.
- CA-02: superficies secundarias nao expõem poder demais.
- CA-03: operador consegue resolver incidentes sem shell local na maioria dos casos.

## 9. Nao Objetivos

- NO-01: transformar Telegram na unica fonte de verdade do Zavorth.
- NO-02: replicar menus identicos em todas as plataformas.

## 10. Open Questions

- Q-01: quais comandos devem virar surface-agnostic primeiro?
