import {
  GatewaySessionService,
  type GatewaySessionListSummarySnapshot,
  type GatewaySessionListSnapshot,
  type GatewaySessionSnapshot,
} from '../runtime/sessions/GatewaySessionService.js';
import type { GatewaySessionLedgerMetadata } from './GatewaySessionLedgerService.js';
import {
  GatewaySessionStoreService,
  type GatewayCanonicalSessionTarget,
} from '../runtime/sessions/GatewaySessionStoreService.js';

type GatewaySessionReadModelRuntime = {
  sessionStoreService?: GatewaySessionStoreService;
};

export class GatewaySessionReadModelService {
  private readonly sessionStore: GatewaySessionStoreService;

  constructor(
    private readonly sessions: GatewaySessionService,
    runtime: GatewaySessionReadModelRuntime = {},
  ) {
    this.sessionStore = runtime.sessionStoreService || new GatewaySessionStoreService();
  }

  public resolveTarget(input: {
    userId?: string | null;
    fallbackRuntimeUserId?: string | null;
    platform?: string | null;
    chatId?: string | null;
    sessionId?: string | null;
    sourceUserId?: string | null;
  }): GatewayCanonicalSessionTarget | null {
    return this.sessionStore.resolveTarget(input);
  }

  public async buildSnapshot(input: {
    userId?: string | null;
    fallbackRuntimeUserId?: string | null;
    platform?: string | null;
    chatId?: string | null;
    sessionId?: string | null;
    sourceUserId?: string | null;
  }): Promise<GatewaySessionSnapshot | null> {
    const target = this.sessionStore.resolveTarget(input);
    if (!target) {
      return null;
    }

    return this.sessions.buildSessionSnapshot({
      userId: target.runtimeUserId,
      chatId: target.chatId,
      sessionId: target.sessionId,
      platform: target.platform,
      sourceUserId: target.sourceUserId,
    });
  }

  public buildSnapshotFast(input: {
    userId?: string | null;
    fallbackRuntimeUserId?: string | null;
    platform?: string | null;
    chatId?: string | null;
    sessionId?: string | null;
    sourceUserId?: string | null;
  }): GatewaySessionSnapshot | null {
    const target = this.sessionStore.resolveTarget(input);
    if (!target) {
      return null;
    }

    return this.sessions.buildSessionSnapshotFast({
      userId: target.runtimeUserId,
      chatId: target.chatId,
      sessionId: target.sessionId,
      platform: target.platform,
      sourceUserId: target.sourceUserId,
    });
  }

  public async listSessions(input: {
    userId: string;
    limit?: number;
  }): Promise<GatewaySessionListSnapshot> {
    return this.sessions.listSessions(input);
  }

  public listSessionsSummary(input: {
    userId: string;
    limit?: number;
  }): GatewaySessionListSummarySnapshot {
    return this.sessions.listSessionsSummary(input);
  }

  public readSessionMetadata(input: {
    userId?: string | null;
    fallbackRuntimeUserId?: string | null;
    platform?: string | null;
    chatId?: string | null;
    sessionId?: string | null;
    sourceUserId?: string | null;
  }): GatewaySessionLedgerMetadata | null {
    const target = this.sessionStore.resolveTarget(input);
    if (!target) {
      return null;
    }
    return this.sessions.readSessionMetadata({
      userId: target.runtimeUserId,
      chatId: target.chatId,
      sessionId: target.sessionId,
      platform: target.platform,
      sourceUserId: target.sourceUserId,
    });
  }

  public patchSessionMetadata(input: {
    userId?: string | null;
    fallbackRuntimeUserId?: string | null;
    platform?: string | null;
    chatId?: string | null;
    sessionId?: string | null;
    sourceUserId?: string | null;
    label?: string | null;
    workspaceHint?: string | null;
    pinned?: boolean;
    modelProfile?: string | null;
  }): GatewaySessionLedgerMetadata | null {
    const target = this.sessionStore.resolveTarget(input);
    if (!target) {
      return null;
    }
    return this.sessions.patchSessionMetadata({
      userId: target.runtimeUserId,
      chatId: target.chatId,
      sessionId: target.sessionId,
      platform: target.platform,
      sourceUserId: target.sourceUserId,
      label: input.label,
      workspaceHint: input.workspaceHint,
      pinned: input.pinned,
      modelProfile: input.modelProfile,
    });
  }
}
