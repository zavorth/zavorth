# Spec: Paridade multisurface e isolamento por tenant

**Feature ID:** `multisurface/surface-parity-and-tenant-isolation`  
**Status:** active  
**Escopo:** `specs/features/multisurface/surface-parity-and-tenant-isolation`

## 1. Problema

O Zavorth esta saindo de um modelo Telegram-first para um runtime multissuperficie. Sem paridade de contrato e isolamento por tenant, cada canal tende a crescer com regras divergentes.

## 2. Objetivo

Fazer o Zavorth operar como um runtime compartilhado, com identidade, sessao, policy e tasking consistentes entre Telegram, Discord e Web.

## 3. Requisitos Funcionais

- RF-01: uma mesma feature deve poder declarar comportamento por superficie.
- RF-02: tenants devem ser resolvidos e persistidos de forma consistente.
- RF-03: comandos e workflows compartilhados devem depender do core, nao de um gateway isolado.

## 4. Requisitos De Seguranca

- RS-01: isolamento por tenant e obrigatorio.
- RS-02: um canal nao pode herdar automaticamente poder de outro.
- RS-03: readiness deve acusar onboarding/policy incompletos antes de abrir uma superficie publica.

## 5. Impacto Por Superficie

- Telegram: continua forte para operacao.
- Discord: foco em servidor publico com policy conservadora.
- Web: continuidade, sessao e cockpit.
- Runtime supervisionado: diagnostics e readiness consolidados.

## 6. Tenancy E Governanca

- Tenant impactado: pessoal e compartilhado.
- Policy profile: varia por tenant e superficie.
- Owner/operator implications: aprovacao e operacao continuam bindadas ao escopo correto.

## 7. Observabilidade E Operacao

- Logs: surface routing, policy mismatch, session handoff.
- Auditoria: approvals, comandos e bloqueios cross-surface.
- Health/readiness: tenants pendentes, gateway status e superfícies ativas.
- Rollout: sempre por superficie e por tenant.
- Rollback: ability to disable a surface without derrubar o runtime inteiro.

## 8. Criterios De Aceitacao

- CA-01: o runtime explica claramente o estado de cada superficie.
- CA-02: tenants compartilhados entram em onboarding explicito.
- CA-03: as features novas nascem surface-aware.

## 9. Nao Objetivos

- NO-01: UX identica em todas as plataformas.
- NO-02: habilitar todas as surfaces ao mesmo tempo sem rollout gradual.

## 10. Open Questions

- Q-01: qual subconjunto de comandos deve ser 100% compartilhado entre Telegram, Discord e Web?
