# Spec: Contrato oficial de comandos compartilhados

**Feature ID:** `multisurface/shared-command-contract`  
**Status:** active

## Problema

- o Zavorth ja tem comandos compartilhados, mas a lista de suporte, o hint de fallback e o manifesto de slash commands podem derivar entre `CoreOrchestrator`, `SharedSurfaceCommandService` e `DiscordGateway`
- isso aumenta risco de surfaces anunciarem menos ou mais do que realmente suportam

## Objetivo

- criar uma fonte canônica para classificar comandos compartilhados por handler e por exposicao no Discord
- fazer o core e o gateway nativo consumirem o mesmo contrato

## Requisitos

- distinguir comandos do `dispatcher` dos comandos do `shared-service`
- manter `/reload` como surface command do alias `/selfupdate`
- preservar a politica atual do Discord publico sem expandir comandos desnecessariamente

## Criterios De Aceitacao

- `CoreOrchestrator` usa o contrato para hints/fallback
- `DiscordGateway` registra slash commands com base no mesmo contrato
- testes validam o manifesto e o hint canônico
