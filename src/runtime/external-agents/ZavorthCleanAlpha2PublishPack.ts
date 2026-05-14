export const ZAVORTH_CLEAN_ALPHA2_PUBLISH_PACK_NOW = '2026-05-02T01:20:00.000Z' as const;
export const ZAVORTH_CLEAN_ALPHA2_PUBLISH_PACK_RUNTIME_ID = 'zavorth-clean-alpha2-publish-pack' as const;

export type ZavorthCleanAlpha2Decision =
  | 'zavorth-alpha2-blocked-by-missing-276'
  | 'zavorth-alpha2-publish-ready'
  | 'zavorth-clean-alpha2-published'
  | 'zavorth-alpha2-root-publish-failed'
  | 'zavorth-alpha2-root-published-create-failed';

export type ZavorthCleanAlpha2Scenario =
  | 'missing-276'
  | 'prepublish-ready'
  | 'full-success'
  | 'root-failed'
  | 'root-success-create-failed';

export type ZavorthCleanAlpha2Pack276Requirement = {
  nativeContract: 'ZavorthCleanAlpha2Pack276Requirement/v1';
  required: true;
  docPath: 'docs/276-zavorth-hard-rename-and-legacy-identity-purge-pack.md';
  boundaryPath: 'src/runtime/external-agents/ZavorthHardRenameLegacyIdentityPurgePack.ts';
  testPath: 'tests/runtime/external-agents/ZavorthHardRenameLegacyIdentityPurgePack.test.ts';
  observedDecision: 'zavorth-hard-rename-purge-ready' | null;
  satisfied: boolean;
};

export type ZavorthCleanAlpha2VersionState = {
  nativeContract: 'ZavorthCleanAlpha2VersionState/v1';
  registryBefore: '1.1.0-alpha.1' | 'unknown';
  localBefore: '1.1.0-alpha.2';
  target: '1.1.0-alpha.2';
  publishTag: 'alpha';
  stableRelease: false;
  latestTagManuallyChanged: false;
};

export type ZavorthCleanAlpha2PackageReadiness = {
  nativeContract: 'ZavorthCleanAlpha2PackageReadiness/v1';
  packageName: 'zavorth' | 'create-zavorth';
  version: '1.1.0-alpha.2';
  workingDirectory: '.' | 'packages/create-zavorth';
  bin: string[];
  dryRunCommand: 'npm pack --dry-run --json';
  dryRunReady: boolean;
  packageSizeBytes: number;
  unpackedSizeBytes: number;
  fileCount: number;
  oldIdentityPackageLeak: false;
};

export type ZavorthCleanAlpha2PublishResult = {
  nativeContract: 'ZavorthCleanAlpha2PublishResult/v1';
  packageName: 'zavorth' | 'create-zavorth';
  version: '1.1.0-alpha.2';
  command: 'npm publish --access public --tag alpha';
  workingDirectory: '.' | 'packages/create-zavorth';
  attempted: boolean;
  success: boolean;
  publishTag: 'alpha';
  stdoutSummary: string;
  stderrSummary: string;
  rawSecretSerialized: false;
};

export type ZavorthCleanAlpha2PostPublishVerification = {
  nativeContract: 'ZavorthCleanAlpha2PostPublishVerification/v1';
  packageName: 'zavorth' | 'create-zavorth';
  command:
    | 'npm view zavorth versions dist-tags --json'
    | 'npm view create-zavorth versions dist-tags --json';
  performed: boolean;
  success: boolean;
  versionsIncludeAlpha2: boolean;
  alphaTag: '1.1.0-alpha.1' | '1.1.0-alpha.2' | null;
  latestTag: '1.1.0-alpha.0' | '1.1.0-alpha.1' | '1.1.0-alpha.2' | null;
  latestTagManuallyChanged: false;
};

export type ZavorthCleanAlpha2PublicSmoke = {
  nativeContract: 'ZavorthCleanAlpha2PublicSmoke/v1';
  command: 'npx --yes zavorth@latest --help' | 'npx --yes create-zavorth@latest --help';
  performed: boolean;
  success: boolean;
  outputOldIdentityLeak: false;
  runtimePersistentStartPerformed: false;
};

export type ZavorthCleanAlpha2LegacyIdentityScan = {
  nativeContract: 'ZavorthCleanAlpha2LegacyIdentityScan/v1';
  scope: 'package-output' | 'public-smoke-output' | 'public-docs-package-surface';
  performed: boolean;
  oldIdentityPublicLeak: false;
  rawSecretSerialized: false;
};

