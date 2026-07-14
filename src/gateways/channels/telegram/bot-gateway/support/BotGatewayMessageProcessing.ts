import { Context, InputFile } from 'grammy';
import {
  createInternalSurfaceCommandApi,
} from '../../../../../api/internal/InternalSurfaceApiCompat.js';
import type { IMessageContext } from '../../../../../contracts/IMessageBroker.js';
import { getDefaultCapabilityRegistry } from '../../../../../capabilities/CapabilityRegistry.js';
import { config } from '../../../../../config/index.js';
import { SurfaceOperationalIntentService } from '../../../../../services/SurfaceOperationalIntentService.js';
import { WorkspaceResolver } from '../../../../../security/WorkspaceResolver.js';
import { parseTelegramCommand } from '../../../../../gateways/channels/telegram/BotGatewayHelpers.js';
import { TelegramChannelContractService } from '../../../../../gateways/channels/telegram/TelegramChannelContractService.js';
import { TelegramAuthorizedChatRegistry } from '../../../../../gateways/channels/telegram/TelegramAuthorizedChatRegistry.js';
import type { ParsedCommand } from '../../../../../gateways/channels/telegram/CommandParser.js';
import { EchoOutputStageService } from '../../../../../services/EchoOutputStageService.js';
import type { BotGatewaySupportRuntime } from '../../../../../gateways/channels/telegram/bot-gateway/BotGatewaySupportTypes.js';
import { telegramLegacySurfacePolicyService } from '../../../../../gateways/channels/telegram/controllers/TelegramLegacySurfacePolicyService.js';
import { TelegramDailyAssistantService } from '../../../../../gateways/channels/telegram/TelegramDailyAssistantService.js';
import { hookMiddleware } from '../../../../../services/ZavorthMiddlewareHook.js';
import { logger } from '../../../../../logger.js';
export type NaturalConversationIngressMetadata = {
  traceId?: string | null;
  voiceFlow?: Record<string, unknown> | null;
  transport?: string | null;
  requestedBy?: string | null;
  preferredLanguageCode?: string | null;
};

function resolveSurfaceOperationalIntentService(
  runtime: BotGatewaySupportRuntime,
): Pick<SurfaceOperationalIntentService, 'decideResponse'> {
  if (!runtime.surfaceOperationalIntentService) {
    runtime.surfaceOperationalIntentService = new SurfaceOperationalIntentService();
  }
  return runtime.surfaceOperationalIntentService;
}

