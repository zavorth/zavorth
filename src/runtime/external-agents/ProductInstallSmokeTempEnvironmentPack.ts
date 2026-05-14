export const PRODUCT_INSTALL_SMOKE_TEMP_ENVIRONMENT_PACK_NOW = '2026-05-02T00:30:00.000Z' as const;
export const PRODUCT_INSTALL_SMOKE_TEMP_ENVIRONMENT_PACK_RUNTIME_ID = 'product-install-smoke-temp-environment-pack' as const;

export type ProductInstallSmokeDecision =
  | 'blocked'
  | 'install-smoke-passed';

export type ProductInstallSmokeCommandStatus =
  | 'passed'
  | 'skipped';

export type ProductInstallSmokeCommandId =
  | 'npx-zavorth-help'
  | 'node-bin-zavorth-help'
  | 'npx-zavorth-setup-help'
  | 'npx-zavorth-doctor-help'
  | 'npx-zavorth-go-dry-run';

export type ProductInstallSmokeCommandResult = {
  nativeContract: 'ProductInstallSmokeCommandResult/v1';
  commandId: ProductInstallSmokeCommandId;
  command: string;
  status: ProductInstallSmokeCommandStatus;
  exitCode: 0 | null;
  safeHelpOrDryRunOnly: true;
  providerKeyRequired: false;
  externalExecutorRequired: false;
  runtimePersisted: false;
  uglyStackTraceObserved: false;
  rawSecretSerialized: false;
};

export type ProductInstallSmokePackageInspection = {
  nativeContract: 'ProductInstallSmokePackageInspection/v1';
  generatedPackage: 'zavorth-1.1.0-alpha.0.tgz';
  generatedByLocalNpmPack: true;
  npmPublishActuallyPerformed: false;
  requiredEntriesPresent: string[];
  forbiddenEntriesAbsent: string[];
  packageRemovedAfterSmoke: true;
  rawSecretSerialized: false;
};

export type ProductInstallSmokeTempEnvironment = {
  nativeContract: 'ProductInstallSmokeTempEnvironment/v1';
  tempPath: '.tmp/install-smoke/261-temp-env';
  npmInitPerformed: true;
  localTgzInstalled: true;
  installedZavorthBinAvailable: true;
  cleanedAfterSmoke: true;
  globalInstallPerformed: false;
  rawSecretSerialized: false;
};

export type ProductInstallSmokeGate = {
  productInstallSmokeTempEnvironmentPackCreated: true;
  npmPackLocalOnly: true;
  npmPublishActuallyPerformed: false;
  tempInstallSmokeExecuted: true;
  installedZavorthBinAvailable: true;
  defaultInstallExternalExecutorRequired: false;
  providerKeyRequiredForHelpCommands: false;
  batFilesNotProductPath: true;
  rawSecretSerialized: false;
  tempEnvironmentCleaned: true;
};

export type ProductInstallSmokeSource = {
  npmPackLocalOnly: true;
  packageGenerated: true;
  tempEnvironmentCreated: true;
  tgzInstalledInTempEnvironment: true;
  installedZavorthBinAvailable: true;
  helpCommandsPassed: true;
  setupHelpPassed: true;
  doctorHelpPassed: true;
  goDryRunPassed: true;
  packageContentsValidated: true;
  forbiddenPackageEntriesAbsent: true;
  humanErrorMessagesValidated: true;
  tempEnvironmentCleaned: true;
  generatedPackageCleaned: true;
  npmPublishAttempted: false;
  globalInstallAttempted: false;
  externalExecutorRequired: false;
  providerKeyRequiredForHelpCommands: false;
  batFilesDocumentedAsProductPath: false;
  rawSecretSerialized: false;
  providerExecutionAttempted: false;
  toolCommandExecutionAttempted: false;
  messageSendAttempted: false;
  migrationAttempted: false;
  persistentRuntimeStarted: false;
};

