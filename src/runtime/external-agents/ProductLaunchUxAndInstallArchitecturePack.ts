export const PRODUCT_LAUNCH_UX_AND_INSTALL_ARCHITECTURE_PACK_NOW = '2026-05-01T23:10:00.000Z' as const;
export const PRODUCT_LAUNCH_UX_AND_INSTALL_ARCHITECTURE_PACK_RUNTIME_ID = 'product-launch-ux-and-install-architecture-pack' as const;

export type ProductLaunchUxPackDecision =
  | 'blocked'
  | 'product-launch-ux-ready';

export type ProductLaunchUxCommandAudience =
  | 'installed-cli-user'
  | 'repo-clone-user';

export type ProductLaunchUxCommandId =
  | 'zavorth setup'
  | 'zavorth go'
  | 'zavorth doctor'
  | 'zavorth status'
  | 'zavorth chat'
  | 'npm install'
  | 'npm run setup'
  | 'npm run go'
  | 'npm run doctor';

export type ProductLaunchUxCommandSurface = {
  nativeContract: 'ProductLaunchUxCommandSurface/v1';
  command: ProductLaunchUxCommandId;
  audience: ProductLaunchUxCommandAudience;
  productPath: true;
  documented: true;
  batFilePath: false;
  externalExecutorRequired: false;
  rawSecretSerialized: false;
};

export type ProductLaunchUxCommandCenterLaunch = {
  nativeContract: 'ProductLaunchUxCommandCenterLaunch/v1';
  canonicalPath: '/control';
  openedOrUrlDisplayed: true;
  headlessFallbackDocumented: true;
  healthOrStatusAfterStartDocumented: true;
  externalExecutorRequired: false;
  batFileRequired: false;
  rawSecretSerialized: false;
};

export type ProductLaunchUxDocumentationPolicy = {
  nativeContract: 'ProductLaunchUxDocumentationPolicy/v1';
  publicDocsZavorthNative: true;
  batFilesNotProductPath: true;
  batShortcutsAllowedOnlyAsLocalOwnerShortcuts: true;
  defaultInstallExternalExecutorRequired: false;
  commandCenterControlDocumented: true;
  quickstartCommandCountSmall: true;
  rawSecretSerialized: false;
  publicExternalExecutorIdentityLeak: false;
};

export type ProductLaunchUxPackageEntrypoint = {
  nativeContract: 'ProductLaunchUxPackageEntrypoint/v1';
  packageBin: 'zavorth';
  binShimProvidesHumanMissingBuildMessage: true;
  setupScript: 'npm run setup';
  goScript: 'npm run go';
  doctorScript: 'npm run doctor';
  setupForwardsArgsToSetupV3: true;
  productLauncherBuildIncludesDoctor: true;
  existingCommandsPreserved: true;
  rawSecretSerialized: false;
};

export type ProductLaunchUxExecutionGate = {
  productLaunchUxPackCreated: true;
  batFilesNotProductPath: true;
  defaultInstallExternalExecutorRequired: false;
  quickstartCommandCountSmall: true;
  cliSetupGoDoctorDocumented: true;
  repoLocalSetupGoDocumented: true;
  commandCenterControlDocumented: true;
  runtimeBehaviorChangedOnlyIfNeeded: true;
  rawSecretSerialized: false;
  publicExternalExecutorIdentityLeak: false;
};

export type ProductLaunchUxSource = {
  packageBinZavorth: true;
  packageBinShimCreated: true;
  packageScriptsSetupGoDoctor: true;
  cliSetupGoDoctorStatusChatAvailable: true;
  repoLocalSetupGoDocumented: true;
  cliSetupGoDoctorDocumented: true;
  commandCenterControlDocumented: true;
  docsPromoteBatFiles: false;
  docsRequireExternalExecutor: false;
  externalExecutorDefaultRuntimeRequired: false;
  rawSecretSerialized: false;
  runtimeBehaviorChangeAttemptedOutsideUxEntrypoint: false;
  messageSendAttempted: false;
  providerExecutionAttempted: false;
  toolCommandExecutionAttempted: false;
  migrationAttempted: false;
};

