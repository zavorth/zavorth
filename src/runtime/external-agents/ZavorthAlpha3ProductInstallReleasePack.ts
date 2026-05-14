export const ZAVORTH_ALPHA3_PRODUCT_INSTALL_RELEASE_PACK_NOW = '2026-05-02T04:10:00.000Z' as const;
export const ZAVORTH_ALPHA3_PRODUCT_INSTALL_RELEASE_PACK_RUNTIME_ID = 'zavorth-alpha3-product-install-release-pack' as const;

export type ZavorthAlpha3Decision =
  | 'zavorth-alpha3-product-install-release-ready'
  | 'zavorth-alpha3-product-install-release-published'
  | 'zavorth-alpha3-root-publish-failed'
  | 'zavorth-alpha3-root-published-create-failed';

export type ZavorthAlpha3Scenario = 'prepublish-ready' | 'full-success' | 'root-failed' | 'root-success-create-failed';

export type ZavorthAlpha3VersionState = {
  nativeContract: 'ZavorthAlpha3VersionState/v1';
  registryAlphaBefore: '1.1.0-alpha.1';
  failedPreviousTarget: '1.1.0-alpha.2';
  localBefore: '1.1.0-alpha.2';
  target: '1.1.0';
  publishTag: 'alpha';
  stableRelease: false;
  latestTagManuallyChanged: false;
};

export type ZavorthAlpha3PackageReadiness = {
  nativeContract: 'ZavorthAlpha3PackageReadiness/v1';
  packageName: 'zavorth' | 'create-zavorth';
  version: '1.1.0';
  workingDirectory: '.' | 'packages/create-zavorth';
  bin: string[];
  packDryRunCommand: 'npm pack --dry-run --json';
  packDryRunRequired: true;
  oldIdentityPackageLeak: false;
  installerScriptsIncluded?: boolean;
};

export type ZavorthAlpha3IncludedProductWork = {
  nativeContract: 'ZavorthAlpha3IncludedProductWork/v1';
  packId: '276' | '278' | '280';
  summary: string;
  requiredForAlpha3: true;
};

export type ZavorthAlpha3PublishResult = {
  nativeContract: 'ZavorthAlpha3PublishResult/v1';
  packageName: 'zavorth' | 'create-zavorth';
  version: '1.1.0';
  command: 'npm publish --access public --tag alpha';
  workingDirectory: '.' | 'packages/create-zavorth';
  attempted: boolean;
  success: boolean;
  publishTag: 'alpha';
  stdoutSummary: string;
  stderrSummary: string;
  rawSecretSerialized: false;
};

export type ZavorthAlpha3PostPublishVerification = {
  nativeContract: 'ZavorthAlpha3PostPublishVerification/v1';
  packageName: 'zavorth' | 'create-zavorth';
  command:
    | 'npm view zavorth versions dist-tags --json'
    | 'npm view create-zavorth versions dist-tags --json';
  required: true;
  performed: boolean;
  success: boolean;
  versionsIncludeAlpha3: boolean;
  alphaTag: '1.1.0-alpha.1' | '1.1.0' | null;
  latestTagManuallyChanged: false;
};

export type ZavorthAlpha3NpxSmoke = {
  nativeContract: 'ZavorthAlpha3NpxSmoke/v1';
  command: 'npx --yes zavorth@latest --help' | 'npx --yes create-zavorth@latest --help';
  required: true;
  performed: boolean;
  success: boolean;
  outputOldIdentityLeak: false;
  runtimePersistentStartPerformed: false;
};

export type ZavorthAlpha3InstallerDryRun = {
  nativeContract: 'ZavorthAlpha3InstallerDryRun/v1';
  command:
    | 'powershell -ExecutionPolicy Bypass -File scripts/install-zavorth.ps1 -DryRun'
    | 'bash scripts/install-zavorth.sh --dry-run';
  required: true;
  performed: boolean;
  success: boolean;
  globalInstallPerformed: false;
  runtimePersistentStartPerformed: false;
  rawSecretSerialized: false;
};

