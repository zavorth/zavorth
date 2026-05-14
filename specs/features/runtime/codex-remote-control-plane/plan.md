# Plan

## Scope

Primeira camada arquitetural do `Codex Remote`, reaproveitando:

- `CodexCliAdapter`
- `ZavorthRemoteTransportService`
- `GatewaySessionStoreService`
- rotas web protegidas do dashboard

## Implementation

1. Criar `CodexRemoteProfileRegistryService`.
2. Criar `CodexRemoteControlPlaneService`.
3. Criar `CodexRemoteActionService`.
4. Conectar `CodexCliAdapter` ao profile registry para permitir `CODEX_HOME` por perfil.
5. Expor endpoints web protegidos via `WebAppSurfaceRouteService`.
6. Instanciar os serviços no `DashboardService`.

## Validation

- testes unitários dos três serviços
- teste do endpoint web protegido
- teste do `CodexCliAdapter` com `CODEX_HOME` do perfil
- `npm run build`
