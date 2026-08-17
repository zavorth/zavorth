/**
 * Mock Multi-Channel Gateway for End-to-End (E2E) Testing.
 * Simulates inbound/outbound messaging and live streaming across Telegram, Discord, Slack, Web Console, and ACP.
 * Strictly typed (Zero any) and EN-First.
 */

import { EventEmitter } from 'node:events';
import { logger } from '../../logger.js';

export type ChannelPlatform = 'telegram' | 'discord' | 'slack' | 'web_console' | 'acp' | 'cli';

export interface InboundMessage {
  id: string;
  channel: ChannelPlatform;
  senderId: string;
  senderName: string;
  text: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface OutboundMessage {
  id: string;
  channel: ChannelPlatform;
  recipientId: string;
  text: string;
  toolCalls?: Array<{ name: string; args: Record<string, unknown>; result?: string }>;
  timestamp: string;
}

export interface ChannelStreamEvent {
  channel: ChannelPlatform;
  sessionId: string;
  type: 'token' | 'thought' | 'tool_call' | 'tool_result' | 'done' | 'error';
  payload: string;
}

export class MockChannelGateway extends EventEmitter {
  private readonly messageHistory: OutboundMessage[] = [];
  private readonly streamEvents: ChannelStreamEvent[] = [];
  private messageHandler?: (msg: InboundMessage) => Promise<OutboundMessage>;

  constructor() {
    super();
  }

  public setInboundHandler(handler: (msg: InboundMessage) => Promise<OutboundMessage>): void {
    this.messageHandler = handler;
  }

  /**
   * Simulates an inbound user message from a specific platform.
   */
  public async receiveUserMessage(
    channel: ChannelPlatform,
    text: string,
    senderId = 'test_user_01',
    senderName = 'Test User',
  ): Promise<OutboundMessage> {
    const inbound: InboundMessage = {
      id: `in_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      channel,
      senderId,
      senderName,
      text,
      timestamp: new Date().toISOString(),
    };

    logger.info(`[MockGateway] Received message on [${channel}] from ${senderName} (${senderId}): "${text}"`);
    this.emit('message:inbound', inbound);

    if (!this.messageHandler) {
      const fallback: OutboundMessage = {
        id: `out_${Date.now()}`,
        channel,
        recipientId: senderId,
        text: `Echo: ${text}`,
        timestamp: new Date().toISOString(),
      };
      this.messageHistory.push(fallback);
      return fallback;
    }

    const response = await this.messageHandler(inbound);
    this.messageHistory.push(response);
    this.emit('message:outbound', response);
    return response;
  }

  /**
   * Emits a real-time stream token or event from the agent to the channel.
   */
  public emitStreamEvent(event: ChannelStreamEvent): void {
    this.streamEvents.push(event);
    this.emit('stream', event);
  }

  public getOutboundMessages(channel?: ChannelPlatform): OutboundMessage[] {
    if (!channel) return [...this.messageHistory];
    return this.messageHistory.filter((m) => m.channel === channel);
  }

  public getStreamEvents(channel?: ChannelPlatform): ChannelStreamEvent[] {
    if (!channel) return [...this.streamEvents];
    return this.streamEvents.filter((e) => e.channel === channel);
  }

  public clear(): void {
    this.messageHistory.length = 0;
    this.streamEvents.length = 0;
  }
}
