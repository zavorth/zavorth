/**
 * PresentationAdapterService — Transforms agent responses into
 * channel-appropriate formats based on declared capabilities.
 *
 * This replaces per-channel formatting code with a single capability-based
 * adapter. Any new channel works automatically by registering its
 * capabilities — no adapter code needed.
 *
 * Architecture:
 *   Agent response (universal format)
 *         │
 *         ▼
 *   PresentationAdapter.resolve(channelId)
 *         │
 *         ▼
 *   Formatted output matching channel capabilities
 */

import {
  ZavorthChannelCapabilitiesService,
  type ChannelCapabilities,
} from './ZavorthChannelCapabilitiesService.js';

export type ResponseContentType =
  | 'text'
  | 'choice'
  | 'confirmation'
  | 'card'
  | 'list'
  | 'code'
  | 'error'
  | 'status';

export interface UniversalResponse {
  type: ResponseContentType;
  title?: string;
  text: string;
  options?: string[];
  items?: string[];
  code?: string;
  language?: string;
  severity?: 'info' | 'warning' | 'error' | 'success';
  metadata?: Record<string, unknown>;
}

export interface FormattedMessage {
  /** The formatted text to send. */
  text: string;

  /** Optional inline buttons (only if channel supports them). */
  buttons?: Array<{ label: string; value: string }>;

  /** Whether this message should be ephemeral (if channel supports it). */
  ephemeral?: boolean;

  /** Suggested typing delay in ms before sending (simulates natural pace). */
  typingDelayMs?: number;

  /** Original response type preserved for channel-specific post-processing. */
  originalType: ResponseContentType;

  /** Capabilities that were used during formatting. */
  appliedCapabilities: string[];
}

export class ZavorthPresentationAdapterService {
  private readonly caps: ZavorthChannelCapabilitiesService;

  constructor(capsService?: ZavorthChannelCapabilitiesService) {
    this.caps = capsService ?? new ZavorthChannelCapabilitiesService();
  }

  /**
   * Main entry point: transform a universal response for a specific channel.
   */
  public format(response: UniversalResponse, channelId: string): FormattedMessage {
    const capabilities = this.caps.get(channelId);
    const applied: string[] = [];

    switch (response.type) {
      case 'text':
        return this.formatText(response, capabilities, applied);

      case 'choice':
        return this.formatChoice(response, capabilities, applied);

      case 'confirmation':
        return this.formatConfirmation(response, capabilities, applied);

      case 'card':
        return this.formatCard(response, capabilities, applied);

      case 'list':
        return this.formatList(response, capabilities, applied);

      case 'code':
        return this.formatCode(response, capabilities, applied);

      case 'error':
        return this.formatError(response, capabilities, applied);

      case 'status':
        return this.formatStatus(response, capabilities, applied);

      default:
        return this.formatText(response, capabilities, applied);
    }
  }

  /**
   * Split a long message into chunks that fit within the channel's
   * maximum message length.
   */
  public splitMessage(text: string, channelId: string): string[] {
    const maxLen = this.caps.getMaxMessageLength(channelId);
    if (maxLen <= 0) return [text];

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxLen) {
        chunks.push(remaining);
        break;
      }

      // Try to split at the last newline before the limit
      let splitAt = remaining.lastIndexOf('\n', maxLen);
      if (splitAt <= 0) {
        // No newline found — split at last space
        splitAt = remaining.lastIndexOf(' ', maxLen);
      }
      if (splitAt <= 0) {
        // No space found — hard cut
        splitAt = maxLen;
      }

