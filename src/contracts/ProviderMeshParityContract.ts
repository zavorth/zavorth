import type {
  ModelCapabilityKind,
  ModelModality,
  ProviderCredentialKind,
  ProviderRouteKind,
} from './ModelPickerContract.js';
import type { CapabilitySourceMapping } from './CapabilityNormalizationContract.js';
import type { ZavorthPluginManifest } from './PluginManifestContract.js';
import type {
  ProviderCompatibilityClassification,
  ProviderRuntimeAdapterKind,
} from '../services/providers/catalog/ProviderCompatibilityClassifier.js';
import type {
  ProviderIntegrationManifest,
  ProviderIntegrationRouteManifest,
} from '../services/providers/catalog/ProviderIntegrationManifest.js';

export const ZAVORTH_PROVIDER_MESH_PARITY_CONTRACT_VERSION = '2026-05-04.checkpoint-4';

export type ProviderMeshParityStatus =
  | 'first-class'
  | 'cataloged'
  | 'generic-compatible'
  | 'template-ready'
  | 'unsupported'
  | 'unmapped';

export type ProviderMeshParityAdapterStrategy =
  | 'bespoke-runtime'
  | 'gateway-runtime'
  | 'openai-compatible-runtime'
  | 'anthropic-compatible-runtime'
  | 'local-openai-compatible-runtime'
  | 'template-required'
  | 'unmapped';

export type ProviderMeshParityCredentialPolicy = {
  authKind: ProviderCredentialKind | 'unknown';
  credentialRefs: string[];
  secretValuesSerialized: false;
  requiresOperatorConfiguration: boolean;
};

export type ProviderMeshParityProviderEntry = {
  sourceName: string;
  normalizedSourceName: string;
  status: ProviderMeshParityStatus;
  mapping: CapabilitySourceMapping;
  manifest: ProviderIntegrationManifest;
  route: ProviderIntegrationRouteManifest;
  generatedProviderManifest: boolean;
  generatedPluginManifest: ZavorthPluginManifest;
  adapterStrategy: ProviderMeshParityAdapterStrategy;
  runtimeAdapter: ProviderRuntimeAdapterKind;
  runtimeSupported: boolean;
  firstClassProvider: boolean;
  genericCompatible: boolean;
  routeKind: ProviderRouteKind;
  capabilities: ModelCapabilityKind[];
  modalities: ModelModality[];
  credentialPolicy: ProviderMeshParityCredentialPolicy;
  smokeGate: {
    id: string;
    command: string;
    liveCallRequired: boolean;
    expected: string;
  };
  findings: string[];
  classification: ProviderCompatibilityClassification;
};

export type ProviderMeshParitySnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_PROVIDER_MESH_PARITY_CONTRACT_VERSION;
  primitiveId: 'provider.call';
  summary: {
    sourceProviders: number;
    firstClass: number;
    cataloged: number;
    genericCompatible: number;
    templateReady: number;
    unsupported: number;
    unmapped: number;
    generatedProviderManifests: number;
    generatedPluginManifests: number;
    secretValuesSerialized: false;
  };
  entries: ProviderMeshParityProviderEntry[];
  unsupported: ProviderMeshParityProviderEntry[];
  generatedProviderManifests: ProviderIntegrationManifest[];
  generatedPluginManifests: ZavorthPluginManifest[];
};
