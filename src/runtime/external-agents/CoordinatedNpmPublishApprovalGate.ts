import {
  createCreateZavorthPackageBridgePackFixture,
} from './CreateZavorthPackageBridgePack.js';
import type {
  CreateZavorthPackageBridgeNormalization,
} from './CreateZavorthPackageBridgePack.js';

export const COORDINATED_NPM_PUBLISH_APPROVAL_GATE_NOW = '2026-05-02T04:00:00.000Z' as const;
export const COORDINATED_NPM_PUBLISH_APPROVAL_GATE_RUNTIME_ID = 'coordinated-npm-publish-approval-gate' as const;

export type CoordinatedNpmPublishDecision =
  | 'blocked'
  | 'ready-awaiting-operator-approval';

export type CoordinatedNpmPublishExpectedState =
  | 'createZavorthPackageReady=true'
  | 'createZavorthPublishActuallyPerformed=false'
  | 'finalOperatorApprovalRequired=true'
  | 'npmIdentityAvailable=false'
  | 'npmPublishActuallyPerformed=false'
  | 'publishBlocked=true'
  | 'publishDecision=blocked'
  | 'publishOrder=root-then-create'
  | 'rootPackageReady=true';

export type NpmPublishPackageKind = 'create-zavorth' | 'root';

export type NpmPackagePublishReadiness = {
  nativeContract: 'NpmPackagePublishReadiness/v1';
  packageKind: NpmPublishPackageKind;
  packageName: 'zavorth' | 'create-zavorth';
  packageVersion: '1.1.0-alpha.0';
  packageDirectory: '.' | 'packages/create-zavorth';
  binMapping: Record<string, string>;
  requiredFilesPresent: true;
  forbiddenFilesAbsent: true;
  packDryRunReady: true;
  helpCommandReady: true;
  blockers: string[];
  npmPublishActuallyPerformed: false;
  rawSecretSerialized: false;
};

export type NpmPublishOrderPlan = {
  nativeContract: 'NpmPublishOrderPlan/v1';
  publishOrder: 'root-then-create';
  rationale: string;
  publishCommandsPreparedButNotExecuted: true;
  finalCommands: [
    'npm publish --access public',
    'cd packages/create-zavorth && npm publish --access public',
  ];
  alphaTagAlternatives: [
    'npm publish --access public --tag alpha',
    'cd packages/create-zavorth && npm publish --access public --tag alpha',
  ];
  residualRisks: string[];
  futureSmokeAfterPublish: 'npm create zavorth -- --dry-run';
  npmPublishActuallyPerformed: false;
  createZavorthPublishActuallyPerformed: false;
};

export type NpmPublishIdentityCheck = {
  nativeContract: 'NpmPublishIdentityCheck/v1';
  npmWhoamiChecked: true;
  npmIdentityAvailable: boolean;
  npmIdentityStatus: 'available' | 'not-authenticated';
  npmWhoamiResult: 'ENEEDAUTH' | 'authenticated-redacted';
  npmTokenPrinted: false;
  npmAuthModified: false;
  blocker?: string;
};

export type NpmPublishSafetyReport = {
  nativeContract: 'NpmPublishSafetyReport/v1';
  publicExternalExecutorIdentityLeak: false;
  rawSecretSerialized: false;
  batFilesNotProductPath: true;
  rawImportDefaultDisabled: true;
  limitedProductionSendStillGated: true;
  adapterRemovalGlobalAllowed: false;
  runtimePersistentStart: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  toolCommandActuallyExecuted: false;
  externalExecutorLiveCalled: false;
  blockers: string[];
};

export type NpmPublishGoNoGoDecision = {
  nativeContract: 'NpmPublishGoNoGoDecision/v1';
  publishDecision: CoordinatedNpmPublishDecision;
  publishReady: boolean;
  publishBlocked: boolean;
  publishBlockers: string[];
  finalOperatorApprovalRequired: true;
  rootPackageReady: true;
  createZavorthPackageReady: true;
  npmPublishActuallyPerformed: false;
  createZavorthPublishActuallyPerformed: false;
};

