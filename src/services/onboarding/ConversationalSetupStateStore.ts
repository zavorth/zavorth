import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { ZavorthConversationalSetupInput } from '../ZavorthConversationalSetupService.js';

export type ConversationalSetupDraft = {
  schemaVersion: 1;
  sessionIdHash: string;
  answers: ZavorthConversationalSetupInput;
  locale: string;
  confirmationTokenHash: string;
  createdAt: string;
  expiresAt: string;
};

export type ConversationalSetupStateStoreRuntime = {
  projectRoot?: string;
  now?: () => Date;
  ttlMs?: number;
};

export class ConversationalSetupStateStore {
  private readonly stateDir: string;
  private readonly now: () => Date;
  private readonly ttlMs: number;

  constructor(runtime: ConversationalSetupStateStoreRuntime = {}) {
    this.stateDir = path.join(runtime.projectRoot || process.cwd(), '.zavorth', 'onboarding');
    this.now = runtime.now || (() => new Date());
    this.ttlMs = runtime.ttlMs || 24 * 60 * 60 * 1000;
  }

  public savePreview(sessionId: string, answers: ZavorthConversationalSetupInput, locale: string): {
    draft: ConversationalSetupDraft;
    confirmationToken: string;
  } {
    const confirmationToken = crypto.randomBytes(32).toString('base64url');
    const createdAt = this.now();
    const draft: ConversationalSetupDraft = {
      schemaVersion: 1,
      sessionIdHash: hash(sessionId),
      answers,
      locale,
      confirmationTokenHash: hash(confirmationToken),
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + this.ttlMs).toISOString(),
    };
    this.write(sessionId, draft);
    return { draft, confirmationToken };
  }

  public read(sessionId: string): ConversationalSetupDraft | null {
    const file = this.fileFor(sessionId);
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as ConversationalSetupDraft;
      if (parsed.schemaVersion !== 1 || parsed.sessionIdHash !== hash(sessionId)) {
        return null;
      }
      if (Date.parse(parsed.expiresAt) <= this.now().getTime()) {
        this.remove(sessionId);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  public consumeConfirmed(sessionId: string, confirmationToken: string): ConversationalSetupDraft | null {
    const draft = this.read(sessionId);
    if (!draft || !safeHashEquals(draft.confirmationTokenHash, hash(confirmationToken))) {
      return null;
    }
    this.remove(sessionId);
    return draft;
  }

  public remove(sessionId: string): void {
    try {
      fs.rmSync(this.fileFor(sessionId), { force: true });
    } catch {
      // A missing or concurrently consumed preview is already removed.
    }
  }

  private write(sessionId: string, draft: ConversationalSetupDraft): void {
    fs.mkdirSync(this.stateDir, { recursive: true });
    const file = this.fileFor(sessionId);
    const temporary = `${file}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(draft, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporary, file);
  }

  private fileFor(sessionId: string): string {
    return path.join(this.stateDir, `${hash(sessionId)}.json`);
  }
}

function hash(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function safeHashEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