export type ProductLaunchUxNormalization = {
  nativeContract: 'ProductLaunchUxAndInstallArchitecturePack/v1';
  generatedAt: string;
  runtimeId: typeof PRODUCT_LAUNCH_UX_AND_INSTALL_ARCHITECTURE_PACK_RUNTIME_ID;
  decision: ProductLaunchUxPackDecision;
  status: ProductLaunchUxPackDecision;
  installedCliPath: ProductLaunchUxCommandSurface[];
  repoClonePath: ProductLaunchUxCommandSurface[];
  commandCenterLaunch: ProductLaunchUxCommandCenterLaunch;
  documentationPolicy: ProductLaunchUxDocumentationPolicy;
  packageEntrypoint: ProductLaunchUxPackageEntrypoint;
  executionGate: ProductLaunchUxExecutionGate;
  prohibited: {
    batAsProductPath: false;
    externalExecutorInstallRequirement: false;
    rawSecretSerialized: false;
    messageActuallySent: false;
    providerActuallyExecuted: false;
    toolCommandActuallyExecuted: false;
    stateMigrated: false;
  };
};

export type ProductLaunchUxOptions = {
  generatedAt: string;
  runtimeId: typeof PRODUCT_LAUNCH_UX_AND_INSTALL_ARCHITECTURE_PACK_RUNTIME_ID;
  source: ProductLaunchUxSource;
};

function commandSurface(
  command: ProductLaunchUxCommandId,
  audience: ProductLaunchUxCommandAudience,
): ProductLaunchUxCommandSurface {
  return {
    nativeContract: 'ProductLaunchUxCommandSurface/v1',
    command,
    audience,
    productPath: true,
    documented: true,
    batFilePath: false,
    externalExecutorRequired: false,
    rawSecretSerialized: false,
  };
}

function executionGate(): ProductLaunchUxExecutionGate {
  return {
    productLaunchUxPackCreated: true,
    batFilesNotProductPath: true,
    defaultInstallExternalExecutorRequired: false,
    quickstartCommandCountSmall: true,
    cliSetupGoDoctorDocumented: true,
    repoLocalSetupGoDocumented: true,
    commandCenterControlDocumented: true,
    runtimeBehaviorChangedOnlyIfNeeded: true,
    rawSecretSerialized: false,
    publicExternalExecutorIdentityLeak: false,
  };
}

function sourceReady(source: ProductLaunchUxSource): boolean {
  return (
    source.packageBinZavorth &&
    source.packageBinShimCreated &&
    source.packageScriptsSetupGoDoctor &&
    source.cliSetupGoDoctorStatusChatAvailable &&
    source.repoLocalSetupGoDocumented &&
    source.cliSetupGoDoctorDocumented &&
    source.commandCenterControlDocumented &&
    !source.docsPromoteBatFiles &&
    !source.docsRequireExternalExecutor &&
    !source.externalExecutorDefaultRuntimeRequired &&
    !source.rawSecretSerialized &&
    !source.runtimeBehaviorChangeAttemptedOutsideUxEntrypoint &&
    !source.messageSendAttempted &&
    !source.providerExecutionAttempted &&
    !source.toolCommandExecutionAttempted &&
    !source.migrationAttempted
  );
}

export class ProductLaunchUxAndInstallArchitecturePack {
  public constructor(public readonly normalization: ProductLaunchUxNormalization) {}

  public commandsFor(audience: ProductLaunchUxCommandAudience): ProductLaunchUxCommandId[] {
    return [...this.normalization.installedCliPath, ...this.normalization.repoClonePath]
      .filter((command) => command.audience === audience)
      .map((command) => command.command);
  }
}