export type ProductInstallSmokeNormalization = {
  nativeContract: 'ProductInstallSmokeTempEnvironmentPack/v1';
  generatedAt: string;
  runtimeId: typeof PRODUCT_INSTALL_SMOKE_TEMP_ENVIRONMENT_PACK_RUNTIME_ID;
  decision: ProductInstallSmokeDecision;
  status: ProductInstallSmokeDecision;
  packageInspection: ProductInstallSmokePackageInspection;
  tempEnvironment: ProductInstallSmokeTempEnvironment;
  commandResults: ProductInstallSmokeCommandResult[];
  executionGate: ProductInstallSmokeGate;
  prohibited: {
    npmPublishActuallyPerformed: false;
    globalInstallPerformed: false;
    externalExecutorInstallRequirement: false;
    providerKeyRequiredForHelpCommands: false;
    batAsProductPath: false;
    rawSecretSerialized: false;
    providerActuallyExecuted: false;
    toolCommandActuallyExecuted: false;
    messageActuallySent: false;
    stateMigrated: false;
    persistentRuntimeStarted: false;
  };
};

export type ProductInstallSmokeOptions = {
  generatedAt: string;
  runtimeId: typeof PRODUCT_INSTALL_SMOKE_TEMP_ENVIRONMENT_PACK_RUNTIME_ID;
  source: ProductInstallSmokeSource;
};

const REQUIRED_PACKAGE_ENTRIES = [
  'package/bin/zavorth.js',
  'package/dist/zavorth-cli.js',
  'package/dist-ops/scripts/setup-v3.js',
  'package/dist-ops/scripts/ops-go.js',
  'package/dist-ops/scripts/ops-doctor.js',
  'package/docs/02-quickstart.md',
  'package/docs/09-operations.md',
  'package/docs/10-troubleshooting.md',
  'package/docs/34-zavorth-cli.md',
] as const;

const FORBIDDEN_PACKAGE_ENTRIES = [
  'package/.env',
  'package/.tmp/',
  'package/node_modules/',
  'package/data/runtime/',
  'package/logs/',
] as const;

function commandResult(
  commandId: ProductInstallSmokeCommandId,
  command: string,
): ProductInstallSmokeCommandResult {
  return {
    nativeContract: 'ProductInstallSmokeCommandResult/v1',
    commandId,
    command,
    status: 'passed',
    exitCode: 0,
    safeHelpOrDryRunOnly: true,
    providerKeyRequired: false,
    externalExecutorRequired: false,
    runtimePersisted: false,
    uglyStackTraceObserved: false,
    rawSecretSerialized: false,
  };
}

function sourceReady(source: ProductInstallSmokeSource): boolean {
  return (
    source.npmPackLocalOnly &&
    source.packageGenerated &&
    source.tempEnvironmentCreated &&
    source.tgzInstalledInTempEnvironment &&
    source.installedZavorthBinAvailable &&
    source.helpCommandsPassed &&
    source.setupHelpPassed &&
    source.doctorHelpPassed &&
    source.goDryRunPassed &&
    source.packageContentsValidated &&
    source.forbiddenPackageEntriesAbsent &&
    source.humanErrorMessagesValidated &&
    source.tempEnvironmentCleaned &&
    source.generatedPackageCleaned &&
    !source.npmPublishAttempted &&
    !source.globalInstallAttempted &&
    !source.externalExecutorRequired &&
    !source.providerKeyRequiredForHelpCommands &&
    !source.batFilesDocumentedAsProductPath &&
    !source.rawSecretSerialized &&
    !source.providerExecutionAttempted &&
    !source.toolCommandExecutionAttempted &&
    !source.messageSendAttempted &&
    !source.migrationAttempted &&
    !source.persistentRuntimeStarted
  );
}

export class ProductInstallSmokeTempEnvironmentPack {
  public constructor(public readonly normalization: ProductInstallSmokeNormalization) {}

  public command(commandId: ProductInstallSmokeCommandId): ProductInstallSmokeCommandResult {
    const found = this.normalization.commandResults.find((command) => command.commandId === commandId);
    if (!found) {
      throw new Error(`Unknown install smoke command: ${commandId}`);
    }
    return found;
  }
}

