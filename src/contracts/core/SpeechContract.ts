export const SPEECH_CONTRACT_VERSION = 'speech-v1' as const;

export const SPEECH_TRANSCRIBE_CAPABILITY_ID = 'speech.transcribe' as const;
export const SPEECH_SYNTHESIZE_CAPABILITY_ID = 'speech.synthesize' as const;

export type SpeechArtifactRef = {
  artifactId: string;
  contentType: string;
  storageRef: string;
};

export type SpeechProviderEvidence = {
  providerId: string;
  modelId: string | null;
  metadata: Record<string, unknown>;
};

export type SpeechPolicyDecision = {
  allowed: boolean;
  reason: string;
  consentRequired: boolean;
  retention: 'ephemeral' | 'artifact' | 'redacted';
};

export type SpeechTranscribeRequest = {
  source: SpeechArtifactRef;
  languageHint?: string | null;
  speakerLabels?: boolean;
  sessionId?: string | null;
  correlationId?: string | null;
};

export type SpeechTranscriptSegment = {
  text: string;
  startMs: number | null;
  endMs: number | null;
  speakerId: string | null;
  confidence: number | null;
};

export type SpeechTranscribeResult = {
  ok: boolean;
  contractVersion: typeof SPEECH_CONTRACT_VERSION;
  transcriptArtifactId: string | null;
  transcriptArtifact?: SpeechArtifactRef | null;
  text: string;
  segments: SpeechTranscriptSegment[];
  policyDecision: SpeechPolicyDecision;
  providerEvidence: SpeechProviderEvidence | null;
  receiptId: string;
  processedAt: string;
  error: string | null;
};

export type SpeechSynthesizeRequest = {
  text: string;
  voiceId?: string | null;
  format?: 'wav' | 'mp3' | 'ogg';
  sessionId?: string | null;
  correlationId?: string | null;
};

export type SpeechSynthesizeResult = {
  ok: boolean;
  contractVersion: typeof SPEECH_CONTRACT_VERSION;
  audioArtifact: SpeechArtifactRef | null;
  policyDecision: SpeechPolicyDecision;
  providerEvidence: SpeechProviderEvidence | null;
  receiptId: string;
  processedAt: string;
  error: string | null;
};
