import type {
  ModelCapabilityKind,
  ModelModality,
  ProviderCredentialKind,
  ProviderRouteKind,
} from './ModelPickerContract.js';
import type { CapabilitySourceMapping } from '../CapabilityNormalizationContract.js';
import type { ZavorthPluginManifest } from '../PluginManifestContract.js';
import type {
  ProviderCompatibilityClassification,
  ProviderRuntimeAdapterKind,
} from '../../services/providers/catalog/ProviderCompatibilityClassifier.js';
import type {
  ProviderIntegrationManifest,
  ProviderIntegrationRouteManifest,
} from '../../services/providers/catalog/ProviderIntegrationManifest.js';

export const ZAVORTH_PROVIDER_MESH_READINESS_CONTRACT_VERSION = '2026-05-04.gate-4';

export type ProviderMeshReadinessStatus =
  | 'first-class'
  | 'cataloged'
  | 'generic-compatible'
  | 'template-ready'
  | 'unsupported'
  | 'unmapped';

export type ProviderMeshReadinessAdapterStrategy =
  | 'bespoke-runtime'
  | 'gateway-runtime'
  | 'openai-compatible-runtime'
  | 'anthropic-compatible-runtime'
  | 'local-openai-compatible-runtime'
  | 'template-required'
  | 'unmapped';

export type ProviderMeshReadinessCredentialPolicy = {
  authKind: ProviderCredentialKind | 'unknown';
  credentialRefs: string[];
  secretValuesSerialized: false;
  requiresOperatorConfiguration: boolean;
};

export type ProviderMeshReadinessProviderEntry = {
  sourceName: string;
  normalizedSourceName: string;
  status: ProviderMeshReadinessStatus;
  mapping: CapabilitySourceMapping;
  manifest: ProviderIntegrationManifest;
  route: ProviderIntegrationRouteManifest;
  generatedProviderManifest: boolean;
  generatedPluginManifest: ZavorthPluginManifest;
  adapterStrategy: ProviderMeshReadinessAdapterStrategy;
  runtimeAdapter: ProviderRuntimeAdapterKind;
  runtimeSupported: boolean;
  firstClassProvider: boolean;
  genericCompatible: boolean;
  routeKind: ProviderRouteKind;
  capabilities: ModelCapabilityKind[];
  modalities: ModelModality[];
  credentialPolicy: ProviderMeshReadinessCredentialPolicy;
  smokeGate: {
    id: string;
    command: string;
    liveCallRequired: boolean;
    expected: string;
  };
  findings: string[];
  classification: ProviderCompatibilityClassification;
};

export type ProviderMeshReadinessSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_PROVIDER_MESH_READINESS_CONTRACT_VERSION;
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
  entries: ProviderMeshReadinessProviderEntry[];
  unsupported: ProviderMeshReadinessProviderEntry[];
  generatedProviderManifests: ProviderIntegrationManifest[];
  generatedPluginManifests: ZavorthPluginManifest[];
};