export async function processTextMessage(
  runtime: BotGatewaySupportRuntime,
  ctx: Context,
  text: string,
  inlineData?: Array<{ mimeType: string; data: string }>,
  ingressMetadata?: NaturalConversationIngressMetadata,
): Promise<void> {
  const channelContractService =
    runtime.telegramChannelContractService || new TelegramChannelContractService();
  const telegramContract = channelContractService.buildContract(ctx);
  const chatId = telegramContract.chatId || ctx.chat?.id.toString() || '';
  const userId = ctx.from?.id.toString() || '';
  new TelegramAuthorizedChatRegistry().recordAuthorizedContext(ctx);

  runtime.surfaceIdentityService.linkIdentity({
    source: 'telegram',
    sourceUserId: userId,
    runtimeUserId: userId,
    chatId: telegramContract.chatHint || chatId,
    linkedBy: 'telegram-auth',
    verificationMethod: 'allowed-user',
  });
  runtime.logRepo.log('info', 'Telegram', `Recebeu mensagem de ${userId}`);
  await recordIncomingMessageTelemetry(runtime, chatId, userId, text, ctx.chat?.type || 'unknown');

  // HIGH_RISK callback challenge: bare TOTP / pin= after task:approve button.
  const permissionController =
    (runtime as { permissionController?: { tryConsumeHighRiskTotpReply?: (c: Context, t: string) => Promise<boolean> } })
      .permissionController ||
    (runtime as { getPermissionController?: () => { tryConsumeHighRiskTotpReply?: (c: Context, t: string) => Promise<boolean> } })
      .getPermissionController?.();
  if (
    permissionController?.tryConsumeHighRiskTotpReply &&
    (await permissionController.tryConsumeHighRiskTotpReply(ctx, text))
  ) {
    return;
  }

  // agent-first: free text never goes through priority interceptors.
  // Only explicit slash commands may be handled before the agent.
  const isSlashText = String(text || '').trim().startsWith('/');
  if (isSlashText && (await runtime.priorityCommandService.handle(ctx, text))) {
    return;
  }

  let effectiveText = text;
  let parsed = runtime.parser.parse(effectiveText);
  const workspaceCommandResolution = await resolveWorkspaceCommandInput(
    runtime,
    effectiveText,
    parsed,
  );
  if (workspaceCommandResolution) {
    effectiveText = workspaceCommandResolution.rawText;
    parsed = workspaceCommandResolution.parsed;
  }

  if (
    runtime.securityLock.isLocked() &&
    !runtime.securityLock.isCommandAllowedWhenLocked(parsed.command_type)
  ) {
    if (parsed.command_type === '/lock') {
      await ctx.reply('\u{1F512} Zavorth is already locked.');
      return;
    }
    await ctx.reply('\u{1F512} Zavorth is locked. Use /unlock <password> to unlock.');
    return;
  }

  if (effectiveText.includes(' | ') && effectiveText.startsWith('/')) {
    const segments = effectiveText
      .split(/\s*\|\s*/)
      .map((segment) => segment.trim())
      .filter(Boolean);
    if (segments.length > 1) {
      await runtime.chainController.handleCommandChain(ctx, segments);
      return;
    }
  }

  if (parsed.command_type === '/start') {
    await runtime.hubController.handleStartCommand(ctx, parsed.command_args);
    return;
  }

  if (parsed.command_type === '/status') {
    await runtime.opsController.handleStatus(ctx);
    return;
  }

  const capability = getDefaultCapabilityRegistry().findByCommand(parsed.command_type);
  if (capability?.command?.handler_action) {
    const handled = await runtime.capabilityController.handleCommand(
      ctx,
      capability,
      parsed.command_args,
      userId,
    );
    if (handled) {
      return;
    }
  }

  if (await tryHandleExplicitAgentApproval(runtime, ctx, parsed, effectiveText, chatId, userId, telegramContract)) {
    return;
  }

  if (
    await runtime.commandRoutingService.dispatchPrivateCommand(
      ctx,
      parsed,
      effectiveText,
      userId,
    )
  ) {
    return;
  }

  const sharedSurfaceApi = createInternalSurfaceCommandApi(
    runtime.getSharedSurfaceCommandService(),
  );
  if (sharedSurfaceApi) {
    const result = await sharedSurfaceApi.handleCommand({
      context: buildSharedSurfaceTelegramContext(runtime, ctx, effectiveText, chatId, userId, inlineData),
      parsedCommand: parsed,
      request: {
        surface: 'telegram',
        requestedBy: userId,
        chatId,
        threadId: telegramContract.threadId,
        correlation: {
          sessionId: telegramContract.threadId || chatId,
        },
        metadata: {
          chatHint: telegramContract.chatHint,
          transport: telegramContract.transport,
        },
      },
    });
    if (result.status !== 'not_handled') {
      if (!result.ok && result.messages.length === 0 && result.summary) {
        await ctx.reply(result.summary);
      }
      return;
    }
  }

  if (telegramLegacySurfacePolicyService.isCriticalOperatorSlashCommand(effectiveText, parsed.command_type)) {
    await ctx.reply(
      telegramLegacySurfacePolicyService.buildUnhandledOperatorCommandMessage(
        effectiveText,
        parsed.command_type,
      ),
    );
    return;
  }

  // Canonical agent gateway owns natural Telegram conversation when available.
  if (await tryHandleNaturalConversationThroughAgentGateway(
    runtime,
    ctx,
    effectiveText,
    parsed,
    chatId,
    userId,
    telegramContract,
    inlineData,
    ingressMetadata,
  )) {
    return;
  }

  // Legacy unified conversation is the explicit AgentGateway-absent fallback.
  if (await tryHandleNaturalConversationThroughLegacyUnifiedGateway(
    runtime,
    ctx,
    effectiveText,
    parsed,
    chatId,
    userId,
    telegramContract,
    inlineData,
    ingressMetadata,
  )) {
    return;
  }

  // Commandless middleware only after governed gateway fallbacks are exhausted.
  const middlewareResult = await hookMiddleware({
    text: effectiveText,
    channelId: 'telegram',
    userId,
    locale: ingressMetadata?.preferredLanguageCode ?? undefined,
  });
  if (middlewareResult.handled && middlewareResult.response) {
    await ctx.reply(middlewareResult.response);
    return;
  }

  const hasExecutionAttachment = hasExecutionAttachmentPayload(inlineData, ingressMetadata);
  const fallbackResponseDecision = await resolveSurfaceOperationalIntentService(runtime).decideResponse({
    surface: 'telegram',
    text: effectiveText,
    hasAttachments: hasExecutionAttachment,
    explicitExecution: effectiveText.trim().startsWith('/task'),
  });
  if (fallbackResponseDecision.responsePath === 'fast-chat' && parsed.command_type === '/task') {
    await ctx.reply("I'm here. Chat normally, or ask for a concrete action when you want me to run something.");
    return;
  }

  await runtime.surfaceTaskDispatcher.dispatchTaskMessage({
    ctx,
    platform: 'telegram',
    chatId,
    text: effectiveText,
    sourceUserId: userId,
    fallbackRuntimeUserId: userId,
    source: 'telegram',
    chatHint: telegramContract.chatHint,
    threadId: telegramContract.threadId,
    surfacePolicy: {
      publicServerMode: telegramContract.isGroup,
      forceApprovalForExecution: false,
      transport: telegramContract.transport,
    },
    identity: {
      linkedBy: 'telegram-auth',
      verificationMethod: 'allowed-user',
    },
    inlineData,
  });
}

