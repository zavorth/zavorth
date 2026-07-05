/**
 * ChannelCapabilitiesService — Capability-based channel registry.
 *
 * Each channel declares what it supports. The PresentationAdapter uses
 * these capabilities to format responses appropriately without
 * channel-specific hardcoding.
 *
 * New channels simply register their capabilities and everything works
 * automatically via the fallback chain.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChannelCapabilities {
  /** Channel identifier (e.g., 'telegram', 'whatsapp', 'discord'). */
  id: string;

  /** Human-readable channel name. */
  label: string;

  /** Whether the channel supports Markdown formatting. */
  supportsMarkdown: boolean;

  /** Whether the channel supports inline buttons / quick replies. */
  supportsButtons: boolean;

  /** Whether the channel supports rich embeds (cards with title, description, color). */
  supportsRichEmbeds: boolean;

  /** Whether the channel supports sending images. */
  supportsImages: boolean;

  /** Whether the channel supports sending audio / voice messages. */
  supportsAudio: boolean;

  /** Whether the channel supports sending video. */
  supportsVideo: boolean;

  /** Whether the channel supports reactions (emoji reactions to messages). */
  supportsReactions: boolean;

  /** Whether the channel supports HTML formatting. */
  supportsHTML: boolean;

  /** Whether the channel supports threaded conversations. */
  supportsThreads: boolean;

  /** Whether the channel supports editing messages after sending. */
  supportsMessageEditing: boolean;

  /** Whether the channel supports message pinning. */
  supportsPinning: boolean;

  /** Maximum characters per single message. 0 = no limit. */
  maxMessageLength: number;

  /** Maximum number of buttons per message. 0 = no buttons. */
  maxButtonsPerMessage: number;

  /** Maximum number of media attachments per message. */
  maxAttachmentsPerMessage: number;

  /** Whether the channel supports ephemeral messages (visible only to one user). */
  supportsEphemeral: boolean;

  /** Whether the channel supports scheduled / delayed messages. */
  supportsScheduledMessages: boolean;

  /** Whether the channel supports typing indicators. */
  supportsTypingIndicator: boolean;

  /** Whether the channel supports presence / online status. */
  supportsPresence: boolean;
}

// ---------------------------------------------------------------------------
// Default capabilities (most restrictive — plain text fallback)
// ---------------------------------------------------------------------------

const FALLBACK_CAPABILITIES: ChannelCapabilities = {
  id: 'unknown',
  label: 'Unknown Channel',
  supportsMarkdown: false,
  supportsButtons: false,
  supportsRichEmbeds: false,
  supportsImages: false,
  supportsAudio: false,
  supportsVideo: false,
  supportsReactions: false,
  supportsHTML: false,
  supportsThreads: false,
  supportsMessageEditing: false,
  supportsPinning: false,
  maxMessageLength: 4096,
  maxButtonsPerMessage: 0,
  maxAttachmentsPerMessage: 0,
  supportsEphemeral: false,
  supportsScheduledMessages: false,
  supportsTypingIndicator: false,
  supportsPresence: false,
};

// ---------------------------------------------------------------------------
// Built-in channel profiles
// ---------------------------------------------------------------------------

