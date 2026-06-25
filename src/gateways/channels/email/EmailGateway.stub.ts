import fs from 'fs';
import path from 'path';
import { IMessageBroker } from '../../../contracts/IMessageBroker.js';
import { type LiveChannelBroadcastGatewayContract, PlatformKey } from '../../../contracts/PlatformContract.js';
import { config } from '../../../config/index.js';

export interface EmailGatewayStubMessage {
  from: string;
  subject?: string | null;
  text: string;
  messageId?: string | null;
}

export type EmailGatewayStatusSnapshot = {
  mode: 'smtp-imap';
  enabled: boolean;
  started: boolean;
  recipientsConfigured: number;
  allowedRecipients: string[];
  providerConfigured: boolean;
  smtpConfigured: boolean;
  imapConfigured: boolean;
  transport: 'native' | 'local';
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastError: string | null;
  updatedAt: string;
};

export class EmailGateway implements LiveChannelBroadcastGatewayContract {
  public readonly platform: PlatformKey = 'email';
  public readonly supportsRoleAwareBroadcast = false;

  private broker: IMessageBroker | null;
  private started = false;
  private lastInboundAt: string | null = null;
  private lastOutboundAt: string | null = null;
  private lastError: string | null = null;

  constructor(broker?: IMessageBroker) {
    this.broker = broker ?? null;
  }

  public attachBroker(broker: IMessageBroker): void {
    this.broker = broker;
  }

  public async start(): Promise<void> {
    this.started = true;
    this.lastError = null;
    this.ensureRuntimePaths();
    this.writeStatus();
  }

  public async stop(): Promise<void> {
    this.started = false;
    this.writeStatus();
  }

  public isStarted(): boolean {
    return this.started;
  }

  public readStatus(): EmailGatewayStatusSnapshot | null {
    if (!fs.existsSync(config.emailStatusFile)) {
      return null;
    }
    try {
      return JSON.parse(fs.readFileSync(config.emailStatusFile, 'utf8')) as EmailGatewayStatusSnapshot;
    } catch {
      return null;
    }
  }

  public getIdentityHints(): { linkedBy: string; verificationMethod: string } {
    return {
      linkedBy: 'email-gateway',
      verificationMethod: config.emailImapHost ? 'smtp-imap' : 'smtp-outbox',
    };
  }

  public resolveBroadcastRecipients(): string[] {
    return [...config.emailAllowedRecipients];
  }

  public async simulateIncomingMessage(message: EmailGatewayStubMessage): Promise<void> {
    await this.dispatchIncomingMessage({
      userId: String(message.from || '').trim().toLowerCase(),
      chatId: String(message.messageId || message.from || '').trim(),
      rawText: String(message.text || ''),
      subject: String(message.subject || '').trim() || null,
      messageId: String(message.messageId || '').trim() || null,
    });
  }

  public async broadcast(message: string): Promise<void> {
    if (!this.started) {
      this.lastError = 'Email gateway ainda nao foi iniciado.';
      this.writeStatus();
      throw new Error(this.lastError);
    }

    const recipients = this.resolveBroadcastRecipients();
    if (recipients.length === 0) {
      this.lastError = 'Email nao tem destinatarios permitidos configurados.';
      this.writeStatus();
      throw new Error(this.lastError);
    }

    this.writeEnvelope({
      recipients,
      subject: 'Zavorth channel mesh test',
      message,
      kind: 'broadcast',
    });
  }

  private async dispatchIncomingMessage(input: {
    userId: string;
    chatId: string;
    rawText: string;
    subject: string | null;
    messageId: string | null;
  }): Promise<void> {
    if (!this.broker) {
      throw new Error('EmailGateway has no broker attached.');
    }

    this.lastInboundAt = new Date().toISOString();
    this.lastError = null;
    this.writeStatus();
    await this.broker.processMessage({
      platform: 'email',
      userId: input.userId,
      chatId: input.chatId,
      channelId: input.chatId,
      messageId: input.messageId,
      isGroup: false,
      rawText: input.subject ? `${input.subject}\n\n${input.rawText}` : input.rawText,
      reply: async (text: string) => {
        this.writeEnvelope({
          recipient: input.userId,
          subject: `Re: ${input.subject || 'Zavorth notification'}`,
          message: text,
          kind: 'reply',
        });
      },
      editMessage: async () => undefined,
    });
  }

  private ensureRuntimePaths(): void {
    fs.mkdirSync(config.emailOutboxDir, { recursive: true });
    fs.mkdirSync(path.dirname(config.emailStatusFile), { recursive: true });
  }

  private writeEnvelope(input: {
    recipient?: string | null;
    recipients?: string[];
    subject: string;
    message: string;
    kind: 'broadcast' | 'reply';
  }): void {
    this.ensureRuntimePaths();
    const createdAt = new Date().toISOString();
    const envelope = {
      id: `email-${Date.now()}`,
      createdAt,
      platform: 'email',
      transport: config.emailSmtpHost ? 'smtp-configured' : 'local-outbox',
      smtpHost: String(config.emailSmtpHost || '').trim() || null,
      recipient: String(input.recipient || '').trim().toLowerCase() || null,
      recipients: Array.isArray(input.recipients) ? input.recipients : [],
      subject: input.subject,
      message: input.message,
      kind: input.kind,
    };
    const targetFile = path.join(
      config.emailOutboxDir,
      `${createdAt.replace(/[:.]/g, '-')}-${String(envelope.id)}.json`,
    );
    fs.writeFileSync(targetFile, JSON.stringify(envelope, null, 2), 'utf8');
    this.lastOutboundAt = createdAt;
    this.lastError = null;
    this.writeStatus();
  }

  private writeStatus(): void {
    this.ensureRuntimePaths();
    const updatedAt = new Date().toISOString();
    fs.writeFileSync(
      config.emailStatusFile,
      JSON.stringify(
        {
          mode: 'smtp-imap',
          enabled: Boolean(config.emailEnabled || config.emailSmtpHost),
          started: this.started,
          recipientsConfigured: config.emailAllowedRecipients.length,
          allowedRecipients: [...config.emailAllowedRecipients],
          providerConfigured: Boolean(config.emailSmtpHost),
          smtpConfigured: Boolean(config.emailSmtpHost),
          imapConfigured: Boolean(config.emailImapHost),
          transport: config.emailSmtpHost ? 'native' : 'local',
          lastInboundAt: this.lastInboundAt,
          lastOutboundAt: this.lastOutboundAt,
          lastError: this.lastError,
          updatedAt,
        },
        null,
        2,
      ),
      'utf8',
    );
  }
}