export type ZavorthAlpha3DistTagState = {
  nativeContract: 'ZavorthAlpha3DistTagState/v1';
  publishTag: 'alpha';
  stableRelease: false;
  latestTagManuallyChanged: false;
  rootAlphaAfter: '1.1.0-alpha.1' | '1.1.0' | null;
  createAlphaAfter: '1.1.0-alpha.1' | '1.1.0' | null;
};

export type ZavorthAlpha3PublicOutputIdentityScan = {
  nativeContract: 'ZavorthAlpha3PublicOutputIdentityScan/v1';
  scope: 'npx-smoke-output' | 'installer-dry-run-output' | 'public-docs-package-surface';
  required: true;
  performed: boolean;
  publicOutputZavorthOnly: boolean;
  oldIdentityPublicLeak: false;
  rawSecretSerialized: false;
};

export type ZavorthAlpha3BlockedAction = {
  nativeContract: 'ZavorthAlpha3BlockedAction/v1';
  action:
    | 'adapter-global-removal'
    | 'dist-tag-latest-manual-change'
    | 'domain-purchase'
    | 'github-org-create'
    | 'global-install'
    | 'provider-tool-command-execution'
    | 'raw-history-import'
    | 'runtime-persistent-start'
    | 'stable-release'
    | 'trademark-file';
  performed: false;
};

export type ZavorthAlpha3FinalState = {
  decision: ZavorthAlpha3Decision;
  publishedVersion: '1.1.0';
  rootPublished: boolean;
  createPackagePublished: boolean;
  createPackagePublishAttempted: boolean;
  npxSmokePassed: boolean;
  installerDryRunPassed: boolean;
  publicOutputZavorthOnly: boolean;
  stableRelease: false;
  latestTagManuallyChanged: false;
  globalInstallPerformed: false;
  runtimePersistentStartPerformed: false;
  domainPurchased: false;
  githubOrgCreatedByThisPack: false;
  trademarkFiled: false;
  rawSecretSerialized: false;
  oldIdentityPublicLeak: false;
};

export type ZavorthAlpha3ProductInstallReleasePackNormalization = {
  nativeContract: 'ZavorthAlpha3ProductInstallReleasePack/v1';
  packId: '281';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_ALPHA3_PRODUCT_INSTALL_RELEASE_PACK_RUNTIME_ID;
  decision: ZavorthAlpha3Decision;
  versionBefore: ZavorthAlpha3VersionState;
  versionAfter: ZavorthAlpha3VersionState;
  rootPackage: ZavorthAlpha3PackageReadiness;
  createPackage: ZavorthAlpha3PackageReadiness;
  includedProductWork: ZavorthAlpha3IncludedProductWork[];
  publishResults: ZavorthAlpha3PublishResult[];
  postPublishVerification: ZavorthAlpha3PostPublishVerification[];
  npxSmoke: ZavorthAlpha3NpxSmoke[];
  installerDryRun: ZavorthAlpha3InstallerDryRun[];
  distTagState: ZavorthAlpha3DistTagState;
  publicOutputIdentityScan: ZavorthAlpha3PublicOutputIdentityScan[];
  publishOrder: ['zavorth', 'create-zavorth'];
  blockedActions: ZavorthAlpha3BlockedAction[];
  validationCommands: string[];
  finalState: ZavorthAlpha3FinalState;
};

export type ZavorthAlpha3ProductInstallReleasePackOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_ALPHA3_PRODUCT_INSTALL_RELEASE_PACK_RUNTIME_ID;
  scenario?: ZavorthAlpha3Scenario;
};

function decisionForScenario(scenario: ZavorthAlpha3Scenario): ZavorthAlpha3Decision {
  if (scenario === 'full-success') return 'zavorth-alpha3-product-install-release-published';
  if (scenario === 'root-failed') return 'zavorth-alpha3-root-publish-failed';
  if (scenario === 'root-success-create-failed') return 'zavorth-alpha3-root-published-create-failed';
  return 'zavorth-alpha3-product-install-release-ready';
}

