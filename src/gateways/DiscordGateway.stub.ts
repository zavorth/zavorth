import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { IMessageBroker } from '../contracts/IMessageBroker.js';
import { PlatformGatewayContract, PlatformKey } from '../contracts/PlatformContract.js';

export interface DiscordGatewayStubMessage {
  userId: string;
  chatId: string;
  rawText: string;
  isGroup?: boolean;
}

export class DiscordGateway implements PlatformGatewayContract {
  public readonly platform: PlatformKey = 'discord';
  public readonly supportsRoleAwareBroadcast = false;

  private broker: IMessageBroker | null;
  private started = false;

  constructor(broker?: IMessageBroker) {
    this.broker = broker ?? null;
  }

  public attachBroker(broker: IMessageBroker): void {
    this.broker = broker;
  }

  public async start(): Promise<void> {
    this.started = true;
  }

  public async stop(): Promise<void> {
    this.started = false;
  }

  public isStarted(): boolean {
    return this.started;
  }

  public async simulateIncomingMessage(message: DiscordGatewayStubMessage): Promise<void> {
    if (!this.broker) {
      throw new Error('DiscordGateway stub has no broker attached.');
    }

    await this.broker.processMessage({
      platform: 'discord',
      userId: String(message.userId || ''),
      chatId: String(message.chatId || ''),
      isGroup: Boolean(message.isGroup),
      rawText: String(message.rawText || ''),
      reply: async (text: string) => {
        this.writeEnvelope(text, String(message.chatId || ''));
      },
      editMessage: async () => {},
    });
  }

  private writeEnvelope(message: string, chatId: string): void {
    const outboxDir = path.join(config.runtimeDir || 'data/runtime', 'discord', 'outbox');
    try {
      fs.mkdirSync(outboxDir, { recursive: true });
      const createdAt = new Date().toISOString();
      const envelope = {
        id: `discord-${Date.now()}`,
        createdAt,
        platform: 'discord',
        recipient: chatId,
        message,
        kind: 'reply',
      };
      const targetFile = path.join(
        outboxDir,
        `${createdAt.replace(/[:.]/g, '-')}-${envelope.id}.json`,
      );
      fs.writeFileSync(targetFile, JSON.stringify(envelope, null, 2), 'utf8');
    } catch {
      // ignore write errors in pure stub
    }
  }

  public async broadcast(message: string): Promise<void> {
    if (!this.started) {
      return;
    }

    void message;
  }
}
