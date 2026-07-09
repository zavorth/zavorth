import { logger } from '../../../../logger.js';
import { Bot } from 'grammy';
import { CommandParser } from '../../../../gateways/channels/telegram/CommandParser.js';
import { AudioHandler } from '../../../../gateways/channels/telegram/AudioHandler.js';
import { VideoHandler } from '../../../../gateways/channels/telegram/VideoHandler.js';
import { EchoOutputStageService } from '../../../../services/EchoOutputStageService.js';
import { LogRepository } from '../../../../storage/LogRepository.js';
import { LocalExecutor } from '../../../../execution/LocalExecutor.js';
import { CodexExecutor } from '../../../../execution/CodexExecutor.js';
import { ExecutionGateway } from '../../../../execution/ExecutionGateway.js';
import {
  EXTERNAL_EXECUTOR_ID,
  ExternalExecutor,
} from '../../../../execution/ExternalExecutor.js';
import { StitchExecutor } from '../../../../execution/StitchExecutor.js';

import { AiStudioExecutor } from '../../../../execution/AiStudioExecutor.js';
import { GeminiManagedAgentExecutor } from '../../../../execution/GeminiManagedAgentExecutor.js';
import { AuditLogger } from '../../../../monitoring/AuditLogger.js';
import { ZavorthBridgePreferenceStore } from '../../../../agents/ZavorthBridgePreferenceStore.js';
import { RemoteModeManager } from '../../../../services/RemoteModeManager.js';
import { ZavorthBridgeControlService } from '../../../../services/ZavorthBridgeControlService.js';
import { ZavorthBridgePromptService } from '../../../../services/ZavorthBridgePromptService.js';
import { WslControlService } from '../../../../services/WslControlService.js';
import { SystemCleanupService } from '../../../../services/SystemCleanupService.js';
import { ChatCleanupService } from '../../../../services/ChatCleanupService.js';
import { PermissionService } from '../../../../services/PermissionService.js';
import { SecurityLockService } from '../../../../services/SecurityLockService.js';
import { FunGamesService } from '../../../../services/FunGamesService.js';
import { WelcomeService } from '../../../../services/WelcomeService.js';
import { AntiSpamService } from '../../../../services/AntiSpamService.js';
import { MessageFilterService } from '../../../../services/MessageFilterService.js';
import { WarnService } from '../../../../services/WarnService.js';
import { GroupStatsService } from '../../../../services/GroupStatsService.js';
import { RuntimeDiagnosticsService } from '../../../../services/RuntimeDiagnosticsService.js';
import { RuntimeCompositionService } from '../../../../services/RuntimeCompositionService.js';
import { WorkspaceProfileService } from '../../../../services/WorkspaceProfileService.js';
import { WorkspaceCommandService } from '../../../../services/WorkspaceCommandService.js';
import { HostIdentityService } from '../../../../services/HostIdentityService.js';
import { SurfaceIdentityService } from '../../../../services/SurfaceIdentityService.js';
import { CapabilityLifecycleService } from '../../../../services/CapabilityLifecycleService.js';
import { RuntimeProfileService } from '../../../../services/RuntimeProfileService.js';
import { SupervisedRuntimeNotificationService } from '../../../../services/SupervisedRuntimeNotificationService.js';
import { TelegramChannelContractService } from '../../../../gateways/channels/telegram/TelegramChannelContractService.js';
import { createTelegramHoneypotMonitor } from '../../../../gateways/channels/telegram/bot-gateway/BotGatewayHoneypotBootstrap.js';
import type { BotGatewayRuntimeOptions } from '../../../../gateways/channels/telegram/bot-gateway/BotGatewayBootstrapTypes.js';
import type { BotGatewaySupportRuntime } from '../../../../gateways/channels/telegram/bot-gateway/BotGatewaySupportTypes.js';
import type { ContextEngine } from '../../../../context-engine/ContextEngine.js';

interface BotGatewayFoundationHost extends Omit<Partial<BotGatewaySupportRuntime>, 'logRepo'> {
  remoteModeManager?: RemoteModeManager;
  zavorthBridgeControlService?: ZavorthBridgeControlService;
  zavorthBridgePromptService?: ZavorthBridgePromptService;
  contextEngine?: ContextEngine | null;
  executionGateway?: ExecutionGateway;
  auditLogger?: AuditLogger;
  wslControl?: WslControlService;
  systemCleanup?: SystemCleanupService;
  permissionService?: PermissionService;
  honeypot?: { start: () => void };
  funGamesService?: FunGamesService;
  welcomeService?: WelcomeService;
  antiSpamService?: AntiSpamService;
  messageFilterService?: MessageFilterService;
  warnService?: WarnService;
  groupStatsService?: GroupStatsService;
}

