# Spec: Provider Control Plane

**Feature ID:** `providers/provider-control-plane`  
**Status:** active

## Problema

- o Zavorth ja conhece varios providers, aliases e modelos, mas essa logica ainda fica espalhada entre `ProviderFactory`, `/model`, `/models` e heuristicas de workspace
- isso aumenta drift em nomes validos, aliases, texto de ajuda e leitura operacional do runtime

## Objetivo

- criar uma camada canonica para descrever providers, aliases, modelos ativos e perfis de uso
- reutilizar essa camada nas superficies humanas antes de expandir para todo o runtime

## Requisitos

- listar providers e aliases publicos de forma canonica
- resolver selecao de `/model` sem duplicar regex e aliases em controllers
- expor perfis de uso reutilizaveis como `coding`, `research`, `budget`, `balanced` e `local-first`

## Criterios De Aceitacao

- `/model` usa a camada canonica de selecao
- a resposta de `/models` passa a depender do control plane
- testes cobrem aliases, Gemma via Gemini e recomendacao de perfis
