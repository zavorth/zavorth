/**
 * Declares which operator surfaces support voice, and how.
 * Future surfaces register here (or via registerVoiceSurface) to opt into the shared stack.
 */

export type VoiceSurfaceMode =
  | 'desktop-call'
  | 'desktop-dictation'
  | 'messaging-attachment'
  | 'messaging-webhook'
  | 'telegram-native'
  | 'none';

export type VoiceSurfaceCapability = {
  surfaceId: string;
  label: string;
  modes: VoiceSurfaceMode[];
  /** Uses VoicePreference + AudioTranscriptionService */
  preferenceStt: boolean;
  /** Can speak replies under VoiceTtsPolicy */
  preferenceTts: boolean;
  notes?: string;
};

const registry = new Map<string, VoiceSurfaceCapability>();

function seedDefaults(): void {
  if (registry.size > 0) return;
  const entries: VoiceSurfaceCapability[] = [
    {
      surfaceId: 'desktop',
      label: 'Desktop',
      modes: ['desktop-call', 'desktop-dictation'],
      preferenceStt: true,
      preferenceTts: true,
      notes: 'Mic dictation + Phone call (duplex/WebRTC).',
    },
    {
      surfaceId: 'web',
      label: 'Experience Web',
      modes: ['desktop-call'],
      preferenceStt: true,
      preferenceTts: true,
      notes: 'Same preference stack; duplex via experience APIs.',
    },
    {
      surfaceId: 'telegram',
      label: 'Telegram',
      modes: ['telegram-native'],
      preferenceStt: true,
      preferenceTts: true,
      notes: 'Native voice messages via AudioHandler + preference STT/TTS.',
    },
    {
      surfaceId: 'discord',
      label: 'Discord',
      modes: ['messaging-attachment'],
      preferenceStt: true,
      preferenceTts: true,
      notes: 'Voice attachments via MessagingChannelVoiceIngest.',
    },
    {
      surfaceId: 'whatsapp',
      label: 'WhatsApp',
      modes: ['messaging-webhook'],
      preferenceStt: true,
      preferenceTts: true,
      notes: 'Cloud API audio URL or media id + WHATSAPP_ACCESS_TOKEN.',
    },
    {
      surfaceId: 'slack',
      label: 'Slack',
      modes: ['messaging-webhook'],
      preferenceStt: true,
      preferenceTts: true,
      notes: 'File attachments; private URLs need SLACK_BOT_TOKEN.',
    },
    {
      surfaceId: 'signal',
      label: 'Signal',
      modes: ['messaging-webhook'],
      preferenceStt: true,
      preferenceTts: true,
      notes: 'Webhook payload audio when URL/base64 present.',
    },
    {
      surfaceId: 'teams',
      label: 'Microsoft Teams',
      modes: ['messaging-webhook'],
      preferenceStt: true,
      preferenceTts: true,
      notes: 'Activity attachments with contentUrl when present.',
    },
    {
      surfaceId: 'instagram',
      label: 'Instagram',
      modes: ['messaging-webhook'],
      preferenceStt: true,
      preferenceTts: true,
    },
    {
      surfaceId: 'email',
      label: 'Email',
      modes: ['none'],
      preferenceStt: false,
      preferenceTts: false,
      notes: 'No default voice path (attachments are not auto-transcribed).',
    },
    {
      surfaceId: 'cli',
      label: 'CLI',
      modes: ['desktop-dictation'],
      preferenceStt: true,
      preferenceTts: true,
      notes: 'Local voice tools when configured.',
    },
  ];
  for (const e of entries) registry.set(e.surfaceId, e);
}

export function registerVoiceSurface(cap: VoiceSurfaceCapability): void {
  seedDefaults();
  registry.set(cap.surfaceId, cap);
}

export function getVoiceSurfaceCapability(surfaceId: string): VoiceSurfaceCapability | null {
  seedDefaults();
  return registry.get(String(surfaceId || '').trim()) || null;
}

export function listVoiceSurfaceCapabilities(): VoiceSurfaceCapability[] {
  seedDefaults();
  return [...registry.values()].sort((a, b) => a.surfaceId.localeCompare(b.surfaceId));
}

export function surfaceSupportsVoice(surfaceId: string): boolean {
  const cap = getVoiceSurfaceCapability(surfaceId);
  if (!cap) return false;
  return cap.modes.some((m) => m !== 'none') && cap.preferenceStt;
}

export function resetVoiceSurfaceRegistryForTests(): void {
  registry.clear();
}
