# Plan: Contrato oficial de comandos compartilhados

**Feature ID:** `multisurface/shared-command-contract`  
**Status:** active

## Arquitetura

- [SharedSurfaceCommandContract.ts](src\services\SharedSurfaceCommandContract.ts)
- [SharedSurfaceCommandService.ts](src\services\SharedSurfaceCommandService.ts)
- [CoreOrchestrator.ts](src\core\CoreOrchestrator.ts)
- [DiscordGateway.ts](src\gateways\DiscordGateway.ts)
- [SharedSurfaceCommandContract.test.ts](tests\services\SharedSurfaceCommandContract.test.ts)

## Mudanca

- introduzir um contrato simples com handler, alias de surface e exposicao de slash command
- consumir o contrato no core para evitar drift em mensagens de fallback
- consumir o mesmo contrato no Discord nativo para manter o manifesto alinhado

## Validacao

- testes do contrato
- testes existentes de `CoreOrchestrator` e `DiscordGateway`
- `npm run build`

