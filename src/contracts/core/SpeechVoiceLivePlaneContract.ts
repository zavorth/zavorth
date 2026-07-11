import type { LiveReadinessStatus } from './LiveReadinessContract.js';

export const ZAVORTH_SPEECH_VOICE_LIVE_PLANE_CONTRACT_VERSION = '2026-05-04.live-checkpoint-7' as const;

export type SpeechVoiceLiveTargetId =
  | 'azure-speech'
  | 'deepgram'
  | 'senseaudio'
  | 'speech-core'
  | 'elevenlabs'
  | 'tts-local-cli'
  | 'voice-call'
  | 'talk-voice'
  | 'google-meet'
  | 'inworld';

export type SpeechVoiceLiveCapability =
  | 'speech.transcribe'
  | 'speech.synthesize'
  | 'voice.session';

export type SpeechVoiceLiveModality =
  | 'stt'
  | 'tts'
  | 'voice-session'
  | 'meeting-bridge';

export type SpeechVoiceLiveStatus =
  | 'stt-live'
  | 'tts-live'
  | 'stt-tts-live'
  | 'local-tts-live'
  | 'voice-session-live'
  | 'meeting-bridge-excluded'
  | 'blocked';

export type SpeechVoiceLiveAdapterFamily =
  | 'http-stt'
  | 'http-tts'
  | 'local-tts-cli'
  | 'push-to-talk-session'
  | 'live-call-session'
  | 'meeting-bridge-decision';

export type SpeechVoiceLiveGateKind =
  | 'stt-adapter'
  | 'tts-adapter'
  | 'local-cli-adapter'
  | 'transcript-artifact'
  | 'audio-artifact'
  | 'streaming-mode'
  | 'batch-mode'
  | 'voice-session-lifecycle'
  | 'consent-recording-policy'
  | 'meeting-bridge-decision'
  | 'provider-evidence'
  | 'configured-doctor'
  | 'mock-smoke'
  | 'staging-live-smoke'
  | 'redacted-receipt';

export type SpeechVoiceLiveGateStatus =
  | 'passed'
  | 'partial'
  | 'missing'
  | 'blocked';

export type SpeechVoiceLiveConfigSchema = {
  requiredEnv: string[];
  optionalEnv: string[];
  secretEnv: string[];
  artifactEnv: string[];
  secretValuesSerialized: false;
};

export type SpeechVoiceLiveGate = {
  kind: SpeechVoiceLiveGateKind;
  status: SpeechVoiceLiveGateStatus;
  evidence: string;
  command: string | null;
};

export type SpeechVoiceMeetingBridgeDecision = 'live' | 'excluded' | 'not-applicable';

export type SpeechVoiceLiveReceipt = {
  id: string;
  targetId: SpeechVoiceLiveTargetId;
  status: SpeechVoiceLiveStatus;
  readinessStatus: Extract<LiveReadinessStatus, 'partial-live' | 'configured-only' | 'blocked'>;
  capabilities: SpeechVoiceLiveCapability[];
  modalities: SpeechVoiceLiveModality[];
  adapterFamilies: SpeechVoiceLiveAdapterFamily[];
  meetingBridgeDecision: SpeechVoiceMeetingBridgeDecision;
  liveIoPerformed: false;
  stagingLiveRequiresExplicitCommand: true;
  artifactFirst: true;
  consentPolicyAttached: true;
  secretValuesSerialized: false;
};

export type SpeechVoiceLiveEntry = {
  targetId: SpeechVoiceLiveTargetId;
  status: SpeechVoiceLiveStatus;
  readinessStatus: Extract<LiveReadinessStatus, 'partial-live' | 'configured-only' | 'blocked'>;
  capabilities: SpeechVoiceLiveCapability[];
  modalities: SpeechVoiceLiveModality[];
  adapterFamilies: SpeechVoiceLiveAdapterFamily[];
  adapterTargets: string[];
  serviceTargets: string[];
  configSchema: SpeechVoiceLiveConfigSchema;
  gates: SpeechVoiceLiveGate[];
  gaps: string[];
  doctorCommand: string;
  stagingLiveSmokeCommand: string;
  receipt: SpeechVoiceLiveReceipt;
};

export type SpeechVoiceLivePlaneSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SPEECH_VOICE_LIVE_PLANE_CONTRACT_VERSION;
  gate: 'speech-voice-live-plane';
  status: 'closed' | 'attention' | 'blocked';
  summary: {
    targets: 10;
    sttTargets: number;
    ttsTargets: number;
    voiceSessionTargets: number;
    meetingBridgeTargets: number;
    meetingBridgesLiveOrExcluded: true;
    transcriptArtifactTargets: number;
    audioArtifactTargets: number;
    streamingTargets: number;
    batchTargets: number;
    consentPolicyTargets: number;
    stagingLiveSmokeCommands: number;
    redactedReceipts: number;
    blocked: number;
    liveIoRequiredByStage7Check: false;
    secretValuesSerialized: false;
  };
  entries: SpeechVoiceLiveEntry[];
  receipts: SpeechVoiceLiveReceipt[];
  policy: {
    noLiveIoDuringStage7Check: true;
    artifactFirstTranscriptsRequired: true;
    artifactFirstAudioRequired: true;
    recordingConsentRequiredForLiveCalls: true;
    meetingBridgeMustBeLiveOrSignedExcluded: true;
    stagingLiveRequiresExplicitOperatorCommand: true;
    noSecretsSerialized: true;
  };
  commands: {
    check: 'npm run speech-voice-live-plane:check --silent';
    doctor: 'npm run speech-voice-live-plane -- --profile configured';
    stagingLiveSmoke: 'npm run speech-voice-live-plane -- --profile staging-live --target <target> --confirm-live-io';
    focusedTests: string[];
    typecheck: 'npm run runtime:check --silent';
    nextStage: 'ZavorthControl controls - Research, Web Extraction And Browser Live Plane';
  };
};
