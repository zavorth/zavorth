import fs from 'fs';
import path from 'path';

import type { DiscordSurfacePolicyService } from '../../../../services/DiscordSurfacePolicyService.js';
import { rememberDiscordRecentChannel } from '../DiscordGatewayMessageHelpers.js';
import { logger } from '../../../../logger';
import type {
DiscordGatewayRecentChannel,
  DiscordGatewayState,
  DiscordGatewayStatusSnapshot,
} from '../DiscordGatewayTypes.js';

type DiscordGatewayLogLevel = 'info' | 'warn' | 'error';

type DiscordGatewayPersistenceOptions = {
  enabled: boolean;
  allowDirectMessages: boolean;
  allowedGuildIds: string[];
  stateFilePath: string;
  statusFilePath: string;
  runtimeDir: string;
  now: () => Date;
  getStarted: () => boolean;
  discordSurfacePolicyService: DiscordSurfacePolicyService;
  log?: (level: DiscordGatewayLogLevel, message: string) => void;
};

const createEmptyState = (): DiscordGatewayState => ({
  startedAt: null,
  processedCount: 0,
  rejectedCount: 0,
  lastInboundAt: null,
  lastOutboundAt: null,
  lastRejectedAt: null,
  lastError: null,
  recentChannels: [],
});

export class DiscordGatewayPersistence {
  private readonly enabled: boolean;
  private readonly allowDirectMessages: boolean;
  private readonly allowedGuildIds: string[];
  private readonly stateFilePath: string;
  private readonly statusFilePath: string;
  private readonly runtimeDir: string;
  private readonly now: () => Date;
  private readonly getStarted: () => boolean;
  private readonly discordSurfacePolicyService: DiscordSurfacePolicyService;
  private readonly log?: (level: DiscordGatewayLogLevel, message: string) => void;

  constructor(options: DiscordGatewayPersistenceOptions) {
    this.enabled = options.enabled;
    this.allowDirectMessages = options.allowDirectMessages;
    this.allowedGuildIds = [...options.allowedGuildIds];
    this.stateFilePath = options.stateFilePath;
    this.statusFilePath = options.statusFilePath;
    this.runtimeDir = options.runtimeDir;
    this.now = options.now;
    this.getStarted = options.getStarted;
    this.discordSurfacePolicyService = options.discordSurfacePolicyService;
    this.log = options.log;
  }

  public ensureRuntimeDirs(): void {
    fs.mkdirSync(this.runtimeDir, { recursive: true });
    fs.mkdirSync(path.dirname(this.statusFilePath), { recursive: true });
  }

