# Plan: MCP Capability Control Plane

**Feature ID:** `integrations/mcp-capability-control-plane`  
**Status:** completed

## Arquitetura

- persistir o estado do runtime MCP em [McpRuntimeService.ts](src\mcp\McpRuntimeService.ts)
- ler manifesto e snapshot persistido em [McpCapabilityControlPlaneService.ts](src\services\McpCapabilityControlPlaneService.ts)
- propagar esse plano via [IntegrationHubService.ts](src\services\IntegrationHubService.ts), [ZavorthCapabilityCatalogService.ts](src\services\ZavorthCapabilityCatalogService.ts) e [RuntimeAccessReadinessService.ts](src\services\RuntimeAccessReadinessService.ts)

## Mudanca

- consolidar `manifest_only`, `connected`, `failed`, `disabled` e `stopped`
- resumir capabilities e tools em um snapshot unificado
- mostrar MCP no Integration Hub web e no overview do `/app`

## Arquivos Principais

- [McpRuntimeService.ts](src\mcp\McpRuntimeService.ts)
- [McpCapabilityControlPlaneService.ts](src\services\McpCapabilityControlPlaneService.ts)
- [IntegrationHubService.ts](src\services\IntegrationHubService.ts)
- [ZavorthCapabilityCatalogService.ts](src\services\ZavorthCapabilityCatalogService.ts)
- [RuntimeAccessReadinessService.ts](src\services\RuntimeAccessReadinessService.ts)
- [app.js](vercel-web\app.js)

## Validacao

- [McpRuntimeService.test.ts](tests\mcp\McpRuntimeService.test.ts)
- [McpCapabilityControlPlaneService.test.ts](tests\services\McpCapabilityControlPlaneService.test.ts)
- [DashboardIntegrationHub.test.ts](tests\services\DashboardIntegrationHub.test.ts)
- [RuntimeAccessReadinessService.test.ts](tests\services\RuntimeAccessReadinessService.test.ts)
- [DashboardService.test.ts](tests\services\DashboardService.test.ts)
- `npm run build`

