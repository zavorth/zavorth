# Spec: Guardrails de superficies publicas

**Feature ID:** `security/public-surface-guardrails`  
**Status:** active  
**Escopo:** `specs/features/security/public-surface-guardrails`

## 1. Problema

O Zavorth opera em superficies potencialmente publicas. Sem guardrails consistentes, comandos, anexos, links e prompts maliciosos podem abrir risco operacional e vazamento de privilegio.

## 2. Objetivo

Garantir postura fail-closed e menor privilegio em qualquer superficie exposta, com enfase em Discord publico e integrações futuras.

## 3. Requisitos Funcionais

- RF-01: surfaces publicas devem exigir onboarding e policy antes de aceitar trafego.
- RF-02: comandos operacionais devem ser owner-only ou operator-only por policy.
- RF-03: inputs publicos devem passar por filtros de abuso e risco.

## 4. Requisitos De Seguranca

- RS-01: anexos, links e mass mentions devem ser tratados como nao confiaveis por padrao.
- RS-02: qualquer acao de alto risco deve exigir aprovacao e auditoria.
- RS-03: tenants compartilhados nao podem vazar privilegio entre si.

## 5. Impacto Por Superficie

- Telegram: continua superficie privilegiada do operador.
- Discord: principal superficie publica com hardening.
- Web: auth, token, dashboard e endpoints.
- Runtime supervisionado: readiness e diagnostics devem refletir bloqueios e pendencias.

## 6. Tenancy E Governanca

- Tenant impactado: tenants compartilhados.
- Policy profile: discord-public-guild, web-session e equivalentes futuros.
- Owner/operator implications: owners definem politica; operadores agem em escopo limitado.

## 7. Observabilidade E Operacao

- Logs: bloqueios, rate limit, onboarding e policy mismatches.
- Auditoria: aprovacoes, bloqueios e comandos sensiveis.
- Health/readiness: deve acusar tenant pendente de onboarding.
- Rollout: por canal/guild/superficie.
- Rollback: reversao de policy e exposure.

## 8. Criterios De Aceitacao

- CA-01: superficie publica nao aceita trafego sem onboarding minimo.
- CA-02: comandos operacionais nao vazam para publico.
- CA-03: diagnostics e readiness refletem corretamente o estado de seguranca.

## 9. Nao Objetivos

- NO-01: moderacao completa de comunidade.
- NO-02: substituicao de politicas externas do Discord/Telegram.

## 10. Open Questions

- Q-01: quando adicionar trilha criptografica tamper-evident acima do audit atual?
