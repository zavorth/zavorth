export type VoiceWakeMode = 'off' | 'armed' | 'listening' | 'capturing' | 'cooldown';

export type VoiceWakeDetectorKind = 'external-process' | 'embedded-local' | 'local' | 'disabled';

export type VoiceWakePrivacyPolicy = {
  localOnly: true;
  rawAudioPersisted: false;
  transcriptPersisted: 'receipt-only';
  visibleIndicatorRequired: true;
  ttlRequired: true;
  defaultTtlSeconds: number;
};

export type VoiceWakeDetectorSnapshot = {
  kind: VoiceWakeDetectorKind;
  configured: boolean;
  command: string | null;
  args: string[];
};

export type VoiceWakeReceipt = {
  id: string;
  createdAt: string;
  event:
    | 'armed'
    | 'disarmed'
    | 'expired'
    | 'wake_detected'
    | 'capture_started'
    | 'transcript_committed'
    | 'cooldown_started';
  summary: string;
  transcript?: string | null;
  rawAudioPersisted: false;
};

export type VoiceWakeSession = {
  contractVersion: 'voice-wake/1';
  sessionId: string;
  mode: VoiceWakeMode;
  armedUntil: string | null;
  detector: VoiceWakeDetectorSnapshot;
  privacy: VoiceWakePrivacyPolicy;
  lastReceipt: VoiceWakeReceipt | null;
  receipts: VoiceWakeReceipt[];
  safety: {
    defaultOff: true;
    localWakeOnly: true;
    noRawAudioPersistence: true;
    autoDisarmOnTtl: true;
    visibleMicIndicator: true;
  };
};

export type VoiceWakeCommandEvent =
  | { type: 'wake'; transcript?: string | null }
  | { type: 'capture_started' }
  | { type: 'transcript'; transcript: string }
  | { type: 'cooldown' }
  | { type: 'lock_screen' }
  | { type: 'sensitive_profile' };
