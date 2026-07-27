import fs from 'fs';
import path from 'path';
import { IMessageBroker } from '../../../contracts/IMessageBroker.js';
import { type LiveChannelBroadcastGatewayContract, PlatformKey } from '../../../contracts/PlatformContract.js';
import { config } from '../../../config/index.js';
import { SignalLiveClient } from '../../../adapters/channels/SignalLiveClient.js';
import { logger } from '../../../logger.js';
import { errorMessage } from '../../../utils/errorLike.js';
export interface SignalGatewayLocalMessage {

  sender: string;

  text: string;
  messageId?: string | null;
  chatId?: string | null;
}

export type SignalGatewayStatusSnapshot = {
  mode: 'signal-cli';
  enabled: boolean;
  started: boolean;
  recipientsConfigured: number;
  allowedRecipients: string[];
  providerConfigured: boolean;
  accountNumber: string | null;
  bridgeTarget: string | null;
  transport: 'bridge' | 'local';
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastError: string | null;
  updatedAt: string;
};

type SignalGatewayRuntime = {
  liveClient?: SignalLiveClient;
};

export class SignalGateway implements LiveChannelBroadcastGatewayContract {
  public readonly platform: PlatformKey = 'signal';
  public readonly supportsRoleAwareBroadcast = false;

  private broker: IMessageBroker | null;
  private started = false;
  private lastInboundAt: string | null = null;
  private lastOutboundAt: string | null = null;
  private lastError: string | null = null;
  private readonly liveClient: SignalLiveClient;

  constructor(broker?: IMessageBroker, runtime: SignalGatewayRuntime = {}) {
    this.broker = broker ?? null;
    this.liveClient = runtime.liveClient || new SignalLiveClient();
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

  public readStatus(): SignalGatewayStatusSnapshot | null {
    if (!fs.existsSync(config.signalStatusFile)) {
      return null;
    }
    try {
      return JSON.parse(fs.readFileSync(config.signalStatusFile, 'utf8')) as SignalGatewayStatusSnapshot;
    } catch (error: unknown) {logger.warn('[Signal way.local] JSON parse failed', error); return null; }
  }

  public getIdentityHints(): { linkedBy: string; verificationMethod: string } {
    return {
      linkedBy: 'signal-gateway',
      verificationMethod: this.liveClient.resolveTransport() === 'json-rpc'
        ? 'signal-jsonrpc'
        : this.liveClient.resolveTransport() === 'signal-cli'
          ? 'signal-cli'
          : 'signal-fallback-outbox',
    };
  }

  public resolveBroadcastRecipients(): string[] {
    return [...config.signalAllowedRecipients];
  }

  public async simulateIncomingMessage(message: SignalGatewayLocalMessage): Promise<void> {
    await this.dispatchIncomingMessage({
      userId: String(message.sender || ''),
      chatId: String(message.chatId || message.sender || ''),
      rawText: String(message.text || ''),
      messageId: String(message.messageId || '').trim() || null,
    });
  }

  public async broadcast(message: string): Promise<void> {
    if (!this.started) {
      this.lastError = 'Signal bridge has not started yet.';
      this.writeStatus();
      throw new Error(this.lastError);
    }

    const recipients = this.resolveBroadcastRecipients();
    if (recipients.length === 0) {
      this.lastError = 'Signal bridge has no configured allowed recipients.';
      this.writeStatus();
      throw new Error(this.lastError);
    }

    await this.sendOrFallback({
      recipients,
      message,
      kind: 'broadcast',
    });
  }

  private async dispatchIncomingMessage(input: {
    userId: string;
    chatId: string;
    rawText: string;
    messageId: string | null;
  }): Promise<void> {
    if (!this.broker) {
      throw new Error('SignalGateway has no broker attached.');
    }

    this.lastInboundAt = new Date().toISOString();
    this.lastError = null;
    this.writeStatus();
    await this.broker.processMessage({
      platform: 'signal',
      userId: input.userId,
      chatId: input.chatId,
      channelId: input.chatId,
      messageId: input.messageId,
      isGroup: false,
      rawText: input.rawText,
      reply: async (text: string) => {
        await this.sendOrFallback({
          recipient: input.chatId,
          message: text,
          kind: 'reply',
          replyToId: input.messageId,
        });
      },
      editMessage: async () => undefined,
    });
  }

  private ensureRuntimePaths(): void {
    fs.mkdirSync(config.signalOutboxDir, { recursive: true });
    fs.mkdirSync(path.dirname(config.signalStatusFile), { recursive: true });
  }

  private writeEnvelope(input: {
    recipient?: string | null;
    recipients?: string[];
    message: string;
    kind: 'broadcast' | 'reply';
    replyToId?: string | null;
  }): void {
    this.ensureRuntimePaths();
    const createdAt = new Date().toISOString();
    const envelope = {
      id: `signal-${Date.now()}`,
      createdAt,
      platform: 'signal',
      transport: config.signalCliPath || config.signalJsonRpcUrl ? 'signal-cli-configured' : 'local-outbox',
      accountNumber: String(config.signalAccountNumber || '').trim() || null,
      recipient: String(input.recipient || '').trim() || null,
      recipients: Array.isArray(input.recipients) ? input.recipients : [],
      message: input.message,
      kind: input.kind,
      replyToId: String(input.replyToId || '').trim() || null,
    };
    const targetFile = path.join(
      config.signalOutboxDir,
      `${createdAt.replace(/[:.]/g, '-')}-${String(envelope.id)}.json`,
    );
    fs.writeFileSync(targetFile, JSON.stringify(envelope, null, 2), 'utf8');
    this.lastOutboundAt = createdAt;
    this.lastError = null;
    this.writeStatus();
  }

  private async sendOrFallback(input: {
    recipient?: string | null;
    recipients?: string[];
    message: string;
    kind: 'broadcast' | 'reply';
    replyToId?: string | null;
  }): Promise<void> {
    const recipients = Array.isArray(input.recipients)
      ? input.recipients
      : [String(input.recipient || '').trim()].filter(Boolean);
    if (this.liveClient.isConfigured()) {
      try {
        await this.liveClient.sendText({
          recipients,
          message: input.message,
        });
        this.lastOutboundAt = new Date().toISOString();
        this.lastError = null;
        this.writeStatus();
        return;
      } catch (error: unknown) {this.lastError = `Signal live send failed: ${errorMessage(error)}`;
        this.writeStatus();
        throw error;
      }
    }

    this.writeEnvelope(input);
  }

  private writeStatus(): void {
    this.ensureRuntimePaths();
    const updatedAt = new Date().toISOString();
    fs.writeFileSync(
      config.signalStatusFile,
      JSON.stringify(
        {
          mode: 'signal-cli',
          enabled: Boolean(config.signalEnabled || config.signalCliPath || config.signalJsonRpcUrl),
          started: this.started,
          recipientsConfigured: config.signalAllowedRecipients.length,
          allowedRecipients: [...config.signalAllowedRecipients],
          providerConfigured: this.liveClient.isConfigured(),
          accountNumber: String(config.signalAccountNumber || '').trim() || null,
          bridgeTarget: String(config.signalJsonRpcUrl || config.signalCliPath || '').trim() || null,
          transport: this.liveClient.resolveTransport() === 'unconfigured' ? 'local' : 'bridge',
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