export type ZavorthCleanAlpha2DistTagState = {
  nativeContract: 'ZavorthCleanAlpha2DistTagState/v1';
  before: {
    zavorthAlpha: '1.1.0-alpha.1';
    zavorthLatest: '1.1.0-alpha.0';
    createZavorthAlpha: '1.1.0-alpha.1';
    createZavorthLatest: '1.1.0-alpha.0';
  };
  after: {
    zavorthAlpha: '1.1.0-alpha.1' | '1.1.0-alpha.2' | null;
    zavorthLatest: '1.1.0-alpha.0' | '1.1.0-alpha.2' | null;
    createZavorthAlpha: '1.1.0-alpha.1' | '1.1.0-alpha.2' | null;
    createZavorthLatest: '1.1.0-alpha.0' | '1.1.0-alpha.2' | null;
  };
  latestTagManuallyChanged: false;
};

export type ZavorthCleanAlpha2BlockedAction = {
  nativeContract: 'ZavorthCleanAlpha2BlockedAction/v1';
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

export type ZavorthCleanAlpha2FinalState = {
  decision: ZavorthCleanAlpha2Decision;
  publishedVersion: '1.1.0-alpha.2';
  rootPublished: boolean;
  createPackagePublished: boolean;
  publicSmokePassed: boolean;
  legacyIdentityPublicLeak: false;
  stableRelease: false;
  latestTagManuallyChanged: false;
  globalInstallPerformed: false;
  runtimePersistentStartPerformed: false;
  domainPurchased: false;
  githubOrgCreatedByThisPack: false;
  trademarkFiled: false;
  rawSecretSerialized: false;
};

export type ZavorthCleanAlpha2PublishPackNormalization = {
  nativeContract: 'ZavorthCleanAlpha2PublishPack/v1';
  packId: '277';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_CLEAN_ALPHA2_PUBLISH_PACK_RUNTIME_ID;
  decision: ZavorthCleanAlpha2Decision;
  requiresPack276: ZavorthCleanAlpha2Pack276Requirement;
  versionBefore: ZavorthCleanAlpha2VersionState;
  versionAfter: ZavorthCleanAlpha2VersionState;
  rootPackage: ZavorthCleanAlpha2PackageReadiness;
  createPackage: ZavorthCleanAlpha2PackageReadiness;
  publishResults: ZavorthCleanAlpha2PublishResult[];
  postPublishVerification: ZavorthCleanAlpha2PostPublishVerification[];
  publicSmoke: ZavorthCleanAlpha2PublicSmoke[];
  legacyIdentityScan: ZavorthCleanAlpha2LegacyIdentityScan[];
  distTagState: ZavorthCleanAlpha2DistTagState;
  publishOrder: ['zavorth', 'create-zavorth'];
  blockedActions: ZavorthCleanAlpha2BlockedAction[];
  validationCommands: string[];
  finalState: ZavorthCleanAlpha2FinalState;
};

export type ZavorthCleanAlpha2PublishPackOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_CLEAN_ALPHA2_PUBLISH_PACK_RUNTIME_ID;
  scenario: ZavorthCleanAlpha2Scenario;
};

function decisionForScenario(scenario: ZavorthCleanAlpha2Scenario): ZavorthCleanAlpha2Decision {
  if (scenario === 'missing-276') {
    return 'zavorth-alpha2-blocked-by-missing-276';
  }
  if (scenario === 'full-success') {
    return 'zavorth-clean-alpha2-published';
  }
  if (scenario === 'root-failed') {
    return 'zavorth-alpha2-root-publish-failed';
  }
  if (scenario === 'root-success-create-failed') {
    return 'zavorth-alpha2-root-published-create-failed';
  }
  return 'zavorth-alpha2-publish-ready';
}

function requiresPack276(scenario: ZavorthCleanAlpha2Scenario): ZavorthCleanAlpha2Pack276Requirement {
  const satisfied = scenario !== 'missing-276';
  return {
    nativeContract: 'ZavorthCleanAlpha2Pack276Requirement/v1',
    required: true,
    docPath: 'docs/276-zavorth-hard-rename-and-legacy-identity-purge-pack.md',
    boundaryPath: 'src/runtime/external-agents/ZavorthHardRenameLegacyIdentityPurgePack.ts',
    testPath: 'tests/runtime/external-agents/ZavorthHardRenameLegacyIdentityPurgePack.test.ts',
    observedDecision: satisfied ? 'zavorth-hard-rename-purge-ready' : null,
    satisfied,
  };
}