export type CoordinatedNpmPublishApprovalExecutionGate = {
  coordinatedNpmPublishApprovalGateCreated: true;
  publishDecision: CoordinatedNpmPublishDecision;
  publishReady: boolean;
  publishBlocked: boolean;
  rootPackageReady: true;
  createZavorthPackageReady: true;
  npmIdentityAvailable: boolean;
  publishOrder: 'root-then-create';
  npmPublishActuallyPerformed: false;
  createZavorthPublishActuallyPerformed: false;
  finalOperatorApprovalRequired: true;
  rawSecretSerialized: false;
  publicExternalExecutorIdentityLeak: false;
  batFilesNotProductPath: true;
  rawImportDefaultDisabled: true;
  limitedProductionSendStillGated: true;
  adapterRemovalGlobalAllowed: false;
};

export type CoordinatedNpmPublishApprovalSource = {
  previous264: Pick<
    CreateZavorthPackageBridgeNormalization,
    'decision' | 'executionGate' | 'bridge'
  >;
  rootPackageReady: true;
  createZavorthPackageReady: true;
  rootPackageName: 'zavorth';
  createPackageName: 'create-zavorth';
  packageVersion: '1.1.0-alpha.0';
  rootPackDryRunPassed: true;
  createPackDryRunPassed: true;
  rootHelpPassed: true;
  createHelpPassed: true;
  createDryRunPassed: true;
  runtimeCheckPassed: true;
  buildPassed: true;
  representativeExternalAgentsPassed: true;
  npmWhoamiChecked: true;
  npmIdentityAvailable: boolean;
  npmIdentityStatus: 'available' | 'not-authenticated';
  npmWhoamiResult: 'ENEEDAUTH' | 'authenticated-redacted';
  publicSurfaceScanPassed: true;
  redactionScanPassed: true;
  npmPublishAttempted: false;
  createZavorthPublishAttempted: false;
  npmAuthModified: false;
  globalInstallAttempted: false;
  runtimePersistentStartAttempted: false;
  externalExecutorLiveCalled: false;
  publicExternalExecutorIdentityExposed: false;
  docsPromoteBatFiles: false;
  rawSqliteImportEnabled: false;
  messageSendAttempted: false;
  providerExecutionAttempted: false;
  toolCommandExecutionAttempted: false;
  adapterGlobalRemovalAttempted: false;
  rawSecretSerialized: false;
};

export type CoordinatedNpmPublishApprovalNormalization = {
  nativeContract: 'CoordinatedNpmPublishApprovalGate/v1';
  generatedAt: string;
  runtimeId: typeof COORDINATED_NPM_PUBLISH_APPROVAL_GATE_RUNTIME_ID;
  decision: CoordinatedNpmPublishDecision;
  status: CoordinatedNpmPublishDecision;
  expectedStates: CoordinatedNpmPublishExpectedState[];
  rootPackage: NpmPackagePublishReadiness;
  createZavorthPackage: NpmPackagePublishReadiness;
  publishOrderPlan: NpmPublishOrderPlan;
  npmIdentityCheck: NpmPublishIdentityCheck;
  safetyReport: NpmPublishSafetyReport;
  goNoGoDecision: NpmPublishGoNoGoDecision;
  executionGate: CoordinatedNpmPublishApprovalExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    rawContentSerialized: false;
    packageSecretsIncluded: false;
    publicSourceIdentityExposed: false;
    receiptsRedacted: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  terminalGate: 'do-not-publish-without-explicit-operator-approval';
};

export type CoordinatedNpmPublishApprovalOptions = {
  generatedAt: string;
  runtimeId: typeof COORDINATED_NPM_PUBLISH_APPROVAL_GATE_RUNTIME_ID;
  source: CoordinatedNpmPublishApprovalSource;
};

function expectedStates(): CoordinatedNpmPublishExpectedState[] {
  return [
    'publishDecision=blocked',
    'publishBlocked=true',
    'rootPackageReady=true',
    'createZavorthPackageReady=true',
    'npmIdentityAvailable=false',
    'publishOrder=root-then-create',
    'npmPublishActuallyPerformed=false',
    'createZavorthPublishActuallyPerformed=false',
    'finalOperatorApprovalRequired=true',
  ];
}

