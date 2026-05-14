# Spec: Fonte de verdade do runtime do dashboard

**Feature ID:** `runtime/dashboard-runtime-source-of-truth`  
**Status:** active

## Problema

- o runtime supervisionado e o `ops:access` dependem de `dashboard-runtime.json` para decidir qual porta do `/app` e do dashboard estao vivas
- quando existe processo orfao ou snapshot antigo, o sistema pode confiar em uma porta que nao pertence ao worker supervisionado atual
- isso gera diagnostico confuso, probes errados e risco de reciclagem desnecessaria

## Objetivo

- aceitar o snapshot do dashboard apenas quando ele pertencer ao worker supervisionado atual
- manter a leitura local correta quando o dashboard realmente precisou subir em porta alternativa
- evitar que readiness e launcher tratem estado antigo como fonte de verdade do boot atual

## Requisitos

- `RuntimeAccessReadinessService` deve rejeitar snapshot de dashboard cujo `pid` nao bata com o lock ativo do worker
- o fallback deve continuar usando `ZAVORTH_WEB_PORT` quando o snapshot nao for confiavel
- o comportamento nao pode quebrar runtimes validos que sobem em `33334+`

## Criterios De Aceitacao

- snapshot vivo, mas de outro `pid`, nao muda a `local.baseUrl`
- snapshot do worker ativo continua tendo prioridade
- build e testes direcionados passam
