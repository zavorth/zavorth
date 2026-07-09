import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { logger } from '../logger.js';
import type {
VoiceWakeCommandEvent,
  VoiceWakeDetectorSnapshot,
  VoiceWakeMode,
  VoiceWakeReceipt,
  VoiceWakeSession,
} from '../contracts/VoiceWakeContract.js';

type VoiceWakeRuntimeOptions = {
  stateFile: string;
  env?: Record<string, string | undefined>;
  now?: () => Date;
  sessionId?: string;
  defaultTtlSeconds?: number;
};

const RECEIPT_LIMIT = 50;

export class VoiceWakeRuntimeService {
  private readonly stateFile: string;
  private readonly env: Record<string, string | undefined>;
  private readonly now: () => Date;
  private readonly sessionId: string;
  private readonly defaultTtlSeconds: number;

  constructor(options: VoiceWakeRuntimeOptions) {
    this.stateFile = path.resolve(options.stateFile);
    this.env = options.env || process.env;
    this.now = options.now || (() => new Date());
    this.sessionId = options.sessionId || randomUUID();
    this.defaultTtlSeconds = Math.max(30, Number(options.defaultTtlSeconds || this.env.ZAVORTH_WAKE_TTL_SECONDS || 900));
  }

  public status(): VoiceWakeSession {
    const session = this.readSession();
    if (session.mode !== 'off' && session.armedUntil && Date.parse(session.armedUntil) <= this.now().getTime()) {
      const receipt = this.receipt('expired', 'Wake word TTL expired; microphone indicator is off.');
      return this.writeSession({
        ...session,
        mode: 'off',
        armedUntil: null,
        lastReceipt: receipt,
        receipts: this.appendReceipt(session.receipts, receipt),
      });
    }
    return session;
  }

  public arm(ttlMs?: number | null): VoiceWakeSession {
    const ttl = Math.max(30_000, Number(ttlMs || this.defaultTtlSeconds * 1000));
    const armedUntil = new Date(this.now().getTime() + ttl).toISOString();
    const current = this.readSession();
    const receipt = this.receipt('armed', `Wake word armed until ${armedUntil}.`);
    return this.writeSession({
      ...current,
      mode: 'armed',
      armedUntil,
      detector: this.detector(),
      lastReceipt: receipt,
      receipts: this.appendReceipt(current.receipts, receipt),
    });
  }

  public disarm(reason = 'Wake word disarmed by operator.'): VoiceWakeSession {
    const current = this.readSession();
    const receipt = this.receipt('disarmed', reason);
    return this.writeSession({
      ...current,
      mode: 'off',
      armedUntil: null,
      lastReceipt: receipt,
      receipts: this.appendReceipt(current.receipts, receipt),
    });
  }

  public handleEvent(event: VoiceWakeCommandEvent): VoiceWakeSession {
    const current = this.status();
    if (current.mode === 'off') {
      return current;
    }
    if (event.type === 'lock_screen' || event.type === 'sensitive_profile') {
      return this.disarm(event.type === 'lock_screen'
        ? 'Wake word disarmed because the screen was locked.'
        : 'Wake word disarmed because a sensitive profile became active.');
    }
    if (event.type === 'wake') {
      const receipt = this.receipt('wake_detected', 'Wake word detected locally.');
      const transcriptReceipt = event.transcript
        ? this.receipt('transcript_committed', 'Voice command transcript committed as receipt.', event.transcript)
        : null;
      return this.writeSession({
        ...current,
        mode: event.transcript ? 'cooldown' : 'listening',
        lastReceipt: transcriptReceipt || receipt,
        receipts: this.appendReceipt(
          this.appendReceipt(current.receipts, receipt),
          transcriptReceipt,
        ),
      });
    }
    if (event.type === 'capture_started') {
      const receipt = this.receipt('capture_started', 'Voice command capture started after local wake detection.');
      return this.writeSession({
        ...current,
        mode: 'capturing',
        lastReceipt: receipt,
        receipts: this.appendReceipt(current.receipts, receipt),
      });
    }
    if (event.type === 'transcript') {
      const receipt = this.receipt('transcript_committed', 'Voice command transcript committed as receipt.', event.transcript);
      return this.writeSession({
        ...current,
        mode: 'cooldown',
        lastReceipt: receipt,
        receipts: this.appendReceipt(current.receipts, receipt),
      });
    }
    const receipt = this.receipt('cooldown_started', 'Wake runtime entered cooldown.');
    return this.writeSession({
      ...current,
      mode: this.isStillArmed(current) ? 'armed' : 'off',
      armedUntil: this.isStillArmed(current) ? current.armedUntil : null,
      lastReceipt: receipt,
      receipts: this.appendReceipt(current.receipts, receipt),
    });
  }

