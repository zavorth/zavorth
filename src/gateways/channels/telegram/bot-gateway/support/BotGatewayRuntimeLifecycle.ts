import { Context, type Api } from 'grammy';
import { config } from '../../../../../config/index.js';
import { SmartOutputService } from '../../../../../services/SmartOutputService.js';
import { WorkspaceResolver } from '../../../../../security/WorkspaceResolver.js';
import { TelegramGatewayHandlerRegistrar } from '../../../../../gateways/channels/telegram/TelegramGatewayHandlerRegistrar.js';
import type {
  BotGatewaySupportHandlerCallbacks,
  BotGatewaySupportRuntime,
} from '../../../../../gateways/channels/telegram/bot-gateway/BotGatewaySupportTypes.js';
import {
  EXTERNAL_EXECUTOR_LABEL,
  getRuntimeAdapterRoleFromMetadata,
} from '../../../../../gateways/channels/telegram/ExternalExecutorIdentity.js';
import { asErrorLike } from '../../../../../utils/errorLike.js';

interface TelegramApi {
  sendMessage(
    chatId: string | number,
    text: string,
    options?: Record<string, unknown>,
  ): Promise<unknown>;
  sendDocument?(
    chatId: string | number,
    document: unknown,
    options?: Record<string, unknown>,
  ): Promise<unknown>;
}

export function resolveBroadcastRecipients(
  roles: string[] = ['admin'],
): string[] {
  const requestedRoles = new Set(
    (roles || [])
      .map((role) => String(role || '').trim().toLowerCase())
      .filter(Boolean),
  );

  if (requestedRoles.size === 0) {
    return [...config.allowedUserIds];
  }

  return config.allowedUserIds.filter((userId) => {
    const assignedRoles = config.telegramUserRoles[userId] || ['admin'];
    return assignedRoles.some((role) =>
      requestedRoles.has(String(role).toLowerCase()),
    );
  });
}

export async function broadcast(
  runtime: BotGatewaySupportRuntime,
  message: string,
  roles: string[] = ['admin'],
): Promise<void> {
  const recipients = resolveBroadcastRecipients(roles);

  for (const userId of recipients) {
    try {
      await SmartOutputService.send(runtime.bot.api as TelegramApi, userId, message);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message_ = error instanceof Error ? err.message : String(error);
      runtime.logRepo.log(
        'error',
        'BotGateway',
        `Error sending broadcast: ${message_}`,
      );
    }
  }
}

export async function sendToChat(
  runtime: BotGatewaySupportRuntime,
  chatId: string,
  message: string,
): Promise<void> {
  try {
    await SmartOutputService.send(runtime.bot.api as TelegramApi, chatId, message);
  } catch (error: unknown) {
    const err = asErrorLike(error);
    const message_ = error instanceof Error ? err.message : String(error);
    runtime.logRepo.log(
      'error',
      'BotGateway',
      `Error sending direct message to ${chatId}: ${message_}`,
    );
    throw error;
  }
}

export async function startZavorthControlSurface(
  runtime: BotGatewaySupportRuntime,
): Promise<void> {
  if (runtime.state.zavorthControlSurfaceStarted) {
    return;
  }

  try {
    await runtime.zavorthControlService.start();
    runtime.state.zavorthControlSurfaceStarted = true;
    runtime.logRepo.log(
      'info',
      'ZavorthControlService',
      `ZavorthControl web online at ${runtime.zavorthControlService.getUrl()}`,
    );
  } catch (error: unknown) {
    const err = asErrorLike(error);
    const errMsg = error instanceof Error ? err.message : String(error);
    runtime.logRepo.log(
      'error',
      'ZavorthControlService',
      `Failed to start zavorthControl web: ${errMsg || error}`,
    );
    throw error;
  }
}

export async function flushPendingSupervisedNotifications(
  runtime: BotGatewaySupportRuntime,
): Promise<void> {
  if (runtime.state.supervisedRuntimeNotificationFlushInFlight) {
    return;
  }

  runtime.state.supervisedRuntimeNotificationFlushInFlight = true;
  try {
    const pendingNotificationResult =
      await runtime.supervisedRuntimeNotificationService.flushPending(
        (chatId, message) => {
          return new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(
                new Error(
                  'Timeout sending pending notification during supervised startup.',
                ),
              );
            }, 15_000);

            sendToChat(runtime, chatId, message)
              .then(() => {
                clearTimeout(timeout);
                resolve();
              })
              .catch((error) => {
                clearTimeout(timeout);
                reject(error);
              });
          });
        },
      );

    if (pendingNotificationResult.delivered) {
      runtime.logRepo.log(
        'info',
        'BotGateway',
        `Supervised startup notification sent to ${pendingNotificationResult.notification?.chatId}.`,
      );
    } else if (!pendingNotificationResult.skipped) {
      runtime.logRepo.log(
        'warn',
        'BotGateway',
        `Failed to deliver pending supervised startup notification: ${pendingNotificationResult.error || 'unknown error'}`,
      );
    }
  } finally {
    runtime.state.supervisedRuntimeNotificationFlushInFlight = false;
  }
}

