import type { ProviderNativeToolName } from '../../providers/ILlmProvider.js';

export const PROVIDER_NATIVE_CAPABILITY_MATRIX_VERSION = 'provider-native-capability-matrix/1' as const;

export type ProviderNativeCapability =
  | 'native_search'
  | 'native_code_execution'
  | 'native_vision'
  | 'native_audio'
  | 'native_media_generation'
  | 'native_file_search'
  | 'native_token_streaming'
  | 'native_browser'
  | 'native_connector';

export type ProviderNativeCapabilityStatus =
  | 'native_enabled'
  | 'zavorth_fallback'
  | 'unsupported';

export type ProviderNativeCapabilityRisk =
  | 'safe_observation'
  | 'governed_observation'
  | 'approval_required'
  | 'unsupported';

export type ProviderNativeEvidenceRequirement =
  | 'citations'
  | 'grounding_metadata'
  | 'execution_result'
  | 'media_artifact'
  | 'none';

export type ProviderNativeCapabilityPolicy = {
  risk: ProviderNativeCapabilityRisk;
  approvalRequired: boolean;
  receiptRequired: boolean;
  allowWithoutApproval: boolean;
  outputTrust: 'verified_public_observation' | 'untrusted_provider_output' | 'local_governed_artifact';
};

export type ProviderNativeCapabilityEntry = {
  version: typeof PROVIDER_NATIVE_CAPABILITY_MATRIX_VERSION;
  providerFamily: string;
  capability: ProviderNativeCapability;
  status: ProviderNativeCapabilityStatus;
  providerToolName: ProviderNativeToolName | null;
  fallbackToolName: string | null;
  requiredEvidence: ProviderNativeEvidenceRequirement;
  policy: ProviderNativeCapabilityPolicy;
  notes: string[];
};

export type ProviderNativeCapabilityDecision = ProviderNativeCapabilityEntry & {
  providerName: string;
  modelName: string | null;
};

export type ProviderNativeFallbackAssessment = {
  capability: ProviderNativeCapability;
  providerToolName: ProviderNativeToolName | null;
  fallbackToolName: string | null;
  fallbackRecommended: boolean;
  reason: string;
  evidenceSatisfied: boolean;
  citationCount: number;
  policy: ProviderNativeCapabilityPolicy;
};