function versionState(): ZavorthCleanAlpha2VersionState {
  return {
    nativeContract: 'ZavorthCleanAlpha2VersionState/v1',
    registryBefore: '1.1.0-alpha.1',
    localBefore: '1.1.0-alpha.2',
    target: '1.1.0-alpha.2',
    publishTag: 'alpha',
    stableRelease: false,
    latestTagManuallyChanged: false,
  };
}

function rootPackageReadiness(): ZavorthCleanAlpha2PackageReadiness {
  return {
    nativeContract: 'ZavorthCleanAlpha2PackageReadiness/v1',
    packageName: 'zavorth',
    version: '1.1.0-alpha.2',
    workingDirectory: '.',
    bin: ['zavorth'],
    dryRunCommand: 'npm pack --dry-run --json',
    dryRunReady: true,
    packageSizeBytes: 3304278,
    unpackedSizeBytes: 19955732,
    fileCount: 3649,
    oldIdentityPackageLeak: false,
  };
}

function createPackageReadiness(): ZavorthCleanAlpha2PackageReadiness {
  return {
    nativeContract: 'ZavorthCleanAlpha2PackageReadiness/v1',
    packageName: 'create-zavorth',
    version: '1.1.0-alpha.2',
    workingDirectory: 'packages/create-zavorth',
    bin: ['create-zavorth'],
    dryRunCommand: 'npm pack --dry-run --json',
    dryRunReady: true,
    packageSizeBytes: 1526,
    unpackedSizeBytes: 3567,
    fileCount: 3,
    oldIdentityPackageLeak: false,
  };
}

function publishResults(scenario: ZavorthCleanAlpha2Scenario): ZavorthCleanAlpha2PublishResult[] {
  const rootAttempted = scenario !== 'prepublish-ready' && scenario !== 'missing-276';
  const rootSuccess = scenario === 'full-success' || scenario === 'root-success-create-failed';
  const createAttempted = rootSuccess;
  const createSuccess = scenario === 'full-success';

  return [
    {
      nativeContract: 'ZavorthCleanAlpha2PublishResult/v1',
      packageName: 'zavorth',
      version: '1.1.0-alpha.2',
      command: 'npm publish --access public --tag alpha',
      workingDirectory: '.',
      attempted: rootAttempted,
      success: rootSuccess,
      publishTag: 'alpha',
      stdoutSummary: rootSuccess
        ? '+ zavorth@1.1.0-alpha.2 published with tag alpha'
        : rootAttempted
          ? 'root package publish attempted and failed before create package publish'
          : 'prepared; awaiting root publish execution',
      stderrSummary: rootAttempted && !rootSuccess ? 'root publish failed; stderr redacted' : '',
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthCleanAlpha2PublishResult/v1',
      packageName: 'create-zavorth',
      version: '1.1.0-alpha.2',
      command: 'npm publish --access public --tag alpha',
      workingDirectory: 'packages/create-zavorth',
      attempted: createAttempted,
      success: createSuccess,
      publishTag: 'alpha',
      stdoutSummary: createSuccess
        ? '+ create-zavorth@1.1.0-alpha.2 published with tag alpha'
        : createAttempted
          ? 'create package publish failed after root package publish'
          : 'not attempted until root package publish succeeds',
      stderrSummary: '',
      rawSecretSerialized: false,
    },
  ];
}

function postPublishVerification(
  scenario: ZavorthCleanAlpha2Scenario,
): ZavorthCleanAlpha2PostPublishVerification[] {
  const rootSuccess = scenario === 'full-success' || scenario === 'root-success-create-failed';
  const createSuccess = scenario === 'full-success';
  const rootFailed = scenario === 'root-failed';

  return [
    {
      nativeContract: 'ZavorthCleanAlpha2PostPublishVerification/v1',
      packageName: 'zavorth',
      command: 'npm view zavorth versions dist-tags --json',
      performed: rootSuccess || rootFailed,
      success: rootSuccess,
      versionsIncludeAlpha2: rootSuccess,
      alphaTag: rootSuccess ? '1.1.0-alpha.2' : rootFailed ? '1.1.0-alpha.1' : null,
      latestTag: rootSuccess || rootFailed ? '1.1.0-alpha.0' : null,
      latestTagManuallyChanged: false,
    },
    {
      nativeContract: 'ZavorthCleanAlpha2PostPublishVerification/v1',
      packageName: 'create-zavorth',
      command: 'npm view create-zavorth versions dist-tags --json',
      performed: createSuccess || rootFailed,
      success: createSuccess,
      versionsIncludeAlpha2: createSuccess,
      alphaTag: createSuccess ? '1.1.0-alpha.2' : rootFailed ? '1.1.0-alpha.1' : null,
      latestTag: createSuccess || rootFailed ? '1.1.0-alpha.0' : null,
      latestTagManuallyChanged: false,
    },
  ];
}

