export const PRODUCT_LAUNCH_UX_FINAL_POLISH_PACK_NOW = '2026-05-01T23:59:00.000Z' as const;
export const PRODUCT_LAUNCH_UX_FINAL_POLISH_PACK_RUNTIME_ID = 'product-launch-ux-final-polish-pack' as const;

export type ProductLaunchUxFinalPolishDecision =
  | 'blocked'
  | 'product-launch-ux-final-polish-ready';

export type ProductLaunchUxFinalAudience =
  | 'installed-cli-user'
  | 'repo-clone-user';

export type ProductLaunchUxFinalCommandId =
  | 'zavorth setup'
  | 'zavorth go'
  | 'zavorth doctor'
  | 'zavorth status'
  | 'zavorth chat'
  | 'npm install'
  | 'npm run build'
  | 'npm run setup'
  | 'npm run go'
  | 'npm run doctor'
  | 'npm run status'
  | 'npm run chat';

export type ProductLaunchUxFinalInstallPath = {
  nativeContract: 'ProductLaunchUxFinalInstallPath/v1';
  audience: ProductLaunchUxFinalAudience;
  commands: ProductLaunchUxFinalCommandId[];
  commandCountSmall: true;
  pathSimple: true;
  batFilePath: false;
  externalExecutorRequired: false;
  rawSecretSerialized: false;
};

export type ProductLaunchUxFirstRunCheckId =
  | 'node-npm-version'
  | 'dependencies-installed'
  | 'build-dist-present'
  | 'env-file-present'
  | 'provider-model-config'
  | 'port-availability'
  | 'local-permissions'
  | 'secretref-config-pending';

export type ProductLaunchUxFirstRunCheck = {
  nativeContract: 'ProductLaunchUxFirstRunCheck/v1';
  checkId: ProductLaunchUxFirstRunCheckId;
  detectsOrDocuments: true;
  humanNextStep: string;
  dangerousActionRequiresApproval: true;
  rawSecretSerialized: false;
};

export type ProductLaunchUxMissingBuildMessage = {
  nativeContract: 'ProductLaunchUxMissingBuildMessage/v1';
  entrypoint: 'bin/zavorth.js';
  humanMessage: true;
  suggestsInstallBuildSetupGoDoctor: true;
  avoidsRawStackTraceForCommonFirstUse: true;
  rawSecretSerialized: false;
};

export type ProductLaunchUxGoDoctorClarity = {
  nativeContract: 'ProductLaunchUxGoDoctorClarity/v1';
  commandCenterPath: '/control';
  goShowsOrOpensControlUrl: true;
  headlessFallbackClear: true;
  failureSuggestsDoctor: true;
  repoLocalDoctorAvailable: true;
  cliDoctorAvailable: true;
  externalExecutorRequired: false;
  batFileRequired: false;
  rawSecretSerialized: false;
};

export type ProductLaunchUxFinalDocumentationPolicy = {
  nativeContract: 'ProductLaunchUxFinalDocumentationPolicy/v1';
  publicDocsZavorthNative: true;
  docsDoNotPromoteBatFiles: true;
  docsDoNotRequireExternalExecutor: true;
  quickstartCommandCountSmall: true;
  installedCliPathDocumented: true;
  repoLocalPathDocumented: true;
  commandCenterControlDocumented: true;
  publicExternalExecutorIdentityLeak: false;
  rawSecretSerialized: false;
};

export type ProductLaunchUxFinalExecutionGate = {
  productLaunchUxFinalPolishPackCreated: true;
  installedCliPathSimple: true;
  repoLocalPathSimple: true;
  npmRunDoctorAvailable: true;
  missingBuildMessageHuman: true;
  commandCenterControlDocumented: true;
  goShowsOrOpensControlUrl: true;
  batFilesNotProductPath: true;
  defaultInstallExternalExecutorRequired: false;
  defaultRuntimeZavorthOwned: true;
  publicExternalExecutorIdentityLeak: false;
  rawSecretSerialized: false;
};

export type ProductLaunchUxFinalPolishSource = {
  packageBinZavorthFriendlyEntrypoint: true;
  repoLocalScriptsSetupGoDoctorExist: true;
  cliSetupGoDoctorStatusDocumented: true;
  onboardAliasPreserved: true;
  firstRunChecksDetectedOrDocumented: true;
  missingBuildMessageHuman: true;
  goShowsOrOpensControlUrl: true;
  commandCenterControlDocumented: true;
  docsPromoteBatFiles: false;
  docsRequireExternalExecutor: false;
  externalExecutorDefaultRuntimeRequired: false;
  rawSecretSerialized: false;
  messageSendAttempted: false;
  providerExecutionAttempted: false;
  toolCommandExecutionAttempted: false;
  migrationAttempted: false;
  adapterGlobalRemovalAttempted: false;
};

