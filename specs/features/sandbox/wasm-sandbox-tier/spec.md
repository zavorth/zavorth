# Spec: Wasm Sandbox Tier

**Feature ID:** `sandbox/wasm-sandbox-tier`  
**Status:** completed  
**Escopo:** `specs/features/sandbox/wasm-sandbox-tier`

## Problema

- o Zavorth ja tinha `local-jail`, `container` e `microvm`, mas ainda nao declarava um tier Wasm explicito no runtime mesh
- isso deixava a Fase 4 sem uma capacidade oficial para evoluir o sandbox leve de codigo literal

## Objetivo

- introduzir o tier Wasm como capacidade explicita e opcional
- expor sua prontidao no health/runtime mesh sem quebrar Docker ou Firecracker
- preparar o terreno para execucao controlada de codigo literal em etapas futuras

## Requisitos

- existir um snapshot oficial de prontidao/capacidade do tier Wasm
- o runtime mesh precisa enxergar o tier como modo oficial
- a seguranca precisa refletir se o tier Wasm esta pronto ou nao
- o rollout inicial nao pode fingir que Wasm substitui shell, workspace mount ou microVM
