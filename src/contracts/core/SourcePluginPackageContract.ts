import type {
  ZavorthPluginManifest,
  ZavorthPluginReceipt,
} from './PluginManifestContract.js';

export const ZAVORTH_SOURCE_PLUGIN_PACKAGE_ABSORPTION_CONTRACT_VERSION = '2026-05-05.gate-1' as const;

export const SOURCE_INTERNAL_PLUGIN_PACKAGES = [
  '@source/memory-host-sdk',
  '@source/plugin-package-contract',
  '@source/plugin-sdk',
  '@source/sdk',
] as const;

export type SourceInternalPluginPackageName = typeof SOURCE_INTERNAL_PLUGIN_PACKAGES[number];

export type SourcePluginPackageAbsorptionStatus =
  | 'passed'
  | 'failed';

export type SourcePluginPackageConversionStatus =
  | 'converted'
  | 'needs_review'
  | 'blocked';

export type SourcePluginPackageDecision =
  | 'mapped-to-plugin-os'
  | 'zavorth-native-sdk'
  | 'owner-decision-required'
  | 'rejected';

export type SourcePluginPackageExportFamily =
  | 'plugin-runtime'
  | 'provider'
  | 'channel'
  | 'config'
  | 'security'
  | 'secret'
  | 'memory'
  | 'runtime-utility'
  | 'testing'
  | 'media'
  | 'package-root'
  | 'other';

export type SourcePluginPackageCompatibility = {
  pluginApiRange: string | null;
  builtWithSourceVersion: string | null;
  pluginSdkVersion: string | null;
  minGatewayVersion: string | null;
  missingRequiredFieldPaths: string[];
};

export type SourcePluginPackageValidationIssue = {
  severity: 'error' | 'warning';
  fieldPath: string;
  message: string;
};

export type SourcePluginPackageAdapterReceipt = {
  generatedAt: string;
  sourcePackageName: string;
  sourcePackageVersion: string;
  status: SourcePluginPackageConversionStatus;
  manifestId: string;
  compatibility: SourcePluginPackageCompatibility;
  issues: SourcePluginPackageValidationIssue[];
  policy: {
    noSourceImportPathShim: true;
    noRuntimeExecution: true;
    manifestDisabledByDefault: true;
    requiresPolicyBeforeInvoke: true;
    noSecretsSerialized: true;
  };
};

export type SourcePluginPackageAdapterSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SOURCE_PLUGIN_PACKAGE_ABSORPTION_CONTRACT_VERSION;
  status: SourcePluginPackageConversionStatus;
  manifest: ZavorthPluginManifest;
  receipt: SourcePluginPackageAdapterReceipt;
};

export type SourcePluginSdkCompatibilityMatrixEntry = {
  packageName: SourceInternalPluginPackageName;
  packagePath: string;
  status: 'found' | 'missing';
  declaredExports: number;
  exportSubpaths: string[];
  exportFamilies: Record<SourcePluginPackageExportFamily, number>;
  decision: SourcePluginPackageDecision;
  targetPhase: 1 | 5;
  zavorthTarget: string;
  reason: string;
};

export type SourcePluginSdkCompatibilityMatrixSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SOURCE_PLUGIN_PACKAGE_ABSORPTION_CONTRACT_VERSION;
  status: SourcePluginPackageAbsorptionStatus;
  sourceRoot: string;
  summary: {
    packagesExpected: number;
    packagesFound: number;
    packagesMissing: number;
    declaredExports: number;
    pluginSdkExports: number;
    memoryHostExports: number;
    packageContractExports: number;
    sdkRootExports: number;
    mappedToPluginOs: number;
    mappedToNativeSdk: number;
    ownerDecisionRequired: number;
  };
  entries: SourcePluginSdkCompatibilityMatrixEntry[];
};

export type SourcePluginRuntimeDoctorSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SOURCE_PLUGIN_PACKAGE_ABSORPTION_CONTRACT_VERSION;
  status: SourcePluginPackageAbsorptionStatus;
  adapter: SourcePluginPackageAdapterSnapshot;
  manifestHealth: {
    ok: boolean;
    findings: string[];
  };
  lifecycle: {
    installWithoutApproval: ZavorthPluginReceipt;
    installWithApproval: ZavorthPluginReceipt;
    enableWithApproval: ZavorthPluginReceipt;
    invokeWithoutApproval: ZavorthPluginReceipt;
  };
  summary: {
    receipts: number;
    approvalsRequired: number;
    blocked: number;
    executionPerformed: false;
    noSecretsSerialized: true;
  };
  policy: {
    doctorOnly: true;
    noExternalPluginCodeExecution: true;
    approvalRequiredBeforeSensitiveInvoke: true;
    sandboxPolicyEvaluated: true;
    receiptsEmitted: true;
  };
};

export type SourcePluginOsAbsorptionSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SOURCE_PLUGIN_PACKAGE_ABSORPTION_CONTRACT_VERSION;
  status: SourcePluginPackageAbsorptionStatus;
  gate: 'source-plugin-package';
  statement: 'Source Plugin OS and package SDK surfaces are absorbed as Zavorth-native contracts, adapter checks, policy and receipts.';
  matrix: SourcePluginSdkCompatibilityMatrixSnapshot;
  doctor: SourcePluginRuntimeDoctorSnapshot;
  summary: {
    packagesFound: number;
    declaredExports: number;
    manifestsConverted: number;
    lifecycleReceipts: number;
    approvalsRequired: number;
    blocked: number;
    unimplementedSourceShim: false;
    runtimeExecutionPerformed: false;
    secretValuesSerialized: false;
  };
  policy: {
    noSourceSourceCopy: true;
    noSourceImportPathShim: true;
    noExternalPluginCodeExecution: true;
    disabledByDefault: true;
    policyRequiredBeforeInvoke: true;
    artifactFirstReceipts: true;
  };
  commands: {
    inspect: 'npm run source-plugin-os-absorption --silent';
    inspectJson: 'npm run source-plugin-os-absorption:json --silent';
    check: 'npm run source-plugin-os-absorption:check --silent';
    qa: 'npm run qa:source-plugin-os-absorption --silent';
    nextAction: 'Preview engine - Agent Runtime Bridge Pack';
  };
};
