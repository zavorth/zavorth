# Plan: Provider Control Plane

**Feature ID:** `providers/provider-control-plane`  
**Status:** active

## Arquitetura

- [ProviderControlPlaneService.ts](src\services\ProviderControlPlaneService.ts)
- [TelegramProviderController.ts](src\telegram\controllers\TelegramProviderController.ts)
- [SharedSurfaceCommandService.ts](src\services\SharedSurfaceCommandService.ts)
- [WorkspaceLlmProfile.ts](src\services\WorkspaceLlmProfile.ts)

## Mudanca

- concentrar metadata de providers, aliases e modelos correntes em um servico unico
- reutilizar essa camada no fluxo `/model`
- preparar perfis reutilizaveis para a fase seguinte do doctor e da recomendacao automatica
- expor um resumo canÃ´nico de providers no capability catalog e no Integration Hub para consumo web

## Validacao

- testes de `ProviderControlPlaneService`
- testes de `ZavorthCapabilityCatalogService`
- testes de `TelegramProviderController`
- testes de `SharedSurfaceCommandService`
- `npm run build`