      chunks.push(remaining.slice(0, splitAt).trimEnd());
      remaining = remaining.slice(splitAt).trimStart();
    }

    return chunks;
  }

  private formatText(
    response: UniversalResponse,
    caps: ChannelCapabilities,
    applied: string[],
  ): FormattedMessage {
    let text = response.text;

    if (caps.supportsMarkdown) {
      text = this.adaptMarkdownForChannel(text, caps.id);
      applied.push('markdown');
      if (this.isChannelFamily(caps.id, ['discord'])) applied.push('discord-markdown');
      if (this.isChannelFamily(caps.id, ['whatsapp', 'sms'])) applied.push('short-blocks');
    } else {
      text = this.stripMarkdown(text);
      applied.push('plain-text');
    }

    if (response.title) {
      text = caps.supportsMarkdown ? `**${response.title}**\n\n${text}` : `${response.title.toUpperCase()}\n\n${text}`;
    }

    return {
      text: this.truncate(text, caps.maxMessageLength),
      originalType: 'text',
      appliedCapabilities: applied,
    };
  }

  /**
   * Channel-aware markdown adaptation (no separate ChannelFormatService).
   * Discord: no tables, wrap bare URLs; WhatsApp: shorter blocks / simple bold.
   */
  public adaptMarkdownForChannel(text: string, channelId: string): string {
    let next = String(text || '');
    const id = String(channelId || '').toLowerCase();

    if (this.isChannelFamily(id, ['discord'])) {
      next = this.convertMarkdownTablesToLists(next);
      next = this.wrapBareUrlsForDiscord(next);
      appliedCapabilityHint(next);
    }

    if (this.isChannelFamily(id, ['whatsapp', 'sms', 'imessage'])) {
      next = this.convertMarkdownTablesToLists(next);
      next = this.shortenBlocksForMessaging(next);
      // WhatsApp prefers *bold* single-asterisk in many clients; keep ** for universal and strip tables already.
    }

    if (this.isChannelFamily(id, ['telegram'])) {
      // Telegram supports fuller markdown; keep tables as-is unless huge.
      if (next.length > 3500) {
        next = this.convertMarkdownTablesToLists(next);
      }
    }

    return next;
  }

  private isChannelFamily(channelId: string, families: string[]): boolean {
    const id = String(channelId || '').toLowerCase();
    return families.some((family) => id === family || id.startsWith(`${family}-`) || id.includes(family));
  }

  private convertMarkdownTablesToLists(text: string): string {
    const lines = text.split(/\r...\n/);
    const out: string[] = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const next = lines[i + 1] || '';
      const isTableHeader = /\|/.test(line) && /^\s*\|...[\s:-]+\|/.test(next);
      if (!isTableHeader) {
        out.push(line);
        i += 1;
        continue;
      }
      const headers = splitTableRow(line);
      i += 2; // skip header + separator
      while (i < lines.length && /\|/.test(lines[i]) && !/^\s*$/.test(lines[i])) {
        const cells = splitTableRow(lines[i]);
        const parts = headers.map((header, idx) => `${header}: ${cells[idx] || ''}`.trim());
        out.push(`- ${parts.join(' · ')}`);
        i += 1;
      }
    }
    return out.join('\n');
  }

  private wrapBareUrlsForDiscord(text: string): string {
    return text.replace(/(https?:\/\/[^\s<>()]+)/g, (full, url: string, offset: number, source: string) => {
      if (offset > 0 && source[offset - 1] === '<') return full;
      const trailing = url.match(/[.,);]+$/)?.[0] || '';
      const core = trailing ? url.slice(0, -trailing.length) : url;
      return `<${core}>${trailing}`;
    });
  }

  private shortenBlocksForMessaging(text: string): string {
    // Collapse long fenced blocks to a short notice + first lines.
    return text.replace(/```[\w-]*\n([\s\S]*...)```/g, (_full, body: string) => {
      const lines = String(body || '').split(/\r...\n/).filter(Boolean);
      if (lines.length <= 8) return `\`\`\`\n${lines.join('\n')}\n\`\`\``;
      return `\`\`\`\n${lines.slice(0, 6).join('\n')}\n… (${lines.length - 6} more lines)\n\`\`\``;
    });
  }

  private formatChoice(
    response: UniversalResponse,
    caps: ChannelCapabilities,
    applied: string[],
  ): FormattedMessage {
    let text = response.text;
    const buttons: Array<{ label: string; value: string }> = [];

    if (caps.supportsButtons && response.options && response.options.length <= caps.maxButtonsPerMessage) {
      // Use inline buttons
      for (const opt of response.options) {
        buttons.push({ label: opt, value: opt });
      }
      applied.push('inline-buttons');
    } else if (response.options) {
      // Fallback: numbered list
      const numbered = response.options.map((opt, i) => `${i + 1}\uFE0F\u20E3 ${opt}`).join('\n');
      text = `${text}\n\n${numbered}`;
      applied.push('numbered-list');
    }

    if (caps.supportsMarkdown && !caps.supportsButtons) {
      text = `**${text}**`;
    }

    return {
      text: this.truncate(text, caps.maxMessageLength),
      buttons: buttons.length > 0 ? buttons : undefined,
      originalType: 'choice',
      appliedCapabilities: applied,
    };
  }

  private formatConfirmation(
    response: UniversalResponse,
    caps: ChannelCapabilities,
    applied: string[],
  ): FormattedMessage {
    let text = response.text;
    const buttons: Array<{ label: string; value: string }> = [];

    if (caps.supportsButtons && caps.maxButtonsPerMessage >= 2) {
      buttons.push({ label: 'Confirm', value: 'confirm' });
      buttons.push({ label: 'Cancel', value: 'cancel' });
      applied.push('confirm-buttons');
    } else {
      const sep = caps.supportsMarkdown ? '*' : '';
      text = `${response.text}\n\n${sep}Reply "yes" to confirm or "no" to cancel${sep}`;
      applied.push('text-confirmation');
    }

    if (caps.supportsMarkdown) {
      text = `**${response.title ?? 'Confirmation'}**\n\n${text}`;
    }

    return {
      text: this.truncate(text, caps.maxMessageLength),
      buttons: buttons.length > 0 ? buttons : undefined,
      originalType: 'confirmation',
      appliedCapabilities: applied,
    };
  }

  private formatCard(
    response: UniversalResponse,
    caps: ChannelCapabilities,
    applied: string[],
  ): FormattedMessage {
    let text = response.text;

    if (caps.supportsRichEmbeds) {
      // Channel supports rich embeds — return structured data
      // The channel adapter will build the embed
      text = response.title ? `**${response.title}**\n\n${text}`
        : text;
      applied.push('rich-embed');
    } else if (caps.supportsMarkdown) {
      // Markdown fallback with visual separation
      const divider = '\u2500'.repeat(20);
      text = response.title ? `${divider}\n**${response.title}**\n${divider}\n\n${text}`
        : `${divider}\n\n${text}`;
      applied.push('markdown-card');
    } else {
      // Plain text fallback
      text = response.title ? `[${response.title}]\n\n${text}`
        : text;
      applied.push('plain-card');
    }

    return {
      text: this.truncate(text, caps.maxMessageLength),
      originalType: 'card',
      appliedCapabilities: applied,
    };
  }

  private formatList(
    response: UniversalResponse,
    caps: ChannelCapabilities,
    applied: string[],
  ): FormattedMessage {
    let text = response.text;

    if (response.items && response.items.length > 0) {
      const separator = caps.supportsMarkdown ? '\n' : '\n';
      const prefix = caps.supportsMarkdown ? '- ' : '\u2022 ';
      const items = response.items.map((item) => `${prefix}${item}`).join(separator);
      text = text ? `${text}\n\n${items}` : items;
      applied.push('bullet-list');
    }

    if (response.title) {
      text = caps.supportsMarkdown ? `**${response.title}**\n\n${text}` : `${response.title.toUpperCase()}\n\n${text}`;
    }

    return {
      text: this.truncate(text, caps.maxMessageLength),
      originalType: 'list',
      appliedCapabilities: applied,
    };
  }

  private formatCode(
    response: UniversalResponse,
    caps: ChannelCapabilities,
    applied: string[],
  ): FormattedMessage {
    let text = response.text;

    if (response.code) {
      if (caps.supportsMarkdown) {
        const lang = response.language ?? '';
        text = `${text}\n\n\`\`\`${lang}\n${response.code}\n\`\`\``;
        applied.push('code-block');
      } else {
        // Indent code as plain text fallback
        const indented = response.code.split('\n').map((line) => `  ${line}`).join('\n');
        text = `${text}\n\n${indented}`;
        applied.push('indented-code');
      }
    }

    return {
      text: this.truncate(text, caps.maxMessageLength),
      originalType: 'code',
      appliedCapabilities: applied,
    };
  }

  private formatError(
    response: UniversalResponse,
    caps: ChannelCapabilities,
    applied: string[],
  ): FormattedMessage {
    const emoji = caps.supportsMarkdown ? '\u26A0\uFE0F ' : '[ERROR] ';
    let text = `${emoji}${response.text}`;

    if (caps.supportsMarkdown) {
      text = `**Error**\n\n${text}`;
    }

    return {
      text: this.truncate(text, caps.maxMessageLength),
      originalType: 'error',
      appliedCapabilities: applied,
      typingDelayMs: 500,
    };
  }

  private formatStatus(
    response: UniversalResponse,
    caps: ChannelCapabilities,
    applied: string[],
  ): FormattedMessage {
    let text = response.text;

    if (caps.supportsMarkdown) {
      const icon = response.severity === 'success' ? '\u2705'
        : response.severity === 'warning' ? '\u26A0\uFE0F'
        : response.severity === 'error' ? '\u274C'
        : '\u2139\uFE0F';
      text = `${icon} ${response.title ? `**${response.title}**\n\n` : ''}${text}`;
      applied.push('markdown-status');
    } else {
      const prefix = response.severity?.toUpperCase() ?? 'INFO';
      text = `[${prefix}] ${response.title ? `${response.title}: ` : ''}${text}`;
      applied.push('plain-status');
    }

    return {
      text: this.truncate(text, caps.maxMessageLength),
      originalType: 'status',
      appliedCapabilities: applied,
    };
  }

  private stripMarkdown(text: string): string {
    return text
      .replace(/\*\*(.*...)\*\*/g, '$1')
      .replace(/\*(.*...)\*/g, '$1')
      .replace(/`(.*...)`/g, '$1')
      .replace(/```[\s\S]*...```/g, '[code]')
      .replace(/^#{1,6}\s/gm, '')
      .replace(/^[-*]\s/gm, '\u2022 ')
      .replace(/^\d+\.\s/gm, (match) => match);
  }

  private truncate(text: string, maxLength: number): string {
    if (maxLength <= 0) return text;
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  }
}

function splitTableRow(line: string): string[] {
  return String(line || '')
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function appliedCapabilityHint(_text: string): void {
  // placeholder for future metrics hook
}
