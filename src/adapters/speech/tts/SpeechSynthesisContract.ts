import type {
  SpeechProviderEvidence,
} from '../../../contracts/core/SpeechContract.js';

/**
 * Transport types supported by the TTS adapter subsystem.
 * Each transport maps to a dedicated adapter implementation.
 */
export type TtsTransportType =
  | 'http'
  | 'sdk'
  | 'cli'
  | 'in-process'
  | 'mcp'
  | 'gemini-voice-service';

/**
 * Normalized voice descriptor. Adapters expose their voices so the tool can
 * render them without knowing anything about a specific provider.
 */
export interface TtsVoiceInfo {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female' | 'neutral';
}

/**
 * Normalized input contract shared by every TTS adapter.
 */
export interface TtsSynthesizeInput {
  text: string;
  voiceId?: string | null;
  language?: string | null;
  /** Speech speed (0.5-2.0). Provider default applies when omitted. */
  speed?: number | null;
  /** Voice pitch in semitones (-20..20). Provider default applies when omitted. */
  pitch?: number | null;
  /** When true, text is already SSML and must be sent verbatim. */
  ssml?: boolean;
  /** Requested audio container: mp3, wav, ogg. Provider maps it when supported. */
  outputFormat?: string | null;
  modelId?: string | null;
}

/**
 * Normalized output contract shared by every TTS adapter.
 * The audio bytes are always the final, playable artifact.
 */
export interface TtsSynthesizeOutput {
  audio: Buffer;
  format: string;
  contentType: string;
  providerEvidence: SpeechProviderEvidence;
}

/**
 * Provider-agnostic text-to-speech adapter contract.
 * Every transport adapter implements this single interface.
 */
export interface ISpeechSynthesisAdapter {
  readonly providerId: string;
  readonly transport: TtsTransportType;
  readonly modelId: string | null;
  readonly defaultVoiceId: string | null;
  isAvailable(): boolean;
  listVoices(): TtsVoiceInfo[];
  synthesize(_input: TtsSynthesizeInput): Promise<TtsSynthesizeOutput>;
}