function versionState(): ZavorthAlpha3VersionState {
  return {
    nativeContract: 'ZavorthAlpha3VersionState/v1',
    registryAlphaBefore: '1.1.0-alpha.1',
    failedPreviousTarget: '1.1.0-alpha.2',
    localBefore: '1.1.0-alpha.2',
    target: '1.1.0',
    publishTag: 'alpha',
    stableRelease: false,
    latestTagManuallyChanged: false,
  };
}

function includedProductWork(): ZavorthAlpha3IncludedProductWork[] {
  return [
    {
      nativeContract: 'ZavorthAlpha3IncludedProductWork/v1',
      packId: '276',
      summary: 'hard rename purge removed the previous public identity from the working tree and package surface',
      requiredForAlpha3: true,
    },
    {
      nativeContract: 'ZavorthAlpha3IncludedProductWork/v1',
      packId: '278',
      summary: 'terminal help, go dry-run, create help, and public output were polished',
      requiredForAlpha3: true,
    },
    {
      nativeContract: 'ZavorthAlpha3IncludedProductWork/v1',
      packId: '280',
      summary: 'official PowerShell and Bash installer scripts were prepared with dry-run support',
      requiredForAlpha3: true,
    },
  ];
}

function rootPackage(): ZavorthAlpha3PackageReadiness {
  return {
    nativeContract: 'ZavorthAlpha3PackageReadiness/v1',
    packageName: 'zavorth',
    version: '1.1.0',
    workingDirectory: '.',
    bin: ['zavorth'],
    packDryRunCommand: 'npm pack --dry-run --json',
    packDryRunRequired: true,
    oldIdentityPackageLeak: false,
    installerScriptsIncluded: true,
  };
}

function createPackage(): ZavorthAlpha3PackageReadiness {
  return {
    nativeContract: 'ZavorthAlpha3PackageReadiness/v1',
    packageName: 'create-zavorth',
    version: '1.1.0',
    workingDirectory: 'packages/create-zavorth',
    bin: ['create-zavorth'],
    packDryRunCommand: 'npm pack --dry-run --json',
    packDryRunRequired: true,
    oldIdentityPackageLeak: false,
  };
}

function publishResults(scenario: ZavorthAlpha3Scenario): ZavorthAlpha3PublishResult[] {
  const rootAttempted = scenario !== 'prepublish-ready';
  const rootSuccess = scenario === 'full-success' || scenario === 'root-success-create-failed';
  const createAttempted = rootSuccess;
  const createSuccess = scenario === 'full-success';
  return [
    {
      nativeContract: 'ZavorthAlpha3PublishResult/v1',
      packageName: 'zavorth',
      version: '1.1.0',
      command: 'npm publish --access public --tag alpha',
      workingDirectory: '.',
      attempted: rootAttempted,
      success: rootSuccess,
      publishTag: 'alpha',
      stdoutSummary: rootSuccess ? 'published zavorth@1.1.0' : rootAttempted ? 'root publish failed before create package' : 'not attempted yet',
      stderrSummary: rootSuccess ? '' : rootAttempted ? 'publish failed; see pack report' : '',
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthAlpha3PublishResult/v1',
      packageName: 'create-zavorth',
      version: '1.1.0',
      command: 'npm publish --access public --tag alpha',
      workingDirectory: 'packages/create-zavorth',
      attempted: createAttempted,
      success: createSuccess,
      publishTag: 'alpha',
      stdoutSummary: createSuccess ? 'published create-zavorth@1.1.0' : createAttempted ? 'create package publish failed after root success' : 'not attempted because root did not publish',
      stderrSummary: createSuccess ? '' : createAttempted ? 'publish failed; see pack report' : '',
      rawSecretSerialized: false,
    },
  ];
}

