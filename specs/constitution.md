# Constituicao de Engenharia do Zavorth

Este documento define as regras permanentes do Zavorth para SDD, arquitetura e rollout.

## 1. Principios Nao Negociaveis

1. `Seguranca primeiro`
   Tudo nasce em postura fail-closed. Qualquer superficie publica deve bloquear por padrao ate existir onboarding, owner, policy e allowlist.

2. `Local-first com governanca real`
   Estado, artefatos, auditoria, permissao e memoria operacional devem permanecer controlaveis no host do operador.

3. `Menor privilegio por tenant e superficie`
   Nenhum canal, tenant, gateway ou ferramenta recebe mais acesso do que o estritamente necessario.

4. `Supervisor acima do worker`
   Toda recuperacao relevante privilegia reinicio supervisionado, autorepair, rollback e continuidade de estado.

5. `Spec antes de codigo`
   Mudanca estrutural sem `spec.md`, `plan.md` e `tasks.md` e excecao, nao regra.

## 2. Regras De Arquitetura

- Toda feature deve declarar impacto em `runtime`, `security`, `observability`, `tenancy` e `surfaces`.
- Qualquer integracao nova deve prever fallback, health check e criterio de degradacao segura.
- Nenhuma superficie publica pode expor comando operacional sem policy explicita.
- Toda automacao de alto risco deve prever trilha auditavel, validacao e rollback.

## 3. Regras De Runtime

- O Zavorth deve continuar funcional mesmo quando uma extensao falha, salvo quando a policy declarar `required on boot`.
- Sempre que possivel, o estado de execucao deve ser persistido fora da janela de contexto do modelo.
- O runtime nunca deve reduzir isolamento automaticamente de um tier forte para um tier mais fraco sem policy explicita.

## 4. Regras De Multisurface

- Features nao podem ser descritas como Telegram-first por padrao.
- Toda spec nova deve explicitar o comportamento em:
  - Telegram
  - Discord
  - Web
  - runtime supervisionado

Se alguma superficie nao se aplicar, isso deve ser dito explicitamente.

## 5. Regras De Seguranca

- Dados, tokens e segredos nao entram em documentacao nem fixtures sem necessidade estrita.
- Qualquer proposta de execucao remota, pagamento ou automacao externa precisa de escopo, autorizacao e auditoria.
- Prompt injection, anexos, links e inputs publicos devem ser tratados como nao confiaveis por padrao.

## 6. Regras De Validacao

Toda feature relevante deve prever:

- testes direcionados
- validacao operacional
- estrategia de rollout
- estrategia de rollback
- criterio de pronto

## 7. Definicao De Pronto

Uma feature so e considerada pronta quando:

- o `spec.md` estiver coerente com a implementacao
- o `plan.md` refletir a arquitetura final
- o `tasks.md` estiver atualizado
- build/testes essenciais passarem
- a superficie afetada tiver evidencias de operacao
