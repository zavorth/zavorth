import { config } from '../config/index.js';
import { logger } from '../logger.js';
import { bindAutonomySchedulePlane } from '../services/AutonomySchedulePlane.js';
import { GoalLoopDaemonService } from '../services/GoalLoopDaemonService.js';
import { GoalLoopService } from '../services/GoalLoopService.js';
import { GoalLoopWorkerService } from '../services/GoalLoopWorkerService.js';
import { GoalPlaneService } from '../services/GoalPlaneService.js';
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
import { UserModelReviewDaemonService } from '../services/UserModelReviewDaemonService.js';
import { UserModelTurnCaptureService } from '../services/UserModelTurnCaptureService.js';
import { SessionContinuumService, resolveSessionContinuumStorePath } from '../services/SessionContinuumService.js';
import { ModelPickerContractService } from '../domain/providers/index.js';
import { SkillCuratorPlaneService } from '../skills/SkillCuratorPlaneService.js';
import {
  ZavorthAgentGateway,
  createDefaultAgentRunStore,
  createDefaultAgentWorkflowQueueStore,
} from '../runtime/agent/index.js';
import { createBootstrapToolRuntime } from './bootstrapToolRuntime.js';
import { captureConversationTurn } from '../services/learned-knowledge/ConversationContinuumCapture.js';
import { Monitor } from '../monitoring/Monitor.js';
import { RecoveryManager } from '../orchestrator/RecoveryManager.js';

import { createContextEngineRuntime, wireLegacyUnifiedGatewayAgentCallback } from './bootstrapContextEngine.js';
import type {
  BootstrapFoundation,
  BootstrapPreflight,
  BootstrapRuntimeServices,
  BootstrapSupervisor,
} from './bootstrapTypes.js';

const DORMANT_BOOT_CAPABILITIES = ['remote', 'qa', 'sandbox', 'public-tunnel'];

type AgentRunCompletedRequest = {
  messages?: Array<{ role?: string; content?: unknown }>;
  surface?: unknown;
  channel?: unknown;
};

type AgentRunCompletedCallback = (
  run: { id?: string | null; sessionId?: string | null },
  request: AgentRunCompletedRequest,
  replyText: string,
) => void;

