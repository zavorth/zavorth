import type { Bot, Context } from 'grammy';
import type { CapabilityDefinition } from '../../../../contracts/CapabilityContract.js';
import type { SurfaceCommandBoundary } from '../../../../api/internal/InternalSurfaceApiCompat.js';
import type { TelegramGatewayHandlerRegistrar } from '../../../../gateways/channels/telegram/TelegramGatewayHandlerRegistrar.js';
import type { TelegramChannelContractService } from '../../../../gateways/channels/telegram/TelegramChannelContractService.js';
import type { ParsedCommand } from '../../../../gateways/channels/telegram/CommandParser.js';
import type { AudioSynthesisOptions } from '../../../../gateways/channels/telegram/AudioHandler.js';
import type { LegacyUnifiedGatewayAdapter } from '../../../../context-engine/LegacyUnifiedGatewayAdapter.js';
import type { ZavorthAgentGateway } from '../../../../runtime/agent/index.js';
import type { EchoOutputStageService } from '../../../../services/EchoOutputStageService.js';
import type { SurfaceOperationalIntentService } from '../../../../services/SurfaceOperationalIntentService.js';
import type { HostIdentityService } from '../../../../services/HostIdentityService.js';
import type { WorkspaceProfile as RuntimeWorkspaceProfile } from '../../../../services/WorkspaceProfileService.js';
import type { NaturalConversationIngressMetadata } from '../../../../gateways/channels/telegram/bot-gateway/support/BotGatewayMessageProcessing.js';

export type BotGatewaySupportState = {
  sharedSurfaceCommandService?: SurfaceCommandBoundary | null;
  telegramGatewayHandlerRegistrar?: TelegramGatewayHandlerRegistrar | null;
  supervisedRuntimeNotificationTimer: ReturnType<typeof setInterval> | null;
  supervisedRuntimeNotificationFlushInFlight: boolean;
  zavorthControlSurfaceStarted: boolean;
};

export type LogFunction = (...args: unknown[]) => void;

export type SurfaceTaskDispatcher = {
  dispatchTaskMessage: (input: {
    ctx: Context;
    platform: 'telegram';
    chatId: string;
    text: string;
    sourceUserId: string;
    fallbackRuntimeUserId: string;
    source: 'telegram';
    chatHint?: string | null;
    threadId?: string | null;
    surfacePolicy?: Record<string, unknown>;
    identity?: Record<string, unknown>;
    inlineData?: Array<{ mimeType: string; data: string }>;
  }) => Promise<unknown>;
};

export type SurfaceIdentity = {
  linkIdentity: (input: {
    source: string;
    sourceUserId: string;
    runtimeUserId: string;
    linkedBy?: string | null;
    verificationMethod?: string | null;
    chatId?: string | null;
    sessionId?: string | null;
  }) => void;
};

export type WorkspaceProfile = RuntimeWorkspaceProfile;

export type TelemetryRuntime = {
  record: (event: {
    traceId: string;
    source: string;
    eventType: string;
    status?: string;
    payload?: Record<string, unknown>;
  }) => Promise<void>;
};

export type RuntimeComposition = {
  getTelemetryRuntime: () => TelemetryRuntime;
  getLlmRuntime?: () => unknown;
};

export type CapabilityLifecycleState =
  | 'declared'
  | 'dormant'
  | 'provisioning'
  | 'ready'
  | 'active'
  | 'degraded';

export type CapabilityLifecycle = {
  shouldBootCapability: (capabilityId: string) => boolean;
  markCapabilityState: (
    capabilityId: string,
    nextState: CapabilityLifecycleState,
    notes?: string,
  ) => unknown;
};

export type ZavorthControlStartResult = {
  success?: boolean;
  message?: string;
  controlUrl?: string;
};

export type FlushPendingResult = {
  delivered: boolean;
  skipped: boolean;
  error?: string;
  notification?: { chatId?: string | number | null } | null;
};

export type BotGatewaySupportRuntime = {
  bot: Bot;
  logRepo: { log: (...args: unknown[]) => void };
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
    handleCommand: (ctx: Context, capability: CapabilityDefinition | null, args: string, userId: string) => Promise<boolean>;
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
  surfaceTaskDispatcher: SurfaceTaskDispatcher;
  legacyUnifiedGateway?: LegacyUnifiedGatewayAdapter | null;
  agentGateway?: Pick<
    ZavorthAgentGateway,
    'handle' | 'buildSnapshot' | 'resolveApprovalIntent' | 'registerChannelMeshApprovalMenu'
  > | null;
  surfaceIdentityService: SurfaceIdentity;
  workspaceProfileService: {
    getProfile: (workspace: string) => Promise<WorkspaceProfile | null>;
  };
  workspaceCommandService: {
    resolveInvocation: (
      profile: WorkspaceProfile,
      commandName: string,
      args: string,
    ) => { resolvedText: string; name: string } | null;
  };
  telemetryRuntime: TelemetryRuntime;
  runtimeComposition: RuntimeComposition;
  runtimeDiagnostics: {
    start: () => void;
  };
  runtimeProfileService: {
    supportsAdvancedRuntime: () => boolean;
    getProfile: () => string;
  };
  capabilityLifecycleService: CapabilityLifecycle;
  dailyReportService: {
    start: (broadcast: (message: string, roles?: string[]) => Promise<void>) => void;
  };
  zavorthControlService: {
    start: () => Promise<ZavorthControlStartResult>;
    getUrl: () => string;
  };
  lifecycleController: {
    start: (bot: Bot) => Promise<void>;
  };
  supervisedRuntimeNotificationService: {
    flushPending: (sender: (chatId: string, message: string) => Promise<void>) => Promise<FlushPendingResult>;
  };
  researchQueueWorker: { start: () => void };
  julesQueueWorker: { start: () => void };
  chatCleanup: { trackMessage: (chatId: string, messageId: number) => void };
  hostIdentityService: HostIdentityService;
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
  // Optional dependencies for Echo Mode (voice response)
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
