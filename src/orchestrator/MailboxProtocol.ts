import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Task } from '../contracts/TaskContract.js';

export type MailboxAgent = 'ZAVORTH_BRIDGE' | 'CODEX';

type SignedEnvelopeFields = {
  protocol: string;
  sender: string;
  agent: MailboxAgent;
  action: string;
  messageId: string;
  taskId: string;
  timestamp: string;
  promptBase64: string;
  workspaceBase64: string;
};

export type MailboxEnvelope = {
  protocol: string;
  sender: string;
  agent: MailboxAgent;
  action: string;
  messageId: string;
  taskId: string;
  timestamp: string;
  prompt: string;
  workspace: string;
  signature: string;
  legacy: boolean;
};

export type MailboxDispatchMessage = {
  messageId: string;
  payload: string;
  taskId: string;
  timestamp: string;
};

export type MailboxParseResult =
  | { accepted: true; envelope: MailboxEnvelope }
  | { accepted: false; reason: string };

const DEFAULT_PROTOCOL = 'ZAVORTH_MAILBOX_V1';
const DEFAULT_MAX_AGE_MS = 10 * 60 * 1000;
const SUPPORTED_AGENTS: MailboxAgent[] = ['ZAVORTH_BRIDGE', 'CODEX'];
const SUPPORTED_ACTION = 'PLAN_AND_EXECUTE';

export class MailboxProtocol {
  private readonly secret: string;
  private readonly allowLegacy: boolean;
  private readonly maxAgeMs: number;

  constructor(options?: {
    secret?: string;
    allowLegacy?: boolean;
    maxAgeMs?: number;
  }) {
    this.secret = options?.secret || MailboxProtocol.resolveMailboxSecret();
    this.allowLegacy =
      options?.allowLegacy ??
      String(process.env.ZAVORTH_ALLOW_LEGACY_MAILBOX || '').trim().toLowerCase() === 'true';
    this.maxAgeMs = options?.maxAgeMs || DEFAULT_MAX_AGE_MS;
  }

  public static resolveMailboxPath(): string {
    const fallbackPath = path.join(
      MailboxProtocol.findProjectRoot(),
      'data',
      'agent-bridge',
      'mailbox',
      'legacy',
      'caixa_zavorthBridge.txt',
    );
    return String(process.env.ZAVORTH_MAILBOX_PATH || fallbackPath).trim() || fallbackPath;
  }

  public static resolveMailboxSecret(): string {
    const explicitSecret = String(process.env.ZAVORTH_MAILBOX_SECRET || '').trim();
    if (explicitSecret) {
      return explicitSecret;
    }

    const secretFilePath =
      String(process.env.ZAVORTH_MAILBOX_SECRET_FILE || '').trim() ||
      path.join(MailboxProtocol.findProjectRoot(), 'data', 'runtime', 'mailbox-secret.key');
    const secretDir = path.dirname(secretFilePath);
    fs.mkdirSync(secretDir, { recursive: true });

    if (!fs.existsSync(secretFilePath)) {
      fs.writeFileSync(secretFilePath, crypto.randomBytes(32).toString('hex'), 'utf8');
    }

    const fileSecret = fs.readFileSync(secretFilePath, 'utf8').trim();
    if (!fileSecret) {
      const regenerated = crypto.randomBytes(32).toString('hex');
      fs.writeFileSync(secretFilePath, regenerated, 'utf8');
      return regenerated;
    }

    return fileSecret;
  }

  public buildDispatchPayload(task: Task, agent: MailboxAgent): string {
    return this.buildDispatchMessage(task, agent).payload;
  }

  public buildDispatchMessage(task: Task, agent: MailboxAgent): MailboxDispatchMessage {
    const fields: SignedEnvelopeFields = {
      protocol: DEFAULT_PROTOCOL,
      sender: 'TELEGRAM_USER',
      agent,
      action: 'PLAN_AND_EXECUTE',
      messageId: crypto.randomUUID(),
      taskId: task.task_id,
      timestamp: new Date().toISOString(),
      promptBase64: Buffer.from(task.normalized_message || '', 'utf8').toString('base64'),
      workspaceBase64: Buffer.from(task.workspace || 'AUTO', 'utf8').toString('base64'),
    };

    const signature = this.sign(fields);

    return {
      messageId: fields.messageId,
      payload: [
        `[PROTOCOL: ${fields.protocol}]`,
        `[SENDER: ${fields.sender}]`,
        `[AGENT: ${fields.agent}]`,
        `[ACTION: ${fields.action}]`,
        `[MESSAGE_ID: ${fields.messageId}]`,
        `[TASK_ID: ${fields.taskId}]`,
        `[TIMESTAMP: ${fields.timestamp}]`,
        `[PROMPT_B64: ${fields.promptBase64}]`,
        `[WORKSPACE_B64: ${fields.workspaceBase64}]`,
        `[SIGNATURE: ${signature}]`,
        '---',
        '[END_OF_MESSAGE]',
        '',
      ].join('\n'),
      taskId: fields.taskId,
      timestamp: fields.timestamp,
    };
  }

