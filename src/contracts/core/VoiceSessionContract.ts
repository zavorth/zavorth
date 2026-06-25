import type { SpeechArtifactRef, SpeechProviderEvidence } from './SpeechContract.js';

export const VOICE_SESSION_CONTRACT_VERSION = 'voice-session-v1' as const;
export const VOICE_SESSION_CAPABILITY_ID = 'voice.session' as const;

export type VoiceSessionMode = 'push_to_talk' | 'live_call' | 'meeting_bridge';
export type VoiceSessionStatus = 'planned' | 'waiting_consent' | 'active' | 'completed' | 'failed' | 'cancelled';

export type VoiceSessionConsent = {
  required: boolean;
  granted: boolean;
  grantedBy: string | null;
  grantedAt: string | null;
  reason: string;
};

export type VoiceSessionRequest = {
  mode: VoiceSessionMode;
  channelId?: string | null;
  participants: string[];
  goal: string;
  sessionId?: string | null;
  correlationId?: string | null;
};

export type VoiceSessionTurn = {
  turnId: string;
  speakerId: string | null;
  transcript: string;
  audioArtifact: SpeechArtifactRef | null;
  startedAt: string | null;
  endedAt: string | null;
};

export type VoiceSessionResult = {
  ok: boolean;
  contractVersion: typeof VOICE_SESSION_CONTRACT_VERSION;
  voiceSessionId: string;
  status: VoiceSessionStatus;
  consent: VoiceSessionConsent;
  turns: VoiceSessionTurn[];
  transcriptArtifactId: string | null;
  providerEvidence: SpeechProviderEvidence[];
  receiptId: string;
  processedAt: string;
  error: string | null;
};
