import type { McpRuntimeService } from '../../mcp/McpRuntimeService.js';
import type { McpCapabilityControlPlaneService } from '../../services/McpCapabilityControlPlaneService.js';
import type { CapabilityLifecycleService } from '../../services/CapabilityLifecycleService.js';
import type { RuntimeProfileService } from '../../services/RuntimeProfileService.js';
import type { TelegramChannelContractService } from '../TelegramChannelContractService.js';
import type { ContextEngine } from '../../context-engine/ContextEngine.js';
import type { LegacyUnifiedGatewayAdapter } from '../../context-engine/LegacyUnifiedGatewayAdapter.js';
import type { ZavorthAgentGateway } from '../../runtime/agent/index.js';

export type BotGatewayRuntimeOptions = {
  runtimeProfileService?: RuntimeProfileService;
  contextEngine?: ContextEngine;
  legacyUnifiedGateway?: LegacyUnifiedGatewayAdapter;
  agentGateway?: ZavorthAgentGateway;
  capabilityLifecycleService?: CapabilityLifecycleService;
  mcpRuntimeService?: Pick<McpRuntimeService, 'readSnapshot' | 'reloadServer' | 'stopServer'>;
  mcpCapabilityControlPlaneService?: McpCapabilityControlPlaneService;
  telegramChannelContractService?: TelegramChannelContractService;
};
