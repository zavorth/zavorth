/**
 * Zavorth-native contract for media generation.
 *
 * Every generated asset is represented as a Zavorth artifact. Providers are
 * implementation details behind adapters; raw provider URLs remain evidence
 * only and are never treated as runtime authority.
 *
 * @module contracts/MediaGenerationContract
 * @since 2026-05-03
 * @author Zavorth Core Team
 */

export const MEDIA_GENERATE_CAPABILITY_ID = 'media.generate' as const;

export type MediaGenerationModality = 'image' | 'video' | 'audio';

export interface MediaGenerationRequest {
  prompt: string;
  modality?: MediaGenerationModality;
  count?: number;
  sizeHint?: string | null;
  styleHint?: string | null;
  sessionId?: string | null;
  workspaceId?: string | null;
  correlationId?: string | null;
  providerHints?: Record<string, unknown> | null;
}

export interface GeneratedMediaArtifact {
  artifactId: string;
  modality: MediaGenerationModality;
  contentType: string;
  storageRef: string;
  publicUrl?: string | null;
  sizeBytes?: number | null;
  generatedAt: string;
  providerEvidence: MediaProviderEvidence;
}

export interface MediaProviderEvidence {
  providerId: string;
  modelId?: string | null;
  sourceUrl?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface MediaGenerationPolicyDecision {
  allowed: boolean;
  reason: string;
  policySource: 'content-safety' | 'budget-limit' | 'rate-limit' | 'capability-gate' | 'manual-block';
  promptModified: boolean;
  sanitizedPrompt?: string | null;
}

export interface MediaGenerationResult {
  ok: boolean;
  artifacts: GeneratedMediaArtifact[];
  policyDecision: MediaGenerationPolicyDecision;
  error?: MediaGenerationError | null;
  summary: string;
  processedAt: string;
}

export interface MediaGenerationError {
  code:
    | 'POLICY_BLOCKED'
    | 'PROVIDER_UNAVAILABLE'
    | 'PROVIDER_ERROR'
    | 'INVALID_REQUEST'
    | 'ARTIFACT_STORAGE_FAILED'
    | 'UNKNOWN_ERROR';
  message: string;
  providerDetail?: string | null;
}

export interface IMediaGenerationAdapter {
  readonly adapterId: string;
  readonly supportedModalities: MediaGenerationModality[];
  generate(request: MediaGenerationRequest): Promise<AdapterGenerationOutput[]>;
}

export interface AdapterGenerationOutput {
  data?: Buffer | null;
  sourceUrl?: string | null;
  contentType: string;
  sizeBytes?: number | null;
  providerEvidence: MediaProviderEvidence;
}
