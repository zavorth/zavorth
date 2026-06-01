import fs from 'fs';
import type {
  IntegrationActionExecutionRecord,
  IntegrationGuidedAction,
  IntegrationManifest,
} from '../../../../contracts/IntegrationHubContract.js';
import { spawnCommand } from '../../../../core/CommandSpawn.js';
import type { AIGatewaySidecarService } from '../../../../services/AIGatewaySidecarService.js';
import type { ZavorthBridgeRemoteUpstreamSyncService } from '../../../../services/ZavorthBridgeRemoteUpstreamSyncService.js';
import type { GatewayUpstreamSyncService } from '../../../../services/GatewayUpstreamSyncService.js';
import type { IntegrationHealthService } from '../../../../services/IntegrationHealthService.js';
import type { IntegrationInstallerService } from '../../../../services/IntegrationInstallerService.js';
import type { IntegrationProbeService } from '../../../../services/IntegrationProbeService.js';
import type { IntegrationRegistryService } from '../../../../services/IntegrationRegistryService.js';
import type { TerminalSidecarService } from '../../../../services/TerminalSidecarService.js';
import type { ToolHookPipelineService } from '../../../../services/ToolHookPipelineService.js';

export type IntegrationActionExecution = IntegrationActionExecutionRecord;

export type IntegrationActionRuntime = {
  now?: () => Date;
  defaultWorkspace?: string | null;
  spawn?: typeof spawnCommand;
  registryService?: IntegrationRegistryService;
  installerService?: IntegrationInstallerService;
  healthService?: IntegrationHealthService;
  probeService?: IntegrationProbeService;
  TerminalSidecarService?: Pick<TerminalSidecarService, 'start'>;
  AIGatewaySidecarService?: Pick<AIGatewaySidecarService, 'start'>;
  zavorthBridgeRemoteUpstreamSyncService?: Pick<ZavorthBridgeRemoteUpstreamSyncService, 'sync' | 'promote' | 'rollback'>;
  GatewayUpstreamSyncService?: Pick<GatewayUpstreamSyncService, 'sync' | 'promote' | 'rollback'>;
  hookPipelineService?: Pick<ToolHookPipelineService, 'run'>;
  envFilePath?: string;
  mkdirSync?: typeof fs.mkdirSync;
  openSync?: typeof fs.openSync;
  closeSync?: typeof fs.closeSync;
  writeFileSync?: typeof fs.writeFileSync;
  appendFileSync?: typeof fs.appendFileSync;
};

export type IntegrationActionExecuteOptions = {
  requestedBy?: string | null;
  workspace?: string | null;
};

export type IntegrationActionExecutionContext = {
  requestedBy: string | null;
  workspace: string | null;
};

export type IntegrationActionManifestResolver = (integrationId: string) => IntegrationManifest | null;

export type IntegrationActionTarget = {
  action: IntegrationGuidedAction;
  integrationId: string;
};
