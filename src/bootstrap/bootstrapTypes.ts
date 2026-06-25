import type { BotGateway } from '../gateways/channels/telegram/BotGateway.js';
import type { CoreOrchestrator } from '../core/CoreOrchestrator.js';
import type { PlatformGatewayContract } from '../contracts/PlatformContract.js';
import type { McpRuntimeService } from '../mcp/McpRuntimeService.js';
import type { TaskManager } from '../orchestrator/TaskManager.js';
import type { AIGatewayProxyService } from '../services/AIGatewayProxyService.js';
import type { AIGatewaySidecarService } from '../services/AIGatewaySidecarService.js';
import type { CapabilityLifecycleService } from '../services/CapabilityLifecycleService.js';
import type { ConfigVersioningService } from '../services/ConfigVersioningService.js';
import type { DiscordBootPolicyService } from '../services/DiscordBootPolicyService.js';
import type { GatewayChannelRegistryService } from '../services/GatewayChannelRegistryService.js';
import type { MaintenanceAutomationService } from '../services/MaintenanceAutomationService.js';
import type { McpCapabilityControlPlaneService } from '../services/McpCapabilityControlPlaneService.js';
import type { PlatformCapabilityService } from '../services/PlatformCapabilityService.js';
import type { ProcessLockService } from '../services/ProcessLockService.js';
import type { RuntimeCompositionService } from '../services/RuntimeCompositionService.js';
import type { RuntimeProfileService } from '../services/RuntimeProfileService.js';
import type { SharedSurfaceCommandService } from '../services/SharedSurfaceCommandService.js';
import type { TerminalSidecarService } from '../services/TerminalSidecarService.js';
import type { ToolCatalogService } from '../services/tools/ToolCatalogService.js';
import type { SkillCuratorPlaneService } from '../skills/SkillCuratorPlaneService.js';
import type { LogRepository } from '../storage/LogRepository.js';
import type { ZavorthAgentGateway } from '../runtime/agent/index.js';
import type { ContextEngineRuntime } from './bootstrapContextEngine.js';

export interface BootstrapSupervisor {
  readonly supervisedIpcEnabled: boolean;
  updateProgress(stage: string): void;
  markBootReady(): void;
  clear(): void;
  isHttpHealthy(url: string): Promise<boolean>;
}

export interface BootstrapPreflight {
  platformCapabilityService: PlatformCapabilityService;
  capabilities: ReturnType<PlatformCapabilityService['getCapabilities']>;
  summary: ReturnType<PlatformCapabilityService['getSummary']>;
  discordBootPolicy: DiscordBootPolicyService;
}

export interface BootstrapFoundation extends BootstrapPreflight, ContextEngineRuntime {
  processLock: ProcessLockService;
  logRepo: LogRepository;
  taskManager: TaskManager;
  runtimeProfileService: RuntimeProfileService;
  capabilityLifecycleService: CapabilityLifecycleService;
  configVersioningService: ConfigVersioningService;
  maintenanceAutomation: MaintenanceAutomationService;
  skillCuratorPlaneService: SkillCuratorPlaneService;
  stopRuntimeMaintenance(): void;
  runtimeComposition: RuntimeCompositionService;
  toolRuntime: ReturnType<RuntimeCompositionService['getToolRuntime']>;
  runtimeToolCatalogService: Pick<ToolCatalogService, 'listTools'>;
  agentGateway: ZavorthAgentGateway;
  mcpRuntime: McpRuntimeService;
  mcpCapabilityControlPlaneService: McpCapabilityControlPlaneService;
}

export interface BootstrapRuntimeServices {
  aiGatewaySidecar: AIGatewaySidecarService;
  aiGatewayGateway: AIGatewayProxyService;
  terminalSidecar: TerminalSidecarService;
  sysMonitor: {
    stopHeartbeat(): void;
  };
}

export interface BootstrapSurfaceRuntime {
  botGateway: BotGateway;
  coreOrchestrator: CoreOrchestrator;
  sharedSurfaceCommandService: SharedSurfaceCommandService;
  sharedGatewayChannelRegistry: GatewayChannelRegistryService;
  discordGateway: PlatformGatewayContract;
  whatsAppGateway: PlatformGatewayContract;
  slackGateway: PlatformGatewayContract;
  instagramGateway: PlatformGatewayContract;
  signalGateway: PlatformGatewayContract;
  imessageGateway: PlatformGatewayContract;
  teamsGateway: PlatformGatewayContract;
  emailGateway: PlatformGatewayContract;
}
