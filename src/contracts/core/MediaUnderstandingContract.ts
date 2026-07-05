/**
 * Zavorth-native contract for media understanding.
 *
 * This contract defines the canonical interface for analyzing media assets
 * inside the Zavorth runtime. It complements media.generate with the inverse
 * capability: given a media artifact, produce structured analysis.
 *
 * Core principles:
 * - Input always comes through a Zavorth artifact, local reference, or buffer.
 * - Raw provider URLs are never accepted as authority.
 * - Adapters are the only components that know provider-specific details.
 * - Content policy is evaluated before analysis.
 * - Detected sensitive data is flagged, not exposed.
 *
 * @module contracts/MediaUnderstandingContract
 * @since 2026-05-03
 * @author Zavorth Core Team
 */

export const MEDIA_UNDERSTAND_CAPABILITY_ID = 'media.understand' as const;

export type MediaUnderstandingModality = 'image' | 'audio' | 'video';

export type MediaAnalysisType = 'describe' | 'extract' | 'classify' | 'qa';

export interface MediaUnderstandingRequest {
  source: MediaUnderstandingSource;
  analysisType?: MediaAnalysisType;
  prompt?: string | null;
  modality?: MediaUnderstandingModality | null;
  sessionId?: string | null;
  correlationId?: string | null;
  providerHints?: Record<string, unknown> | null;
}

export type MediaUnderstandingSource =
  | MediaSourceArtifactRef
  | MediaSourceLocalPath
  | MediaSourceBuffer;

export interface MediaSourceArtifactRef {
  kind: 'artifact-ref';
  artifactId: string;
}

export interface MediaSourceLocalPath {
  kind: 'local-path';
  artifactId?: never;
  path: string;
  contentType?: string | null;
}

export interface MediaSourceBuffer {
  kind: 'buffer';
  artifactId?: never;
  data: Buffer;
  contentType: string;
  fileName?: string | null;
}

export interface MediaUnderstandingResult {
  ok: boolean;
  analysisType: MediaAnalysisType;
  modality: MediaUnderstandingModality;
  analysis: MediaAnalysis | null;
  policyDecision: MediaUnderstandingPolicyDecision;
  error?: MediaUnderstandingError | null;
  summary: string;
  processedAt: string;
}

export interface MediaAnalysis {
  description: string;
  extractedText?: string | null;
  classifications?: MediaClassification[] | null;
  answer?: string | null;
  detectedMetadata: MediaDetectedMetadata;
  providerEvidence: MediaAnalysisProviderEvidence;
}

export interface MediaClassification {
  label: string;
  confidence: number;
  category?: string | null;
}

export interface MediaDetectedMetadata {
  contentType: string;
  dimensions?: { width: number; height: number } | null;
  durationSeconds?: number | null;
  sizeBytes: number;
  hasVisibleText: boolean;
  hasFaces: boolean;
  detectedLanguage?: string | null;
  sensitiveContent: boolean;
  sensitiveContentReason?: string | null;
}

export interface MediaAnalysisProviderEvidence {
  providerId: string;
  modelId?: string | null;
  tokensUsed?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface MediaUnderstandingPolicyDecision {
  allowed: boolean;
  reason: string;
  policySource: 'content-type-policy' | 'file-size-limit' | 'capability-gate' | 'source-validation';
  sourceValidated: boolean;
}

export interface MediaUnderstandingError {
  code:
    | 'POLICY_BLOCKED'
    | 'INVALID_SOURCE'
    | 'UNSUPPORTED_MODALITY'
    | 'PROVIDER_UNAVAILABLE'
    | 'PROVIDER_ERROR'
    | 'FILE_NOT_FOUND'
    | 'FILE_TOO_LARGE'
    | 'INVALID_REQUEST'
    | 'UNKNOWN_ERROR';
  message: string;
  providerDetail?: string | null;
}

export interface IMediaUnderstandingAdapter {
  readonly adapterId: string;
  readonly supportedModalities: MediaUnderstandingModality[];
  analyze(input: AdapterAnalysisInput): Promise<AdapterAnalysisOutput>;
}

export interface AdapterAnalysisInput {
  data: Buffer;
  contentType: string;
  analysisType: MediaAnalysisType;
  prompt?: string | null;
  providerHints?: Record<string, unknown> | null;
}

export interface AdapterAnalysisOutput {
  text: string;
  hasVisibleText: boolean;
  hasFaces: boolean;
  sensitiveContent: boolean;
  sensitiveContentReason?: string | null;
  tokensUsed?: number | null;
  providerEvidence: MediaAnalysisProviderEvidence;
}
