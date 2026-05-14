# Spec: Continuidade de sessao tenant-aware

**Feature ID:** `multisurface/tenant-aware-session-continuity`  
**Status:** active

## Problema

- `SessionContinuityService` ja usa loaders tenant-aware quando eles existem
- quando o `taskManager` so oferece loaders gerais por usuario ou chat, tarefas de tenants compartilhados diferentes podem contaminar a continuidade

## Objetivo

- manter a continuidade cross-surface correta mesmo em fallbacks sem loader tenant-aware

## Requisitos

- para boundaries `shared`, a continuidade deve filtrar tarefas pelo `tenantId`
- isso deve valer tanto para tarefas do usuario quanto para tarefas recentes do chat
- tenants pessoais ou internos nao devem perder contexto

## Criterios De Aceitacao

- mixed tasks de guilds diferentes nao aparecem no snapshot de outra guild
- foco e sugestao de retomada continuam coerentes com o tenant ativo
- testes passam