async function tryHandleExplicitAgentApproval(
  runtime: BotGatewaySupportRuntime,
  ctx: Context,
  parsed: ParsedCommand,
  text: string,
  chatId: string,
  userId: string,
  telegramContract: ReturnType<TelegramChannelContractService['buildContract']>,
): Promise<boolean> {
  if (
    !runtime.agentGateway
    || (parsed.command_type !== '/approve' && parsed.command_type !== '/reject')
  ) {
    return false;
  }

  const dailyAssistant = new TelegramDailyAssistantService({
    agentGateway: runtime.agentGateway,
  });
  const result = await dailyAssistant.handleApprovalIntent({
    text,
    userId,
    sessionId: telegramContract.threadId || chatId,
  });
  if (!result || result.receipt.status === 'approval-not-found') {
    return false;
  }

  await ctx.reply(result.text);
  return true;
}

function hasExecutionAttachmentPayload(
  inlineData?: Array<{ mimeType: string; data: string }>,
  ingressMetadata?: NaturalConversationIngressMetadata,
): boolean {
  if (ingressMetadata?.transport === 'voice') {
    return false;
  }

  return Boolean(inlineData?.some((entry) => !isAudioMimeType(entry.mimeType)));
}

function hasVoiceInput(
  inlineData?: Array<{ mimeType: string; data: string }>,
  ingressMetadata?: NaturalConversationIngressMetadata,
): boolean {
  return ingressMetadata?.transport === 'voice'
    || Boolean(inlineData?.some((entry) => isAudioMimeType(entry.mimeType)));
}

function isAudioMimeType(mimeType: string | null | undefined): boolean {
  return String(mimeType || '').toLowerCase().startsWith('audio/');
}

function resolveTelegramUniversalModelLabel(): string {
  const provider = String(config.llmProvider || 'runtime').trim();
  const normalizedProvider = provider.toLowerCase().replace(/[\s_-]+/g, '');
  const modelCandidatesByProvider: Record<string, Array<string | null | undefined>> = {
    gemini: [config.geminiModel, config.geminiDefaultModel],
    google: [config.geminiModel, config.geminiDefaultModel],
    aistudio: [config.aiStudioModel, config.geminiModel, config.geminiDefaultModel],
    gemma: [config.gemmaModel],
    openai: [config.openaiModel],
    deepseek: [config.deepseekModel],
    minimax: [config.minimaxModel],
    aigateway: [config.AIGatewayModel, config.openaiModel],
    openrouter: [config.openRouterModel],
    opencode: [config.openCodeModel],
    qwen: [config.qwenModel],
  };

  return (modelCandidatesByProvider[normalizedProvider] || [])
    .map((candidate) => String(candidate || '').trim())
    .find(Boolean)
    || provider
    || 'current model';
}

