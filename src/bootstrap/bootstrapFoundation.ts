import { config } from '../config/index.js';
import { GoalLoopDaemonService } from '../services/GoalLoopDaemonService.js';
import { GoalLoopService } from '../services/GoalLoopService.js';
import { GoalLoopWorkerService } from '../services/GoalLoopWorkerService.js';
import { GoalPlaneService } from '../services/GoalPlaneService.js';
import { McpRuntimeService } from '../mcp/McpRuntimeService.js';
import { TaskManager } from '../orchestrator/TaskManager.js';
import { TaskPlaneService } from '../services/TaskPlaneService.js';
import { Database } from '../storage/Database.js';
import { LogRepository } from '../storage/LogRepository.js';
import { TaskRepository } from '../storage/TaskRepository.js';
import { AIGatewayProxyService } from '../services/AIGatewayProxyService.js';
import { AIGatewaySidecarService } from '../services/AIGatewaySidecarService.js';
import { CapabilityLifecycleService } from '../services/CapabilityLifecycleService.js';
import { ConfigVersioningService } from '../services/ConfigVersioningService.js';
import { DiscordBootPolicyService } from '../services/DiscordBootPolicyService.js';
import { MaintenanceAutomationService } from '../services/MaintenanceAutomationService.js';
import { OperationsActionService } from '../services/OperationsActionService.js';
import { PlatformCapabilityService } from '../services/PlatformCapabilityService.js';
import { ProcessLockService } from '../services/ProcessLockService.js';
import { RuntimeArtifactMaintenanceService } from '../services/RuntimeArtifactMaintenanceService.js';
import { RuntimeLogMaintenanceService } from '../services/RuntimeLogMaintenanceService.js';
import { RuntimeProfileService } from '../services/RuntimeProfileService.js';
import { TerminalSidecarService } from '../services/TerminalSidecarService.js';
import { ChannelProgressRuntimeBridgeService } from '../services/ChannelProgressRuntimeBridgeService.js';
import { LlmRuntimeService } from '../services/llm/LlmRuntimeService.js';
import { ModelPickerContractService } from '../domain/providers/index.js';
import { SkillCuratorPlaneService } from '../skills/SkillCuratorPlaneService.js';
import {
  ZavorthAgentGateway,
  createDefaultAgentRunStore,
  createDefaultAgentWorkflowQueueStore,
} from '../runtime/agent/index.js';
import { createBootstrapToolRuntime } from './bootstrapToolRuntime.js';
import { createContextEngineRuntime, wireLegacyUnifiedGatewayAgentCallback } from './bootstrapContextEngine.js';
import type {
  BootstrapFoundation,
  BootstrapPreflight,
  BootstrapRuntimeServices,
  BootstrapSupervisor,
} from './bootstrapTypes.js';

const DORMANT_BOOT_CAPABILITIES = ['remote', 'qa', 'sandbox', 'public-tunnel'];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function runCapabilityPreflight(): BootstrapPreflight {
  const platformCapabilityService = new PlatformCapabilityService();
  const capabilities = platformCapabilityService.getCapabilities();
  const summary = platformCapabilityService.getSummary();
  const discordBootPolicy = new DiscordBootPolicyService();

  discordBootPolicy.assertConfiguration({
    requiredOnBoot: config.discordRequiredOnBoot,
    nativeTokenConfigured: Boolean(config.discordBotToken),
    bridgeConfigured: config.discordBridgeEnabled,
  });

  console.log('Preflight de canais configurados neste runtime:');
  for (const capability of capabilities) {
    console.log(`- ${capability.platform}: ${capability.readiness}/${capability.implementationState} (${capability.transport})`);
  }

  if (!platformCapabilityService.isReady('telegram')) {
    console.error('Nenhum canal operacional esta pronto para receber mensagens.');
    console.error('O Telegram continua sendo o canal live do Zavorth neste runtime.');

    if (!config.telegramBotToken) {
      console.error('- TELEGRAM_BOT_TOKEN nao configurado no .env');
    }

    if (config.allowedUserIds.length === 0) {
      console.error('- TELEGRAM_ALLOWED_USER_IDS nao configurado no .env');
    }

    if (summary.partial.length > 0 || summary.planned.length > 0 || summary.disabled.length > 0) {
      console.error(
        `- Canais nao-operacionais neste momento: ${[...summary.partial, ...summary.planned, ...summary.disabled].join(', ')}`,
      );
    }

    process.exit(1);
  }

  return {
    platformCapabilityService,
    capabilities,
    summary,
    discordBootPolicy,
  };
}