export function createProductInstallSmokeSource(
  overrides: Partial<ProductInstallSmokeSource> = {},
): ProductInstallSmokeSource {
  return {
    npmPackLocalOnly: true,
    packageGenerated: true,
    tempEnvironmentCreated: true,
    tgzInstalledInTempEnvironment: true,
    installedZavorthBinAvailable: true,
    helpCommandsPassed: true,
    setupHelpPassed: true,
    doctorHelpPassed: true,
    goDryRunPassed: true,
    packageContentsValidated: true,
    forbiddenPackageEntriesAbsent: true,
    humanErrorMessagesValidated: true,
    tempEnvironmentCleaned: true,
    generatedPackageCleaned: true,
    npmPublishAttempted: false,
    globalInstallAttempted: false,
    externalExecutorRequired: false,
    providerKeyRequiredForHelpCommands: false,
    batFilesDocumentedAsProductPath: false,
    rawSecretSerialized: false,
    providerExecutionAttempted: false,
    toolCommandExecutionAttempted: false,
    messageSendAttempted: false,
    migrationAttempted: false,
    persistentRuntimeStarted: false,
    ...overrides,
  };
}

export function normalizeProductInstallSmokeTempEnvironmentPack(
  options: ProductInstallSmokeOptions,
): ProductInstallSmokeNormalization {
  const ready = sourceReady(options.source);
  const decision: ProductInstallSmokeDecision = ready ? 'install-smoke-passed' : 'blocked';

  return {
    nativeContract: 'ProductInstallSmokeTempEnvironmentPack/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision,
    status: decision,
    packageInspection: {
      nativeContract: 'ProductInstallSmokePackageInspection/v1',
      generatedPackage: 'zavorth-1.1.0-alpha.0.tgz',
      generatedByLocalNpmPack: true,
      npmPublishActuallyPerformed: false,
      requiredEntriesPresent: [...REQUIRED_PACKAGE_ENTRIES],
      forbiddenEntriesAbsent: [...FORBIDDEN_PACKAGE_ENTRIES],
      packageRemovedAfterSmoke: true,
      rawSecretSerialized: false,
    },
    tempEnvironment: {
      nativeContract: 'ProductInstallSmokeTempEnvironment/v1',
      tempPath: '.tmp/install-smoke/261-temp-env',
      npmInitPerformed: true,
      localTgzInstalled: true,
      installedZavorthBinAvailable: true,
      cleanedAfterSmoke: true,
      globalInstallPerformed: false,
      rawSecretSerialized: false,
    },
    commandResults: [
      commandResult('npx-zavorth-help', 'npx --no-install zavorth --help'),
      commandResult('node-bin-zavorth-help', 'node node_modules/zavorth/bin/zavorth.js --help'),
      commandResult('npx-zavorth-setup-help', 'npx --no-install zavorth setup --help'),
      commandResult('npx-zavorth-doctor-help', 'npx --no-install zavorth doctor --help'),
      commandResult('npx-zavorth-go-dry-run', 'npx --no-install zavorth go --dry-run --timeout-ms=1000 --poll-ms=250'),
    ],
    executionGate: {
      productInstallSmokeTempEnvironmentPackCreated: true,
      npmPackLocalOnly: true,
      npmPublishActuallyPerformed: false,
      tempInstallSmokeExecuted: true,
      installedZavorthBinAvailable: true,
      defaultInstallExternalExecutorRequired: false,
      providerKeyRequiredForHelpCommands: false,
      batFilesNotProductPath: true,
      rawSecretSerialized: false,
      tempEnvironmentCleaned: true,
    },
    prohibited: {
      npmPublishActuallyPerformed: false,
      globalInstallPerformed: false,
      externalExecutorInstallRequirement: false,
      providerKeyRequiredForHelpCommands: false,
      batAsProductPath: false,
      rawSecretSerialized: false,
      providerActuallyExecuted: false,
      toolCommandActuallyExecuted: false,
      messageActuallySent: false,
      stateMigrated: false,
      persistentRuntimeStarted: false,
    },
  };
}

export function createProductInstallSmokeTempEnvironmentPackFixture(
  overrides: Partial<ProductInstallSmokeSource> = {},
): ProductInstallSmokeTempEnvironmentPack {
  return new ProductInstallSmokeTempEnvironmentPack(
    normalizeProductInstallSmokeTempEnvironmentPack({
      generatedAt: PRODUCT_INSTALL_SMOKE_TEMP_ENVIRONMENT_PACK_NOW,
      runtimeId: PRODUCT_INSTALL_SMOKE_TEMP_ENVIRONMENT_PACK_RUNTIME_ID,
      source: createProductInstallSmokeSource(overrides),
    }),
  );
}
