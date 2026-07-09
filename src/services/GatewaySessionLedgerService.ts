import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type { WebComposerMention } from '../contracts/WebComposer.js';
import { logger } from '../logger.js';

export type GatewaySessionLedgerTarget = {
  platform?: string | null;
  chatId?: string | null;
  sessionId?: string | null;
  runtimeUserId?: string | null;
  sourceUserId?: string | null;
};

export type GatewaySessionTranscriptEntry = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  taskId?: string | null;
  kind?: string | null;
  mentions?: WebComposerMention[];
  surface: string;
};

export type GatewaySessionLedgerSnapshot = {
  generatedAt: string;
  updatedAt: string;
  sessionId: string | null;
  chatId: string;
  platform: string;
  runtimeUserId: string | null;
  sourceUserId: string | null;
  headline: string | null;
  operatorSummary: string | null;
  latestTaskId: string | null;
  workflowRunIds: string[];
  filesTouched: string[];
  toolRunCount: number;
  artifactCount: number;
  pendingPermissions: number;
  transcriptCount: number;
  label?: string | null;
  workspaceHint?: string | null;
  pinned?: boolean;
  modelProfile?: string | null;
};

export type GatewaySessionLedgerMetadata = {
  label: string | null;
  workspaceHint: string | null;
  pinned: boolean;
  modelProfile: string | null;
  updatedAt: string | null;
};

type GatewaySessionLedgerRecord = {
  version: 1;
  generatedAt: string;
  updatedAt: string;
  target: {
    platform: string;
    chatId: string;
    sessionId: string | null;
    runtimeUserId: string | null;
    sourceUserId: string | null;
  };
  transcript: GatewaySessionTranscriptEntry[];
  snapshot: GatewaySessionLedgerSnapshot | null;
};

type GatewaySessionLedgerRuntime = {
  rootDir?: string;
  now?: () => Date;
  maxTranscriptEntries?: number;
};

export class GatewaySessionLedgerService {
  private readonly rootDir: string;
  private readonly now: () => Date;
  private readonly maxTranscriptEntries: number;

  constructor(runtime: GatewaySessionLedgerRuntime = {}) {
    this.rootDir = runtime.rootDir || config.gatewaySessionLedgerDir;
    this.now = runtime.now || (() => new Date());
    this.maxTranscriptEntries = Math.max(20, Number(runtime.maxTranscriptEntries || 200) || 200);
  }

  public readTranscriptSync(target: GatewaySessionLedgerTarget): GatewaySessionTranscriptEntry[] {
    return this.readRecordSync(target)?.transcript || [];
  }

  public readSnapshotSync(target: GatewaySessionLedgerTarget): GatewaySessionLedgerSnapshot | null {
    return this.readRecordSync(target)?.snapshot || null;
  }

  public readSessionMetadataSync(target: GatewaySessionLedgerTarget): GatewaySessionLedgerMetadata {
    const snapshot = this.readSnapshotSync(target);
    return {
      label: String(snapshot?.label || '').trim() || null,
      workspaceHint: String(snapshot?.workspaceHint || '').trim() || null,
      pinned: snapshot?.pinned === true,
      modelProfile: String(snapshot?.modelProfile || '').trim() || null,
      updatedAt: String(snapshot?.updatedAt || '').trim() || null,
    };
  }

  public appendMessage(
    target: GatewaySessionLedgerTarget,
    message: GatewaySessionTranscriptEntry,
  ): void {
    const resolved = this.normalizeTarget(target);
    if (!resolved) {
      return;
    }

    const record = this.readRecordSync(resolved) || this.createEmptyRecord(resolved);
    record.transcript.push(this.normalizeTranscriptEntry(message, resolved.platform));
    if (record.transcript.length > this.maxTranscriptEntries) {
      record.transcript.splice(0, record.transcript.length - this.maxTranscriptEntries);
    }
    record.updatedAt = this.now().toISOString();
    this.writeRecord(resolved, record);
  }