function postPublishVerification(scenario: ZavorthAlpha3Scenario): ZavorthAlpha3PostPublishVerification[] {
  const full = scenario === 'full-success';
  return [
    {
      nativeContract: 'ZavorthAlpha3PostPublishVerification/v1',
      packageName: 'zavorth',
      command: 'npm view zavorth versions dist-tags --json',
      required: true,
      performed: scenario !== 'prepublish-ready',
      success: full,
      versionsIncludeAlpha3: full,
      alphaTag: full ? '1.1.0' : '1.1.0-alpha.1',
      latestTagManuallyChanged: false,
    },
    {
      nativeContract: 'ZavorthAlpha3PostPublishVerification/v1',
      packageName: 'create-zavorth',
      command: 'npm view create-zavorth versions dist-tags --json',
      required: true,
      performed: full || scenario === 'root-success-create-failed',
      success: full,
      versionsIncludeAlpha3: full,
      alphaTag: full ? '1.1.0' : '1.1.0-alpha.1',
      latestTagManuallyChanged: false,
    },
  ];
}

function npxSmoke(scenario: ZavorthAlpha3Scenario): ZavorthAlpha3NpxSmoke[] {
  const full = scenario === 'full-success';
  return [
    {
      nativeContract: 'ZavorthAlpha3NpxSmoke/v1',
      command: 'npx --yes zavorth@latest --help',
      required: true,
      performed: full,
      success: full,
      outputOldIdentityLeak: false,
      runtimePersistentStartPerformed: false,
    },
    {
      nativeContract: 'ZavorthAlpha3NpxSmoke/v1',
      command: 'npx --yes create-zavorth@latest --help',
      required: true,
      performed: full,
      success: full,
      outputOldIdentityLeak: false,
      runtimePersistentStartPerformed: false,
    },
  ];
}

function installerDryRun(scenario: ZavorthAlpha3Scenario): ZavorthAlpha3InstallerDryRun[] {
  const performed = scenario !== 'prepublish-ready';
  return [
    {
      nativeContract: 'ZavorthAlpha3InstallerDryRun/v1',
      command: 'powershell -ExecutionPolicy Bypass -File scripts/install-zavorth.ps1 -DryRun',
      required: true,
      performed,
      success: performed,
      globalInstallPerformed: false,
      runtimePersistentStartPerformed: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthAlpha3InstallerDryRun/v1',
      command: 'bash scripts/install-zavorth.sh --dry-run',
      required: true,
      performed,
      success: performed,
      globalInstallPerformed: false,
      runtimePersistentStartPerformed: false,
      rawSecretSerialized: false,
    },
  ];
}

function publicOutputIdentityScan(scenario: ZavorthAlpha3Scenario): ZavorthAlpha3PublicOutputIdentityScan[] {
  const performed = scenario !== 'prepublish-ready';
  return ['npx-smoke-output', 'installer-dry-run-output', 'public-docs-package-surface'].map((scope) => ({
    nativeContract: 'ZavorthAlpha3PublicOutputIdentityScan/v1',
    scope: scope as ZavorthAlpha3PublicOutputIdentityScan['scope'],
    required: true,
    performed,
    publicOutputZavorthOnly: true,
    oldIdentityPublicLeak: false,
    rawSecretSerialized: false,
  }));
}

function blockedActions(): ZavorthAlpha3BlockedAction[] {
  return [
    'stable-release',
    'dist-tag-latest-manual-change',
    'global-install',
    'runtime-persistent-start',
    'domain-purchase',
    'github-org-create',
    'trademark-file',
    'provider-tool-command-execution',
    'raw-history-import',
    'adapter-global-removal',
  ].map((action) => ({
    nativeContract: 'ZavorthAlpha3BlockedAction/v1',
    action: action as ZavorthAlpha3BlockedAction['action'],
    performed: false,
  }));
}