const BUILTIN_CHANNELS: ChannelCapabilities[] = [
  {
    id: 'telegram',
    label: 'Telegram',
    supportsMarkdown: true,
    supportsButtons: true,
    supportsRichEmbeds: false,
    supportsImages: true,
    supportsAudio: true,
    supportsVideo: true,
    supportsReactions: true,
    supportsHTML: false,
    supportsThreads: true,
    supportsMessageEditing: true,
    supportsPinning: true,
    maxMessageLength: 4096,
    maxButtonsPerMessage: 8,
    maxAttachmentsPerMessage: 10,
    supportsEphemeral: false,
    supportsScheduledMessages: false,
    supportsTypingIndicator: true,
    supportsPresence: false,
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    supportsMarkdown: false,
    supportsButtons: false,
    supportsRichEmbeds: false,
    supportsImages: true,
    supportsAudio: true,
    supportsVideo: true,
    supportsReactions: true,
    supportsHTML: false,
    supportsThreads: false,
    supportsMessageEditing: false,
    supportsPinning: false,
    maxMessageLength: 4096,
    maxButtonsPerMessage: 0,
    maxAttachmentsPerMessage: 10,
    supportsEphemeral: false,
    supportsScheduledMessages: false,
    supportsTypingIndicator: true,
    supportsPresence: true,
  },
  {
    id: 'discord',
    label: 'Discord',
    supportsMarkdown: true,
    supportsButtons: true,
    supportsRichEmbeds: true,
    supportsImages: true,
    supportsAudio: true,
    supportsVideo: true,
    supportsReactions: true,
    supportsHTML: false,
    supportsThreads: true,
    supportsMessageEditing: true,
    supportsPinning: true,
    maxMessageLength: 2000,
    maxButtonsPerMessage: 5,
    maxAttachmentsPerMessage: 10,
    supportsEphemeral: true,
    supportsScheduledMessages: false,
    supportsTypingIndicator: true,
    supportsPresence: true,
  },
  {
    id: 'slack',
    label: 'Slack',
    supportsMarkdown: true,
    supportsButtons: true,
    supportsRichEmbeds: true,
    supportsImages: true,
    supportsAudio: false,
    supportsVideo: false,
    supportsReactions: true,
    supportsHTML: false,
    supportsThreads: true,
    supportsMessageEditing: true,
    supportsPinning: true,
    maxMessageLength: 40000,
    maxButtonsPerMessage: 25,
    maxAttachmentsPerMessage: 10,
    supportsEphemeral: true,
    supportsScheduledMessages: false,
    supportsTypingIndicator: true,
    supportsPresence: true,
  },
  {
    id: 'email',
    label: 'Email',
    supportsMarkdown: false,
    supportsButtons: false,
    supportsRichEmbeds: false,
    supportsImages: false,
    supportsAudio: false,
    supportsVideo: false,
    supportsReactions: false,
    supportsHTML: true,
    supportsThreads: false,
    supportsMessageEditing: false,
    supportsPinning: false,
    maxMessageLength: 0,
    maxButtonsPerMessage: 0,
    maxAttachmentsPerMessage: 5,
    supportsEphemeral: false,
    supportsScheduledMessages: true,
    supportsTypingIndicator: false,
    supportsPresence: false,
  },
  {
    id: 'web-dashboard',
    label: 'Web Dashboard',
    supportsMarkdown: true,
    supportsButtons: true,
    supportsRichEmbeds: true,
    supportsImages: true,
    supportsAudio: true,
    supportsVideo: true,
    supportsReactions: true,
    supportsHTML: true,
    supportsThreads: true,
    supportsMessageEditing: true,
    supportsPinning: true,
    maxMessageLength: 0,
    maxButtonsPerMessage: 20,
    maxAttachmentsPerMessage: 20,
    supportsEphemeral: true,
    supportsScheduledMessages: true,
    supportsTypingIndicator: true,
    supportsPresence: true,
  },
  {
    id: 'cli',
    label: 'CLI Terminal',
    supportsMarkdown: true,
    supportsButtons: false,
    supportsRichEmbeds: false,
    supportsImages: false,
    supportsAudio: false,
    supportsVideo: false,
    supportsReactions: false,
    supportsHTML: false,
    supportsThreads: false,
    supportsMessageEditing: false,
    supportsPinning: false,
    maxMessageLength: 0,
    maxButtonsPerMessage: 0,
    maxAttachmentsPerMessage: 0,
    supportsEphemeral: false,
    supportsScheduledMessages: false,
    supportsTypingIndicator: false,
    supportsPresence: false,
  },
  {
    id: 'signal',
    label: 'Signal',
    supportsMarkdown: false,
    supportsButtons: false,
    supportsRichEmbeds: false,
    supportsImages: true,
    supportsAudio: true,
    supportsVideo: true,
    supportsReactions: true,
    supportsHTML: false,
    supportsThreads: false,
    supportsMessageEditing: false,
    supportsPinning: false,
    maxMessageLength: 0,
    maxButtonsPerMessage: 0,
    maxAttachmentsPerMessage: 10,
    supportsEphemeral: false,
    supportsScheduledMessages: false,
    supportsTypingIndicator: true,
    supportsPresence: false,
  },
  {
    id: 'imessage',
    label: 'iMessage',
    supportsMarkdown: false,
    supportsButtons: false,
    supportsRichEmbeds: false,
    supportsImages: true,
    supportsAudio: true,
    supportsVideo: true,
    supportsReactions: true,
    supportsHTML: false,
    supportsThreads: false,
    supportsMessageEditing: false,
    supportsPinning: false,
    maxMessageLength: 0,
    maxButtonsPerMessage: 0,
    maxAttachmentsPerMessage: 10,
    supportsEphemeral: false,
    supportsScheduledMessages: false,
    supportsTypingIndicator: true,
    supportsPresence: true,
  },
];

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ZavorthChannelCapabilitiesService {
  private readonly channels = new Map<string, ChannelCapabilities>();

  constructor() {
    for (const channel of BUILTIN_CHANNELS) {
      this.channels.set(channel.id, channel);
    }
  }

  /**
   * Register or update capabilities for a channel.
   * Allows custom channels to declare their own capabilities at runtime.
   */
  public register(capabilities: ChannelCapabilities): void {
    this.channels.set(capabilities.id, capabilities);
  }

  /**
   * Get capabilities for a channel. Returns the fallback if not found.
   */
  public get(channelId: string): ChannelCapabilities {
    return this.channels.get(channelId) ?? { ...FALLBACK_CAPABILITIES, id: channelId };
  }

  /**
   * Check if a specific capability is supported by a channel.
   */
  public supports(channelId: string, capability: keyof ChannelCapabilities): boolean {
    const caps = this.get(channelId);
    const value = caps[capability];
    return typeof value === 'boolean' ? value : false;
  }

  /**
   * Get the maximum message length for a channel. 0 means no limit.
   */
  public getMaxMessageLength(channelId: string): number {
    return this.get(channelId).maxMessageLength;
  }

  /**
   * List all registered channel IDs.
   */
  public listChannelIds(): string[] {
    return Array.from(this.channels.keys());
  }

  /**
   * Check if a channel is registered.
   */
  public has(channelId: string): boolean {
    return this.channels.has(channelId);
  }

  /**
   * Remove a custom channel from the registry.
   * Cannot remove built-in channels.
   */
  public unregister(channelId: string): boolean {
    const isBuiltin = BUILTIN_CHANNELS.some((c) => c.id === channelId);
    if (isBuiltin) return false;
    return this.channels.delete(channelId);
  }
}