  public replaceTranscript(
    target: GatewaySessionLedgerTarget,
    transcript: GatewaySessionTranscriptEntry[],
  ): void {
    const resolved = this.normalizeTarget(target);
    if (!resolved) {
      return;
    }

    const record = this.readRecordSync(resolved) || this.createEmptyRecord(resolved);
    record.transcript = transcript
      .map((entry) => this.normalizeTranscriptEntry(entry, resolved.platform))
      .slice(-this.maxTranscriptEntries);
    record.updatedAt = this.now().toISOString();
    if (record.snapshot) {
      record.snapshot = {
        ...record.snapshot,
        updatedAt: record.updatedAt,
        transcriptCount: record.transcript.length,
      };
    }
    this.writeRecord(resolved, record);
  }

  public saveSnapshot(
    target: GatewaySessionLedgerTarget,
    snapshot: Omit<GatewaySessionLedgerSnapshot, 'updatedAt'>,
  ): void {
    const resolved = this.normalizeTarget(target);
    if (!resolved) {
      return;
    }

    const record = this.readRecordSync(resolved) || this.createEmptyRecord(resolved);
    const existingMetadata = this.readSessionMetadataSync(resolved);
    record.snapshot = {
      ...snapshot,
      updatedAt: this.now().toISOString(),
      chatId: resolved.chatId,
      sessionId: resolved.sessionId,
      platform: resolved.platform,
      runtimeUserId: resolved.runtimeUserId,
      sourceUserId: resolved.sourceUserId,
      filesTouched: Array.from(new Set(Array.isArray(snapshot.filesTouched) ? snapshot.filesTouched.filter(Boolean) : [])),
      workflowRunIds: Array.from(new Set(Array.isArray(snapshot.workflowRunIds) ? snapshot.workflowRunIds.filter(Boolean) : [])),
      label:
        String(snapshot.label || '').trim()
        || existingMetadata.label
        || null,
      workspaceHint:
        String(snapshot.workspaceHint || '').trim()
        || existingMetadata.workspaceHint
        || null,
      pinned: typeof snapshot.pinned === 'boolean' ? snapshot.pinned : existingMetadata.pinned,
      modelProfile:
        String(snapshot.modelProfile || '').trim()
        || existingMetadata.modelProfile
        || null,
    };
    record.updatedAt = record.snapshot.updatedAt;
    this.writeRecord(resolved, record);
  }

  public saveSessionMetadata(
    target: GatewaySessionLedgerTarget,
    metadata: Partial<Omit<GatewaySessionLedgerMetadata, 'updatedAt'>>,
  ): GatewaySessionLedgerMetadata {
    const resolved = this.normalizeTarget(target);
    if (!resolved) {
      return {
        label: null,
        workspaceHint: null,
        pinned: false,
        modelProfile: null,
        updatedAt: null,
      };
    }

    const record = this.readRecordSync(resolved) || this.createEmptyRecord(resolved);
    const now = this.now().toISOString();
    const previous = this.readSessionMetadataSync(resolved);
    const next: GatewaySessionLedgerMetadata = {
      label:
        metadata.label !== undefined
          ? String(metadata.label || '').trim() || null
          : previous.label,
      workspaceHint:
        metadata.workspaceHint !== undefined
          ? String(metadata.workspaceHint || '').trim() || null
          : previous.workspaceHint,
      pinned:
        metadata.pinned !== undefined
          ? metadata.pinned === true
          : previous.pinned,
      modelProfile:
        metadata.modelProfile !== undefined
          ? String(metadata.modelProfile || '').trim() || null
          : previous.modelProfile,
      updatedAt: now,
    };

    record.snapshot = {
      ...(record.snapshot || {
        generatedAt: now,
        updatedAt: now,
        sessionId: resolved.sessionId,
        chatId: resolved.chatId,
        platform: resolved.platform,
        runtimeUserId: resolved.runtimeUserId,
        sourceUserId: resolved.sourceUserId,
        headline: null,
        operatorSummary: null,
        latestTaskId: null,
        workflowRunIds: [],
        filesTouched: [],
        toolRunCount: 0,
        artifactCount: 0,
        pendingPermissions: 0,
        transcriptCount: record.transcript.length,
      }),
      updatedAt: now,
      label: next.label,
      workspaceHint: next.workspaceHint,
      pinned: next.pinned,
      modelProfile: next.modelProfile,
    };
    record.updatedAt = now;
    this.writeRecord(resolved, record);
    return next;
  }