function validationCommands(): string[] {
  return [
    'npx jest tests/runtime/external-agents/ZavorthAlpha3ProductInstallReleasePack.test.ts --runInBand --testTimeout=30000',
    'npm run runtime:check --silent',
    'npm run build --silent',
    'npm pack --dry-run --json',
    'cd packages/create-zavorth && npm pack --dry-run --json',
    'npm publish --access public --tag alpha',
    'cd packages/create-zavorth && npm publish --access public --tag alpha',
    'npm view zavorth versions dist-tags --json',
    'npm view create-zavorth versions dist-tags --json',
    'npx --yes zavorth@latest --help',
    'npx --yes create-zavorth@latest --help',
    'powershell -ExecutionPolicy Bypass -File scripts/install-zavorth.ps1 -DryRun',
    'bash scripts/install-zavorth.sh --dry-run',
    'public output scan',
    'redaction scan',
    'cleanup check',
  ];
}

export function normalizeZavorthAlpha3ProductInstallReleasePack(
  options: ZavorthAlpha3ProductInstallReleasePackOptions,
): ZavorthAlpha3ProductInstallReleasePackNormalization {
  const scenario = options.scenario || 'prepublish-ready';
  const rootSuccess = scenario === 'full-success' || scenario === 'root-success-create-failed';
  const createSuccess = scenario === 'full-success';
  const allPublished = scenario === 'full-success';
  return {
    nativeContract: 'ZavorthAlpha3ProductInstallReleasePack/v1',
    packId: '281',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: decisionForScenario(scenario),
    versionBefore: versionState(),
    versionAfter: versionState(),
    rootPackage: rootPackage(),
    createPackage: createPackage(),
    includedProductWork: includedProductWork(),
    publishResults: publishResults(scenario),
    postPublishVerification: postPublishVerification(scenario),
    npxSmoke: npxSmoke(scenario),
    installerDryRun: installerDryRun(scenario),
    distTagState: {
      nativeContract: 'ZavorthAlpha3DistTagState/v1',
      publishTag: 'alpha',
      stableRelease: false,
      latestTagManuallyChanged: false,
      rootAlphaAfter: allPublished ? '1.1.0' : '1.1.0-alpha.1',
      createAlphaAfter: allPublished ? '1.1.0' : '1.1.0-alpha.1',
    },
    publicOutputIdentityScan: publicOutputIdentityScan(scenario),
    publishOrder: ['zavorth', 'create-zavorth'],
    blockedActions: blockedActions(),
    validationCommands: validationCommands(),
    finalState: {
      decision: decisionForScenario(scenario),
      publishedVersion: '1.1.0',
      rootPublished: rootSuccess,
      createPackagePublished: createSuccess,
      createPackagePublishAttempted: rootSuccess,
      npxSmokePassed: allPublished,
      installerDryRunPassed: scenario !== 'prepublish-ready',
      publicOutputZavorthOnly: true,
      stableRelease: false,
      latestTagManuallyChanged: false,
      globalInstallPerformed: false,
      runtimePersistentStartPerformed: false,
      domainPurchased: false,
      githubOrgCreatedByThisPack: false,
      trademarkFiled: false,
      rawSecretSerialized: false,
      oldIdentityPublicLeak: false,
    },
  };
}

export class ZavorthAlpha3ProductInstallReleasePack {
  public constructor(public readonly normalization: ZavorthAlpha3ProductInstallReleasePackNormalization) {}

  public rootFailureBlocksCreatePublish(): boolean {
    const [root, createPackageResult] = this.normalization.publishResults;
    return root.attempted && !root.success && !createPackageResult.attempted;
  }

  public blockedActionPerformed(): boolean {
    return this.normalization.blockedActions.some((action) => action.performed);
  }
}

export function createZavorthAlpha3ProductInstallReleasePackFixture(
  scenario: ZavorthAlpha3Scenario = 'prepublish-ready',
): ZavorthAlpha3ProductInstallReleasePack {
  return new ZavorthAlpha3ProductInstallReleasePack(
    normalizeZavorthAlpha3ProductInstallReleasePack({
      generatedAt: ZAVORTH_ALPHA3_PRODUCT_INSTALL_RELEASE_PACK_NOW,
      runtimeId: ZAVORTH_ALPHA3_PRODUCT_INSTALL_RELEASE_PACK_RUNTIME_ID,
      scenario,
    }),
  );
}