function publicSmoke(scenario: ZavorthCleanAlpha2Scenario): ZavorthCleanAlpha2PublicSmoke[] {
  const success = scenario === 'full-success';
  return [
    {
      nativeContract: 'ZavorthCleanAlpha2PublicSmoke/v1',
      command: 'npx --yes zavorth@latest --help',
      performed: success,
      success,
      outputOldIdentityLeak: false,
      runtimePersistentStartPerformed: false,
    },
    {
      nativeContract: 'ZavorthCleanAlpha2PublicSmoke/v1',
      command: 'npx --yes create-zavorth@latest --help',
      performed: success,
      success,
      outputOldIdentityLeak: false,
      runtimePersistentStartPerformed: false,
    },
  ];
}

function legacyIdentityScan(scenario: ZavorthCleanAlpha2Scenario): ZavorthCleanAlpha2LegacyIdentityScan[] {
  const performed = scenario !== 'missing-276';
  return ['package-output', 'public-smoke-output', 'public-docs-package-surface'].map((scope) => ({
    nativeContract: 'ZavorthCleanAlpha2LegacyIdentityScan/v1',
    scope: scope as ZavorthCleanAlpha2LegacyIdentityScan['scope'],
    performed,
    oldIdentityPublicLeak: false,
    rawSecretSerialized: false,
  }));
}

function distTagState(scenario: ZavorthCleanAlpha2Scenario): ZavorthCleanAlpha2DistTagState {
  const rootSuccess = scenario === 'full-success' || scenario === 'root-success-create-failed';
  const createSuccess = scenario === 'full-success';
  const rootFailure = scenario === 'root-failed';
  return {
    nativeContract: 'ZavorthCleanAlpha2DistTagState/v1',
    before: {
      zavorthAlpha: '1.1.0-alpha.1',
      zavorthLatest: '1.1.0-alpha.0',
      createZavorthAlpha: '1.1.0-alpha.1',
      createZavorthLatest: '1.1.0-alpha.0',
    },
    after: {
      zavorthAlpha: rootSuccess ? '1.1.0-alpha.2' : rootFailure ? '1.1.0-alpha.1' : null,
      zavorthLatest: rootSuccess || rootFailure ? '1.1.0-alpha.0' : null,
      createZavorthAlpha: createSuccess ? '1.1.0-alpha.2' : rootFailure ? '1.1.0-alpha.1' : null,
      createZavorthLatest: createSuccess || rootFailure ? '1.1.0-alpha.0' : null,
    },
    latestTagManuallyChanged: false,
  };
}

function blockedActions(): ZavorthCleanAlpha2BlockedAction[] {
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
    nativeContract: 'ZavorthCleanAlpha2BlockedAction/v1',
    action: action as ZavorthCleanAlpha2BlockedAction['action'],
    performed: false,
  }));
}

function validationCommands(): string[] {
  return [
    'npx jest tests/runtime/external-agents/ZavorthCleanAlpha2PublishPack.test.ts --runInBand --testTimeout=30000',
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
    'legacy identity public output scan',
    'redaction scan',
    'cleanup check',
  ];
}

export function normalizeZavorthCleanAlpha2PublishPack(
  options: ZavorthCleanAlpha2PublishPackOptions,
): ZavorthCleanAlpha2PublishPackNormalization {
  const decision = decisionForScenario(options.scenario);
  const results = publishResults(options.scenario);
  const rootPublished = results[0].success;
  const createPackagePublished = results[1].success;
  const smoke = publicSmoke(options.scenario);
  const publicSmokePassed = smoke.every((item) => item.performed && item.success);

  return {
    nativeContract: 'ZavorthCleanAlpha2PublishPack/v1',
    packId: '277',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision,
    requiresPack276: requiresPack276(options.scenario),
    versionBefore: versionState(),
    versionAfter: versionState(),
    rootPackage: rootPackageReadiness(),
    createPackage: createPackageReadiness(),
    publishResults: results,
    postPublishVerification: postPublishVerification(options.scenario),
    publicSmoke: smoke,
    legacyIdentityScan: legacyIdentityScan(options.scenario),
    distTagState: distTagState(options.scenario),
    publishOrder: ['zavorth', 'create-zavorth'],
    blockedActions: blockedActions(),
    validationCommands: validationCommands(),
    finalState: {
      decision,
      publishedVersion: '1.1.0-alpha.2',
      rootPublished,
      createPackagePublished,
      publicSmokePassed,
      legacyIdentityPublicLeak: false,
      stableRelease: false,
      latestTagManuallyChanged: false,
      globalInstallPerformed: false,
      runtimePersistentStartPerformed: false,
      domainPurchased: false,
      githubOrgCreatedByThisPack: false,
      trademarkFiled: false,
      rawSecretSerialized: false,
    },
  };
}

