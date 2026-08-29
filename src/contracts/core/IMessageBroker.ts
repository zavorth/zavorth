import { MessageChannel, PlatformGatewayContract, PlatformKey } from './PlatformContract.js';

export type MessageTransportKind = 'text' | 'slash_command' | 'interaction';

export type MessageAttachment = {
  id?: string | null;
  name?: string | null;
  url?: string | null;
  contentType?: string | null;
  size?: number | null;
};

export interface IMessageContext {
  platform: MessageChannel;
  userId: string;
  chatId: string;
  isGroup: boolean;
  rawText: string;
  messageId?: string | null;
  channelId?: string | null;
  threadId?: string | null;
  transport?: MessageTransportKind;
  attachments?: MessageAttachment[];
  inlineData?: Array<{ mimeType: string; data: string }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  composerPayload?: Record<string, any> | null;
  nativeCommand?: {
    name: string;
    args?: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options?: Record<string, any> | null;
  } | null;
  /**
   * Preferred language tag for localized replies (BCP-47-ish).
   * Absent or unrecognized tags resolve through the localization service
   * fallback chain, never blocking any locale from being served.
   */
  locale?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reply: (text: string, options?: any) => Promise<void>;
  editMessage: (messageId: string, text: string) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  __naturalRoute?: any;
}

export interface IMessageBroker {
  registerGateway(platform: PlatformKey, gateway: PlatformGatewayContract): void;
  processMessage(ctx: IMessageContext): Promise<void>;
  broadcast(message: string, roles?: string[]): Promise<void>;
}