export function createProductLaunchUxSource(
  overrides: Partial<ProductLaunchUxSource> = {},
): ProductLaunchUxSource {
  return {
    packageBinZavorth: true,
    packageBinShimCreated: true,
    packageScriptsSetupGoDoctor: true,
    cliSetupGoDoctorStatusChatAvailable: true,
    repoLocalSetupGoDocumented: true,
    cliSetupGoDoctorDocumented: true,
    commandCenterControlDocumented: true,
    docsPromoteBatFiles: false,
    docsRequireExternalExecutor: false,
    externalExecutorDefaultRuntimeRequired: false,
    rawSecretSerialized: false,
    runtimeBehaviorChangeAttemptedOutsideUxEntrypoint: false,
    messageSendAttempted: false,
    providerExecutionAttempted: false,
    toolCommandExecutionAttempted: false,
    migrationAttempted: false,
    ...overrides,
  };
}

export function normalizeProductLaunchUxAndInstallArchitecturePack(
  options: ProductLaunchUxOptions,
): ProductLaunchUxNormalization {
  const ready = sourceReady(options.source);

  return {
    nativeContract: 'ProductLaunchUxAndInstallArchitecturePack/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'product-launch-ux-ready' : 'blocked',
    status: ready ? 'product-launch-ux-ready' : 'blocked',
    installedCliPath: [
      commandSurface('zavorth setup', 'installed-cli-user'),
      commandSurface('zavorth go', 'installed-cli-user'),
      commandSurface('zavorth doctor', 'installed-cli-user'),
      commandSurface('zavorth status', 'installed-cli-user'),
      commandSurface('zavorth chat', 'installed-cli-user'),
    ],
    repoClonePath: [
      commandSurface('npm install', 'repo-clone-user'),
      commandSurface('npm run setup', 'repo-clone-user'),
      commandSurface('npm run go', 'repo-clone-user'),
      commandSurface('npm run doctor', 'repo-clone-user'),
    ],
    commandCenterLaunch: {
      nativeContract: 'ProductLaunchUxCommandCenterLaunch/v1',
      canonicalPath: '/control',
      openedOrUrlDisplayed: true,
      headlessFallbackDocumented: true,
      healthOrStatusAfterStartDocumented: true,
      externalExecutorRequired: false,
      batFileRequired: false,
      rawSecretSerialized: false,
    },
    documentationPolicy: {
      nativeContract: 'ProductLaunchUxDocumentationPolicy/v1',
      publicDocsZavorthNative: true,
      batFilesNotProductPath: true,
      batShortcutsAllowedOnlyAsLocalOwnerShortcuts: true,
      defaultInstallExternalExecutorRequired: false,
      commandCenterControlDocumented: true,
      quickstartCommandCountSmall: true,
      rawSecretSerialized: false,
      publicExternalExecutorIdentityLeak: false,
    },
    packageEntrypoint: {
      nativeContract: 'ProductLaunchUxPackageEntrypoint/v1',
      packageBin: 'zavorth',
      binShimProvidesHumanMissingBuildMessage: true,
      setupScript: 'npm run setup',
      goScript: 'npm run go',
      doctorScript: 'npm run doctor',
      setupForwardsArgsToSetupV3: true,
      productLauncherBuildIncludesDoctor: true,
      existingCommandsPreserved: true,
      rawSecretSerialized: false,
    },
    executionGate: executionGate(),
    prohibited: {
      batAsProductPath: false,
      externalExecutorInstallRequirement: false,
      rawSecretSerialized: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      toolCommandActuallyExecuted: false,
      stateMigrated: false,
    },
  };
}

export function createProductLaunchUxAndInstallArchitecturePackFixture(
  overrides: Partial<ProductLaunchUxSource> = {},
): ProductLaunchUxAndInstallArchitecturePack {
  return new ProductLaunchUxAndInstallArchitecturePack(
    normalizeProductLaunchUxAndInstallArchitecturePack({
      generatedAt: PRODUCT_LAUNCH_UX_AND_INSTALL_ARCHITECTURE_PACK_NOW,
      runtimeId: PRODUCT_LAUNCH_UX_AND_INSTALL_ARCHITECTURE_PACK_RUNTIME_ID,
      source: createProductLaunchUxSource(overrides),
    }),
  );
}