function rootPackage(): NpmPackagePublishReadiness {
  return {
    nativeContract: 'NpmPackagePublishReadiness/v1',
    packageKind: 'root',
    packageName: 'zavorth',
    packageVersion: '1.1.0-alpha.0',
    packageDirectory: '.',
    binMapping: {
      zavorth: './bin/zavorth.js',
      'create-zavorth': './bin/create-zavorth.js',
    },
    requiredFilesPresent: true,
    forbiddenFilesAbsent: true,
    packDryRunReady: true,
    helpCommandReady: true,
    blockers: [],
    npmPublishActuallyPerformed: false,
    rawSecretSerialized: false,
  };
}

function createZavorthPackage(): NpmPackagePublishReadiness {
  return {
    nativeContract: 'NpmPackagePublishReadiness/v1',
    packageKind: 'create-zavorth',
    packageName: 'create-zavorth',
    packageVersion: '1.1.0-alpha.0',
    packageDirectory: 'packages/create-zavorth',
    binMapping: {
      'create-zavorth': './bin/create-zavorth.js',
    },
    requiredFilesPresent: true,
    forbiddenFilesAbsent: true,
    packDryRunReady: true,
    helpCommandReady: true,
    blockers: [],
    npmPublishActuallyPerformed: false,
    rawSecretSerialized: false,
  };
}

function publishOrderPlan(): NpmPublishOrderPlan {
  return {
    nativeContract: 'NpmPublishOrderPlan/v1',
    publishOrder: 'root-then-create',
    rationale: 'Publish the main zavorth CLI first so the create-zavorth initializer can point users at an already available installed CLI path.',
    publishCommandsPreparedButNotExecuted: true,
    finalCommands: [
      'npm publish --access public',
      'cd packages/create-zavorth && npm publish --access public',
    ],
    alphaTagAlternatives: [
      'npm publish --access public --tag alpha',
      'cd packages/create-zavorth && npm publish --access public --tag alpha',
    ],
    residualRisks: [
      'Public npm currently has a zavorth package at 0.3.9; operator must have maintainer rights before publishing zavorth@1.1.0-alpha.0.',
      'Version 1.1.0-alpha.0 is prerelease-shaped; use --tag alpha unless the operator explicitly wants this to become latest.',
      'create-zavorth appears unpublished, so its first publish still requires authenticated operator approval.',
    ],
    futureSmokeAfterPublish: 'npm create zavorth -- --dry-run',
    npmPublishActuallyPerformed: false,
    createZavorthPublishActuallyPerformed: false,
  };
}

function identityCheck(source: CoordinatedNpmPublishApprovalSource): NpmPublishIdentityCheck {
  return {
    nativeContract: 'NpmPublishIdentityCheck/v1',
    npmWhoamiChecked: true,
    npmIdentityAvailable: source.npmIdentityAvailable,
    npmIdentityStatus: source.npmIdentityStatus,
    npmWhoamiResult: source.npmWhoamiResult,
    npmTokenPrinted: false,
    npmAuthModified: false,
    blocker: source.npmIdentityAvailable
      ? undefined
      : 'npm whoami returned ENEEDAUTH; operator must authenticate before any real publish approval.',
  };
}

function safetyReport(source: CoordinatedNpmPublishApprovalSource): NpmPublishSafetyReport {
  const blockers: string[] = [];
  if (!source.publicSurfaceScanPassed) {
    blockers.push('public surface scan did not pass');
  }
  if (!source.redactionScanPassed) {
    blockers.push('redaction scan did not pass');
  }

  return {
    nativeContract: 'NpmPublishSafetyReport/v1',
    publicExternalExecutorIdentityLeak: false,
    rawSecretSerialized: false,
    batFilesNotProductPath: true,
    rawImportDefaultDisabled: true,
    limitedProductionSendStillGated: true,
    adapterRemovalGlobalAllowed: false,
    runtimePersistentStart: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    toolCommandActuallyExecuted: false,
    externalExecutorLiveCalled: false,
    blockers,
  };
}