export type ProductLaunchUxFinalPolishNormalization = {
  nativeContract: 'ProductLaunchUxFinalPolishPack/v1';
  generatedAt: string;
  runtimeId: typeof PRODUCT_LAUNCH_UX_FINAL_POLISH_PACK_RUNTIME_ID;
  decision: ProductLaunchUxFinalPolishDecision;
  status: ProductLaunchUxFinalPolishDecision;
  installedCliPath: ProductLaunchUxFinalInstallPath;
  repoLocalPath: ProductLaunchUxFinalInstallPath;
  firstRunChecks: ProductLaunchUxFirstRunCheck[];
  missingBuild: ProductLaunchUxMissingBuildMessage;
  goDoctorClarity: ProductLaunchUxGoDoctorClarity;
  documentationPolicy: ProductLaunchUxFinalDocumentationPolicy;
  executionGate: ProductLaunchUxFinalExecutionGate;
  prohibited: {
    batAsProductPath: false;
    externalExecutorInstallRequirement: false;
    rawSecretSerialized: false;
    messageActuallySent: false;
    providerActuallyExecuted: false;
    toolCommandActuallyExecuted: false;
    stateMigrated: false;
    adapterGlobalRemoved: false;
  };
};

export type ProductLaunchUxFinalPolishOptions = {
  generatedAt: string;
  runtimeId: typeof PRODUCT_LAUNCH_UX_FINAL_POLISH_PACK_RUNTIME_ID;
  source: ProductLaunchUxFinalPolishSource;
};

const FIRST_RUN_CHECKS: Array<{
  checkId: ProductLaunchUxFirstRunCheckId;
  humanNextStep: string;
}> = [
  {
    checkId: 'node-npm-version',
    humanNextStep: 'Install a supported Node/npm version, then rerun zavorth setup.',
  },
  {
    checkId: 'dependencies-installed',
    humanNextStep: 'Run npm install before npm run setup or npm run go.',
  },
  {
    checkId: 'build-dist-present',
    humanNextStep: 'Run npm run build when the installed CLI build is missing.',
  },
  {
    checkId: 'env-file-present',
    humanNextStep: 'Run zavorth setup or npm run setup to create local configuration.',
  },
  {
    checkId: 'provider-model-config',
    humanNextStep: 'Choose a provider/model during setup or rerun zavorth doctor.',
  },
  {
    checkId: 'port-availability',
    humanNextStep: 'Free the configured port or choose another port during setup.',
  },
  {
    checkId: 'local-permissions',
    humanNextStep: 'Review the doctor output and approve only local safe steps.',
  },
  {
    checkId: 'secretref-config-pending',
    humanNextStep: 'Add SecretRef metadata or rerun setup without serializing raw values.',
  },
];

function firstRunCheck(
  check: (typeof FIRST_RUN_CHECKS)[number],
): ProductLaunchUxFirstRunCheck {
  return {
    nativeContract: 'ProductLaunchUxFirstRunCheck/v1',
    checkId: check.checkId,
    detectsOrDocuments: true,
    humanNextStep: check.humanNextStep,
    dangerousActionRequiresApproval: true,
    rawSecretSerialized: false,
  };
}

function executionGate(): ProductLaunchUxFinalExecutionGate {
  return {
    productLaunchUxFinalPolishPackCreated: true,
    installedCliPathSimple: true,
    repoLocalPathSimple: true,
    npmRunDoctorAvailable: true,
    missingBuildMessageHuman: true,
    commandCenterControlDocumented: true,
    goShowsOrOpensControlUrl: true,
    batFilesNotProductPath: true,
    defaultInstallExternalExecutorRequired: false,
    defaultRuntimeZavorthOwned: true,
    publicExternalExecutorIdentityLeak: false,
    rawSecretSerialized: false,
  };
}

function sourceReady(source: ProductLaunchUxFinalPolishSource): boolean {
  return (
    source.packageBinZavorthFriendlyEntrypoint &&
    source.repoLocalScriptsSetupGoDoctorExist &&
    source.cliSetupGoDoctorStatusDocumented &&
    source.onboardAliasPreserved &&
    source.firstRunChecksDetectedOrDocumented &&
    source.missingBuildMessageHuman &&
    source.goShowsOrOpensControlUrl &&
    source.commandCenterControlDocumented &&
    !source.docsPromoteBatFiles &&
    !source.docsRequireExternalExecutor &&
    !source.externalExecutorDefaultRuntimeRequired &&
    !source.rawSecretSerialized &&
    !source.messageSendAttempted &&
    !source.providerExecutionAttempted &&
    !source.toolCommandExecutionAttempted &&
    !source.migrationAttempted &&
    !source.adapterGlobalRemovalAttempted
  );
}

