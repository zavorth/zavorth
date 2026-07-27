import type {
  ZavorthPluginManifest,
  ZavorthPluginModuleKind,
  ZavorthPluginPermission,
} from '../PluginManifestContract.js';

export const ZAVORTH_CAPABILITY_NORMALIZATION_CONTRACT_VERSION = '2026-05-04.gate-3';

export type CapabilityNormalizationFamily =
  | 'agent'
  | 'provider'
  | 'channel'
  | 'sandbox'
  | 'media'
  | 'search'
  | 'browser'
  | 'voice'
  | 'memory'
  | 'file'
  | 'document'
  | 'artifact'
  | 'diagnostics'
  | 'qa'
  | 'device'
  | 'bridge'
  | 'migration'
  | 'workspace'
  | 'task';

export type CapabilityNormalizationSourceKind =
  | 'private-extension'
  | 'zavorth-native'
  | 'module-template';

export type CapabilityPrimitiveRuntimeStatus =
  | 'native-contract'
  | 'normalized-template'
  | 'needs-contract'
  | 'needs-runtime-proof';

export type CapabilityPrimitiveDefinition = {
  primitiveId: string;
  label: string;
  family: CapabilityNormalizationFamily;
  intent: string;
  summary: string;
  moduleKind: ZavorthPluginModuleKind;
  runtimeStatus: CapabilityPrimitiveRuntimeStatus;
  contractTarget: string;
  serviceTarget: string;
  adapterTarget: string;
  policyTarget: string;
  commandName: string | null;
  artifactKinds: string[];
  receiptKinds: string[];
  permissions: ZavorthPluginPermission[];
};

export type CapabilitySourceMappingStatus = 'normalized' | 'needs-review' | 'unmapped';

export type CapabilitySourceMapping = {
  sourceName: string;
  normalizedSourceName: string;
  sourceKind: CapabilityNormalizationSourceKind;
  primitiveId: string | null;
  family: CapabilityNormalizationFamily | null;
  moduleKind: ZavorthPluginModuleKind | null;
  status: CapabilitySourceMappingStatus;
  reason: string;
  targetFiles: {
    contract: string | null;
    service: string | null;
    adapter: string | null;
    policy: string | null;
  };
};

export type CapabilityManifestTemplate = {
  source: CapabilitySourceMapping;
  primitive: CapabilityPrimitiveDefinition;
  manifest: ZavorthPluginManifest;
};

export type CapabilityNormalizationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_CAPABILITY_NORMALIZATION_CONTRACT_VERSION;
  summary: {
    sourceModules: number;
    normalized: number;
    needsReview: number;
    unmapped: number;
    primitives: number;
    manifestTemplates: number;
  };
  primitives: CapabilityPrimitiveDefinition[];
  mappings: CapabilitySourceMapping[];
};
