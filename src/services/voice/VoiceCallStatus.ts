/**
 * User-facing voice call status (priority 5).
 * Shared by Desktop UI and tests (no React deps).
 */

export type VoiceCallStatusTone = 'idle' | 'info' | 'active' | 'warn' | 'error' | 'success';

export type VoiceCallStatusModel = {
  key: string;
  label: string;
  detail: string;
  tone: VoiceCallStatusTone;
  color: string;
};

export function resolveVoiceCallStatus(input: {
  active: boolean;
  phase?: string | null;
  webrtcState?: string | null;
  mediaMode?: string | null;
  mediaPlane?: string | null;
  busy?: boolean;
  lastError?: string | null;
  rms?: number;
}): VoiceCallStatusModel {
  if (!input.active) {
    return {
      key: 'idle',
      label: 'Idle',
      detail: 'Start a voice call when ready.',
      tone: 'idle',
      color: '#6b7280',
    };
  }

  const phase = String(input.phase || 'idle').toLowerCase();
  const webrtc = String(input.webrtcState || '').toLowerCase();
  const err = String(input.lastError || '').trim();

  if (phase === 'error' || err) {
    return {
      key: 'error',
      label: 'Error',
      detail: err || 'Voice call failed. Type your message instead.',
      tone: 'error',
      color: '#ef4444',
    };
  }

  if (
    phase === 'idle' ||
    phase === 'connecting' ||
    webrtc === 'new' ||
    webrtc === 'connecting' ||
    webrtc === 'checking'
  ) {
    if (phase !== 'listening' && phase !== 'processing' && phase !== 'speaking') {
      return {
        key: 'connecting',
        label: 'Connecting',
        detail:
          input.mediaPlane === 'native_wrtc'
            ? 'Opening mic + WebRTC media plane…'
            : 'Opening microphone and session…',
        tone: 'info',
        color: '#3b82f6',
      };
    }
  }

  if (phase === 'processing' || input.busy) {
    return {
      key: 'thinking',
      label: 'Thinking',
      detail: 'Transcribing and running the agent…',
      tone: 'active',
      color: '#a855f7',
    };
  }

  if (phase === 'speaking') {
    return {
      key: 'speaking',
      label: 'Speaking',
      detail: 'Agent is talking — speak to interrupt (barge-in).',
      tone: 'success',
      color: '#22c55e',
    };
  }

  if (phase === 'listening') {
    const hearing = (input.rms || 0) > 0.02;
    return {
      key: 'listening',
      label: hearing ? 'Hearing you' : 'Listening',
      detail: hearing
        ? 'Speech detected…'
        : 'Mic open — pause when you finish speaking.',
      tone: 'active',
      color: hearing ? '#f59e0b' : '#06b6d4',
    };
  }

  if (phase === 'ended') {
    return {
      key: 'ended',
      label: 'Ended',
      detail: 'Call session closed.',
      tone: 'idle',
      color: '#6b7280',
    };
  }

  return {
    key: phase || 'active',
    label: phase || 'Active',
    detail: [input.mediaMode, input.mediaPlane].filter(Boolean).join(' · ') || 'Voice call running.',
    tone: 'info',
    color: '#3b82f6',
  };
}
