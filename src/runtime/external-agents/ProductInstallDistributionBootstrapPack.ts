export const PRODUCT_INSTALL_DISTRIBUTION_BOOTSTRAP_PACK_NOW = '2026-05-02T00:10:00.000Z' as const;
export const PRODUCT_INSTALL_DISTRIBUTION_BOOTSTRAP_PACK_RUNTIME_ID = 'product-install-distribution-bootstrap-pack' as const;

export type ProductInstallDistributionDecision =
  | 'blocked'
  | 'product-install-distribution-bootstrap-ready';

export type ProductInstallDistributionPathId =
  | 'global-npm-install'
  | 'npx-setup'
  | 'future-npm-create-zavorth'
  | 'repo-local';

export type ProductInstallDistributionPathStatus =
  | 'documented'
  | 'designed-experimental'
  | 'local-official';

export type ProductInstallDistributionPath = {
  nativeContract: 'ProductInstallDistributionPath/v1';
  pathId: ProductInstallDistributionPathId;
  status: ProductInstallDistributionPathStatus;
  commands: string[];
  publishRequiredBeforePublicUse: boolean;
  defaultInstallExternalExecutorRequired: false;
  batFilePath: false;
  rawSecretSerialized: false;
};

export type ProductInstallPackageReadiness = {
  nativeContract: 'ProductInstallPackageReadiness/v1';
  packageName: 'zavorth';
  version: '1.1.0-alpha.0';
  main: 'dist/index.js';
  binZavorth: './bin/zavorth.js';
  filesIncludeBin: true;
  filesIncludeDist: true;
  filesIncludeDistOps: true;
  filesIncludePublicDocs: true;
  prepackBuildsDist: true;
  missingDistMessageHuman: true;
  npmPublishActuallyPerformed: false;
  rawSecretSerialized: false;
};

export type ProductInstallFutureCreateZavorthDesign = {
  nativeContract: 'ProductInstallFutureCreateZavorthDesign/v1';
  command: 'npm create zavorth';
  status: 'future-design-only';
  templateProjectInitDesigned: true;
  minimalQuestionsDesigned: true;
  canInstallDependenciesInFuture: true;
  canCreateEnvInFuture: true;
  canRunSetupInFuture: true;
  implementedInThisPack: false;
  rawSecretSerialized: false;
};

export type ProductInstallPublishChecklistId =
  | 'build'
  | 'runtime-check'
  | 'redaction-scan'
  | 'public-surface-scan'
  | 'npm-pack-dry-run'
  | 'temporary-install-smoke';

export type ProductInstallPublishChecklistItem = {
  nativeContract: 'ProductInstallPublishChecklistItem/v1';
  checklistId: ProductInstallPublishChecklistId;
  commandOrCheck: string;
  requiredBeforePublish: true;
  publishesPackage: false;
  rawSecretSerialized: false;
};

export type ProductInstallDistributionGate = {
  productInstallDistributionBootstrapPackCreated: true;
  globalNpmInstallPathDocumented: true;
  npxSetupPathDesigned: true;
  npmCreateZavorthPathDesigned: true;
  npmPublishActuallyPerformed: false;
  defaultInstallExternalExecutorRequired: false;
  batFilesNotProductPath: true;
  defaultRuntimeZavorthOwned: true;
  publicExternalExecutorIdentityLeak: false;
  rawSecretSerialized: false;
};

export type ProductInstallDistributionSource = {
  packageNameReady: true;
  packageVersionReady: true;
  packageBinReady: true;
  packageFilesConfigured: true;
  prepackBuildConfigured: true;
  globalNpmInstallDocsUpdated: true;
  npxSetupDocsUpdated: true;
  npmCreateZavorthDesigned: true;
  repoLocalPathPreserved: true;
  missingDistMessageHuman: true;
  publishChecklistDocumented: true;
  npmPublishAttempted: false;
  releaseAttempted: false;
  docsPromoteBatFiles: false;
  docsRequireExternalExecutor: false;
  publicExternalExecutorIdentityLeak: false;
  rawSecretSerialized: false;
  providerExecutionAttempted: false;
  toolCommandExecutionAttempted: false;
  messageSendAttempted: false;
  migrationAttempted: false;
  onboardCompatibilityRemoved: false;
};