  public parseAndVerify(content: string): MailboxParseResult {
    if (!content.includes('[END_OF_MESSAGE]')) {
      return { accepted: false, reason: 'Mensagem rejeitada: marcador de fim ausente.' };
    }

    const sender = this.readField(content, 'SENDER');
    if (sender !== 'TELEGRAM_USER') {
      return { accepted: false, reason: 'Mensagem ignorada: sender nao reconhecido.' };
    }

    const signature = this.readField(content, 'SIGNATURE');
    if (!signature) {
      if (!this.allowLegacy) {
        return { accepted: false, reason: 'Mensagem rejeitada: assinatura ausente.' };
      }

      const prompt =
        this.readField(content, 'PROMPT') ||
        this.decodeBase64Field(this.readField(content, 'PROMPT_B64'));
      if (!prompt) {
        return { accepted: false, reason: 'Mensagem rejeitada: prompt ausente.' };
      }

      const workspace =
        this.readField(content, 'WORKSPACE') ||
        this.decodeBase64Field(this.readField(content, 'WORKSPACE_B64')) ||
        'AUTO';
      const taskId = this.readField(content, 'TASK_ID') || 'legacy-mailbox';
      const timestamp = this.readField(content, 'TIMESTAMP') || new Date().toISOString();

      return {
        accepted: true,
        envelope: {
          protocol: this.readField(content, 'PROTOCOL') || 'LEGACY',
          sender,
          agent: (this.readField(content, 'AGENT') as MailboxAgent) || 'ZAVORTH_BRIDGE',
          action: this.readField(content, 'ACTION') || 'PLAN_AND_EXECUTE',
          messageId: crypto.createHash('sha256').update(content, 'utf8').digest('hex'),
          taskId,
          timestamp,
          prompt,
          workspace,
          signature: 'LEGACY',
          legacy: true,
        },
      };
    }

    const protocol = this.readField(content, 'PROTOCOL') || DEFAULT_PROTOCOL;
    const agent = this.readField(content, 'AGENT') as MailboxAgent | null;
    const action = this.readField(content, 'ACTION');
    const messageId = this.readField(content, 'MESSAGE_ID');
    const taskId = this.readField(content, 'TASK_ID');
    const timestamp = this.readField(content, 'TIMESTAMP');
    const promptBase64 = this.readField(content, 'PROMPT_B64');
    const workspaceBase64 =
      this.readField(content, 'WORKSPACE_B64') ||
      Buffer.from('AUTO', 'utf8').toString('base64');

    if (!agent || !action || !messageId || !taskId || !timestamp || !promptBase64) {
      return { accepted: false, reason: 'Mensagem rejeitada: campos obrigatorios ausentes.' };
    }

    const fields: SignedEnvelopeFields = {
      protocol,
      sender,
      agent,
      action,
      messageId,
      taskId,
      timestamp,
      promptBase64,
      workspaceBase64,
    };

    const expectedSignature = this.sign(fields);
    if (!this.safeCompare(signature, expectedSignature)) {
      return { accepted: false, reason: 'Mensagem rejeitada: assinatura invalida.' };
    }

    if (protocol !== DEFAULT_PROTOCOL) {
      return { accepted: false, reason: `Mensagem rejeitada: protocolo nao suportado (${protocol}).` };
    }
    if (!SUPPORTED_AGENTS.includes(agent)) {
      return { accepted: false, reason: `Mensagem rejeitada: agent nao suportado (${agent}).` };
    }
    if (action !== SUPPORTED_ACTION) {
      return { accepted: false, reason: `Mensagem rejeitada: action nao suportada (${action}).` };
    }

    const timestampMs = Date.parse(timestamp);
    if (!Number.isFinite(timestampMs)) {
      return { accepted: false, reason: 'Mensagem rejeitada: timestamp invalido.' };
    }

    const ageMs = Date.now() - timestampMs;
    if (ageMs < -60_000) {
      return { accepted: false, reason: 'Mensagem rejeitada: timestamp no futuro.' };
    }
    if (ageMs > this.maxAgeMs) {
      return { accepted: false, reason: 'Mensagem rejeitada: payload expirado.' };
    }

    const prompt = this.decodeBase64Field(promptBase64);
    if (!prompt) {
      return { accepted: false, reason: 'Mensagem rejeitada: prompt invalido.' };
    }

    const workspace = this.decodeBase64Field(workspaceBase64) || 'AUTO';

    return {
      accepted: true,
      envelope: {
        protocol,
        sender,
        agent,
        action,
        messageId,
        taskId,
        timestamp,
        prompt,
        workspace,
        signature,
        legacy: false,
      },
    };
  }

  private sign(fields: SignedEnvelopeFields): string {
    return crypto
      .createHmac('sha256', this.secret)
      .update(this.buildCanonicalString(fields), 'utf8')
      .digest('hex');
  }

  private buildCanonicalString(fields: SignedEnvelopeFields): string {
    return [
      `protocol=${fields.protocol}`,
      `sender=${fields.sender}`,
      `agent=${fields.agent}`,
      `action=${fields.action}`,
      `message_id=${fields.messageId}`,
      `task_id=${fields.taskId}`,
      `timestamp=${fields.timestamp}`,
      `prompt_b64=${fields.promptBase64}`,
      `workspace_b64=${fields.workspaceBase64}`,
    ].join('\n');
  }

  private readField(content: string, fieldName: string): string | null {
    const escapedField = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = content.match(new RegExp(`\\[${escapedField}:\\s*([^\\]]*)\\]`));
    return match?.[1]?.trim() || null;
  }

  private decodeBase64Field(value: string | null): string | null {
    if (!value) {
      return null;
    }

    try {
      return Buffer.from(value, 'base64').toString('utf8').trim();
    } catch {
      return null;
    }
  }

  private safeCompare(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');
    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
  }

  private static findProjectRoot(): string {
    let dir = process.cwd();
    for (let i = 0; i < 6; i++) {
      if (fs.existsSync(path.join(dir, 'package.json'))) {
        return dir;
      }
      dir = path.dirname(dir);
    }
    return process.cwd();
  }
}