export async function initializeBootstrapFoundation(
  preflight: BootstrapPreflight,
  runtimeArtifactMaintenanceService: RuntimeArtifactMaintenanceService,
  runtimeLogMaintenanceService: RuntimeLogMaintenanceService,
): Promise<BootstrapFoundation> {
  console.log('[BOOT] storage-init');
  const processLock = new ProcessLockService(config.telegramProcessLockFile);
  processLock.acquire('telegram-long-polling');
  process.on('exit', () => processLock.release());

  await Database.getInstance();
  const logRepo = new LogRepository();
  const taskRepo = new TaskRepository();
  await logRepo.init();
  await taskRepo.init();
  console.log('[BOOT] storage-ready');

  const runtimeProfileService = new RuntimeProfileService();
  const capabilityLifecycleService = new CapabilityLifecycleService({
    runtimeProfileService,
  });
  const dormantCapabilityCleanup = capabilityLifecycleService.cleanupDormantCapabilityArtifacts(DORMANT_BOOT_CAPABILITIES);
  const configVersioningService = new ConfigVersioningService();
  const operationsActionService = new OperationsActionService(logRepo);
  const maintenanceAutomation = new MaintenanceAutomationService(operationsActionService, logRepo);
  const skillCuratorPlaneService = new SkillCuratorPlaneService();

  capabilityLifecycleService.markCapabilityState(
    'core-runtime',
    'active',
    `Boot ativo no perfil ${runtimeProfileService.getProfile()}.`,
  );

  let runtimeMaintenanceTimer: ReturnType<typeof setInterval> | null = null;
  const runRuntimeMaintenance = () => {
    runtimeLogMaintenanceService.rotateOversizedLogs();
    runtimeArtifactMaintenanceService.cleanupVisualSmokeProfiles();
    capabilityLifecycleService.expireIdleCapabilities();
    capabilityLifecycleService.cleanupDormantCapabilityArtifacts(DORMANT_BOOT_CAPABILITIES);
    void skillCuratorPlaneService.maybeRunCurator({
      idleForSeconds: config.skillsCuratorMinIdleHours * 3600,
      reason: 'runtime-maintenance',
      triggeredBy: 'bootstrap-maintenance',
    }).catch((error: unknown) => {
      logRepo.log('warn', 'SkillCurator', `Falha na manutencao de skills: ${errorMessage(error)}`);
    });
  };

  if (config.runtimeMaintenanceIntervalMs > 0) {
    runtimeMaintenanceTimer = setInterval(runRuntimeMaintenance, config.runtimeMaintenanceIntervalMs);
    runtimeMaintenanceTimer.unref?.();
  }

  logRepo.log('info', 'Bootstrap', 'Repositorios iniciados.');
  logRepo.log(
    'info',
    'Bootstrap',
    `Perfil de runtime ativo: ${runtimeProfileService.getProfile()} (policy=${config.zavorthCapabilityPolicy}).`,
  );
  for (const cleanup of dormantCapabilityCleanup) {
    logRepo.log(
      'info',
      'Bootstrap',
      `Capability dormente ${cleanup.capabilityId}: cleanup de ${cleanup.removedPaths.length} path(s) no boot.`,
    );
  }
  for (const capability of preflight.capabilities) {
    logRepo.log(
      capability.readiness === 'ready' ? 'info' : 'warn',
      'Bootstrap',
      `Canal ${capability.platform}: ${capability.readiness}/${capability.implementationState} via ${capability.transport}. ${capability.notes.join(' ')}`,
    );
  }

  const taskManager = new TaskManager(taskRepo, logRepo);
  const toolRuntimeServices = createBootstrapToolRuntime(logRepo);
  logRepo.log('info', 'Bootstrap', 'TaskManager unificado e tools registradas.');

  // === CONTEXT ENGINE WIRING ===
  const contextEngineRuntime = createContextEngineRuntime(logRepo);
  wireLegacyUnifiedGatewayAgentCallback({
    logRepo,
    contextEngine: contextEngineRuntime.contextEngine,
    legacyUnifiedGateway: contextEngineRuntime.legacyUnifiedGateway,
    runtimeComposition: toolRuntimeServices.runtimeComposition,
  });
  logRepo.log(
    'info',
    'Bootstrap',
    `Cognitive Firewall ativo: ${contextEngineRuntime.skillLoadResult.totalSkills} skills, ${contextEngineRuntime.skillLoadResult.totalTools} tools descobertas.`,
  );
  const agentGateway = new ZavorthAgentGateway({
    defaultProviderLabel: config.llmProvider || 'Zavorth',
    defaultModelLabel: config.geminiModel || config.geminiDefaultModel || config.openaiModel || 'modelo atual',
    modelPickerContractService: new ModelPickerContractService(),
    llmRuntime: new LlmRuntimeService(),
    toolRuntime: toolRuntimeServices.toolRuntime,
    runStore: createDefaultAgentRunStore(),
    workflowQueueStore: createDefaultAgentWorkflowQueueStore(),
  });
  agentGateway.addRuntimeEventBus(new ChannelProgressRuntimeBridgeService());
  let goalLoopDaemon: GoalLoopDaemonService | null = null;
  if (config.goalLoopDaemonEnabled) {
    const taskPlane = new TaskPlaneService({
      storePath: `${config.runtimeDir}/task-plane.json`,
      stateDbPath: config.dbPath,
    });
    const goalPlane = new GoalPlaneService({
      storePath: `${config.runtimeDir}/goal-plane.json`,
      taskPlane,
      stateDbPath: config.dbPath,
    });
    const goalLoop = new GoalLoopService({
      goalPlane,
      taskPlane,
      stateDbPath: config.dbPath,
      llmRuntime: new LlmRuntimeService(),
    });
    const goalLoopWorker = new GoalLoopWorkerService({
      goalPlane,
      taskPlane,
      loop: goalLoop,
      agentRunner: {
        run: (request, options) => agentGateway.handle(request, options),
      },
      stateDbPath: config.dbPath,
    });
    goalLoopDaemon = new GoalLoopDaemonService({
      taskPlane,
      worker: goalLoopWorker,
      stateDbPath: config.dbPath,
    });
    goalLoopDaemon.start({
      daemonId: 'bootstrap-goal-loop-daemon',
      intervalMs: config.goalLoopDaemonIntervalMs,
      leaseMs: config.goalLoopDaemonLeaseMs,
      staleAfterMs: config.goalLoopDaemonStaleAfterMs,
      maxItems: config.goalLoopDaemonMaxItems,
    });
    logRepo.log(
      'info',
      'GoalLoopDaemon',
      `Goal Loop daemon ativo: interval=${config.goalLoopDaemonIntervalMs}ms maxItems=${config.goalLoopDaemonMaxItems}.`,
    );
  } else {
    logRepo.log('info', 'GoalLoopDaemon', 'Goal Loop daemon desativado por ZAVORTH_GOAL_LOOP_DAEMON_ENABLED=false.');
  }
  // === END CONTEXT ENGINE WIRING ===

  return {
    ...preflight,
    ...toolRuntimeServices,
    ...contextEngineRuntime,
    agentGateway,
    processLock,
    logRepo,
    taskManager,
    runtimeProfileService,
    capabilityLifecycleService,
    configVersioningService,
    maintenanceAutomation,
    skillCuratorPlaneService,
    stopRuntimeMaintenance() {
      goalLoopDaemon?.stop({ daemonId: 'bootstrap-goal-loop-daemon' });
      if (!runtimeMaintenanceTimer) {
        return;
      }

      clearInterval(runtimeMaintenanceTimer);
      runtimeMaintenanceTimer = null;
    },
  };
}