export type ProductInstallDistributionNormalization = {
  nativeContract: 'ProductInstallDistributionBootstrapPack/v1';
  generatedAt: string;
  runtimeId: typeof PRODUCT_INSTALL_DISTRIBUTION_BOOTSTRAP_PACK_RUNTIME_ID;
  decision: ProductInstallDistributionDecision;
  status: ProductInstallDistributionDecision;
  packageReadiness: ProductInstallPackageReadiness;
  paths: ProductInstallDistributionPath[];
  futureCreateZavorth: ProductInstallFutureCreateZavorthDesign;
  publishChecklist: ProductInstallPublishChecklistItem[];
  executionGate: ProductInstallDistributionGate;
  prohibited: {
    npmPublishActuallyPerformed: false;
    releaseActuallyExecuted: false;
    batAsProductPath: false;
    externalExecutorInstallRequirement: false;
    rawSecretSerialized: false;
    providerActuallyExecuted: false;
    toolCommandActuallyExecuted: false;
    messageActuallySent: false;
    stateMigrated: false;
  };
};

export type ProductInstallDistributionOptions = {
  generatedAt: string;
  runtimeId: typeof PRODUCT_INSTALL_DISTRIBUTION_BOOTSTRAP_PACK_RUNTIME_ID;
  source: ProductInstallDistributionSource;
};

function sourceReady(source: ProductInstallDistributionSource): boolean {
  return (
    source.packageNameReady &&
    source.packageVersionReady &&
    source.packageBinReady &&
    source.packageFilesConfigured &&
    source.prepackBuildConfigured &&
    source.globalNpmInstallDocsUpdated &&
    source.npxSetupDocsUpdated &&
    source.npmCreateZavorthDesigned &&
    source.repoLocalPathPreserved &&
    source.missingDistMessageHuman &&
    source.publishChecklistDocumented &&
    !source.npmPublishAttempted &&
    !source.releaseAttempted &&
    !source.docsPromoteBatFiles &&
    !source.docsRequireExternalExecutor &&
    !source.publicExternalExecutorIdentityLeak &&
    !source.rawSecretSerialized &&
    !source.providerExecutionAttempted &&
    !source.toolCommandExecutionAttempted &&
    !source.messageSendAttempted &&
    !source.migrationAttempted &&
    !source.onboardCompatibilityRemoved
  );
}

function distributionPath(
  pathId: ProductInstallDistributionPathId,
  status: ProductInstallDistributionPathStatus,
  commands: string[],
  publishRequiredBeforePublicUse: boolean,
): ProductInstallDistributionPath {
  return {
    nativeContract: 'ProductInstallDistributionPath/v1',
    pathId,
    status,
    commands,
    publishRequiredBeforePublicUse,
    defaultInstallExternalExecutorRequired: false,
    batFilePath: false,
    rawSecretSerialized: false,
  };
}

function checklistItem(
  checklistId: ProductInstallPublishChecklistId,
  commandOrCheck: string,
): ProductInstallPublishChecklistItem {
  return {
    nativeContract: 'ProductInstallPublishChecklistItem/v1',
    checklistId,
    commandOrCheck,
    requiredBeforePublish: true,
    publishesPackage: false,
    rawSecretSerialized: false,
  };
}

export class ProductInstallDistributionBootstrapPack {
  public constructor(public readonly normalization: ProductInstallDistributionNormalization) {}

  public path(pathId: ProductInstallDistributionPathId): ProductInstallDistributionPath {
    const found = this.normalization.paths.find((path) => path.pathId === pathId);
    if (!found) {
      throw new Error(`Unknown distribution path: ${pathId}`);
    }
    return found;
  }
}

export function createProductInstallDistributionSource(
  overrides: Partial<ProductInstallDistributionSource> = {},
): ProductInstallDistributionSource {
  return {
    packageNameReady: true,
    packageVersionReady: true,
    packageBinReady: true,
    packageFilesConfigured: true,
    prepackBuildConfigured: true,
    globalNpmInstallDocsUpdated: true,
    npxSetupDocsUpdated: true,
    npmCreateZavorthDesigned: true,
    repoLocalPathPreserved: true,
    missingDistMessageHuman: true,
    publishChecklistDocumented: true,
    npmPublishAttempted: false,
    releaseAttempted: false,
    docsPromoteBatFiles: false,
    docsRequireExternalExecutor: false,
    publicExternalExecutorIdentityLeak: false,
    rawSecretSerialized: false,
    providerExecutionAttempted: false,
    toolCommandExecutionAttempted: false,
    messageSendAttempted: false,
    migrationAttempted: false,
    onboardCompatibilityRemoved: false,
    ...overrides,
  };
}