  public readStatus(): DiscordGatewayStatusSnapshot | null {
    if (!fs.existsSync(this.statusFilePath)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(this.statusFilePath, 'utf8')) as DiscordGatewayStatusSnapshot;
    } catch (error: any) { const err = error; const e = error; logger.warn('[Discord way Persistence] JSON parse failed', error); return null; }
  }

  public readState(): DiscordGatewayState {
    if (!fs.existsSync(this.stateFilePath)) {
      return createEmptyState();
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(this.stateFilePath, 'utf8')) as Partial<DiscordGatewayState>;
      return {
        startedAt: typeof parsed.startedAt === 'string' ? parsed.startedAt : null,
        processedCount: Number(parsed.processedCount || 0) || 0,
        rejectedCount: Number(parsed.rejectedCount || 0) || 0,
        lastInboundAt: typeof parsed.lastInboundAt === 'string' ? parsed.lastInboundAt : null,
        lastOutboundAt: typeof parsed.lastOutboundAt === 'string' ? parsed.lastOutboundAt : null,
        lastRejectedAt: typeof parsed.lastRejectedAt === 'string' ? parsed.lastRejectedAt : null,
        lastError: typeof parsed.lastError === 'string' ? parsed.lastError : null,
        recentChannels: Array.isArray(parsed.recentChannels)
          ? parsed.recentChannels
            .map((entry) => ({
              channelId: String((entry as DiscordGatewayRecentChannel)?.channelId || '').trim(),
              guildId: String((entry as DiscordGatewayRecentChannel)?.guildId || '').trim() || null,
              authorId: String((entry as DiscordGatewayRecentChannel)?.authorId || '').trim() || null,
              isDirectMessage: (entry as DiscordGatewayRecentChannel)?.isDirectMessage === true,
              observedAt:
                String((entry as DiscordGatewayRecentChannel)?.observedAt || '').trim() ||
                this.now().toISOString(),
            }))
            .filter((entry) => entry.channelId)
          : [],
      };
    } catch (error: any) { const err = error; const e = error;
    logger.warn('[Discord way Persistence] array operation failed', error);
    return createEmptyState();
  }
  }

  public patchState(updater: (state: DiscordGatewayState) => DiscordGatewayState): DiscordGatewayState {
    const next = updater(this.readState());
    this.ensureRuntimeDirs();
    fs.writeFileSync(this.stateFilePath, JSON.stringify(next, null, 2), 'utf8');
    return next;
  }

  public markReady(): void {
    this.patchState((state) => ({
      ...state,
      startedAt: state.startedAt || this.now().toISOString(),
      lastError: null,
    }));
    this.writeStatus();
  }

  public markProcessedInbound(input: {
    channelId: string;
    guildId: string | null;
    authorId: string;
    isDirectMessage: boolean;
  }): void {
    this.patchState((state) => ({
      ...state,
      processedCount: state.processedCount + 1,
      lastInboundAt: this.now().toISOString(),
      lastError: null,
      recentChannels: rememberDiscordRecentChannel(
        state.recentChannels,
        input.channelId,
        input.guildId,
        input.authorId,
        input.isDirectMessage,
        this.now,
      ),
    }));
    this.writeStatus();
  }

  public markRejected(reason: string): void {
    this.patchState((state) => ({
      ...state,
      rejectedCount: state.rejectedCount + 1,
      lastRejectedAt: this.now().toISOString(),
      lastError: reason,
    }));
    this.writeStatus();
  }

  public markOutbound(): void {
    this.patchState((state) => ({
      ...state,
      lastOutboundAt: this.now().toISOString(),
      lastError: null,
    }));
    this.writeStatus();
  }

  public resolveBroadcastRecipients(roles: string[] = []): string[] {
    const normalizedRoles = Array.from(
      new Set(
        (roles || [])
          .map((role) => String(role || '').trim().toLowerCase())
          .filter(Boolean),
      ),
    );
    if (normalizedRoles.length > 0 && !normalizedRoles.some((role) => ['admin', 'operator'].includes(role))) {
      return [];
    }

    const recentChannels = this.readState().recentChannels;

    if (this.discordSurfacePolicyService.isPublicServerMode()) {
      return Array.from(
        new Set(
          recentChannels
            .filter(
              (entry) =>
                entry.isDirectMessage &&
                entry.authorId &&
                this.discordSurfacePolicyService.isOwner(entry.authorId),
            )
            .map((entry) => entry.channelId)
            .filter(Boolean),
        ),
      );
    }

    return Array.from(new Set(recentChannels.map((entry) => entry.channelId).filter(Boolean)));
  }

  public writeStatus(): DiscordGatewayStatusSnapshot {
    const state = this.readState();
    const snapshot: DiscordGatewayStatusSnapshot = {
      mode: 'native',
      enabled: this.enabled,
      started: this.getStarted(),
      startedAt: state.startedAt,
      updatedAt: this.now().toISOString(),
      allowDirectMessages: this.allowDirectMessages,
      allowedGuildIds: [...this.allowedGuildIds],
      allowedChannelIds: this.discordSurfacePolicyService.getAllowedChannelIds(),
      commandExposure: this.discordSurfacePolicyService.getCommandExposure(),
      publicServerMode: this.discordSurfacePolicyService.isPublicServerMode(),
      pendingInbox: 0,
      pendingOutbox: 0,
      processedCount: state.processedCount,
      rejectedCount: state.rejectedCount,
      lastInboundAt: state.lastInboundAt,
      lastOutboundAt: state.lastOutboundAt,
      lastRejectedAt: state.lastRejectedAt,
      lastError: state.lastError,
      recentChannelCount: state.recentChannels.length,
    };

    this.ensureRuntimeDirs();
    fs.writeFileSync(this.statusFilePath, JSON.stringify(snapshot, null, 2), 'utf8');
    return snapshot;
  }

  public recordError(message: string): void {
    this.patchState((state) => ({
      ...state,
      lastError: message,
      lastRejectedAt: this.now().toISOString(),
    }));
    this.writeStatus();
    this.log?.('error', message);
  }
}
