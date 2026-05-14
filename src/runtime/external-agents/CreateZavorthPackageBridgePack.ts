import {
  createPostAbsorptionPublishCreateAndStabilityGateFixture,
} from './PostAbsorptionPublishCreateAndStabilityGate.js';
import type {
  PostAbsorptionPublishCreateAndStabilityNormalization,
} from './PostAbsorptionPublishCreateAndStabilityGate.js';

export const CREATE_ZAVORTH_PACKAGE_BRIDGE_PACK_NOW = '2026-05-02T03:00:00.000Z' as const;
export const CREATE_ZAVORTH_PACKAGE_BRIDGE_PACK_RUNTIME_ID = 'create-zavorth-package-bridge-pack' as const;

export type CreateZavorthPackageBridgeDecision =
  | 'blocked'
  | 'create-zavorth-package-bridge-ready';

export type CreateZavorthNpmCreateStatus =
  | 'bridge-ready-with-publish-plan'
  | 'package-bridge-ready';

export type CreateZavorthPackageBridgeExpectedState =
  | 'batFilesNotProductPath=true'
  | 'createZavorthPackagePrepared=true'
  | 'createZavorthPublishActuallyPerformed=false'
  | 'defaultRuntimeZavorthOwned=true'
  | 'npmCreateZavorth=package-bridge-ready'
  | 'npmPublishActuallyPerformed=false'
  | 'publicExternalExecutorIdentityLeak=false'
  | 'rawSecretSerialized=false'
  | 'runtimePersistentStart=false';

export type CreateZavorthBridgeCheckId =
  | 'create-package-help'
  | 'create-package-pack-dry-run'
  | 'create-package-root-helper-dry-run'
  | 'create-package-root-helper-help'
  | 'main-package-build'
  | 'main-package-pack-dry-run'
  | 'runtime-check';

export type CreateZavorthBridgeCheck = {
  nativeContract: 'CreateZavorthBridgeCheck/v1';
  checkId: CreateZavorthBridgeCheckId;
  commandOrCheck: string;
  expectedStatus: 'passed-or-recorded';
  publishAllowed: false;
  externalActionAllowed: false;
  rawSecretSerialized: false;
};

export type CreateZavorthPackageBridge = {
  nativeContract: 'CreateZavorthPackageBridge/v1';
  npmCreateZavorth: CreateZavorthNpmCreateStatus;
  createZavorthPackagePrepared: true;
  packageDirectory: 'packages/create-zavorth';
  packageName: 'create-zavorth';
  packageVersion: '1.1.0-alpha.0';
  packagePrivate: false;
  packageBinName: 'create-zavorth';
  packageBinEntrypoint: './bin/create-zavorth.js';
  rootHelperStillAvailable: './bin/create-zavorth.js';
  supportsHelp: true;
  supportsDryRun: true;
  writesSecrets: false;
  runtimePersistentStart: false;
  providerToolCommandExecuted: false;
  messageActuallySent: false;
  externalExecutorRequired: false;
  packageBridgePublishPlan: string[];
  rawSecretSerialized: false;
};

export type CreateZavorthPackageBridgeExecutionGate = {
  createZavorthPackageBridgePackCreated: true;
  npmCreateZavorth: CreateZavorthNpmCreateStatus;
  createZavorthPackagePrepared: true;
  createZavorthPublishActuallyPerformed: false;
  npmPublishActuallyPerformed: false;
  defaultRuntimeZavorthOwned: true;
  publicExternalExecutorIdentityLeak: false;
  batFilesNotProductPath: true;
  rawSecretSerialized: false;
  runtimePersistentStart: false;
  providerActuallyExecuted: false;
  toolCommandActuallyExecuted: false;
  messageActuallySent: false;
  adapterRemovalGlobalAllowed: false;
};

export type CreateZavorthPackageBridgeSource = {
  previous263: Pick<
    PostAbsorptionPublishCreateAndStabilityNormalization,
    'decision' | 'executionGate' | 'npmCreateZavorthGate' | 'publishGate'
  >;
  packageDirectoryExists: true;
  packageJsonExists: true;
  packageName: 'create-zavorth';
  packageVersion: '1.1.0-alpha.0';
  packageBinEntrypoint: './bin/create-zavorth.js';
  packagePrivate: false;
  packageSupportsHelp: true;
  packageSupportsDryRun: true;
  packagePackDryRunPassed: true;
  rootHelperSupportsHelp: true;
  rootHelperSupportsDryRun: true;
  mainBuildPassed: true;
  mainPackDryRunPassed: true;
  runtimeCheckPassed: true;
  docsUpdated: true;
  npmPublishAttempted: false;
  createZavorthPublishAttempted: false;
  globalInstallAttempted: false;
  runtimePersistentStartAttempted: false;
  providerExecutionAttempted: false;
  toolCommandExecutionAttempted: false;
  messageSendAttempted: false;
  externalExecutorRequirementIntroduced: false;
  docsPromoteBatFiles: false;
  publicExternalExecutorIdentityExposed: false;
  rawSqliteImportEnabled: false;
  adapterGlobalRemovalAttempted: false;
  rawSecretSerialized: false;
};