function hasProhibitedAttempt(source: CoordinatedNpmPublishApprovalSource): boolean {
  return source.npmPublishAttempted ||
    source.createZavorthPublishAttempted ||
    source.npmAuthModified ||
    source.globalInstallAttempted ||
    source.runtimePersistentStartAttempted ||
    source.externalExecutorLiveCalled ||
    source.publicExternalExecutorIdentityExposed ||
    source.docsPromoteBatFiles ||
    source.rawSqliteImportEnabled ||
    source.messageSendAttempted ||
    source.providerExecutionAttempted ||
    source.toolCommandExecutionAttempted ||
    source.adapterGlobalRemovalAttempted ||
    source.rawSecretSerialized;
}

function publishBlockers(source: CoordinatedNpmPublishApprovalSource): string[] {
  const blockers: string[] = [];
  if (!source.npmIdentityAvailable) {
    blockers.push('npm identity unavailable: npm whoami returned ENEEDAUTH');
  }
  blockers.push('registry ownership unverified: public npm already has zavorth at 0.3.9, so operator maintainer rights must be confirmed');
  if (!source.rootPackageReady || !source.rootPackDryRunPassed || !source.rootHelpPassed) {
    blockers.push('root package release audit is not ready');
  }
  if (!source.createZavorthPackageReady || !source.createPackDryRunPassed || !source.createHelpPassed || !source.createDryRunPassed) {
    blockers.push('create-zavorth package release audit is not ready');
  }
  if (hasProhibitedAttempt(source)) {
    blockers.push('prohibited publish/runtime/safety attempt detected');
  }
  return blockers;
}

function sourceAuditsReady(source: CoordinatedNpmPublishApprovalSource): boolean {
  return (
    source.previous264.decision === 'create-zavorth-package-bridge-ready' &&
    source.previous264.executionGate.createZavorthPackagePrepared &&
    source.previous264.executionGate.npmPublishActuallyPerformed === false &&
    source.previous264.executionGate.createZavorthPublishActuallyPerformed === false &&
    source.rootPackageReady &&
    source.createZavorthPackageReady &&
    source.rootPackageName === 'zavorth' &&
    source.createPackageName === 'create-zavorth' &&
    source.packageVersion === '1.1.0-alpha.0' &&
    source.rootPackDryRunPassed &&
    source.createPackDryRunPassed &&
    source.rootHelpPassed &&
    source.createHelpPassed &&
    source.createDryRunPassed &&
    source.runtimeCheckPassed &&
    source.buildPassed &&
    source.representativeExternalAgentsPassed &&
    source.npmWhoamiChecked &&
    source.publicSurfaceScanPassed &&
    source.redactionScanPassed &&
    !hasProhibitedAttempt(source)
  );
}

function goNoGoDecision(source: CoordinatedNpmPublishApprovalSource): NpmPublishGoNoGoDecision {
  const blockers = publishBlockers(source);
  const ready = sourceAuditsReady(source) && source.npmIdentityAvailable && blockers.length === 0;

  return {
    nativeContract: 'NpmPublishGoNoGoDecision/v1',
    publishDecision: ready ? 'ready-awaiting-operator-approval' : 'blocked',
    publishReady: ready,
    publishBlocked: !ready,
    publishBlockers: blockers,
    finalOperatorApprovalRequired: true,
    rootPackageReady: true,
    createZavorthPackageReady: true,
    npmPublishActuallyPerformed: false,
    createZavorthPublishActuallyPerformed: false,
  };
}

function executionGate(source: CoordinatedNpmPublishApprovalSource): CoordinatedNpmPublishApprovalExecutionGate {
  const goNoGo = goNoGoDecision(source);

  return {
    coordinatedNpmPublishApprovalGateCreated: true,
    publishDecision: goNoGo.publishDecision,
    publishReady: goNoGo.publishReady,
    publishBlocked: goNoGo.publishBlocked,
    rootPackageReady: true,
    createZavorthPackageReady: true,
    npmIdentityAvailable: source.npmIdentityAvailable,
    publishOrder: 'root-then-create',
    npmPublishActuallyPerformed: false,
    createZavorthPublishActuallyPerformed: false,
    finalOperatorApprovalRequired: true,
    rawSecretSerialized: false,
    publicExternalExecutorIdentityLeak: false,
    batFilesNotProductPath: true,
    rawImportDefaultDisabled: true,
    limitedProductionSendStillGated: true,
    adapterRemovalGlobalAllowed: false,
  };
}

