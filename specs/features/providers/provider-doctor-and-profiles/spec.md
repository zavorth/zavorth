# Spec: Provider Doctor And Profiles

**Feature ID:** `providers/provider-doctor-and-profiles`  
**Status:** active

## Problema

- o Zavorth ja sabe trocar provider, mas ainda nao responde de forma operacional quais estao prontos, quais pedem segredo e quais exigem probe local
- isso dificulta onboarding de modelos, rollout de fallback e leitura rapida de saude do plano de inferencia

## Objetivo

- criar um doctor leve de providers com recomendacoes acionaveis
- expor perfis operacionais que sirvam de base para as proximas fases de routing e UX

## Requisitos

- distinguir provider pronto, pendente de configuracao e pendente de probe local/runtime
- mostrar recomendacoes operacionais curtas
- manter a resposta humana compacta e reaproveitavel em Telegram, Discord e web

## Criterios De Aceitacao

- `/models` passa a mostrar readiness e recomendacoes
- existe um `ProviderDoctorService` com snapshot e renderizacao textual
- testes cobrem status basicos e recomendacao de profile