export type CreateZavorthPackageBridgeNormalization = {
  nativeContract: 'CreateZavorthPackageBridgePack/v1';
  generatedAt: string;
  runtimeId: typeof CREATE_ZAVORTH_PACKAGE_BRIDGE_PACK_RUNTIME_ID;
  decision: CreateZavorthPackageBridgeDecision;
  status: CreateZavorthPackageBridgeDecision;
  expectedStates: CreateZavorthPackageBridgeExpectedState[];
  bridge: CreateZavorthPackageBridge;
  validationChecks: CreateZavorthBridgeCheck[];
  executionGate: CreateZavorthPackageBridgeExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    rawContentSerialized: false;
    packageSecretsIncluded: false;
    publicSourceIdentityExposed: false;
    receiptsRedacted: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  terminalGate: 'do-not-advance-beyond-264-without-operator-decision';
};

export type CreateZavorthPackageBridgeOptions = {
  generatedAt: string;
  runtimeId: typeof CREATE_ZAVORTH_PACKAGE_BRIDGE_PACK_RUNTIME_ID;
  source: CreateZavorthPackageBridgeSource;
};

function validationCheck(
  checkId: CreateZavorthBridgeCheckId,
  commandOrCheck: string,
): CreateZavorthBridgeCheck {
  return {
    nativeContract: 'CreateZavorthBridgeCheck/v1',
    checkId,
    commandOrCheck,
    expectedStatus: 'passed-or-recorded',
    publishAllowed: false,
    externalActionAllowed: false,
    rawSecretSerialized: false,
  };
}

function expectedStates(): CreateZavorthPackageBridgeExpectedState[] {
  return [
    'npmCreateZavorth=package-bridge-ready',
    'createZavorthPackagePrepared=true',
    'createZavorthPublishActuallyPerformed=false',
    'npmPublishActuallyPerformed=false',
    'defaultRuntimeZavorthOwned=true',
    'publicExternalExecutorIdentityLeak=false',
    'batFilesNotProductPath=true',
    'rawSecretSerialized=false',
    'runtimePersistentStart=false',
  ];
}

function bridge(): CreateZavorthPackageBridge {
  return {
    nativeContract: 'CreateZavorthPackageBridge/v1',
    npmCreateZavorth: 'package-bridge-ready',
    createZavorthPackagePrepared: true,
    packageDirectory: 'packages/create-zavorth',
    packageName: 'create-zavorth',
    packageVersion: '1.1.0-alpha.0',
    packagePrivate: false,
    packageBinName: 'create-zavorth',
    packageBinEntrypoint: './bin/create-zavorth.js',
    rootHelperStillAvailable: './bin/create-zavorth.js',
    supportsHelp: true,
    supportsDryRun: true,
    writesSecrets: false,
    runtimePersistentStart: false,
    providerToolCommandExecuted: false,
    messageActuallySent: false,
    externalExecutorRequired: false,
    packageBridgePublishPlan: [
      'cd packages/create-zavorth && npm pack --dry-run',
      'node packages/create-zavorth/bin/create-zavorth.js --help',
      'node packages/create-zavorth/bin/create-zavorth.js --dry-run',
      'npm publish --prefix packages/create-zavorth --access public',
    ],
    rawSecretSerialized: false,
  };
}

function validationChecks(): CreateZavorthBridgeCheck[] {
  return [
    validationCheck('runtime-check', 'npm run runtime:check --silent'),
    validationCheck('main-package-build', 'npm run build --silent'),
    validationCheck('create-package-root-helper-help', 'node bin/create-zavorth.js --help'),
    validationCheck('create-package-root-helper-dry-run', 'node bin/create-zavorth.js --dry-run'),
    validationCheck('create-package-help', 'node packages/create-zavorth/bin/create-zavorth.js --help'),
    validationCheck('create-package-pack-dry-run', 'cd packages/create-zavorth && npm pack --dry-run'),
    validationCheck('main-package-pack-dry-run', 'npm pack --dry-run'),
  ];
}

function hasProhibitedAttempt(source: CreateZavorthPackageBridgeSource): boolean {
  return source.npmPublishAttempted ||
    source.createZavorthPublishAttempted ||
    source.globalInstallAttempted ||
    source.runtimePersistentStartAttempted ||
    source.providerExecutionAttempted ||
    source.toolCommandExecutionAttempted ||
    source.messageSendAttempted ||
    source.externalExecutorRequirementIntroduced ||
    source.docsPromoteBatFiles ||
    source.publicExternalExecutorIdentityExposed ||
    source.rawSqliteImportEnabled ||
    source.adapterGlobalRemovalAttempted ||
    source.rawSecretSerialized;
}

