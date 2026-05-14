# Plan: Wasm Sandbox Tier

**Feature ID:** `sandbox/wasm-sandbox-tier`  
**Status:** completed

## Arquitetura

- adicionar um service proprio de capability para Wasm
- integrar o status no `OperationsHealthService`
- promover o tier no `ZavorthRuntimeModesService`
- refletir a leitura no `ZavorthSecurityMeshService`

## Primeira Fatia

- `WasmSandboxCapabilityService.ts`
- config minima para habilitar/desabilitar o tier
- `OperationsHealthSnapshot.wasm`
- modo `wasm-sandbox` no runtime modes

## Validacao

- `WasmSandboxCapabilityService.test.ts`
- `OperationsHealthService.test.ts`
- `ZavorthRuntimeModesService.test.ts`
- `ZavorthSecurityMeshService.test.ts`
- `npm run build`
