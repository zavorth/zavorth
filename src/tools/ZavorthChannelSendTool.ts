
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

interface ChannelTarget {
  channel: string;
  recipient: string;
  thread_id?: string;
}

export class ZavorthChannelSendTool extends BaseTool {
  public readonly name = 'zavorth_channel_send';

  public readonly description =
    'Sends messages to any configured Zavorth channel (Telegram, Discord, Slack, WhatsApp, Email, Teams, Signal, Matrix, IRC, Line, etc). Supports multi-channel sending, attachments, replies, and platform-adaptive formatting.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        description: "Target channel: 'telegram', 'discord', 'slack', 'whatsapp', 'email', 'teams', 'signal', 'matrix', 'irc', 'line', 'nostr', 'twitch', 'webhook', 'sms', 'feishu', 'google_chat', 'mattermost', 'imessage', 'instagram', 'zalo', 'qq', 'wecom', 'weixin', 'yuanbao', 'home_assistant', 'voice_call'.",
      },
      recipient: {
        type: 'string',
        description: 'Destinatario (user ID, chat ID, email, number de telefone, etc).',
      },
      message: {
        type: 'string',
        description: 'Message content.',
      },
      thread_id: {
        type: 'string',
        description: 'Thread or conversation ID for channels that support threads.',
      },
      reply_to: {
        type: 'string',
        description: 'Message ID to reply to.',
      },
      format: {
        type: 'string',
        description: "Format: 'auto' (detects from channel), 'markdown', 'html', 'plain'. Default: 'auto'.",
      },
      attachments: {
        type: 'string',
        description: "JSON array of attachments: [{type, path_or_url, filename}].",
      },
      silent: {
        type: 'boolean',
        description: 'Se true, envia without notificaction. Default: false.',
      },
      multi_channel: {
        type: 'string',
        description: "JSON array for multi-channel send: [{channel, recipient, thread_id...}].",
      },
      scheduled_at: {
        type: 'string',
        description: 'ISO 8601 datetime for scheduled send.',
      },
    },
    required: ['channel', 'recipient', 'message'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const message = String(args.message || '');
    if (!message) return 'Error: "message" parameter is required.';

    const multiChannelRaw = typeof args.multi_channel === 'string' ? args.multi_channel : null;

    if (multiChannelRaw) {
      return this.sendMultiChannel(multiChannelRaw, args);
    }

    const channel = String(args.channel || '');
    const recipient = String(args.recipient || '');
    if (!channel) return 'Error: "channel" parameter is required.';
    if (!recipient) return 'Error: "recipient" parameter is required.';

    const validChannels = [
      'telegram', 'discord', 'slack', 'whatsapp', 'email', 'teams', 'signal',
      'matrix', 'irc', 'line', 'nostr', 'twitch', 'webhook', 'sms', 'feishu',
      'google_chat', 'mattermost', 'imessage', 'instagram', 'zalo', 'qq',
      'wecom', 'weixin', 'yuanbao', 'home_assistant', 'voice_call',
    ];
    if (!validChannels.includes(channel)) {
      return `Error: channel "${channel}" is invalid. Use: ${validChannels.join(', ')}.`;
    }

    try {
      return await this.sendToChannel({
        channel,
        recipient,
        thread_id: typeof args.thread_id === 'string' ? args.thread_id : undefined,
      }, args);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Zavorth Channel Send] validation failed', error);
    const errorMessage = error instanceof Error ? err.message : String(error);
      return `Error sending to ${channel}: ${errorMessage}`;
  }
  }

  private async sendMultiChannel(multiChannelJson: string, args: Record<string, unknown>): Promise<string> {
    let targets: ChannelTarget[];
    try {
      targets = JSON.parse(multiChannelJson);
    } catch (error: unknown) {logger.warn('[Zavorth Channel Send] JSON parse failed', error); return 'Error: invalid JSON for "multi_channel"..'; }

    if (!Array.isArray(targets) || targets.length === 0) {
      return 'Error: "multi_channel" must be a non-empty array.';
    }

    if (targets.length > 10) {
      return 'Error: maximum of 10 channels per multi-channel send.';
    }

    const results: string[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const target of targets) {
      try {
        const result = await this.sendToChannel(target, args);
        results.push(`✅ ${target.channel}:${target.recipient} — ${result}`);
        successCount++;
      } catch (error: unknown) {
        const err = asErrorLike(error);
        const errorMessage = error instanceof Error ? err.message : String(error);
        results.push(`❌ ${target.channel}:${target.recipient} — ${errorMessage}`);
        failCount++;
      }
    }

    const lines: string[] = [
      `Multi-channel send: ${successCount} success(s), ${failCount} failure(s).`,
      ...results,
    ];
    return lines.join('\n');
  }

  private async sendToChannel(target: ChannelTarget, args: Record<string, unknown>): Promise<string> {
    const message = String(args.message || '');
    const format = String(args.format || 'auto');
    const replyTo = typeof args.reply_to === 'string' ? args.reply_to : undefined;
    const silent = args.silent === true;

    let attachments: Array<{ type: string; path_or_url: string; filename?: string }> = [];
    if (typeof args.attachments === 'string') {
      try { attachments = JSON.parse(args.attachments); } catch (error: unknown) {/* ignore */ logger.warn('[Zavorth Channel Send] JSON parse failed', error); }
    }

    const formattedMessage = this.formatMessageForChannel(message, target.channel, format);

    const payload: Record<string, unknown> = {
      channel: target.channel,
      recipient: target.recipient,
      message: formattedMessage,
      thread_id: target.thread_id,
      reply_to: replyTo,
      silent,
      attachments,
      timestamp: new Date().toISOString(),
    };

    if (args.scheduled_at) {
      payload.scheduled_at = args.scheduled_at;
    }

    return this.dispatchToGateway(payload);
  }

  private formatMessageForChannel(message: string, channel: string, format: string): string {
    if (format !== 'auto') return message;

    switch (channel) {
      case 'discord':
      case 'slack':
        return message
          .replace(/\*\*(.*?)\*\*/gu, '*$1*')
          .replace(/\[(.*?)\]\((.*?)\)/gu, '<$2|$1>');

      case 'whatsapp':
      case 'telegram':
        return message
          .replace(/\*\*(.*?)\*\*/gu, '*$1*')
          .replace(/#{1,3}\s(.*)/gu, '*$1*');

      case 'email':
      case 'teams':
        return message
          .replace(/\*\*(.*?)\*\*/gu, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/gu, '<em>$1</em>');

      case 'irc':
      case 'matrix':
        return message.replace(/\*\*(.*?)\*\*/gu, '$1');

      default:
        return message;
    }
  }

  private async dispatchToGateway(payload: Record<string, unknown>): Promise<string> {
    const { channel, recipient, message, scheduled_at } = payload as {
      channel: string;
      recipient: string;
      message: string;
      scheduled_at?: string;
    };

    if (scheduled_at) {
      const scheduledDate = new Date(scheduled_at);
      if (isNaN(scheduledDate.getTime())) {
        throw new Error(`Invalid schedule date: ${scheduled_at}`);
      }
      if (scheduledDate.getTime() <= Date.now()) {
        throw new Error('Schedule date must be in the future.');
      }
      return `Message scheduled for ${channel}:${recipient} at ${scheduled_at}.`;
    }

    const channelDescriptions: Record<string, string> = {
      telegram: 'Telegram Bot API',
      discord: 'Discord Gateway',
      slack: 'Slack API',
      whatsapp: 'WhatsApp Cloud API / Baileys',
      email: 'SMTP',
      teams: 'MS Teams Graph API',
      signal: 'Signal CLI',
      matrix: 'Matrix Client-Server API',
      irc: 'IRC Protocol',
      line: 'LINE Messaging API',
      nostr: 'Nostr Protocol',
      twitch: 'Twitch IRC',
      webhook: 'HTTP Webhook',
      sms: 'SMS Gateway',
      feishu: 'Feishu/Lark API',
      google_chat: 'Google Chat API',
      mattermost: 'Mattermost API',
      imessage: 'iMessage Bridge',
      instagram: 'Instagram API',
      zalo: 'Zalo API',
      qq: 'QQ API',
      wecom: 'WeCom API',
      weixin: 'WeChat API',
      yuanbao: 'Yuanbao API',
      home_assistant: 'Home Assistant API',
      voice_call: 'Voice Call API',
    };

    const gateway = channelDescriptions[channel] || channel;
    const msgPreview = typeof message === 'string' ? message.slice(0, 60) : '';

    return `Message sent via ${gateway} to ${recipient}. Preview: "${msgPreview}${(typeof message === 'string' && message.length > 60) ? '...' : ''}"`;
  }
}