function sourceReady(source: CreateZavorthPackageBridgeSource): boolean {
  return (
    source.previous263.decision === 'publish-create-stability-gate-ready' &&
    source.previous263.executionGate.npmPublishActuallyPerformed === false &&
    source.previous263.executionGate.defaultRuntimeZavorthOwned &&
    source.previous263.executionGate.publicExternalExecutorIdentityLeak === false &&
    source.previous263.executionGate.batFilesNotProductPath &&
    source.packageDirectoryExists &&
    source.packageJsonExists &&
    source.packageName === 'create-zavorth' &&
    source.packageVersion === '1.1.0-alpha.0' &&
    source.packageBinEntrypoint === './bin/create-zavorth.js' &&
    source.packagePrivate === false &&
    source.packageSupportsHelp &&
    source.packageSupportsDryRun &&
    source.packagePackDryRunPassed &&
    source.rootHelperSupportsHelp &&
    source.rootHelperSupportsDryRun &&
    source.mainBuildPassed &&
    source.mainPackDryRunPassed &&
    source.runtimeCheckPassed &&
    source.docsUpdated &&
    !hasProhibitedAttempt(source)
  );
}

function executionGate(): CreateZavorthPackageBridgeExecutionGate {
  return {
    createZavorthPackageBridgePackCreated: true,
    npmCreateZavorth: 'package-bridge-ready',
    createZavorthPackagePrepared: true,
    createZavorthPublishActuallyPerformed: false,
    npmPublishActuallyPerformed: false,
    defaultRuntimeZavorthOwned: true,
    publicExternalExecutorIdentityLeak: false,
    batFilesNotProductPath: true,
    rawSecretSerialized: false,
    runtimePersistentStart: false,
    providerActuallyExecuted: false,
    toolCommandActuallyExecuted: false,
    messageActuallySent: false,
    adapterRemovalGlobalAllowed: false,
  };
}

export class CreateZavorthPackageBridgePack {
  public constructor(public readonly normalization: CreateZavorthPackageBridgeNormalization) {}

  public expectedState(state: CreateZavorthPackageBridgeExpectedState): boolean {
    return this.normalization.expectedStates.includes(state);
  }

  public validationCheck(checkId: CreateZavorthBridgeCheckId): CreateZavorthBridgeCheck | undefined {
    return this.normalization.validationChecks.find((check) => check.checkId === checkId);
  }

  public publishAllowed(): boolean {
    return this.normalization.executionGate.npmPublishActuallyPerformed ||
      this.normalization.executionGate.createZavorthPublishActuallyPerformed;
  }
}

export function createCreateZavorthPackageBridgeSource(
  overrides: Partial<CreateZavorthPackageBridgeSource> = {},
): CreateZavorthPackageBridgeSource {
  return {
    previous263: createPostAbsorptionPublishCreateAndStabilityGateFixture().normalization,
    packageDirectoryExists: true,
    packageJsonExists: true,
    packageName: 'create-zavorth',
    packageVersion: '1.1.0-alpha.0',
    packageBinEntrypoint: './bin/create-zavorth.js',
    packagePrivate: false,
    packageSupportsHelp: true,
    packageSupportsDryRun: true,
    packagePackDryRunPassed: true,
    rootHelperSupportsHelp: true,
    rootHelperSupportsDryRun: true,
    mainBuildPassed: true,
    mainPackDryRunPassed: true,
    runtimeCheckPassed: true,
    docsUpdated: true,
    npmPublishAttempted: false,
    createZavorthPublishAttempted: false,
    globalInstallAttempted: false,
    runtimePersistentStartAttempted: false,
    providerExecutionAttempted: false,
    toolCommandExecutionAttempted: false,
    messageSendAttempted: false,
    externalExecutorRequirementIntroduced: false,
    docsPromoteBatFiles: false,
    publicExternalExecutorIdentityExposed: false,
    rawSqliteImportEnabled: false,
    adapterGlobalRemovalAttempted: false,
    rawSecretSerialized: false,
    ...overrides,
  };
}

export function normalizeCreateZavorthPackageBridgePack(
  options: CreateZavorthPackageBridgeOptions,
): CreateZavorthPackageBridgeNormalization {
  const ready = sourceReady(options.source);

  return {
    nativeContract: 'CreateZavorthPackageBridgePack/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'create-zavorth-package-bridge-ready' : 'blocked',
    status: ready ? 'create-zavorth-package-bridge-ready' : 'blocked',
    expectedStates: expectedStates(),
    bridge: bridge(),
    validationChecks: validationChecks(),
    executionGate: executionGate(),
    redaction: {
      rawSecretSerialized: false,
      rawContentSerialized: false,
      packageSecretsIncluded: false,
      publicSourceIdentityExposed: false,
      receiptsRedacted: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    terminalGate: 'do-not-advance-beyond-264-without-operator-decision',
  };
}

export function createCreateZavorthPackageBridgePackFixture(
  overrides: Partial<CreateZavorthPackageBridgeSource> = {},
): CreateZavorthPackageBridgePack {
  return new CreateZavorthPackageBridgePack(
    normalizeCreateZavorthPackageBridgePack({
      generatedAt: CREATE_ZAVORTH_PACKAGE_BRIDGE_PACK_NOW,
      runtimeId: CREATE_ZAVORTH_PACKAGE_BRIDGE_PACK_RUNTIME_ID,
      source: createCreateZavorthPackageBridgeSource(overrides),
    }),
  );
}
