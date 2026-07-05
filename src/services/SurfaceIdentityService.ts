import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type { MessageChannel } from '../contracts/PlatformContract.js';
import { logger } from '../logger.js';

type SurfaceIdentityState = {
  links: Record<string, string | SurfaceIdentityLinkRecord>;
};

export type SurfaceIdentityLinkRecord = {
  principalId: string;
  source: string;
  sourceUserId: string;
  linkedAt: string;
  linkedBy: string | null;
  verificationMethod: string | null;
  status: 'active' | 'revoked';
  chatId: string | null;
  sessionId: string | null;
};

type SurfaceIdentityOptions = {
  filePath?: string;
  now?: () => Date;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
  allowedTelegramUserIds?: string[];
};

export class SurfaceIdentityService {
  private readonly filePath: string;
  private readonly now: () => Date;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly allowedTelegramUserIds: string[];

  constructor(options: SurfaceIdentityOptions = {}) {
    this.filePath = options.filePath || config.surfaceIdentityStateFile;
    this.now = options.now || (() => new Date());
    this.existsSync = options.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = options.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = options.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSync = options.mkdirSync || fs.mkdirSync.bind(fs);
    this.allowedTelegramUserIds = options.allowedTelegramUserIds || config.allowedUserIds;
  }

  public resolveRuntimeUserId(input: {
    source: MessageChannel | string;
    sourceUserId: string;
    fallbackRuntimeUserId?: string | null;
  }): string {
    const source = this.normalizeSource(input.source);
    const sourceUserId = String(input.sourceUserId || '').trim();
    const fallbackRuntimeUserId = String(input.fallbackRuntimeUserId || '').trim();
    const key = this.buildIdentityKey(source, sourceUserId);
    const linked = this.readState().links[key];
    if (linked) {
      return this.readPrincipalId(linked);
    }

    if (fallbackRuntimeUserId) {
      return fallbackRuntimeUserId;
    }

    if (source === 'web' && this.allowedTelegramUserIds.length === 1) {
      return this.allowedTelegramUserIds[0];
    }

    return sourceUserId || key;
  }

  public linkIdentity(input: {
    source: MessageChannel | string;
    sourceUserId: string;
    runtimeUserId: string;
    linkedBy?: string | null;
    verificationMethod?: string | null;
    chatId?: string | null;
    sessionId?: string | null;
    status?: 'active' | 'revoked';
  }): void {
    const source = this.normalizeSource(input.source);
    const sourceUserId = String(input.sourceUserId || '').trim();
    const runtimeUserId = String(input.runtimeUserId || '').trim();
    if (!source || !sourceUserId || !runtimeUserId) {
      return;
    }

    const state = this.readState();
    state.links[this.buildIdentityKey(source, sourceUserId)] = {
      principalId: runtimeUserId,
      source,
      sourceUserId,
      linkedAt: this.now().toISOString(),
      linkedBy: String(input.linkedBy || '').trim() || null,
      verificationMethod: String(input.verificationMethod || '').trim() || null,
      status: input.status || 'active',
      chatId: String(input.chatId || '').trim() || null,
      sessionId: String(input.sessionId || '').trim() || null,
    };
    this.writeState(state);
  }

  public listLinkedSurfaces(principalId: string): Array<{ source: string; sourceUserId: string; linkedAt: string }> {
    const normalizedPrincipalId = String(principalId || '').trim();
    if (!normalizedPrincipalId) {
      return [];
    }

    return Object.entries(this.readState().links)
      .map(([key, value]) => this.normalizeLinkRecord(key, value))
      .filter((record) => record && record.principalId === normalizedPrincipalId && record.status === 'active')
      .map((record) => {
        return {
          source: record!.source,
          sourceUserId: record!.sourceUserId,
          linkedAt: record!.linkedAt,
        };
      });
  }

  public listPrincipalUserIds(principalId: string): string[] {
    const normalizedPrincipalId = String(principalId || '').trim();
    if (!normalizedPrincipalId) {
      return [];
    }

    const userIds = new Set<string>([normalizedPrincipalId]);
    for (const [key, value] of Object.entries(this.readState().links)) {
      const record = this.normalizeLinkRecord(key, value);
      if (!record || record.principalId !== normalizedPrincipalId || record.status !== 'active') {
        continue;
      }
      userIds.add(record.sourceUserId);
    }
    return Array.from(userIds);
  }

  private readPrincipalId(link: string | SurfaceIdentityLinkRecord): string {
    if (typeof link === 'string') {
      return link;
    }
    return String(link.principalId || '').trim();
  }

  private normalizeLinkRecord(key: string, link: string | SurfaceIdentityLinkRecord): SurfaceIdentityLinkRecord | null {
    if (typeof link === 'string') {
      const [source, ...rest] = String(key || '').split(':');
      return {
        principalId: String(link || '').trim(),
        source: String(source || '').trim() || 'unknown',
        sourceUserId: rest.join(':'),
        linkedAt: this.now().toISOString(),
        linkedBy: null,
        verificationMethod: null,
        status: 'active',
        chatId: null,
        sessionId: null,
      };
    }

    const principalId = String(link.principalId || '').trim();
    const source = String(link.source || '').trim();
    const sourceUserId = String(link.sourceUserId || '').trim();
    if (!principalId || !source || !sourceUserId) {
      return null;
    }

    return {
      principalId,
      source,
      sourceUserId,
      linkedAt: String(link.linkedAt || this.now().toISOString()).trim(),
      linkedBy: String(link.linkedBy || '').trim() || null,
      verificationMethod: String(link.verificationMethod || '').trim() || null,
      status: link.status === 'revoked' ? 'revoked' : 'active',
      chatId: String(link.chatId || '').trim() || null,
      sessionId: String(link.sessionId || '').trim() || null,
    };
  }

  private buildIdentityKey(source: string, sourceUserId: string): string {
    return `${source}:${sourceUserId}`;
  }

  private normalizeSource(source: string): string {
    return String(source || '').trim().toLowerCase() || 'unknown';
  }

  private readState(): SurfaceIdentityState {
    if (!this.existsSync(this.filePath)) {
      return { links: {} };
    }

    try {
      const parsed = JSON.parse(this.readFileSync(this.filePath, 'utf8')) as Partial<SurfaceIdentityState>;
      return {
        links: parsed.links && typeof parsed.links === 'object' ? parsed.links : {},
      };
    } catch (error) {
    logger.warn('[Surface Identity] JSON parse failed', error);
    return { links: {} };
  }
  }

  private writeState(state: SurfaceIdentityState): void {
    this.mkdirSync(path.dirname(this.filePath), { recursive: true });
    this.writeFileSync(this.filePath, JSON.stringify(state, null, 2), 'utf8');
  }
}
