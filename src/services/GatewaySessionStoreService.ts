import { randomUUID } from 'crypto';
import type { MessageChannel } from '../contracts/PlatformContract.js';
import { SurfaceIdentityService } from './SurfaceIdentityService.js';

type GatewaySessionStoreRuntime = {
  surfaceIdentityService?: SurfaceIdentityService;
  createWebSession?: (() => string) | null;
};

export type GatewayCanonicalSessionTarget = {
  platform: string;
  chatId: string;
  sessionId: string | null;
  runtimeUserId: string;
  sourceUserId: string;
  label: string;
};

export type GatewaySessionSpawnSnapshot = {
  ok: boolean;
  platform: string;
  sessionId: string | null;
  chatId: string | null;
  sourceUserId: string | null;
  runtimeUserId: string;
  handoffCommand: string;
};

export class GatewaySessionStoreService {
  private readonly surfaceIdentity: SurfaceIdentityService;
  private readonly createWebSession: (() => string) | null;

  constructor(runtime: GatewaySessionStoreRuntime = {}) {
    this.surfaceIdentity = runtime.surfaceIdentityService || new SurfaceIdentityService();
    this.createWebSession = runtime.createWebSession || null;
  }

  public resolveTarget(input: {
    userId?: string | null;
    fallbackRuntimeUserId?: string | null;
    platform?: MessageChannel | string | null;
    chatId?: string | null;
    sessionId?: string | null;
    sourceUserId?: string | null;
  }): GatewayCanonicalSessionTarget | null {
    const platform = this.resolvePlatform(input.platform, input.chatId, input.sessionId);
    if (!platform) {
      return null;
    }
    const sessionId = this.resolveSessionId(platform, input.chatId, input.sessionId);
    const chatId = this.resolveChatId(platform, input.chatId, sessionId);
    if (!chatId) {
      return null;
    }

    const sourceUserId = String(input.sourceUserId || '').trim() || sessionId || this.deriveSourceUserId(chatId);
    const explicitRuntimeUserId = String(input.userId || '').trim();
    const runtimeUserId =
      explicitRuntimeUserId ||
      this.surfaceIdentity.resolveRuntimeUserId({
        source: platform,
        sourceUserId,
        fallbackRuntimeUserId: input.fallbackRuntimeUserId || sourceUserId,
      });

    return {
      platform,
      chatId,
      sessionId,
      runtimeUserId,
      sourceUserId,
      label: this.buildLabel(platform, chatId, sessionId),
    };
  }

  public createSession(input: {
    userId: string;
    platform?: MessageChannel | string | null;
  }): GatewaySessionSpawnSnapshot {
    const runtimeUserId = String(input.userId || '').trim();
    const platform = this.resolvePlatform(input.platform, null, null) || 'web';
    if (!runtimeUserId) {
      throw new Error('Gateway session spawn requer userId.');
    }

    if (platform === 'web' && this.createWebSession) {
      const sessionId = this.createWebSession();
      return {
        ok: true,
        platform,
        sessionId,
        chatId: this.resolveChatId(platform, null, sessionId),
        sourceUserId: sessionId,
        runtimeUserId,
        handoffCommand: `/open-session ${sessionId}`,
      };
    }

    const syntheticSessionId = randomUUID();
    return {
      ok: false,
      platform,
      sessionId: null,
      chatId: null,
      sourceUserId: null,
      runtimeUserId,
      handoffCommand: `/task continuar sessao ${syntheticSessionId} em ${platform}`,
    };
  }

  public canSpawn(platform?: MessageChannel | string | null): boolean {
    const normalized = this.resolvePlatform(platform, null, null) || 'web';
    return normalized === 'web' && Boolean(this.createWebSession);
  }

  private resolvePlatform(
    platform?: MessageChannel | string | null,
    chatId?: string | null,
    sessionId?: string | null,
  ): string | null {
    const explicit = String(platform || '').trim().toLowerCase();
    if (explicit) {
      return explicit;
    }

    const normalizedChatId = String(chatId || '').trim().toLowerCase();
    if (normalizedChatId.includes(':')) {
      return normalizedChatId.split(':')[0] || null;
    }

    return String(sessionId || '').trim() ? 'web' : null;
  }

  private resolveSessionId(platform: string, chatId?: string | null, sessionId?: string | null): string | null {
    const explicit = String(sessionId || '').trim();
    if (explicit) {
      return explicit;
    }

    const normalizedChatId = String(chatId || '').trim();
    if (platform === 'web' && normalizedChatId.startsWith('web:')) {
      return normalizedChatId.substring(4) || null;
    }

    return null;
  }

  private resolveChatId(platform: string, chatId?: string | null, sessionId?: string | null): string {
    const explicit = String(chatId || '').trim();
    if (explicit) {
      return explicit;
    }
    if (sessionId) {
      return `${platform}:${sessionId}`;
    }
    return '';
  }

  private deriveSourceUserId(chatId: string): string {
    const normalized = String(chatId || '').trim();
    const parts = normalized.split(':');
    return parts.length > 1 ? parts.slice(1).join(':') : normalized;
  }

  private buildLabel(platform: string, chatId: string, sessionId: string | null): string {
    if (sessionId) {
      return `${platform}:${sessionId}`;
    }
    return `${platform}:${chatId}`;
  }
}
