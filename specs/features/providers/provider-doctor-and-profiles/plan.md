# Plan: Provider Doctor And Profiles

**Feature ID:** `providers/provider-doctor-and-profiles`  
**Status:** active

## Arquitetura

- [ProviderDoctorService.ts](src\services\ProviderDoctorService.ts)
- [ProviderControlPlaneService.ts](src\services\ProviderControlPlaneService.ts)
- [SharedSurfaceCommandService.ts](src\services\SharedSurfaceCommandService.ts)
- [RuntimeAccessReadinessService.ts](src\services\RuntimeAccessReadinessService.ts)

## Mudanca

- transformar o resumo de `/models` em um doctor real de providers
- manter os perfis operacionais perto do control plane
- usar o doctor como primeiro passo antes de integrar isso ao readiness, ao hub de integracoes e ao snapshot web

## Validacao

- testes de `ProviderDoctorService`
- testes de `RuntimeAccessReadinessService`
- testes de `DashboardIntegrationHub`
- testes de `SharedSurfaceCommandService`
- `npm run build`