  private readSession(): VoiceWakeSession {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.stateFile, 'utf8')) as VoiceWakeSession;
      return {
        ...this.defaultSession(),
        ...parsed,
        detector: this.detector(),
        privacy: this.defaultSession().privacy,
        safety: this.defaultSession().safety,
        receipts: Array.isArray(parsed.receipts) ? parsed.receipts.slice(-RECEIPT_LIMIT) : [],
      };
    } catch (error: unknown) {logger.warn('[Voice Wake Runtime] JSON parse failed', error);
    return this.defaultSession();
  }
  }

  private writeSession(session: VoiceWakeSession): VoiceWakeSession {
    fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
    fs.writeFileSync(this.stateFile, `${JSON.stringify(session, null, 2)}\n`, 'utf8');
    return session;
  }

  private defaultSession(): VoiceWakeSession {
    return {
      contractVersion: 'voice-wake/1',
      sessionId: this.sessionId,
      mode: 'off',
      armedUntil: null,
      detector: this.detector(),
      privacy: {
        localOnly: true,
        rawAudioPersisted: false,
        transcriptPersisted: 'receipt-only',
        visibleIndicatorRequired: true,
        ttlRequired: true,
        defaultTtlSeconds: this.defaultTtlSeconds,
      },
      lastReceipt: null,
      receipts: [],
      safety: {
        defaultOff: true,
        localWakeOnly: true,
        noRawAudioPersistence: true,
        autoDisarmOnTtl: true,
        visibleMicIndicator: true,
      },
    };
  }

  private detector(): VoiceWakeDetectorSnapshot {
    const command = String(this.env.ZAVORTH_WAKE_COMMAND || '').trim();
    const rawArgs = String(this.env.ZAVORTH_WAKE_ARGS || '').trim();
    const embedded = String(this.env.ZAVORTH_WAKE_EMBEDDED || '').trim() === '1';
    return {
      kind: command ? 'external-process' : embedded ? 'embedded-local' : 'disabled',
      configured: Boolean(command || embedded),
      command: command || null,
      args: rawArgs ? rawArgs.split(/\s+/u).filter(Boolean) : [],
    };
  }

  private receipt(event: VoiceWakeReceipt['event'], summary: string, transcript?: string | null): VoiceWakeReceipt {
    return {
      id: `voice-wake-${randomUUID()}`,
      createdAt: this.now().toISOString(),
      event,
      summary,
      ...(transcript ? { transcript } : {}),
      rawAudioPersisted: false,
    };
  }

  private appendReceipt(receipts: VoiceWakeReceipt[], receipt: VoiceWakeReceipt | null): VoiceWakeReceipt[] {
    if (!receipt) {
      return receipts.slice(-RECEIPT_LIMIT);
    }
    return [...receipts, receipt].slice(-RECEIPT_LIMIT);
  }

  private isStillArmed(session: { armedUntil: string | null; mode: VoiceWakeMode }): boolean {
    return Boolean(session.armedUntil && Date.parse(session.armedUntil) > this.now().getTime() && session.mode !== 'off');
  }
}
