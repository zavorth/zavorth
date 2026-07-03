import type { Bot, Context } from 'grammy';
import type { SurfaceCommandBoundary } from '../../../../api/internal/InternalSurfaceApiCompat.js';
import type { TelegramGatewayHandlerRegistrar } from '../../../../gateways/channels/telegram/TelegramGatewayHandlerRegistrar.js';
import type { TelegramChannelContractService } from '../../../../gateways/channels/telegram/TelegramChannelContractService.js';
import type { ParsedCommand } from '../../../../gateways/channels/telegram/CommandParser.js';
import type { AudioSynthesisOptions } from '../../../../gateways/channels/telegram/AudioHandler.js';
import type { LegacyUnifiedGatewayAdapter } from '../../../../context-engine/LegacyUnifiedGatewayAdapter.js';
import type { ZavorthAgentGateway } from '../../../../runtime/agent/index.js';
import type { EchoOutputStageService } from '../../../../services/EchoOutputStageService.js';
import type { SurfaceOperationalIntentService } from '../../../../services/SurfaceOperationalIntentService.js';
import type { NaturalConversationIngressMetadata } from '../../../../gateways/channels/telegram/bot-gateway/support/BotGatewayMessageProcessing.js';

export type BotGatewaySupportState = {
  sharedSurfaceCommandService?: SurfaceCommandBoundary | null;
  telegramGatewayHandlerRegistrar?: TelegramGatewayHandlerRegistrar | null;
  supervisedRuntimeNotificationTimer: ReturnType<typeof setInterval> | null;
  supervisedRuntimeNotificationFlushInFlight: boolean;
  zavorthControlSurfaceStarted: boolean;
};

export type BotGatewaySupportRuntime = {
  bot: Bot;
  logRepo: { log: (...args: any[]) => void };
  parser: { parse: (text: string) => ParsedCommand };
  priorityCommandService: { handle: (ctx: Context, text: string) => Promise<boolean> };
  securityLock: {
    isLocked: () => boolean;
    isCommandAllowedWhenLocked: (commandType: string) => boolean;
  };
  chainController: { handleCommandChain: (ctx: Context, segments: string[]) => Promise<void> };
  hubController: { handleStartCommand: (ctx: Context, args: string) => Promise<void> };
  opsController: { handleStatus: (ctx: Context) => Promise<void> };
  capabilityController: {
    handleCommand: (ctx: Context, capability: any, args: string, userId: string) => Promise<boolean>;
  };
  commandRoutingService: {
    dispatchPrivateCommand: (
      ctx: Context,
      parsed: ParsedCommand,
      effectiveText: string,
      userId: string,
    ) => Promise<boolean>;
    dispatchGroupCommand: (ctx: Context, command: string, args: string) => Promise<boolean>;
  };
  groupEventController: {
    processAntiSpam: (ctx: Context) => Promise<boolean>;
    processMessageFilter: (ctx: Context) => Promise<boolean>;
    trackMessage: (ctx: Context) => Promise<void>;
    handleNewMembers: (ctx: Context) => Promise<void>;
    handleLeftMember: (ctx: Context) => Promise<void>;
  };
  mediaController: {
    handlePhoto: (ctx: Context) => Promise<void>;
    handleVoice: (ctx: Context) => Promise<void>;
    handleVideo: (ctx: Context) => Promise<void>;
    handleDocument: (ctx: Context) => Promise<void>;
  };
  surfaceTaskDispatcher: any;
  legacyUnifiedGateway?: LegacyUnifiedGatewayAdapter | null;
  agentGateway?: Pick<ZavorthAgentGateway, 'handle' | 'buildSnapshot' | 'resolveApprovalIntent'> | null;
  surfaceIdentityService: any;
  workspaceProfileService: {
    getProfile: (workspace: string) => Promise<any>;
  };
  workspaceCommandService: {
    resolveInvocation: (
      profile: any,
      commandName: string,
      args: string,
    ) => { resolvedText: string; name: string } | null;
  };
  telemetryRuntime: any;
  runtimeComposition: any;
  runtimeDiagnostics: {
    start: () => void;
  };
  runtimeProfileService: {
    supportsAdvancedRuntime: () => boolean;
    getProfile: () => string;
  };
  capabilityLifecycleService: any;
  dailyReportService: {
    start: (broadcast: (message: string, roles?: string[]) => Promise<void>) => void;
  };
  zavorthControlService: {
    start: () => Promise<any>;
    getUrl: () => string;
  };
  lifecycleController: {
    start: (bot: Bot) => Promise<void>;
  };
  supervisedRuntimeNotificationService: {
    flushPending: (sender: (chatId: string, message: string) => Promise<void>) => Promise<any>;
  };
  researchQueueWorker: { start: () => void };
  julesQueueWorker: { start: () => void };
  chatCleanup: { trackMessage: (chatId: string, messageId: number) => void };
  hostIdentityService: unknown;
  telegramChannelContractService: TelegramChannelContractService;
  callbackController: { handleCallback: (ctx: Context, data: string) => Promise<void> };
  processTextMessage?: (
    ctx: Context,
    text: string,
    inlineData?: Array<{ mimeType: string; data: string }>,
    ingressMetadata?: NaturalConversationIngressMetadata,
  ) => Promise<void>;
  processGroupCommand?: (ctx: Context, text: string) => Promise<void>;
  canUseInteractiveGroupAi?: (ctx: Context) => Promise<boolean>;
  state: BotGatewaySupportState;
  getSharedSurfaceCommandService: () => BotGatewaySupportState['sharedSurfaceCommandService'];
  // Certification matrix: Dependências opcionais para Modo Echo (resposta por voz)
  echoAudioHandler?: {
    synthesize: (text: string, voiceIdOrOptions?: string | AudioSynthesisOptions) => Promise<string | null>;
    cleanup: (filePath: string) => void;
  };
  echoPreferenceStore?: {
    isEchoModeActive: () => Promise<boolean>;
  };
  echoOutputStage?: EchoOutputStageService;
  surfaceOperationalIntentService?: Pick<SurfaceOperationalIntentService, 'decideResponse'> | null;
};

export type BotGatewaySupportHandlerCallbacks = {
  processTextMessage: (ctx: Context, text: string) => Promise<void>;
  processGroupCommand: (ctx: Context, text: string) => Promise<void>;
  canUseInteractiveGroupAi: (ctx: Context) => Promise<boolean>;
};