export class CoordinatedNpmPublishApprovalGate {
  public constructor(public readonly normalization: CoordinatedNpmPublishApprovalNormalization) {}

  public expectedState(state: CoordinatedNpmPublishExpectedState): boolean {
    return this.normalization.expectedStates.includes(state);
  }

  public publishAllowed(): boolean {
    return false;
  }
}

export function createCoordinatedNpmPublishApprovalSource(
  overrides: Partial<CoordinatedNpmPublishApprovalSource> = {},
): CoordinatedNpmPublishApprovalSource {
  return {
    previous264: createCreateZavorthPackageBridgePackFixture().normalization,
    rootPackageReady: true,
    createZavorthPackageReady: true,
    rootPackageName: 'zavorth',
    createPackageName: 'create-zavorth',
    packageVersion: '1.1.0-alpha.0',
    rootPackDryRunPassed: true,
    createPackDryRunPassed: true,
    rootHelpPassed: true,
    createHelpPassed: true,
    createDryRunPassed: true,
    runtimeCheckPassed: true,
    buildPassed: true,
    representativeExternalAgentsPassed: true,
    npmWhoamiChecked: true,
    npmIdentityAvailable: false,
    npmIdentityStatus: 'not-authenticated',
    npmWhoamiResult: 'ENEEDAUTH',
    publicSurfaceScanPassed: true,
    redactionScanPassed: true,
    npmPublishAttempted: false,
    createZavorthPublishAttempted: false,
    npmAuthModified: false,
    globalInstallAttempted: false,
    runtimePersistentStartAttempted: false,
    externalExecutorLiveCalled: false,
    publicExternalExecutorIdentityExposed: false,
    docsPromoteBatFiles: false,
    rawSqliteImportEnabled: false,
    messageSendAttempted: false,
    providerExecutionAttempted: false,
    toolCommandExecutionAttempted: false,
    adapterGlobalRemovalAttempted: false,
    rawSecretSerialized: false,
    ...overrides,
  };
}

export function normalizeCoordinatedNpmPublishApprovalGate(
  options: CoordinatedNpmPublishApprovalOptions,
): CoordinatedNpmPublishApprovalNormalization {
  const goNoGo = goNoGoDecision(options.source);

  return {
    nativeContract: 'CoordinatedNpmPublishApprovalGate/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: goNoGo.publishDecision,
    status: goNoGo.publishDecision,
    expectedStates: expectedStates(),
    rootPackage: rootPackage(),
    createZavorthPackage: createZavorthPackage(),
    publishOrderPlan: publishOrderPlan(),
    npmIdentityCheck: identityCheck(options.source),
    safetyReport: safetyReport(options.source),
    goNoGoDecision: goNoGo,
    executionGate: executionGate(options.source),
    redaction: {
      rawSecretSerialized: false,
      rawContentSerialized: false,
      packageSecretsIncluded: false,
      publicSourceIdentityExposed: false,
      receiptsRedacted: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    terminalGate: 'do-not-publish-without-explicit-operator-approval',
  };
}

export function createCoordinatedNpmPublishApprovalGateFixture(
  overrides: Partial<CoordinatedNpmPublishApprovalSource> = {},
): CoordinatedNpmPublishApprovalGate {
  return new CoordinatedNpmPublishApprovalGate(
    normalizeCoordinatedNpmPublishApprovalGate({
      generatedAt: COORDINATED_NPM_PUBLISH_APPROVAL_GATE_NOW,
      runtimeId: COORDINATED_NPM_PUBLISH_APPROVAL_GATE_RUNTIME_ID,
      source: createCoordinatedNpmPublishApprovalSource(overrides),
    }),
  );
}