async function tryHandleNaturalConversationThroughAgentGateway(
  runtime: BotGatewaySupportRuntime,
  ctx: Context,
  effectiveText: string,
  parsed: ParsedCommand,
  chatId: string,
  userId: string,
  telegramContract: ReturnType<TelegramChannelContractService['buildContract']>,
  inlineData?: Array<{ mimeType: string; data: string }>,
  ingressMetadata?: NaturalConversationIngressMetadata,
): Promise<boolean> {
  const text = String(effectiveText || '').trim();
  if (!runtime.agentGateway || text.startsWith('/')) {
    return false;
  }

  const dailyAssistant = new TelegramDailyAssistantService({
    agentGateway: runtime.agentGateway,
  });
  // agent-first: never mutate approvals via free-text phrase regex.
  // Use /approve|/reject or callback_data task:approve|reject only.

  const hasExecutionAttachment = hasExecutionAttachmentPayload(inlineData, ingressMetadata);
  const responseDecision = await resolveSurfaceOperationalIntentService(runtime).decideResponse({
    surface: 'telegram',
    text,
    hasAttachments: hasExecutionAttachment,
  });
  const requestedTools = responseDecision.requestedTools;

  const result = await dailyAssistant.handleTask({
    userId,
    sessionId: telegramContract.threadId || chatId,
    text,
    workspace: null,
    requestedTools,
    modelProfile: {
      providerLabel: String(config.llmProvider || 'Zavorth'),
      modelLabel: resolveTelegramUniversalModelLabel(),
      routingPolicy: 'gateway',
      supportsTools: true,
    },
    metadata: {
      transport: ingressMetadata?.transport || telegramContract.transport,
      source: 'telegram',
      chatId,
      chatHint: telegramContract.chatHint,
      threadId: telegramContract.threadId,
      traceId: ingressMetadata?.traceId || null,
      responseDecision,
      artifactPolicy: responseDecision.artifactPolicy,
      telegramThinAdapterPolicy: telegramLegacySurfacePolicyService.buildThinAdapterMetadata(),
      legacyUnifiedGatewayAvailable: Boolean(runtime.legacyUnifiedGateway),
      legacyUnifiedGatewayBypassed: Boolean(runtime.legacyUnifiedGateway),
    },
  });
  await ctx.reply(result.text);
  return true;
}

async function tryHandleNaturalConversationThroughLegacyUnifiedGateway(
  runtime: BotGatewaySupportRuntime,
  ctx: Context,
  effectiveText: string,
  parsed: ParsedCommand,
  chatId: string,
  userId: string,
  telegramContract: ReturnType<TelegramChannelContractService['buildContract']>,
  inlineData?: Array<{ mimeType: string; data: string }>,
  ingressMetadata?: NaturalConversationIngressMetadata,
): Promise<boolean> {
  const legacyUnifiedGateway = runtime.legacyUnifiedGateway || null;
  if (runtime.agentGateway || !legacyUnifiedGateway || effectiveText.trim().startsWith('/')) {
    return false;
  }

  const hasExecutionAttachment = hasExecutionAttachmentPayload(inlineData, ingressMetadata);
  // When AgentGateway is absent, LegacyUnifiedGateway is the conversation fallback for all
  // non-slash natural ingress (including voice). Keep decideResponse for diagnostics only.
  const responseDecision = await resolveSurfaceOperationalIntentService(runtime).decideResponse({
    surface: 'telegram',
    text: effectiveText,
    hasAttachments: hasExecutionAttachment,
  });

  const surfaceContext = buildSharedSurfaceTelegramContext(
    runtime,
    ctx,
    effectiveText,
    chatId,
    userId,
    inlineData,
    ingressMetadata,
  );
  await legacyUnifiedGateway.handleEvent({
    surface: 'telegram',
    chatId,
    userId,
    text: effectiveText,
    isGroup: telegramContract.isGroup,
    inlineData,
    reply: surfaceContext.reply,
    metadata: {
      channel: 'telegram',
      phase: 'legacy-unified-conversation-fallback-v1',
      chatHint: telegramContract.chatHint,
      threadId: telegramContract.threadId,
      transport: ingressMetadata?.transport || telegramContract.transport,
      isVoiceInput: hasVoiceInput(inlineData, ingressMetadata),
      traceId: ingressMetadata?.traceId || null,
      voiceFlow: ingressMetadata?.voiceFlow || null,
      preferredLanguageCode: ingressMetadata?.preferredLanguageCode || null,
      responseDecision,
      operationalIntentReason: responseDecision.sourceReason,
      operationalIntentShouldExecute: responseDecision.diagnostics.shouldExecute,
    },
  });
  return true;
}

export async function processGroupCommand(
  runtime: BotGatewaySupportRuntime,
  ctx: Context,
  text: string,
): Promise<void> {
  const parsed = parseTelegramCommand(text);
  if (!parsed) {
    return;
  }

  const command = parsed.commandType;
  const args = parsed.commandArgs;

  if (await runtime.commandRoutingService.dispatchGroupCommand(ctx, command, args)) {
    return;
  }

  const normalizedText = `/${command.slice(1)}${args ? ` ${args}` : ''}`;
  await processTextMessage(runtime, ctx, normalizedText);
}