export class ProductLaunchUxFinalPolishPack {
  public constructor(public readonly normalization: ProductLaunchUxFinalPolishNormalization) {}

  public commandsFor(audience: ProductLaunchUxFinalAudience): ProductLaunchUxFinalCommandId[] {
    return audience === 'installed-cli-user'
      ? this.normalization.installedCliPath.commands
      : this.normalization.repoLocalPath.commands;
  }
}

export function createProductLaunchUxFinalPolishSource(
  overrides: Partial<ProductLaunchUxFinalPolishSource> = {},
): ProductLaunchUxFinalPolishSource {
  return {
    packageBinZavorthFriendlyEntrypoint: true,
    repoLocalScriptsSetupGoDoctorExist: true,
    cliSetupGoDoctorStatusDocumented: true,
    onboardAliasPreserved: true,
    firstRunChecksDetectedOrDocumented: true,
    missingBuildMessageHuman: true,
    goShowsOrOpensControlUrl: true,
    commandCenterControlDocumented: true,
    docsPromoteBatFiles: false,
    docsRequireExternalExecutor: false,
    externalExecutorDefaultRuntimeRequired: false,
    rawSecretSerialized: false,
    messageSendAttempted: false,
    providerExecutionAttempted: false,
    toolCommandExecutionAttempted: false,
    migrationAttempted: false,
    adapterGlobalRemovalAttempted: false,
    ...overrides,
  };
}

export function normalizeProductLaunchUxFinalPolishPack(
  options: ProductLaunchUxFinalPolishOptions,
): ProductLaunchUxFinalPolishNormalization {
  const ready = sourceReady(options.source);
  const decision: ProductLaunchUxFinalPolishDecision = ready
    ? 'product-launch-ux-final-polish-ready'
    : 'blocked';

  return {
    nativeContract: 'ProductLaunchUxFinalPolishPack/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision,
    status: decision,
    installedCliPath: {
      nativeContract: 'ProductLaunchUxFinalInstallPath/v1',
      audience: 'installed-cli-user',
      commands: [
        'zavorth setup',
        'zavorth go',
        'zavorth doctor',
        'zavorth status',
        'zavorth chat',
      ],
      commandCountSmall: true,
      pathSimple: true,
      batFilePath: false,
      externalExecutorRequired: false,
      rawSecretSerialized: false,
    },
    repoLocalPath: {
      nativeContract: 'ProductLaunchUxFinalInstallPath/v1',
      audience: 'repo-clone-user',
      commands: [
        'npm install',
        'npm run setup',
        'npm run go',
        'npm run doctor',
      ],
      commandCountSmall: true,
      pathSimple: true,
      batFilePath: false,
      externalExecutorRequired: false,
      rawSecretSerialized: false,
    },
    firstRunChecks: FIRST_RUN_CHECKS.map(firstRunCheck),
    missingBuild: {
      nativeContract: 'ProductLaunchUxMissingBuildMessage/v1',
      entrypoint: 'bin/zavorth.js',
      humanMessage: true,
      suggestsInstallBuildSetupGoDoctor: true,
      avoidsRawStackTraceForCommonFirstUse: true,
      rawSecretSerialized: false,
    },
    goDoctorClarity: {
      nativeContract: 'ProductLaunchUxGoDoctorClarity/v1',
      commandCenterPath: '/control',
      goShowsOrOpensControlUrl: true,
      headlessFallbackClear: true,
      failureSuggestsDoctor: true,
      repoLocalDoctorAvailable: true,
      cliDoctorAvailable: true,
      externalExecutorRequired: false,
      batFileRequired: false,
      rawSecretSerialized: false,
    },
    documentationPolicy: {
      nativeContract: 'ProductLaunchUxFinalDocumentationPolicy/v1',
      publicDocsZavorthNative: true,
      docsDoNotPromoteBatFiles: true,
      docsDoNotRequireExternalExecutor: true,
      quickstartCommandCountSmall: true,
      installedCliPathDocumented: true,
      repoLocalPathDocumented: true,
      commandCenterControlDocumented: true,
      publicExternalExecutorIdentityLeak: false,
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
      adapterGlobalRemoved: false,
    },
  };
}

export function createProductLaunchUxFinalPolishPackFixture(
  overrides: Partial<ProductLaunchUxFinalPolishSource> = {},
): ProductLaunchUxFinalPolishPack {
  return new ProductLaunchUxFinalPolishPack(
    normalizeProductLaunchUxFinalPolishPack({
      generatedAt: PRODUCT_LAUNCH_UX_FINAL_POLISH_PACK_NOW,
      runtimeId: PRODUCT_LAUNCH_UX_FINAL_POLISH_PACK_RUNTIME_ID,
      source: createProductLaunchUxFinalPolishSource(overrides),
    }),
  );
}
