export const PLATFORM_KEYS = [
  'telegram',
  'discord',
  'whatsapp',
  'instagram',
  'slack',
  'signal',
  'imessage',
  'teams',
  'email',
  'matrix',
  'feishu',
  'google-chat',
  'irc',
  'zalo',
  'wecom',
  'weixin',
  'yuanbao',
  'sms',
  'home-assistant',
  'voice-call',
  'google-meet',
  'line',
  'twitch',
  'qq',
  'nextcloud-talk',
  'mattermost',
  'synology-chat',
  'clickclack',
  'nostr',
] as const;
export const MESSAGE_CHANNELS = [
  'telegram',
  'discord',
  'whatsapp',
  'instagram',
  'slack',
  'signal',
  'imessage',
  'teams',
  'email',
  'matrix',
  'feishu',
  'google-chat',
  'irc',
  'zalo',
  'wecom',
  'weixin',
  'yuanbao',
  'sms',
  'home-assistant',
  'voice-call',
  'google-meet',
  'line',
  'twitch',
  'qq',
  'nextcloud-talk',
  'mattermost',
  'synology-chat',
  'clickclack',
  'nostr',
  'web',
  'cli',
  'api',
] as const;
export const TASK_SOURCES = [
  'telegram',
  'discord',
  'whatsapp',
  'instagram',
  'slack',
  'signal',
  'imessage',
  'teams',
  'email',
  'matrix',
  'feishu',
  'google-chat',
  'irc',
  'zalo',
  'wecom',
  'weixin',
  'yuanbao',
  'sms',
  'home-assistant',
  'voice-call',
  'google-meet',
  'line',
  'twitch',
  'qq',
  'nextcloud-talk',
  'mattermost',
  'synology-chat',
  'clickclack',
  'nostr',
  'web',
  'cli',
  'api',
  'system',
  'bridge',
] as const;

export type PlatformKey = (typeof PLATFORM_KEYS)[number];
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];
export type TaskSource = (typeof TASK_SOURCES)[number];

export type PlatformReadiness = 'ready' | 'partial' | 'planned' | 'disabled';
export type PlatformImplementationState = 'full' | 'partial' | 'local' | 'planned';
export type PlatformTransport = 'native' | 'webhook' | 'local' | 'local' | 'bridge' | 'virtual' | 'planned';

export interface PlatformCapability {
  platform: PlatformKey;
  implementationState: PlatformImplementationState;
  readiness: PlatformReadiness;
  configured: boolean;
  transport: PlatformTransport;
  envKeys: string[];
  notes: string[];
}

export interface PlatformGatewayContract {
  readonly platform: PlatformKey;
  readonly supportsRoleAwareBroadcast?: boolean;
  resolveBroadcastRecipients?(roles?: string[]): Promise<string[]> | string[];
  getIdentityHints?(): { linkedBy: string; verificationMethod: string };
  start?(): Promise<void> | void;
  stop?(): Promise<void> | void;
  broadcast?(message: string, roles?: string[]): Promise<void>;
}

export type PlatformIdentityHints = {
  linkedBy: string;
  verificationMethod: string;
};

export interface LiveChannelGatewayContract extends PlatformGatewayContract {
  isStarted?(): boolean;
  getIdentityHints?(): PlatformIdentityHints;
  readStatus?(): Record<string, unknown> | null;
}

export interface LiveChannelBroadcastGatewayContract extends LiveChannelGatewayContract {
  readonly supportsRoleAwareBroadcast?: boolean;
  resolveBroadcastRecipients?(roles?: string[]): Promise<string[]> | string[];
  broadcast?(message: string, roles?: string[]): Promise<void>;
}

export interface PlatformTextMessage {
  platform: MessageChannel;
  userId: string;
  chatId: string;
  isGroup: boolean;
  rawText: string;
}

export function isPlatformKey(value: string): value is PlatformKey {
  return PLATFORM_KEYS.includes(value as PlatformKey);
}

export function normalizePlatformKey(value: string): PlatformKey | null {
  const normalized = String(value || '').trim().toLowerCase();
  return isPlatformKey(normalized) ? normalized : null;
}

export function isTaskSource(value: string): value is TaskSource {
  return TASK_SOURCES.includes(value as TaskSource);
}
