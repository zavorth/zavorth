import type { Context } from 'grammy';
import {
  ChannelPolicyManager,
  type ChannelAccessPolicy,
} from '../../../channels/policies/ChannelPolicyManager.js';
import type { MessageTransportKind } from '../../../contracts/IMessageBroker.js';

export type TelegramChannelContract = {
  platform: 'telegram';
  chatId: string;
  chatType: string;
  userId: string;
  threadId: string | null;
  channelId: string;
  chatHint: string;
  isGroup: boolean;
  transport: MessageTransportKind;
  policyIdentifiers: string[];
};

export type TelegramChannelPolicyDecision = {
  allowed: boolean;
  reason: string;
  shouldReply: boolean;
  policy: ChannelAccessPolicy | null;
  contract: TelegramChannelContract;
};

export class TelegramChannelContractService {
  constructor(private readonly policyManager: ChannelPolicyManager = new ChannelPolicyManager()) {}

  public async authorize(ctx: Context): Promise<TelegramChannelPolicyDecision> {
    const contract = this.buildContract(ctx);
    if (!contract.chatId) {
      return this.allow(contract, 'telegram-chat-ausente');
    }

    await this.policyManager.loadPolicies();
    const policy = this.policyManager.getPolicy('telegram');
    if (!policy) {
      return {
        allowed: false,
        reason: 'telegram-policy-ausente',
        shouldReply: this.shouldReplyToPolicyBlock(ctx),
        policy,
        contract,
      };
    }

    if (this.matches(policy.blockedList, contract.policyIdentifiers)) {
      return {
        allowed: false,
        reason: 'telegram-policy-blocked',
        shouldReply: this.shouldReplyToPolicyBlock(ctx),
        policy,
        contract,
      };
    }

    if (policy.isOpenAccess || this.matches(policy.allowedList, contract.policyIdentifiers)) {
      return this.allow(contract, policy.isOpenAccess ? 'telegram-policy-open' : 'telegram-policy-allowed', policy);
    }

    return {
      allowed: false,
      reason: 'telegram-policy-not-allowed',
      shouldReply: this.shouldReplyToPolicyBlock(ctx),
      policy,
      contract,
    };
  }

  public buildContract(ctx: Context): TelegramChannelContract {
    const chatId = String(ctx.chat?.id || '').trim();
    const userId = String(ctx.from?.id || '').trim();
    const chatType = String(ctx.chat?.type || 'unknown').trim().toLowerCase();
    const threadId = this.resolveThreadId(ctx);
    const isGroup = chatType === 'group' || chatType === 'supergroup';
    const channelId = chatId;
    const chatHint = threadId ? `${chatId}:thread:${threadId}` : chatId;

    return {
      platform: 'telegram',
      chatId,
      chatType,
      userId,
      threadId,
      channelId,
      chatHint,
      isGroup,
      transport: this.resolveTransport(ctx),
      policyIdentifiers: this.buildPolicyIdentifiers(chatId, userId, threadId),
    };
  }

  private allow(
    contract: TelegramChannelContract,
    reason: string,
    policy: ChannelAccessPolicy | null = null,
  ): TelegramChannelPolicyDecision {
    return {
      allowed: true,
      reason,
      shouldReply: false,
      policy,
      contract,
    };
  }

  private buildPolicyIdentifiers(chatId: string, userId: string, threadId: string | null): string[] {
    const identifiers = [
      chatId,
      chatId ? `chat:${chatId}` : '',
      userId,
      userId ? `user:${userId}` : '',
    ];

    if (chatId && threadId) {
      identifiers.push(`${chatId}:${threadId}`, `${chatId}/thread/${threadId}`, `thread:${chatId}:${threadId}`);
    }

    return Array.from(
      new Set(
        identifiers
          .map((entry) => String(entry || '').trim().toLowerCase())
          .filter(Boolean),
      ),
    );
  }

  private matches(policyList: string[], identifiers: string[]): boolean {
    const normalized = new Set(policyList.map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean));
    return identifiers.some((identifier) => normalized.has(identifier));
  }

  private resolveThreadId(ctx: Context): string | null {
    const message = ctx.message as any;
    const callbackMessage = ctx.callbackQuery?.message as any;
    const threadId = message?.message_thread_id ?? callbackMessage?.message_thread_id ?? null;
    return threadId === null || threadId === undefined ? null : String(threadId);
  }

  private resolveTransport(ctx: Context): MessageTransportKind {
    if (ctx.callbackQuery) {
      return 'interaction';
    }
    const text = String(ctx.message?.text || '').trim();
    return text.startsWith('/') ? 'slash_command' : 'text';
  }

  private shouldReplyToPolicyBlock(ctx: Context): boolean {
    if (ctx.chat?.type === 'private') {
      return true;
    }
    return String(ctx.message?.text || '').trim().startsWith('/');
  }
}