type AgentGatewayRunCompletionPatch = {
  onRunCompleted?: AgentRunCompletedCallback;
  runService: {
    onRunCompleted?: AgentRunCompletedCallback;
  };
};

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

  logger.info('Preflight de channels configurados in this runtime:');
  for (const capability of capabilities) {
    logger.info(
      `- ${capability.platform}: ${capability.readiness}/${capability.implementationState} (${capability.transport})`,
    );
  }

  if (summary.ready.length === 0) {
    logger.error('No operational channel is ready to receive messages.');
    logger.error('At least one channel must be configured and ready.');

    if (summary.partial.length > 0 || summary.planned.length > 0 || summary.disabled.length > 0) {
      logger.error(
        `- Non-operational channels: ${[...summary.partial, ...summary.planned, ...summary.disabled].join(', ')}`,
      );
    }

    throw new Error('No operational channel is ready. Configure at least one channel before starting the runtime.');
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
  logger.info('[BOOT] storage-init');
  const processLock = new ProcessLockService(config.processLockFile);
  processLock.acquire('zavorth-runtime');
  process.on('exit', () => processLock.release());

  await Database.getInstance();
  const logRepo = new LogRepository();
  const taskRepo = new TaskRepository();
  await logRepo.init();
  await taskRepo.init();
  logger.info('[BOOT] storage-ready');

  const runtimeProfileService = new RuntimeProfileService();
  const capabilityLifecycleService = new CapabilityLifecycleService({
    runtimeProfileService,
  });
  const dormantCapabilityCleanup =
    capabilityLifecycleService.cleanupDormantCapabilityArtifacts(DORMANT_BOOT_CAPABILITIES);
  const configVersioningService = new ConfigVersioningService();
  const operationsActionService = new OperationsActionService(logRepo);
  const maintenanceAutomation = new MaintenanceAutomationService(operationsActionService, logRepo);
  const skillCuratorPlaneService = new SkillCuratorPlaneService();

  capabilityLifecycleService.markCapabilityState(
    'core-runtime',
    'active',
    `Boot active no profile ${runtimeProfileService.getProfile()}.`,
  );

  let runtimeMaintenanceTimer: ReturnType<typeof setInterval> | null = null;
  const runRuntimeMaintenance = () => {
    runtimeLogMaintenanceService.rotateOversizedLogs();
    runtimeArtifactMaintenanceService.cleanupVisualSmokeProfiles();
    capabilityLifecycleService.expireIdleCapabilities();
    capabilityLifecycleService.cleanupDormantCapabilityArtifacts(DORMANT_BOOT_CAPABILITIES);
    void skillCuratorPlaneService
      .maybeRunCurator({
        idleForSeconds: config.skillsCuratorMinIdleHours * 3600,
        reason: 'runtime-maintenance',
        triggeredBy: 'bootstrap-maintenance',
      })
      .catch((error: unknown) => {
        logRepo.log('warn', 'SkillCurator', `Skill maintenance failed: ${errorMessage(error)}`);
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
    `Perfil de runtime active: ${runtimeProfileService.getProfile()} (policy=${config.zavorthCapabilityPolicy}).`,
  );
  for (const cleanup of dormantCapabilityCleanup) {
    logRepo.log(
      'info',
      'Bootstrap',
      `Dormant capability ${cleanup.capabilityId}: cleaned ${cleanup.removedPaths.length} path(s) at boot.`,
    );
  }
  for (const capability of preflight.capabilities) {
    logRepo.log(
      capability.readiness === 'ready' ? 'info' : 'warn',
      'Bootstrap',
      `Channel ${capability.platform}: ${capability.readiness}/${capability.implementationState} via ${capability.transport}. ${capability.notes.join(' ')}`,
    );
  }

  const taskManager = new TaskManager(taskRepo, logRepo);
  const toolRuntimeServices = createBootstrapToolRuntime(logRepo);
  logRepo.log('info', 'Bootstrap', 'TaskManager unified and tools registered.');
  try {
    if (!process.env.ZAVORTH_TOOL_EXPOSURE_PROFILE) {
      process.env.ZAVORTH_TOOL_EXPOSURE_PROFILE = 'daily-ops';
    }
  } catch {
    /* soft */
  }

  // Await Plugin OS wiring so channel/agent hosts see dynamic capability tools (soft timeout).
  try {
    const waitUntilReady = toolRuntimeServices.pluginOs?.waitUntilReady as
      | ((timeoutMs?: number) => Promise<{ ok?: boolean; timedOut?: boolean; waitedMs?: number }>)
      | undefined;
    if (typeof waitUntilReady === 'function') {
      const timeoutMs = Math.max(0, Number(process.env.ZAVORTH_PLUGIN_OS_READY_TIMEOUT_MS) || 15000);
      const ready = await waitUntilReady(timeoutMs);
      if (ready?.timedOut) {
        logRepo.log(
          'warn',
          'Bootstrap',
          `Plugin OS ready timed out after ${ready.waitedMs ?? timeoutMs}ms (soft-fail; mesh tools still available).`,
        );
      } else {
        logRepo.log('info', 'Bootstrap', 'Plugin OS ready for channel host.');
      }
    }
  } catch (error: unknown) {
    logRepo.log(
      'warn',
      'Bootstrap',
      `Plugin OS ready wait soft-failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

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
    `Cognitive Firewall active: ${contextEngineRuntime.skillLoadResult.totalSkills} skills, ${contextEngineRuntime.skillLoadResult.totalTools} tools descobertas.`,
  );
  const agentGateway = new ZavorthAgentGateway({
    defaultProviderLabel: config.llmProvider || 'Zavorth',
    defaultModelLabel:
      config.geminiModel || config.openaiModel || config.AIGatewayModel || config.openRouterModel || 'current model',
    modelPickerContractService: new ModelPickerContractService(),
    llmRuntime: new LlmRuntimeService(),
    toolRuntime: toolRuntimeServices.toolRuntime,
    runStore: createDefaultAgentRunStore(),
    workflowQueueStore: createDefaultAgentWorkflowQueueStore(),
  });
  agentGateway.addRuntimeEventBus(new ChannelProgressRuntimeBridgeService());

  const turnCapture = new UserModelTurnCaptureService({ homeRoot: config.projectRoot });
  const sessionContinuum = new SessionContinuumService({
    storePath: resolveSessionContinuumStorePath(config.runtimeDir),
    stateDbPath: config.dbPath || null,
  });
  const patchedGateway = agentGateway as unknown as AgentGatewayRunCompletionPatch;
  const existingGatewayOnRunCompleted = patchedGateway.onRunCompleted;
  const existingServiceOnRunCompleted = patchedGateway.runService?.onRunCompleted?.bind(patchedGateway.runService);
  patchedGateway.runService.onRunCompleted = (run, request, replyText) => {
    existingGatewayOnRunCompleted?.(run, request, replyText);
    existingServiceOnRunCompleted?.(run, request, replyText);
    const requestRecord = request && typeof request === 'object' ? (request as Record<string, unknown>) : {};
    const messageUser = Array.isArray(requestRecord.messages)
      ? (requestRecord.messages as Array<{ role?: string; content?: string }>).find(
          (message) => message?.role === 'user',
        )?.content
      : '';
    const runRecord = (run && typeof run === 'object' ? run : {}) as Record<string, unknown>;
    const userMessage = String(
      requestRecord.text || requestRecord.input || runRecord.input || messageUser || '',
    ).trim();
    const surface = requestRecord.surface || requestRecord.channel || 'runtime';
    const sessionId = run?.sessionId || run?.id || undefined;
    if (userMessage) {
      turnCapture.captureConversation(String(userMessage).slice(0, 5000), replyText.slice(0, 5000), {
        surface: String(surface),
        sessionId,
      });
    }
    try {
      // captureConversationTurn no-ops when ZAVORTH_CONTINUUM_CAPTURE=0.
      captureConversationTurn({
        sessionId: sessionId || null,
        userMessage: userMessage ? String(userMessage).slice(0, 8000) : null,
        assistantMessage: replyText ? String(replyText).slice(0, 8000) : null,
        surface: String(surface || 'runtime'),
        runtimeDir: config.runtimeDir,
        dbPath: config.dbPath || null,
        source: 'AgentRunService.onRunCompleted',
        metadata: {
          runId: run?.id || null,
        },
      });
    } catch (error: unknown) {
      logger.warn('[Session Continuum] local appendTurn failed', error);
    }
  };
  logRepo.log('info', 'TurnCapture', 'User model turn capture active.');
  logRepo.log('info', 'SessionContinuum', `local session continuum store: ${sessionContinuum.getStorePath()}`);
  // Always materialize the shared schedule plane storage (restart survival).
  // Daemon tick is optional; control/cron/action bind this same path when plane is missing.
  const sharedTaskPlane = new TaskPlaneService({
    storePath: `${config.runtimeDir}/task-plane.json`,
    stateDbPath: config.dbPath,
  });
  const sharedSchedulePlane = bindAutonomySchedulePlane({
    runtimeDir: config.runtimeDir,
    taskPlane: sharedTaskPlane,
  });

  let goalLoopDaemon: GoalLoopDaemonService | null = null;
  if (config.goalLoopDaemonEnabled) {
    const taskPlane = sharedTaskPlane;
    const schedulePlane = sharedSchedulePlane;
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
      schedulePlane,
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
      `Goal Loop daemon active: interval=${config.goalLoopDaemonIntervalMs}ms maxItems=${config.goalLoopDaemonMaxItems} schedule=${schedulePlane.getStorageDir()}.`,
    );
  } else if ((process.env.ZAVORTH_GOAL_LOOP_DAEMON_ENABLED || 'true').toLowerCase() === 'false') {
    logRepo.log(
      'info',
      'GoalLoopDaemon',
      `Goal Loop daemon desativado por ZAVORTH_GOAL_LOOP_DAEMON_ENABLED=false (schedule plane remains at ${sharedSchedulePlane.getStorageDir()}).`,
    );
  } else {
    logRepo.log(
      'info',
      'GoalLoopDaemon',
      `Goal Loop daemon desativado (schedule plane remains at ${sharedSchedulePlane.getStorageDir()}).`,
    );
  }

  let userModelDaemon: UserModelReviewDaemonService | null = null;
  if (config.userModelDaemonEnabled) {
    userModelDaemon = new UserModelReviewDaemonService({
      homeRoot: config.projectRoot,
      turnCapture,
      config: {
        intervalMs: config.userModelDaemonIntervalMs,
        minTurnsForReview: config.userModelDaemonMinTurns,
        enableLlmReasoning: config.userModelDaemonEnableLlmReasoning,
        llmProvider: config.userModelDaemonLlmProvider,
        llmModel: config.userModelDaemonLlmModel,
        llmMaxPasses: config.userModelDaemonLlmMaxPasses,
      },
    });
    userModelDaemon.start();
    logRepo.log(
      'info',
      'UserModelDaemon',
      `User model review daemon active: interval=${config.userModelDaemonIntervalMs}ms minTurns=${config.userModelDaemonMinTurns} llmReasoning=${config.userModelDaemonEnableLlmReasoning}.`,
    );
  } else {
    logRepo.log(
      'info',
      'UserModelDaemon',
      'User model review daemon desativado por ZAVORTH_USER_MODEL_DAEMON_ENABLED=false.',
    );
  }

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
      userModelDaemon?.stop();
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
  logger.info('[BOOT] sidecars');

  const aiGatewaySidecar = new AIGatewaySidecarService(foundation.logRepo);
  const aiGatewayGateway = new AIGatewayProxyService();
  const terminalSidecar = new TerminalSidecarService(foundation.logRepo);
  const remoteBootEnabled = foundation.capabilityLifecycleService.shouldBootCapability('remote');

  if (remoteBootEnabled) {
    foundation.capabilityLifecycleService.markCapabilityState(
      'remote',
      'provisioning',
      'Inicializando sidecars remotos do profile current.',
    );
    void aiGatewaySidecar.start().catch((error: unknown) => {
      const message = errorMessage(error);
      foundation.capabilityLifecycleService.markCapabilityState(
        'remote',
        'degraded',
        `Failed to start AIGateway sidecar: ${message}`,
      );
      foundation.logRepo.log(
        'warn',
        'AIGatewaySidecar',
        `Failed to start the AIGateway sidecar during main bootstrap: ${message}`,
      );
    });
  } else {
    foundation.capabilityLifecycleService.markCapabilityState(
      'remote',
      'dormant',
      `Profile ${foundation.runtimeProfileService.getProfile()} kept remote sidecars dormant.`,
    );
    foundation.logRepo.log(
      'info',
      'AIGatewaySidecar',
      `Profile ${foundation.runtimeProfileService.getProfile()} does not start remote sidecars at boot.`,
    );
  }

  if (remoteBootEnabled) {
    const gatewayHealthUrl = `${config.zavorthAIGatewayGatewayBaseUrl.replace(/\/+$/, '')}/health`;
    if (await supervisor.isHttpHealthy(gatewayHealthUrl)) {
      foundation.capabilityLifecycleService.markCapabilityState('remote', 'active', 'AIGateway detected as healthy.');
      foundation.logRepo.log(
        'info',
        'AIGatewayGateway',
        'Gateway own do AIGateway already estava online em outro process.',
      );
    } else {
      foundation.capabilityLifecycleService.markCapabilityState(
        'remote',
        'ready',
        'AIGateway gateway was not online; the remote sidecar remains available on demand.',
      );
      foundation.logRepo.log(
        'warn',
        'AIGatewayGateway',
        'AIGateway own gateway was not online during main bootstrap; it can be started on demand by the operational launcher.',
      );
    }

    void terminalSidecar.start().catch((error: unknown) => {
      const message = errorMessage(error);
      foundation.capabilityLifecycleService.markCapabilityState(
        'remote',
        'degraded',
        `Failed to start ZavorthBridge remote sidecar: ${message}`,
      );
      foundation.logRepo.log(
        'warn',
        'ZavorthTerminalSidecar',
        `Failed to start the ZavorthBridge remote sidecar during main bootstrap: ${message}`,
      );
    });
  }

  logger.info('[BOOT] sidecars-ready');
  supervisor.updateProgress('mcp-runtime');
  logger.info('[BOOT] mcp-runtime');
  await foundation.mcpRuntime.start();
  logger.info('[BOOT] mcp-runtime-ready');

  const sysMonitor = new Monitor(foundation.logRepo);
  sysMonitor.startHeartbeat();

  supervisor.updateProgress('boot-recovery');
  logger.info('[BOOT] boot-recovery');
  const recovery = new RecoveryManager(foundation.taskManager, foundation.logRepo);
  await recovery.runBootRecovery();
  logger.info('[BOOT] boot-recovery-ready');

  return {
    aiGatewaySidecar,
    aiGatewayGateway,
    terminalSidecar,
    sysMonitor,
  };
}
