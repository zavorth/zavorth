# Plan

## Scope

Planejar a segunda camada do Codex Remote:

- `CodexRemoteSessionBrokerService`
- `CodexRemoteSessionStoreService`
- `CodexRemoteSidecarService`
- `CodexRemoteReadModelService`

## Architecture

- [CodexRemoteProfileRegistryService.ts](src\services\CodexRemoteProfileRegistryService.ts)
- [CodexRemoteControlPlaneService.ts](src\services\CodexRemoteControlPlaneService.ts)
- [CodexRemoteActionService.ts](src\services\CodexRemoteActionService.ts)
- [CodexCliAdapter.ts](src\agents\CodexCliAdapter.ts)
- [GatewaySessionService.ts](src\services\GatewaySessionService.ts)
- [WebAppRuntimeRouteService.ts](src\services\WebAppRuntimeRouteService.ts)

## Change

1. criar um broker para sessoes long-running do Codex CLI
2. persistir sessoes do Codex Remote de forma separada dos workflow runs
3. expor attach/resume e tail recente em surfaces seguras
4. preparar o sidecar remoto sem romper o `CodexExecutor` como borda Zavorth

## Validation

- testes do broker e do store
- teste de rotas protegidas para listar/abrir sessoes
- smoke do attach/resume local
- validacao de rollout do sidecar em ambiente supervisionado