export async function start(
  runtime: BotGatewaySupportRuntime,
): Promise<void> {
  const DndService = (await import('../../../../../services/DndService.js')).DndService;
  const { config } = await import('../../../../../config/index.js');
  const telegramLive = String(config.telegramBotToken || '').trim().length > 0;

  runtime.runtimeDiagnostics.start();
  if (runtime.runtimeProfileService.supportsAdvancedRuntime()) {
    runtime.researchQueueWorker.start();
    runtime.julesQueueWorker.start();
    runtime.capabilityLifecycleService.markCapabilityState(
      'remote',
      'active',
      'Research workers enabled by the full profile.',
    );
  }
  if (runtime.capabilityLifecycleService.shouldBootCapability('daily-report')) {
    runtime.dailyReportService.start((message, roles) =>
      broadcast(runtime, message, roles),
    );
    runtime.capabilityLifecycleService.markCapabilityState(
      'daily-report',
      'active',
      'Daily report initialized on gateway boot.',
    );
  } else {
    runtime.capabilityLifecycleService.markCapabilityState(
      'daily-report',
      'dormant',
      `Profile ${runtime.runtimeProfileService.getProfile()} kept the daily report in manual mode.`,
    );
  }
  await startZavorthControlSurface(runtime);
  if (!telegramLive) {
    runtime.logRepo.log(
      'info',
      'BotGateway',
      'Telegram polling skipped — TELEGRAM_BOT_TOKEN is not configured. Control surface remains available.',
    );
    return;
  }
  DndService.startWatcher(runtime.bot.api);
  await runtime.lifecycleController.start(runtime.bot);
  await flushPendingSupervisedNotifications(runtime);
  if (!runtime.state.supervisedRuntimeNotificationTimer) {
    runtime.state.supervisedRuntimeNotificationTimer = setInterval(() => {
      void flushPendingSupervisedNotifications(runtime);
    }, 15_000);
  }
}

export function resolveRuntimeAdapterRole(task: unknown): string {
  const metadata = readMetadataRecord(task);
  return getRuntimeAdapterRoleFromMetadata(metadata);
}

export function resolveApprovedExternalAccessPath(result: unknown): string {
  const metadata = readMetadataRecord(result);
  const rawCandidates = [
    metadata.requested_access_path_windows,
    metadata.requested_access_path_raw,
    metadata.requested_access_path_wsl,
  ];

  for (const candidate of rawCandidates) {
    const normalized = normalizeExternalRequestedPath(candidate);
    if (!normalized) {
      continue;
    }

    return WorkspaceResolver.validate(normalized);
  }

  throw new Error(
    `The ${EXTERNAL_EXECUTOR_LABEL} requested additional access but did not provide a local path that is valid and approved by Zavorth.`,
  );
}

function readMetadataRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const metadata = (value as { metadata?: unknown }).metadata;
  return metadata && typeof metadata === 'object'
    ? metadata as Record<string, unknown>
    : {};
}

export function normalizeExternalRequestedPath(candidate: unknown): string | null {
  const trimmed = String(candidate || '').trim();
  if (!trimmed) {
    return null;
  }

  const wslMatch = trimmed.match(/^\/mnt\/([a-z])\/(.*)$/i);
  if (wslMatch) {
    return `${wslMatch[1].toUpperCase()}:/${String(wslMatch[2] || '').replace(/\\/g, '/')}`;
  }

  if (/^[A-Za-z]:[\\/]/.test(trimmed)) {
    return trimmed.replace(/\\/g, '/');
  }

  return null;
}

export function toWslPath(targetPath: string): string {
  const normalized = String(targetPath || '').replace(/\\/g, '/');
  const driveMatch = normalized.match(/^([A-Za-z]):\/(.*)$/);
  if (!driveMatch) {
    return normalized;
  }

  return `/mnt/${driveMatch[1].toLowerCase()}/${driveMatch[2]}`;
}

export function getTelegramGatewayHandlerRegistrar(
  runtime: BotGatewaySupportRuntime,
  callbacks: BotGatewaySupportHandlerCallbacks,
): TelegramGatewayHandlerRegistrar {
  if (!runtime.state.telegramGatewayHandlerRegistrar) {
    runtime.state.telegramGatewayHandlerRegistrar =
      new TelegramGatewayHandlerRegistrar({
        bot: runtime.bot,
        logRepo: runtime.logRepo,
        chatCleanup: runtime.chatCleanup,
        groupEventController: runtime.groupEventController,
        mediaController: runtime.mediaController,
        callbackController: runtime.callbackController,
        permissionReactionHandler: (runtime as any).permissionController
          ? {
              handleMessageReaction: (ctx: Context) =>
                (runtime as any).permissionController.handleMessageReaction(ctx),
            }
          : null,
        hostIdentityService: runtime.hostIdentityService,
        telegramChannelContractService: runtime.telegramChannelContractService,
        processTextMessage: callbacks.processTextMessage,
        processGroupCommand: callbacks.processGroupCommand,
        canUseInteractiveGroupAi: callbacks.canUseInteractiveGroupAi,
      });
  }

  return runtime.state.telegramGatewayHandlerRegistrar;
}
