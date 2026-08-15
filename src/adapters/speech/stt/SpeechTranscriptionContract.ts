import type {
  SpeechProviderEvidence,
  SpeechTranscriptSegment,
} from '../../../contracts/core/SpeechContract.js';

/**
 * Transport types supported by the STT adapter subsystem.
 * Each transport maps to a dedicated adapter implementation.
 */
export type SttTransportType =
  | 'http'
  | 'websocket'
  | 'sdk'
  | 'cli'
  | 'in-process'
  | 'mcp';

/**
 * Normalized input contract shared by every STT adapter.
 * Adapters receive audio bytes and produce structured transcript text.
 */
export interface SttTranscribeInput {
  audio: Buffer;
  contentType: string;
  languageHint?: string | null;
  speakerLabels?: boolean;
  modelId?: string | null;
  /** Request word-level timestamps when the provider supports them. */
  wordTimestamps?: boolean;
  /** Generation temperature (0-1); provider default applies when omitted. */
  temperature?: number | null;
  /** Context prompt to improve transcription quality (proper nouns, terms). */
  prompt?: string | null;
}

/**
 * Normalized output contract shared by every STT adapter.
 * Consumers depend on this shape, never on a specific provider.
 */
export interface SttTranscribeOutput {
  text: string;
  language: string | null;
  segments: SpeechTranscriptSegment[];
  providerEvidence: SpeechProviderEvidence;
}

/**
 * Provider-agnostic speech-to-text adapter contract.
 * Every transport adapter implements this single interface.
 */
export interface ISpeechTranscriptionAdapter {
  readonly providerId: string;
  readonly transport: SttTransportType;
  readonly modelId: string | null;
  isAvailable(): boolean;
  transcribe(_input: SttTranscribeInput): Promise<SttTranscribeOutput>;
}