export class ZavorthCleanAlpha2PublishPack {
  public constructor(public readonly normalization: ZavorthCleanAlpha2PublishPackNormalization) {}

  public rootFailureBlocksCreatePublish(): boolean {
    if (this.normalization.decision !== 'zavorth-alpha2-root-publish-failed') {
      return true;
    }
    const createResult = this.normalization.publishResults.find((result) => result.packageName === 'create-zavorth');
    return createResult?.attempted === false;
  }

  public latestWasNotManuallyChanged(): boolean {
    return (
      !this.normalization.finalState.latestTagManuallyChanged &&
      this.normalization.blockedActions.some((action) => action.action === 'dist-tag-latest-manual-change')
    );
  }

  public blockedActionPerformed(): boolean {
    return this.normalization.blockedActions.some((action) => action.performed);
  }
}

export function createZavorthCleanAlpha2PublishPackFixture(): ZavorthCleanAlpha2PublishPack {
  return new ZavorthCleanAlpha2PublishPack(
    normalizeZavorthCleanAlpha2PublishPack({
      generatedAt: ZAVORTH_CLEAN_ALPHA2_PUBLISH_PACK_NOW,
      runtimeId: ZAVORTH_CLEAN_ALPHA2_PUBLISH_PACK_RUNTIME_ID,
      scenario: 'root-failed',
    }),
  );
}

export function createZavorthCleanAlpha2PublishFixture(): ZavorthCleanAlpha2PublishPack {
  return createZavorthCleanAlpha2PublishPackFixture();
}

export function createZavorthCleanAlpha2PublishReadyFixture(): ZavorthCleanAlpha2PublishPack {
  return new ZavorthCleanAlpha2PublishPack(
    normalizeZavorthCleanAlpha2PublishPack({
      generatedAt: ZAVORTH_CLEAN_ALPHA2_PUBLISH_PACK_NOW,
      runtimeId: ZAVORTH_CLEAN_ALPHA2_PUBLISH_PACK_RUNTIME_ID,
      scenario: 'prepublish-ready',
    }),
  );
}

export function createZavorthCleanAlpha2PublishSuccessFixture(): ZavorthCleanAlpha2PublishPack {
  return new ZavorthCleanAlpha2PublishPack(
    normalizeZavorthCleanAlpha2PublishPack({
      generatedAt: ZAVORTH_CLEAN_ALPHA2_PUBLISH_PACK_NOW,
      runtimeId: ZAVORTH_CLEAN_ALPHA2_PUBLISH_PACK_RUNTIME_ID,
      scenario: 'full-success',
    }),
  );
}

export function createZavorthCleanAlpha2PublishMissing276Fixture(): ZavorthCleanAlpha2PublishPack {
  return new ZavorthCleanAlpha2PublishPack(
    normalizeZavorthCleanAlpha2PublishPack({
      generatedAt: ZAVORTH_CLEAN_ALPHA2_PUBLISH_PACK_NOW,
      runtimeId: ZAVORTH_CLEAN_ALPHA2_PUBLISH_PACK_RUNTIME_ID,
      scenario: 'missing-276',
    }),
  );
}

export function createZavorthCleanAlpha2PublishRootFailureFixture(): ZavorthCleanAlpha2PublishPack {
  return new ZavorthCleanAlpha2PublishPack(
    normalizeZavorthCleanAlpha2PublishPack({
      generatedAt: ZAVORTH_CLEAN_ALPHA2_PUBLISH_PACK_NOW,
      runtimeId: ZAVORTH_CLEAN_ALPHA2_PUBLISH_PACK_RUNTIME_ID,
      scenario: 'root-failed',
    }),
  );
}

export function createZavorthCleanAlpha2PublishPartialFailureFixture(): ZavorthCleanAlpha2PublishPack {
  return new ZavorthCleanAlpha2PublishPack(
    normalizeZavorthCleanAlpha2PublishPack({
      generatedAt: ZAVORTH_CLEAN_ALPHA2_PUBLISH_PACK_NOW,
      runtimeId: ZAVORTH_CLEAN_ALPHA2_PUBLISH_PACK_RUNTIME_ID,
      scenario: 'root-success-create-failed',
    }),
  );
}