export async function startRemoteRuntimeServices(
  foundation: BootstrapFoundation,
  supervisor: BootstrapSupervisor,
): Promise<BootstrapRuntimeServices> {
  supervisor.updateProgress('sidecars');
  console.log('[BOOT] sidecars');

  const aiGatewaySidecar = new AIGatewaySidecarService(foundation.logRepo);
  const aiGatewayGateway = new AIGatewayProxyService();
  const terminalSidecar = new TerminalSidecarService(foundation.logRepo);
  const remoteBootEnabled = foundation.capabilityLifecycleService.shouldBootCapability('remote');

  if (remoteBootEnabled) {
    foundation.capabilityLifecycleService.markCapabilityState(
      'remote',
      'provisioning',
      'Inicializando sidecars remotos do perfil atual.',
    );
    void aiGatewaySidecar.start().catch((error: unknown) => {
      const message = errorMessage(error);
      foundation.capabilityLifecycleService.markCapabilityState(
        'remote',
        'degraded',
        `Falha ao subir AIGateway sidecar: ${message}`,
      );
      foundation.logRepo.log(
        'warn',
        'AIGatewaySidecar',
        `Falha ao subir o sidecar do AIGateway durante o bootstrap principal: ${message}`,
      );
    });
  } else {
    foundation.capabilityLifecycleService.markCapabilityState(
      'remote',
      'dormant',
      `Perfil ${foundation.runtimeProfileService.getProfile()} manteve sidecars remotos dormentes.`,
    );
    foundation.logRepo.log(
      'info',
      'AIGatewaySidecar',
      `Perfil ${foundation.runtimeProfileService.getProfile()} nao sobe sidecars remotos no boot.`,
    );
  }

  if (remoteBootEnabled) {
    const gatewayHealthUrl = `${config.zavorthAIGatewayGatewayBaseUrl.replace(/\/+$/, '')}/health`;
    if (await supervisor.isHttpHealthy(gatewayHealthUrl)) {
      foundation.capabilityLifecycleService.markCapabilityState(
        'remote',
        'active',
        'Gateway AIGateway detectado como saudavel.',
      );
      foundation.logRepo.log('info', 'AIGatewayGateway', 'Gateway proprio do AIGateway ja estava online em outro processo.');
    } else {
      foundation.capabilityLifecycleService.markCapabilityState(
        'remote',
        'ready',
        'Gateway AIGateway nao estava online; sidecar remoto fica disponivel sob demanda.',
      );
      foundation.logRepo.log(
        'warn',
        'AIGatewayGateway',
        'Gateway proprio do AIGateway nao estava online durante o bootstrap principal; ele pode ser iniciado sob demanda pelo launcher operacional.',
      );
    }

    void terminalSidecar.start().catch((error: unknown) => {
      const message = errorMessage(error);
      foundation.capabilityLifecycleService.markCapabilityState(
        'remote',
        'degraded',
        `Falha ao subir sidecar remoto do ZavorthBridge: ${message}`,
      );
      foundation.logRepo.log(
        'warn',
        'ZavorthTerminalSidecar',
        `Falha ao subir o sidecar remoto do ZavorthBridge durante o bootstrap principal: ${message}`,
      );
    });
  }

  console.log('[BOOT] sidecars-ready');
  supervisor.updateProgress('mcp-runtime');
  console.log('[BOOT] mcp-runtime');
  await foundation.mcpRuntime.start();
  console.log('[BOOT] mcp-runtime-ready');

  const MonitorModule = require('../monitoring/Monitor.js').Monitor;
  const RecoveryModule = require('../orchestrator/RecoveryManager.js').RecoveryManager;
  const sysMonitor = new MonitorModule(foundation.logRepo);
  sysMonitor.startHeartbeat();

  supervisor.updateProgress('boot-recovery');
  console.log('[BOOT] boot-recovery');
  const recovery = new RecoveryModule(foundation.taskManager, foundation.logRepo);
  await recovery.runBootRecovery();
  console.log('[BOOT] boot-recovery-ready');

  return {
    aiGatewaySidecar,
    aiGatewayGateway,
    terminalSidecar,
    sysMonitor,
  };
}
