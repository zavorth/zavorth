import type {
  SourceProviderMeshExpansionSnapshot,
  SourceProviderMeshPackageName,
  SourceProviderRuntimeFamily,
  SourceProviderRuntimeId,
  SourceProviderRuntimeStatus,
} from '../SourceProviderMeshExpansionContract.js';

export const ZAVORTH_SEMANTIC_PROVIDER_MESH_CERTIFICATION_CONTRACT_VERSION = '2026-05-05.semantic-s3' as const;

export type ZavorthSemanticProviderMeshCertificationStatus =
  | 'passed'
  | 'failed';

export type ZavorthSemanticProviderMeshClaimKind =
  | 'package-coverage'
  | 'adapter-runtime'
  | 'credential-route'
  | 'factory-route'
  | 'local-model-policy'
  | 'network-policy'
  | 'live-io-policy'
  | 'receipt-policy'
  | 'provider-bypass-policy';

export type ZavorthSemanticProviderMeshClaimStatus =
  | 'covered'
  | 'replaced'
  | 'owner-gated'
  | 'rejected'
  | 'gap';

export type ZavorthSemanticProviderMeshClaimPriority =
  | 'P0'
  | 'P1'
  | 'P2';

export type ZavorthSemanticProviderMeshClaim = {
  id: string;
  kind: ZavorthSemanticProviderMeshClaimKind;
  status: ZavorthSemanticProviderMeshClaimStatus;
  priority: ZavorthSemanticProviderMeshClaimPriority;
  packageName?: SourceProviderMeshPackageName;
  providerId?: SourceProviderRuntimeId;
  family?: SourceProviderRuntimeFamily;
  runtimeStatus?: SourceProviderRuntimeStatus;
  expectedBehavior: string;
  zavorthEquivalent: string;
  evidence: string[];
  receiptIds: string[];
  notes: string[];
};

export type ZavorthSemanticProviderCredentialScenario = {
  id: 'missing-api-key' | 'configured-api-key-redacted' | 'optional-local-route';
  status: 'passed' | 'failed';
  providerId: SourceProviderRuntimeId;
  evidence: string[];
  secretValuesSerialized: false;
};

export type ZavorthSemanticProviderMeshCertificationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SEMANTIC_PROVIDER_MESH_CERTIFICATION_CONTRACT_VERSION;
  status: ZavorthSemanticProviderMeshCertificationStatus;
  semanticPhase: 'S3';
  statement: 'Provider Mesh semantics are certified as explicit provider routes, credential policies, local-provider alternatives and artifact-first receipts.';
  sourceRoot: string;
  zavorthRoot: string;
  providerMeshStatus: SourceProviderMeshExpansionSnapshot['status'];
  providerMeshContractVersion: SourceProviderMeshExpansionSnapshot['contractVersion'];
  claims: ZavorthSemanticProviderMeshClaim[];
  credentialScenarios: ZavorthSemanticProviderCredentialScenario[];
  summary: {
    semanticClaims: number;
    covered: number;
    replaced: number;
    ownerGated: number;
    rejected: number;
    gaps: number;
    p0Claims: number;
    p1Claims: number;
    p2Claims: number;
    receiptBackedClaims: number;
    packagesCertified: number;
    adaptersCertified: number;
    credentialRoutesCertified: number;
    providerFactoryRoutesCertified: number;
    credentialScenariosPassed: number;
    adapterStatuses: Record<string, SourceProviderRuntimeStatus>;
    liveIoPerformed: false;
    enabledByDefault: false;
    secretValuesSerialized: false;
    sourceCodeCopied: false;
  };
  localModelPolicy: SourceProviderMeshExpansionSnapshot['localModelPolicy'];
  networkPolicy: SourceProviderMeshExpansionSnapshot['networkPolicy'];
  policy: {
    semanticClaimRequiredForEveryProviderPackage: true;
    explicitProviderSelectionRequired: true;
    managedCloudRoutesOwnerGated: true;
    localModelsUseProviderMeshOnly: true;
    noAnthropicApiImpersonationForLocalModels: true;
    noProviderBypass: true;
    noProviderApiSpoofing: true;
    noNetworkWithoutProviderSelection: true;
    noSecretSerialization: true;
    noLiveIoDuringCertification: true;
    noSourceSourceCopy: true;
    artifactFirstReceipts: true;
    gapsBlockRelease: true;
  };
  commands: {
    inspect: 'npm run semantic-provider-mesh-certification --silent';
    inspectJson: 'npm run semantic-provider-mesh-certification:json --silent';
    check: 'npm run semantic-provider-mesh-certification:check --silent';
    qa: 'npm run qa:semantic-provider-mesh-certification --silent';
    nextAction: 'Channel mesh semantics';
  };
};