export async function canUseInteractiveGroupAi(
  runtime: BotGatewaySupportRuntime,
  ctx: Context,
): Promise<boolean> {
  const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
  if (!isGroup) {
    return true;
  }

  const userId = ctx.from?.id?.toString();
  if (userId && config.allowedUserIds.includes(userId)) {
    return true;
  }

  if (!ctx.chat?.id || !ctx.from?.id) {
    return false;
  }

  try {
    const member = await ctx.api.getChatMember(ctx.chat.id, ctx.from.id);
    return member.status === 'administrator' || member.status === 'creator';
  } catch (error: unknown) {logger.warn('[Bot way Message Processing] filesystem check failed', error); return false; }
}

export function buildSharedSurfaceTelegramContext(
  runtime: BotGatewaySupportRuntime,
  ctx: Context,
  rawText: string,
  chatId: string,
  userId: string,
  inlineData?: Array<{ mimeType: string; data: string }>,
  ingressMetadata?: NaturalConversationIngressMetadata,
): IMessageContext {
  const telegramChatId = ctx.chat?.id ?? chatId;
  const messageId = ctx.msg?.message_id ? String(ctx.msg.message_id) : null;

  return {
    platform: 'telegram',
    userId,
    chatId,
    isGroup: ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup',
    rawText,
    messageId,
    channelId: telegramChatId ? String(telegramChatId) : chatId,
    threadId: runtime.telegramChannelContractService.buildContract(ctx).threadId || null,
    transport: rawText.trim().startsWith('/') ? 'slash_command' : 'text',
    inlineData,
    reply: async (text: string, options?: Record<string, unknown>) => {
      // Certification matrix: Modo Echo — resposta por voz
      const outputStage = runtime.echoOutputStage || new EchoOutputStageService({
        audioHandler: runtime.echoAudioHandler || null,
        preferenceStore: runtime.echoPreferenceStore || null,
      });
      await outputStage.deliver({
        surface: 'telegram',
        text,
        rawInput: rawText,
        options,
        requestedBy: ingressMetadata?.requestedBy || userId || 'telegram-bot',
        sessionId: chatId,
        traceId: ingressMetadata?.traceId || null,
        voiceFlow: ingressMetadata?.voiceFlow || null,
        preferredLanguageCode: ingressMetadata?.preferredLanguageCode || null,
        sink: {
          sendText: async (nextText, sendOptions) => ctx.reply(nextText, sendOptions),
          sendChatAction: async (action) => {
            if (!ctx.chat?.id) {
              return;
            }
            await ctx.api.sendChatAction(ctx.chat.id, action);
          },
          sendVoice: async (audioPath) => {
            await ctx.replyWithVoice(new InputFile(audioPath));
          },
        },
      });
    },
    editMessage: async (targetMessageId: string, text: string) => {
      await ctx.api.editMessageText(
        telegramChatId,
        Number.parseInt(String(targetMessageId), 10),
        text,
      );
    },
  };
}

export async function resolveWorkspaceCommandInput(
  runtime: BotGatewaySupportRuntime,
  rawText: string,
  parsed: ParsedCommand,
): Promise<{ rawText: string; parsed: ParsedCommand } | null> {
  if (parsed.command_type !== 'unknown' || !rawText.trim().startsWith('/')) {
    return null;
  }

  const commandToken = parseTelegramCommand(rawText);
  if (!commandToken) {
    return null;
  }

  const commandName = String(commandToken.commandType || '')
    .replace(/^\//, '')
    .trim()
    .toLowerCase();
  if (!commandName) {
    return null;
  }

  const workspace = WorkspaceResolver.resolve(config.defaultWorkspace);
  const profile = await runtime.workspaceProfileService.getProfile(workspace);
  if (!profile) {
    return null;
  }

  const resolved = runtime.workspaceCommandService.resolveInvocation(
    profile,
    commandName,
    parsed.command_args,
  );
  if (!resolved) {
    return null;
  }

  const nextParsed = runtime.parser.parse(resolved.resolvedText);
  nextParsed.workspace_command_name = resolved.name;
  return {
    rawText: resolved.resolvedText,
    parsed: nextParsed,
  };
}

export async function recordIncomingMessageTelemetry(
  runtime: BotGatewaySupportRuntime,
  chatId: string,
  userId: string,
  text: string,
  chatType: string,
): Promise<void> {
  try {
    await runtime.telemetryRuntime.record({
      traceId: `telegram:${chatId || 'unknown'}:${Date.now()}`,
      source: 'bot-gateway',
      eventType: 'telegram.message_received',
      status: 'received',
      payload: {
        chatId,
        userId,
        chatType,
        commandPreview: String(text || '').trim().slice(0, 120),
        isCommand: String(text || '').trim().startsWith('/'),
      },
    });
  } catch (error: unknown) {// telemetry should not block message handling
      logger.warn('[Bot way Message Processing] lifecycle operation failed', error);
    }
}
