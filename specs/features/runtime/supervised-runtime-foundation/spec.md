# Spec: Runtime supervisionado e autorepair

**Feature ID:** `runtime/supervised-runtime-foundation`  
**Status:** active  
**Escopo:** `specs/features/runtime/supervised-runtime-foundation`

## 1. Problema

O Zavorth depende de um runtime de longa duracao. Sem supervisao, rollback e autorepair, qualquer falha de boot ou crash loop degrada o sistema inteiro.

## 2. Objetivo

Manter host e worker recuperaveis, auditaveis e reexecutaveis com o menor tempo de indisponibilidade possivel.

## 3. Requisitos Funcionais

- RF-01: o host deve detectar boot incompleto, crash loop e perda de heartbeat.
- RF-02: o runtime deve conseguir acionar reload supervisionado e autorepair.
- RF-03: o estado operacional deve ser legivel por diagnostics e readiness.

## 4. Requisitos De Seguranca

- RS-01: restart nao pode pular validacao segura quando houver autoedicao.
- RS-02: o runtime nao pode reduzir isolamento automaticamente por falha de tier forte.
- RS-03: reload e autorepair devem permanecer owner/operator aware nas superficies publicas.

## 5. Impacto Por Superficie

- Telegram: comandos operacionais e notificacoes de runtime.
- Discord: status e politica de disponibilidade sem exposicao indevida.
- Web: `/app`, readiness e dashboard.
- Runtime supervisionado: host, worker, bootstrap, restart e recovery.

## 6. Tenancy E Governanca

- Tenant impactado: todos os tenants, porque o runtime e shared infrastructure.
- Policy profile: runtime-global.
- Owner/operator implications: comandos operacionais continuam restritos.

## 7. Observabilidade E Operacao

- Logs: launcher, host, worker e diagnostics.
- Auditoria: eventos operacionais e autorepair.
- Health/readiness: lock files, runtime-diagnostics, access-readiness.
- Rollout: sempre supervisionado.
- Rollback: obrigatorio em mudancas estruturais do runtime.

## 8. Criterios De Aceitacao

- CA-01: o Zavorth volta sozinho de falha de boot previsivel.
- CA-02: autorepair produz relatorio, validacao e rollback.
- CA-03: diagnostics refletem corretamente host, worker e sidecars.

## 9. Nao Objetivos

- NO-01: substituir toda a operacao humana por autonomia total.
- NO-02: suportar qualquer incidente externo arbitrario sem intervenção.

## 10. Open Questions

- Q-01: quando promover checkpointing persistente mais explicito no runtime?
