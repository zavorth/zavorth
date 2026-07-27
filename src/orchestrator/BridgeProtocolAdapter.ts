/**
 * BridgeProtocolAdapter converts between the legacy MailboxProtocol
 * format (V1 text-based) and the BridgeProtocolSchema (V2 JSON-based).
 *
 * It also provides helpers for:
 * - Creating signed V2 envelopes
 * - Validating received V2 envelopes
 * - Writing V2 responses
 * - Converting V1 to V2 and back
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { MailboxProtocol, MailboxEnvelope } from './MailboxProtocol.js';
import { logger } from '../logger.js';
import type {
  BridgeAgent,
  BridgeAction,
  BridgePriority,
  BridgeRequestEnvelope,
  BridgeResponseEnvelope,
  BridgeResponseStatus,
  BridgeResponsePayload,
} from '../contracts/BridgeProtocolSchema.js';
import { errorMessage } from '../utils/errorLike.js';

const PROTOCOL_VERSION = 'ZAVORTH_BRIDGE_V2' as const;
const DEFAULT_TTL_SECONDS = 600; // 10 minutes

export class BridgeProtocolAdapter {
  private readonly secret: string;
  private readonly inboxDir: string;
  private readonly responseDir: string;
  private readonly v1Protocol: MailboxProtocol;

  constructor(options?: {
    secret?: string;
    inboxDir?: string;
    responseDir?: string;
    v1Protocol?: MailboxProtocol;
  }) {
    this.secret = options?.secret || MailboxProtocol.resolveMailboxSecret();
    this.inboxDir = options?.inboxDir || path.join(config.mailboxBridgeDir, 'inbox');
    this.responseDir = options?.responseDir || path.join(config.mailboxBridgeDir, 'responses');
    this.v1Protocol = options?.v1Protocol || new MailboxProtocol({ secret: this.secret });

    fs.mkdirSync(this.inboxDir, { recursive: true });
    fs.mkdirSync(this.responseDir, { recursive: true });
  }

  // ─── Build V2 Request ────────────────────────────────────────────────────

  public buildRequest(params: {
    sender: string;
    agent: BridgeAgent;
    action: BridgeAction;
    prompt: string;
    workspace?: string;
    priority?: BridgePriority;
    externalTaskId?: string;
    targetFiles?: string[];
    context?: Record<string, unknown>;
    ttlSeconds?: number;
    metadata?: Record<string, unknown>;
  }): BridgeRequestEnvelope {
    const messageId = crypto.randomUUID();
    const correlationId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const envelope: Omit<BridgeRequestEnvelope, 'signature'> = {
      protocol: PROTOCOL_VERSION,
      messageId,
      timestamp,
      sender: params.sender,
      agent: params.agent,
      action: params.action,
      priority: params.priority || 'NORMAL',
      correlationId,
      payload: {
        prompt: params.prompt,
        workspace: params.workspace || 'AUTO',
        externalTaskId: params.externalTaskId,
        targetFiles: params.targetFiles,
        context: params.context,
      },
      ttlSeconds: params.ttlSeconds || DEFAULT_TTL_SECONDS,
      metadata: params.metadata,
    };

    const signature = this.signRequest(envelope);
    return { ...envelope, signature };
  }

  // ─── Validate V2 Request ─────────────────────────────────────────────────

  public validateRequest(
    envelope: BridgeRequestEnvelope,
  ): { valid: true } | { valid: false; reason: string } {
    // Protocol check
    if (envelope.protocol !== PROTOCOL_VERSION) {
      return { valid: false, reason: `Invalid protocol: ${envelope.protocol}` };
    }

    // Required fields
    if (!envelope.messageId || !envelope.timestamp || !envelope.sender) {
      return { valid: false, reason: 'Missing required fields (messageId, timestamp, sender).' };
    }
    if (!envelope.agent || !envelope.action || !envelope.correlationId) {
      return { valid: false, reason: 'Missing required fields (agent, action, correlationId).' };
    }
    if (!envelope.payload?.prompt) {
      return { valid: false, reason: 'Payload has no prompt.' };
    }

    // Signature verification
    const expectedSignature = this.signRequest(envelope);
    if (!this.safeCompare(envelope.signature, expectedSignature)) {
      return { valid: false, reason: 'Invalid signature.' };
    }

    // TTL check
    if (envelope.ttlSeconds) {
      const ageMs = Date.now() - Date.parse(envelope.timestamp);
      if (ageMs > envelope.ttlSeconds * 1000) {
        return { valid: false, reason: 'Message expired (TTL exceeded).' };
      }
    }

    // Timestamp sanity
    const timestampMs = Date.parse(envelope.timestamp);
    if (!Number.isFinite(timestampMs)) {
      return { valid: false, reason: 'Invalid timestamp.' };
    }
    if (Date.now() - timestampMs < -60_000) {
      return { valid: false, reason: 'Timestamp is in the future.' };
    }

    return { valid: true };
  }

  // ─── Build V2 Response ───────────────────────────────────────────────────

  public buildResponse(params: {
    correlationId: string;
    inReplyTo: string;
    status: BridgeResponseStatus;
    payload: BridgeResponsePayload;
    metadata?: Record<string, unknown>;
  }): BridgeResponseEnvelope {
    const messageId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const envelope: Omit<BridgeResponseEnvelope, 'signature'> = {
      protocol: PROTOCOL_VERSION,
      messageId,
      timestamp,
      correlationId: params.correlationId,
      inReplyTo: params.inReplyTo,
      status: params.status,
      payload: params.payload,
      metadata: params.metadata,
    };

    const signature = this.signResponse(envelope);
    return { ...envelope, signature };
  }

  // ─── Write Response to Disk ──────────────────────────────────────────────

  public async writeResponse(response: BridgeResponseEnvelope): Promise<string> {
    const filename = `${response.timestamp.replace(/[:.]/g, '-')}_${response.correlationId}_response.json`;
    const filepath = path.join(this.responseDir, filename);
    await fs.promises.writeFile(filepath, JSON.stringify(response, null, 2), 'utf8');
    return filepath;
  }

  // ─── Deposit Request to Inbox ────────────────────────────────────────────

  public async depositRequest(request: BridgeRequestEnvelope): Promise<string> {
    const filename = `${request.timestamp.replace(/[:.]/g, '-')}_${request.agent.toLowerCase()}_${request.messageId}.json`;
    const runtimeDir = path.join(path.dirname(this.inboxDir), 'runtime');
    fs.mkdirSync(runtimeDir, { recursive: true });

    const tmpPath = path.join(runtimeDir, `${filename}.tmp`);
    const finalPath = path.join(this.inboxDir, filename);

    await fs.promises.writeFile(tmpPath, JSON.stringify(request, null, 2), 'utf8');
    await fs.promises.rename(tmpPath, finalPath);
    return finalPath;
  }

  // ─── V1 ↔ V2 Conversion ───────────────────────────────────────────────────

  /** Convert a legacy MailboxEnvelope (V1) into a V2 BridgeRequestEnvelope */
  public v1ToV2(v1Envelope: MailboxEnvelope): BridgeRequestEnvelope {
    const correlationId = `legacy-${v1Envelope.taskId || v1Envelope.messageId}`;
    const envelope: Omit<BridgeRequestEnvelope, 'signature'> = {
      protocol: PROTOCOL_VERSION,
      messageId: v1Envelope.messageId,
      timestamp: v1Envelope.timestamp,
      sender: v1Envelope.sender,
      agent: v1Envelope.agent as BridgeAgent,
      action: v1Envelope.action as BridgeAction,
      priority: 'NORMAL',
      correlationId,
      payload: {
        prompt: v1Envelope.prompt,
        workspace: v1Envelope.workspace || 'AUTO',
        externalTaskId: v1Envelope.taskId,
      },
      ttlSeconds: DEFAULT_TTL_SECONDS,
      metadata: {
        legacyConversion: true,
        originalProtocol: v1Envelope.protocol,
        originalMessageId: v1Envelope.messageId,
        originalSignature: v1Envelope.signature,
      },
    };

    return {
      ...envelope,
      signature: this.signRequest(envelope),
    };
  }

  /** Detect if a file in the inbox is V1 (text) or V2 (JSON) */
  public detectVersion(content: string): 'V1' | 'V2' | 'UNKNOWN' {
    const trimmed = content.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.protocol === PROTOCOL_VERSION) return 'V2';
        return 'UNKNOWN';
      } catch (error: unknown) {logger.warn('[Bridge Protocol Adapter] JSON parse failed', error); return 'UNKNOWN'; }
    }
    if (trimmed.includes('[PROTOCOL:') && trimmed.includes('[END_OF_MESSAGE]')) {
      return 'V1';
    }
    return 'UNKNOWN';
  }

  /** Parse any inbox file (V1 or V2) into a normalized V2 envelope */
  public parseUniversal(content: string):
    | { accepted: true; envelope: BridgeRequestEnvelope; originalVersion: 'V1' | 'V2' }
    | { accepted: false; reason: string } {
    const version = this.detectVersion(content);

    if (version === 'V2') {
      try {
        const parsed = JSON.parse(content.trim()) as BridgeRequestEnvelope;
        const validation = this.validateRequest(parsed);
        if (!validation.valid) {
          return { accepted: false, reason: validation.reason };
        }
        return { accepted: true, envelope: parsed, originalVersion: 'V2' };
      } catch (error: unknown) { logger.warn('[Bridge Protocol Adapter] JSON parse failed', error);
    return { accepted: false, reason: `JSON parse error: ${errorMessage(error)}` };
  }
    }

    if (version === 'V1') {
      const v1Result = this.v1Protocol.parseAndVerify(content);
      if (!v1Result.accepted) {
        return { accepted: false, reason: v1Result.reason };
      }
      const v2Envelope = this.v1ToV2(v1Result.envelope);
      return { accepted: true, envelope: v2Envelope, originalVersion: 'V1' };
    }

    return { accepted: false, reason: 'Message format not recognized.' };
  }

  // ─── Signing ─────────────────────────────────────────────────────────────

  private signRequest(envelope: Omit<BridgeRequestEnvelope, 'signature'>): string {
    const canonical = [
      `protocol=${envelope.protocol}`,
      `messageId=${envelope.messageId}`,
      `timestamp=${envelope.timestamp}`,
      `sender=${envelope.sender}`,
      `agent=${envelope.agent}`,
      `action=${envelope.action}`,
      `priority=${envelope.priority}`,
      `correlationId=${envelope.correlationId}`,
      `prompt=${envelope.payload.prompt}`,
      `workspace=${envelope.payload.workspace}`,
    ].join('\n');

    return crypto
      .createHmac('sha256', this.secret)
      .update(canonical, 'utf8')
      .digest('hex');
  }

  private signResponse(envelope: Omit<BridgeResponseEnvelope, 'signature'>): string {
    const canonical = [
      `protocol=${envelope.protocol}`,
      `messageId=${envelope.messageId}`,
      `timestamp=${envelope.timestamp}`,
      `correlationId=${envelope.correlationId}`,
      `inReplyTo=${envelope.inReplyTo}`,
      `status=${envelope.status}`,
      `taskId=${envelope.payload.taskId}`,
    ].join('\n');

    return crypto
      .createHmac('sha256', this.secret)
      .update(canonical, 'utf8')
      .digest('hex');
  }

  private safeCompare(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');
    if (leftBuffer.length !== rightBuffer.length) return false;
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
  }
}