export function normalizeProductInstallDistributionBootstrapPack(
  options: ProductInstallDistributionOptions,
): ProductInstallDistributionNormalization {
  const ready = sourceReady(options.source);
  const decision: ProductInstallDistributionDecision = ready
    ? 'product-install-distribution-bootstrap-ready'
    : 'blocked';

  return {
    nativeContract: 'ProductInstallDistributionBootstrapPack/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision,
    status: decision,
    packageReadiness: {
      nativeContract: 'ProductInstallPackageReadiness/v1',
      packageName: 'zavorth',
      version: '1.1.0-alpha.0',
      main: 'dist/index.js',
      binZavorth: './bin/zavorth.js',
      filesIncludeBin: true,
      filesIncludeDist: true,
      filesIncludeDistOps: true,
      filesIncludePublicDocs: true,
      prepackBuildsDist: true,
      missingDistMessageHuman: true,
      npmPublishActuallyPerformed: false,
      rawSecretSerialized: false,
    },
    paths: [
      distributionPath('global-npm-install', 'documented', [
        'npm install -g zavorth',
        'zavorth setup',
        'zavorth go',
        'zavorth doctor',
      ], true),
      distributionPath('npx-setup', 'designed-experimental', [
        'npx zavorth setup',
      ], true),
      distributionPath('future-npm-create-zavorth', 'designed-experimental', [
        'npm create zavorth',
      ], true),
      distributionPath('repo-local', 'local-official', [
        'npm install',
        'npm run setup',
        'npm run go',
        'npm run doctor',
      ], false),
    ],
    futureCreateZavorth: {
      nativeContract: 'ProductInstallFutureCreateZavorthDesign/v1',
      command: 'npm create zavorth',
      status: 'future-design-only',
      templateProjectInitDesigned: true,
      minimalQuestionsDesigned: true,
      canInstallDependenciesInFuture: true,
      canCreateEnvInFuture: true,
      canRunSetupInFuture: true,
      implementedInThisPack: false,
      rawSecretSerialized: false,
    },
    publishChecklist: [
      checklistItem('build', 'npm run build --silent'),
      checklistItem('runtime-check', 'npm run runtime:check --silent'),
      checklistItem('redaction-scan', 'scan touched/package docs for raw secrets'),
      checklistItem('public-surface-scan', 'scan public docs for forbidden product identity leaks'),
      checklistItem('npm-pack-dry-run', 'npm pack --dry-run'),
      checklistItem('temporary-install-smoke', 'install packed tarball in a temporary directory and run zavorth --help'),
    ],
    executionGate: {
      productInstallDistributionBootstrapPackCreated: true,
      globalNpmInstallPathDocumented: true,
      npxSetupPathDesigned: true,
      npmCreateZavorthPathDesigned: true,
      npmPublishActuallyPerformed: false,
      defaultInstallExternalExecutorRequired: false,
      batFilesNotProductPath: true,
      defaultRuntimeZavorthOwned: true,
      publicExternalExecutorIdentityLeak: false,
      rawSecretSerialized: false,
    },
    prohibited: {
      npmPublishActuallyPerformed: false,
      releaseActuallyExecuted: false,
      batAsProductPath: false,
      externalExecutorInstallRequirement: false,
      rawSecretSerialized: false,
      providerActuallyExecuted: false,
      toolCommandActuallyExecuted: false,
      messageActuallySent: false,
      stateMigrated: false,
    },
  };
}

export function createProductInstallDistributionBootstrapPackFixture(
  overrides: Partial<ProductInstallDistributionSource> = {},
): ProductInstallDistributionBootstrapPack {
  return new ProductInstallDistributionBootstrapPack(
    normalizeProductInstallDistributionBootstrapPack({
      generatedAt: PRODUCT_INSTALL_DISTRIBUTION_BOOTSTRAP_PACK_NOW,
      runtimeId: PRODUCT_INSTALL_DISTRIBUTION_BOOTSTRAP_PACK_RUNTIME_ID,
      source: createProductInstallDistributionSource(overrides),
    }),
  );
}
