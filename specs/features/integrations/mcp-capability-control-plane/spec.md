# Spec: MCP Capability Control Plane

**Feature ID:** `integrations/mcp-capability-control-plane`  
**Status:** completed

## Problema

- o Zavorth ja tinha manifesto MCP e runtime MCP, mas faltava uma leitura canonica juntando `manifesto + estado conectado + tools registradas`
- isso deixava a governanca MCP espalhada entre bootstrap, logs e troubleshooting manual

## Objetivo

- criar um control plane oficial para MCP
- mostrar quais servidores estao declarados, conectados, falhando ou apenas no manifesto
- refletir esse plano no Integration Hub, no capability catalog, no readiness e no `/app`

## Requisitos

- ler manifesto MCP e snapshot real do runtime
- consolidar capabilities, tool counts, status e recomendacoes curtas
- expor o mesmo snapshot em backend, surfaces operacionais e web

## Entrega Implementada

- [McpRuntimeService.ts](src\mcp\McpRuntimeService.ts) agora persiste `mcp-runtime-state.json`
- [McpCapabilityControlPlaneService.ts](src\services\McpCapabilityControlPlaneService.ts) consolida manifesto e runtime
- [IntegrationHubService.ts](src\services\IntegrationHubService.ts) e [ZavorthCapabilityCatalogService.ts](src\services\ZavorthCapabilityCatalogService.ts) servem esse snapshot
- o `/app` mostra MCP como card proprio dentro do Integration Hub e no overview em [app.js](vercel-web\app.js)

## Criterios De Aceitacao

- o operador consegue ver `connected/enabled/toolCount` sem abrir logs
- o runtime grava um snapshot MCP reutilizavel
- readiness e surfaces web mostram recomendacoes MCP curtas e acionaveis