export function initializeBotGatewayFoundation(
  gateway: any,
  token: string,
  logRepo: LogRepository,
  runtimeComposition?: RuntimeCompositionService,
  runtimeOptions?: BotGatewayRuntimeOptions,
): void {
  gateway.bot = new Bot(token);
  gateway.parser = new CommandParser();
  gateway.audioHandler = new AudioHandler();
  gateway.videoHandler = new VideoHandler();
  gateway.zavorthBridgePreferenceStore = new ZavorthBridgePreferenceStore();
  gateway.echoOutputStage = new EchoOutputStageService({
    audioHandler: gateway.audioHandler,
    preferenceStore: gateway.zavorthBridgePreferenceStore,
  });
  gateway.remoteModeManager = new RemoteModeManager();
  gateway.hostIdentityService = new HostIdentityService();
  gateway.zavorthBridgeControlService = new ZavorthBridgeControlService();
  gateway.zavorthBridgePromptService = new ZavorthBridgePromptService(logRepo);
  gateway.runtimeComposition = runtimeComposition || new RuntimeCompositionService();
  gateway.contextEngine = runtimeOptions?.contextEngine || null;
  gateway.legacyUnifiedGateway = runtimeOptions?.legacyUnifiedGateway || null;
  gateway.agentGateway = runtimeOptions?.agentGateway || null;
  gateway.runtimeProfileService =
    runtimeOptions?.runtimeProfileService || new RuntimeProfileService();
  gateway.capabilityLifecycleService =
    runtimeOptions?.capabilityLifecycleService ||
    new CapabilityLifecycleService({
      runtimeProfileService: gateway.runtimeProfileService,
    });
  gateway.telegramChannelContractService =
    runtimeOptions?.telegramChannelContractService || new TelegramChannelContractService();
  gateway.telemetryRuntime = gateway.runtimeComposition.getTelemetryRuntime();
  gateway.supervisedRuntimeNotificationService =
    new SupervisedRuntimeNotificationService();
  gateway.surfaceIdentityService = new SurfaceIdentityService();

  gateway.executionGateway = new ExecutionGateway(
    logRepo,
    undefined,
    undefined,
    gateway.telemetryRuntime,
  );
  gateway.executionGateway.setHostIdentityService(gateway.hostIdentityService);
  gateway.executionGateway.registerExecutor('local', new LocalExecutor());
  gateway.executionGateway.registerExecutor('local_executor', new LocalExecutor());
  gateway.executionGateway.registerExecutor('codex', new CodexExecutor());
  const externalExecutor = new ExternalExecutor();
  gateway.executionGateway.registerExecutor(EXTERNAL_EXECUTOR_ID, externalExecutor);
  gateway.executionGateway.registerExecutor(
    'gemini_cli',
    new (require('../../execution/GeminiCliExecutor.js').GeminiCliExecutor)(),
  );
  gateway.executionGateway.registerExecutor('aistudio', new AiStudioExecutor());
  gateway.executionGateway.registerExecutor('gemini_managed_agent', new GeminiManagedAgentExecutor());
  gateway.executionGateway.registerExecutor(
    'jules',
    new (require('../../execution/JulesExecutor.js').JulesExecutor)(),
  );
  gateway.executionGateway.registerExecutor('stitch', new StitchExecutor());
  gateway.executionGateway.registerExecutor(
    'swarm',
    new (require('../../execution/SwarmExecutor.js').SwarmExecutor)(
      gateway.runtimeComposition.getLlmRuntime(),
    ),
  );

  gateway.auditLogger = new AuditLogger();
  gateway.auditLogger
    .init()
    .catch((error: Error) =>
      logger.error('AuditLogger init error:', error.message),
    );

  gateway.wslControl = new WslControlService();
  gateway.systemCleanup = new SystemCleanupService();
  gateway.chatCleanup = new ChatCleanupService();
  gateway.permissionService = new PermissionService(
    undefined,
    gateway.telemetryRuntime,
  );
  gateway.securityLock = new SecurityLockService();
  gateway.honeypot = createTelegramHoneypotMonitor(gateway);
  gateway.honeypot.start();

  gateway.funGamesService = new FunGamesService();
  gateway.welcomeService = new WelcomeService();
  gateway.antiSpamService = new AntiSpamService();
  gateway.messageFilterService = new MessageFilterService();
  gateway.warnService = new WarnService();
  gateway.groupStatsService = new GroupStatsService();
  gateway.runtimeDiagnostics = new RuntimeDiagnosticsService(
    gateway.taskManager as any,
    gateway.logRepo as any,
  );
  gateway.workspaceProfileService = new WorkspaceProfileService();
  gateway.workspaceCommandService = new WorkspaceCommandService();
}
