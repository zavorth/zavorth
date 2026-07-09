import fs from 'fs';
import path from 'path';
import { IMessageBroker } from '../../../contracts/IMessageBroker.js';
import { type LiveChannelBroadcastGatewayContract, PlatformKey } from '../../../contracts/PlatformContract.js';
import { config } from '../../../config/index.js';
import { logger } from '../../../logger.js';export interface IMessageGatewayStubMessage {
  sender: string;
  text: string;
  guid?: string | null;
  chatId?: string | null;
}

export type IMessageGatewayStatusSnapshot = {
  mode: 'mac-bridge';
  enabled: boolean;
  started: boolean;
  recipientsConfigured: number;
  allowedRecipients: string[];
  providerConfigured: boolean;
  nodeHostId: string | null;
  platform: string | null;
  readOnly: boolean;
  transport: 'bridge' | 'local';
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastError: string | null;
  updatedAt: string;
};

export class IMessageGateway implements LiveChannelBroadcastGatewayContract {
  public readonly platform: PlatformKey = 'imessage';
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

  public readStatus(): IMessageGatewayStatusSnapshot | null {
    if (!fs.existsSync(config.imessageStatusFile)) {
      return null;
    }
    try {
      return JSON.parse(fs.readFileSync(config.imessageStatusFile, 'utf8')) as IMessageGatewayStatusSnapshot;
    } catch (error: unknown) {logger.warn('[I Message way.stub] JSON parse failed', error); return null; }
  }

  public getIdentityHints(): { linkedBy: string; verificationMethod: string } {
    return {
      linkedBy: 'imessage-gateway',
      verificationMethod: config.imessageNodeId ? 'mac-node-host' : 'mac-bridge-outbox',
    };
  }

  public resolveBroadcastRecipients(): string[] {
    return [...config.imessageAllowedRecipients];
  }

  public async simulateIncomingMessage(message: IMessageGatewayStubMessage): Promise<void> {
    await this.dispatchIncomingMessage({
      userId: String(message.sender || ''),
      chatId: String(message.chatId || message.sender || ''),
      rawText: String(message.text || ''),
      messageId: String(message.guid || '').trim() || null,
    });
  }

  public async broadcast(message: string): Promise<void> {
    if (!this.started) {
      this.lastError = 'iMessage bridge has not started yet.';
      this.writeStatus();
      throw new Error(this.lastError);
    }

    const recipients = this.resolveBroadcastRecipients();
    if (recipients.length === 0) {
      this.lastError = 'iMessage bridge has no configured allowed recipients.';
      this.writeStatus();
      throw new Error(this.lastError);
    }

    this.writeEnvelope({
      recipients,
      message,
      kind: 'broadcast',
      approved: true,
    });
  }

  private async dispatchIncomingMessage(input: {
    userId: string;
    chatId: string;
    rawText: string;
    messageId: string | null;
  }): Promise<void> {
    if (!this.broker) {
      throw new Error('IMessageGateway has no broker attached.');
    }

    this.lastInboundAt = new Date().toISOString();
    this.lastError = null;
    this.writeStatus();
    await this.broker.processMessage({
      platform: 'imessage',
      userId: input.userId,
      chatId: input.chatId,
      channelId: input.chatId,
      messageId: input.messageId,
      isGroup: false,
      rawText: input.rawText,
      reply: async (text: string) => {
        this.writeEnvelope({
          recipient: input.chatId,
          message: text,
          kind: 'reply',
          replyToId: input.messageId,
          approved: true,
        });
      },
      editMessage: async () => undefined,
    });
  }

  private ensureRuntimePaths(): void {
    fs.mkdirSync(config.imessageOutboxDir, { recursive: true });
    fs.mkdirSync(path.dirname(config.imessageStatusFile), { recursive: true });
  }

  private writeEnvelope(input: {
    recipient?: string | null;
    recipients?: string[];
    message: string;
    kind: 'broadcast' | 'reply';
    replyToId?: string | null;
    approved: boolean;
  }): void {
    this.ensureRuntimePaths();
    const createdAt = new Date().toISOString();
    const envelope = {
      id: `imessage-${Date.now()}`,
      createdAt,
      platform: 'imessage',
      transport: config.imessageNodeId ? 'mac-bridge-configured' : 'local-outbox',
      nodeHostId: String(config.imessageNodeId || '').trim() || null,
      readOnly: config.imessageReadOnly,
      recipient: String(input.recipient || '').trim() || null,
      recipients: Array.isArray(input.recipients) ? input.recipients : [],
      message: input.message,
      kind: input.kind,
      approved: input.approved,
      replyToId: String(input.replyToId || '').trim() || null,
    };
    const targetFile = path.join(
      config.imessageOutboxDir,
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
      config.imessageStatusFile,
      JSON.stringify(
        {
          mode: 'mac-bridge',
          enabled: Boolean(config.imessageEnabled || config.imessageNodeId || config.imessageBridgeScript),
          started: this.started,
          recipientsConfigured: config.imessageAllowedRecipients.length,
          allowedRecipients: [...config.imessageAllowedRecipients],
          providerConfigured: Boolean(config.imessageNodeId || config.imessageBridgeScript),
          nodeHostId: String(config.imessageNodeId || '').trim() || null,
          platform: process.platform,
          readOnly: config.imessageReadOnly,
          transport: config.imessageNodeId || config.imessageBridgeScript ? 'bridge' : 'local',
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
