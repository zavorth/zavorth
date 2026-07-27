import type {
  SourceInternalPluginPackageName,
  SourcePluginPackageExportFamily,
} from './SourcePluginPackageContract.js';

export const ZAVORTH_SEMANTIC_PLUGIN_PACKAGE_CERTIFICATION_CONTRACT_VERSION = '2026-05-05.semantic-s1' as const;

export type ZavorthSemanticPluginPackageCertificationStatus = 'passed' | 'failed';

export type ZavorthSemanticPluginPackageClaimKind =
  | 'package-presence'
  | 'export-family'
  | 'manifest-conversion'
  | 'lifecycle-policy'
  | 'runtime-policy'
  | 'sdk-replacement';

export type ZavorthSemanticPluginPackageClaimStatus =
  | 'covered'
  | 'replaced'
  | 'owner-gated'
  | 'rejected'
  | 'gap';

export type ZavorthSemanticPluginPackageClaimPriority = 'P0' | 'P1' | 'P2';

export type ZavorthSemanticPluginPackageClaim = {
  id: string;
  kind: ZavorthSemanticPluginPackageClaimKind;
  status: ZavorthSemanticPluginPackageClaimStatus;
  priority: ZavorthSemanticPluginPackageClaimPriority;
  packageName?: SourceInternalPluginPackageName;
  exportFamily?: SourcePluginPackageExportFamily;
  expectedBehavior: string;
  zavorthEquivalent: string;
  evidence: string[];
  receiptIds: string[];
  notes: string[];
};

export type ZavorthSemanticPluginPackageCertificationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SEMANTIC_PLUGIN_PACKAGE_CERTIFICATION_CONTRACT_VERSION;
  status: ZavorthSemanticPluginPackageCertificationStatus;
  semanticPhase: 'S1';
  statement: 'Plugin/package semantics are certified as Zavorth-native behavior claims backed by executable receipts.';
  sourceRoot: string;
  absorptionStatus: 'passed' | 'failed';
  claims: ZavorthSemanticPluginPackageClaim[];
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
    exportFamiliesCertified: number;
    lifecycleClaimsCertified: number;
    runtimeExecutionPerformed: false;
    sourceCodeCopied: false;
    secretValuesSerialized: false;
  };
  policy: {
    semanticClaimRequiredForEveryPackage: true;
    exportFamiliesMustMapToZavorthCapability: true;
    lifecycleMustBeReceiptBacked: true;
    noExternalPluginExecutionDuringCertification: true;
    noImportPathShim: true;
    artifactFirstReceipts: true;
    gapsBlockRelease: true;
  };
  commands: {
    inspect: 'npm run semantic-plugin-package-certification --silent';
    inspectJson: 'npm run semantic-plugin-package-certification:json --silent';
    check: 'npm run semantic-plugin-package-certification:check --silent';
    qa: 'npm run qa:semantic-plugin-package-certification --silent';
    nextAction: 'Agent runtime semantics';
  };
};
