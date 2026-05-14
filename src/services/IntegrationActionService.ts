import fs from 'fs';
import path from 'path';
import type {
  IntegrationActionMonitorSnapshot,
  IntegrationActionPlan,
  IntegrationManifest,
} from '../contracts/IntegrationHubContract.js';
import { config } from '../config/index.js';
import { spawnCommand } from '../core/CommandSpawn.js';
import { IntegrationHealthService } from './IntegrationHealthService.js';
import { IntegrationInstallerService } from './IntegrationInstallerService.js';
import { TerminalSidecarService } from './TerminalSidecarService.js';
import { AIGatewaySidecarService } from './AIGatewaySidecarService.js';
import { ZavorthBridgeRemoteUpstreamSyncService } from './ZavorthBridgeRemoteUpstreamSyncService.js';
import { GatewayUpstreamSyncService } from './GatewayUpstreamSyncService.js';
import { IntegrationProbeService } from './IntegrationProbeService.js';
import { IntegrationRegistryService } from './IntegrationRegistryService.js';
import { IntegrationActionExecutionSupport } from '../domain/platform-ecosystem/application/integration-actions/IntegrationActionExecutionSupport.js';
import { IntegrationActionLedgerService } from '../domain/platform-ecosystem/application/integration-actions/IntegrationActionLedgerService.js';
import { IntegrationActionMonitorSupport } from '../domain/platform-ecosystem/application/integration-actions/IntegrationActionMonitorSupport.js';
import { IntegrationActionPlanBuilder } from '../domain/platform-ecosystem/application/integration-actions/IntegrationActionPlanBuilder.js';
import { IntegrationActionRecipeService } from '../domain/platform-ecosystem/application/integration-actions/IntegrationActionRecipeService.js';
import { IntegrationActionRuntimeBindingSupport } from '../domain/platform-ecosystem/application/integration-actions/IntegrationActionRuntimeBindingSupport.js';
import type { IntegrationActionExecuteOptions, IntegrationActionRuntime } from '../domain/platform-ecosystem/application/integration-actions/IntegrationActionTypes.js';
import { ToolHookPipelineService } from './ToolHookPipelineService.js';

export class IntegrationActionService {
  private readonly registryService: IntegrationRegistryService;
  private readonly planBuilder: IntegrationActionPlanBuilder;
  private readonly executionSupport: IntegrationActionExecutionSupport;
  private readonly monitorSupport: IntegrationActionMonitorSupport;

  constructor(runtime: IntegrationActionRuntime = {}) {
    const now = runtime.now || (() => new Date());
    const spawnImpl = runtime.spawn || spawnCommand;
    const registryService = runtime.registryService || new IntegrationRegistryService();
    const installerService = runtime.installerService || new IntegrationInstallerService();
    const probeService = runtime.probeService || new IntegrationProbeService({
      registryService,
    });
    const healthService = runtime.healthService || new IntegrationHealthService({
      installerService,
      registryService,
      probeService,
    });
    const hookPipeline = runtime.hookPipelineService || new ToolHookPipelineService();
    const envFilePath = runtime.envFilePath || path.join(config.projectRoot, '.env');
    const mkdirSyncImpl = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    const openSyncImpl = runtime.openSync || fs.openSync.bind(fs);
    const closeSyncImpl = runtime.closeSync || fs.closeSync.bind(fs);
    const writeFileSyncImpl = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    const appendFileSyncImpl = runtime.appendFileSync || fs.appendFileSync.bind(fs);
    const actionLogDir = path.join(config.dataDir, 'runtime', 'integration-actions');
    const actionStatusFile = path.join(config.dataDir, 'runtime', 'integration-action-last.json');
    const actionHistoryFile = path.join(config.dataDir, 'runtime', 'integration-action-history.jsonl');
    const ledgerService = new IntegrationActionLedgerService({
      actionStatusFile,
      actionHistoryFile,
      mkdirSync: mkdirSyncImpl,
      writeFileSync: writeFileSyncImpl,
      appendFileSync: appendFileSyncImpl,
    });
    const runtimeBindingSupport = new IntegrationActionRuntimeBindingSupport({
      installerService,
      envFilePath,
      mkdirSync: mkdirSyncImpl,
      writeFileSync: writeFileSyncImpl,
    });
    const recipeService = new IntegrationActionRecipeService({
      now,
      installerService,
      healthService,
      probeService,
      ledgerService,
      applyRuntimeBinding: (envKey, value) => runtimeBindingSupport.applyRuntimeBinding(envKey, value),
      TerminalSidecarService: runtime.TerminalSidecarService,
      AIGatewaySidecarService: runtime.AIGatewaySidecarService,
      zavorthBridgeRemoteUpstreamSyncService: runtime.zavorthBridgeRemoteUpstreamSyncService,
      GatewayUpstreamSyncService: runtime.GatewayUpstreamSyncService,
    });
    this.registryService = registryService;
    this.monitorSupport = new IntegrationActionMonitorSupport({
      now,
      defaultWorkspace: runtime.defaultWorkspace,
      hookPipeline,
      healthService,
      installerService,
      ledgerService,
      appendFileSync: appendFileSyncImpl,
    });
    this.planBuilder = new IntegrationActionPlanBuilder({
      now,
      healthService,
      recipeService,
      runtimeBindingSupport,
    });
    this.executionSupport = new IntegrationActionExecutionSupport({
      now,
      spawn: spawnImpl,
      healthService,
      installerService,
      probeService,
      recipeService,
      ledgerService,
      runtimeBindingSupport,
      monitorSupport: this.monitorSupport,
      actionLogDir,
      mkdirSync: mkdirSyncImpl,
      openSync: openSyncImpl,
      closeSync: closeSyncImpl,
      writeFileSync: writeFileSyncImpl,
    });
  }

  public buildActionPlan(integrationId: string): IntegrationActionPlan {
    const manifest = this.resolveManifest(integrationId);
    if (!manifest) {
      throw new Error(`Integracao desconhecida: ${integrationId}`);
    }

    return this.planBuilder.buildActionPlan(manifest);
  }

  public async execute(
    integrationId: string,
    actionId: string,
    options: IntegrationActionExecuteOptions = {},
  ) {
    const plan = this.buildActionPlan(integrationId);
    return this.executionSupport.execute(
      plan,
      actionId,
      this.monitorSupport.resolveExecutionContext(options),
      (requestedIntegrationId) => this.resolveManifest(requestedIntegrationId),
    );
  }

  public buildActionMonitor(integrationId: string, limit = 5): IntegrationActionMonitorSnapshot {
    return this.monitorSupport.buildActionMonitor(integrationId, limit);
  }

  private resolveManifest(integrationId: string): IntegrationManifest | null {
    return this.registryService.getManifestById(integrationId)
      || this.registryService.resolveRequestedIntegration(integrationId).manifest;
  }
}