  private readRecordSync(target: GatewaySessionLedgerTarget): GatewaySessionLedgerRecord | null {
    const resolved = this.normalizeTarget(target);
    if (!resolved) {
      return null;
    }

    const recordPath = this.resolveRecordPath(resolved);
    if (!fs.existsSync(recordPath)) {
      return null;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(recordPath, 'utf8')) as GatewaySessionLedgerRecord;
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.transcript)) {
        return null;
      }
      return parsed;
    } catch (error: unknown) {logger.warn('[way Session Ledger] JSON parse failed', error); return null; }
  }

  private writeRecord(target: ReturnType<GatewaySessionLedgerService['normalizeTarget']>, record: GatewaySessionLedgerRecord): void {
    if (!target) {
      return;
    }

    const recordPath = this.resolveRecordPath(target);
    fs.mkdirSync(path.dirname(recordPath), { recursive: true });
    fs.writeFileSync(recordPath, JSON.stringify(record, null, 2), 'utf8');
  }

  private createEmptyRecord(
    target: NonNullable<ReturnType<GatewaySessionLedgerService['normalizeTarget']>>,
  ): GatewaySessionLedgerRecord {
    const now = this.now().toISOString();
    return {
      version: 1,
      generatedAt: now,
      updatedAt: now,
      target: {
        platform: target.platform,
        chatId: target.chatId,
        sessionId: target.sessionId,
        runtimeUserId: target.runtimeUserId,
        sourceUserId: target.sourceUserId,
      },
      transcript: [],
      snapshot: null,
    };
  }

  private normalizeTarget(target: GatewaySessionLedgerTarget): {
    platform: string;
    chatId: string;
    sessionId: string | null;
    runtimeUserId: string | null;
    sourceUserId: string | null;
  } | null {
    const platform = String(target.platform || '').trim().toLowerCase();
    const chatId = String(target.chatId || '').trim();
    if (!platform || !chatId) {
      return null;
    }

    const sessionId = String(target.sessionId || '').trim() || null;
    const runtimeUserId = String(target.runtimeUserId || '').trim() || null;
    const sourceUserId = String(target.sourceUserId || '').trim() || sessionId || null;

    return {
      platform,
      chatId,
      sessionId,
      runtimeUserId,
      sourceUserId,
    };
  }

  private normalizeTranscriptEntry(
    entry: GatewaySessionTranscriptEntry,
    fallbackSurface: string,
  ): GatewaySessionTranscriptEntry {
    return {
      id: String(entry.id || '').trim(),
      role: entry.role,
      content: String(entry.content || '').trim(),
      createdAt: String(entry.createdAt || '').trim() || this.now().toISOString(),
      taskId: String(entry.taskId || '').trim() || null,
      kind: String(entry.kind || '').trim() || null,
      mentions: Array.isArray(entry.mentions) && entry.mentions.length > 0 ? entry.mentions : undefined,
      surface: String(entry.surface || '').trim() || fallbackSurface,
    };
  }

  private resolveRecordPath(
    target: NonNullable<ReturnType<GatewaySessionLedgerService['normalizeTarget']>>,
  ): string {
    const key = target.sessionId
      ? `session-${this.sanitizeFileSegment(target.sessionId)}`
      : `chat-${Buffer.from(target.chatId).toString('base64url')}`;
    return path.resolve(this.rootDir, target.platform, `${key}.json`);
  }

  private sanitizeFileSegment(value: string): string {
    return String(value || '')
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
