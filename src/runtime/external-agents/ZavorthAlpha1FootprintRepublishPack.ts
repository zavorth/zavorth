export const ZAVORTH_ALPHA1_FOOTPRINT_REPUBLISH_PACK_NOW = '2026-05-02T00:10:00.000Z' as const;
export const ZAVORTH_ALPHA1_FOOTPRINT_REPUBLISH_PACK_RUNTIME_ID =
  'zavorth-alpha1-footprint-republish-pack' as const;

export type ZavorthAlpha1RepublishDecision =
  | 'zavorth-alpha1-publish-ready'
  | 'zavorth-alpha1-published'
  | 'zavorth-alpha1-root-publish-failed'
  | 'zavorth-alpha1-root-published-create-failed';

export type ZavorthAlpha1RepublishScenario =
  | 'prepublish-ready'
  | 'full-success'
  | 'root-failed'
  | 'root-success-create-failed';

export type ZavorthAlpha1Version = {
  nativeContract: 'ZavorthAlpha1Version/v1';
  rootPackage: '1.1.0-alpha.0' | '1.1.0-alpha.1';
  createPackage: '1.1.0-alpha.0' | '1.1.0-alpha.1';
};

export type ZavorthAlpha1PublicAlphaPolicy = {
  nativeContract: 'ZavorthAlpha1PublicAlphaPolicy/v1';
  productStage: 'public-alpha';
  publishTag: 'alpha';
  stableRelease: false;
  latestTagManuallyChanged: false;
  latestTagMayRemainAlpha: true;
  latestTagManualChangeBlocked: true;
};

export type ZavorthAlpha1PackageReadiness = {
  nativeContract: 'ZavorthAlpha1PackageReadiness/v1';
  packageName: 'zavorth' | 'create-zavorth';
  version: '1.1.0-alpha.1';
  workingDirectory: '.' | 'packages/create-zavorth';
  bin: string[];
  packageSizeBytes: number;
  unpackedSizeBytes: number;
  fileCount: number;
  sourcemapCount?: number;
  dryRunCommand: 'npm pack --dry-run --json';
  dryRunReady: true;
};

export type ZavorthAlpha1FootprintFrom274 = {
  nativeContract: 'ZavorthAlpha1FootprintFrom274/v1';
  baselinePackageSizeBytes: 8506586;
  baselineUnpackedSizeBytes: 60047405;
  baselineFileCount: 13898;
  optimizedPackageSizeBytes: 5086394;
  optimizedUnpackedSizeBytes: 35026354;
  optimizedFileCount: 6995;
  sourcemapsRemoved: 6905;
};

export type ZavorthAlpha1PublishResult = {
  nativeContract: 'ZavorthAlpha1PublishResult/v1';
  packageName: 'zavorth' | 'create-zavorth';
  version: '1.1.0-alpha.1';
  command: 'npm publish --access public --tag alpha';
  workingDirectory: '.' | 'packages/create-zavorth';
  attempted: boolean;
  success: boolean;
  publishTag: 'alpha';
  stdoutSummary: string;
  stderrSummary: string;
  rawSecretSerialized: false;
};

export type ZavorthAlpha1PostPublishVerification = {
  nativeContract: 'ZavorthAlpha1PostPublishVerification/v1';
  packageName: 'zavorth' | 'create-zavorth';
  command:
    | 'npm view zavorth name version dist-tags --json'
    | 'npm view create-zavorth name version dist-tags --json';
  performed: boolean;
  success: boolean;
  observedVersion: '1.1.0-alpha.0' | '1.1.0-alpha.1' | null;
  observedAlphaTag: '1.1.0-alpha.0' | '1.1.0-alpha.1' | null;
  observedLatestTag: '1.1.0-alpha.0' | '1.1.0-alpha.1' | null;
  latestTagManuallyChanged: false;
};

export type ZavorthAlpha1NpxSmoke = {
  nativeContract: 'ZavorthAlpha1NpxSmoke/v1';
  command: 'npx --yes zavorth@latest --help' | 'npx --yes create-zavorth@latest --help';
  performed: boolean;
  success: boolean;
  runtimePersistentStartPerformed: false;
};

export type ZavorthAlpha1DistTagState = {
  nativeContract: 'ZavorthAlpha1DistTagState/v1';
  before: {
    zavorthAlpha: '1.1.0-alpha.0';
    zavorthLatest: '1.1.0-alpha.0';
    createZavorthAlpha: '1.1.0-alpha.0';
    createZavorthLatest: '1.1.0-alpha.0';
  };
  after: {
    zavorthAlpha: '1.1.0-alpha.1' | null;
    zavorthLatest: '1.1.0-alpha.0' | '1.1.0-alpha.1' | null;
    createZavorthAlpha: '1.1.0-alpha.1' | null;
    createZavorthLatest: '1.1.0-alpha.0' | '1.1.0-alpha.1' | null;
  };
  latestTagManuallyChanged: false;
};

export type ZavorthAlpha1BlockedAction = {
  nativeContract: 'ZavorthAlpha1BlockedAction/v1';
  action:
    | 'dist-tag-latest-manual-change'
    | 'domain-purchase'
    | 'global-install'
    | 'github-org-create'
    | 'provider-tool-command-execution'
    | 'raw-history-import'
    | 'runtime-persistent-start'
    | 'stable-release'
    | 'trademark-file';
  performed: false;
};

export type ZavorthAlpha1FinalState = {
  decision: ZavorthAlpha1RepublishDecision;
  rootPublished: boolean;
  createPackagePublished: boolean;
  publishedVersion: '1.1.0-alpha.1';
  publishTag: 'alpha';
  stableRelease: false;
  latestTagManuallyChanged: false;
  globalInstallPerformed: false;
  runtimePersistentStartPerformed: false;
  domainPurchased: false;
  githubOrgCreatedByThisPack: false;
  trademarkFiled: false;
  rawSecretSerialized: false;
  externalExecutorPublicIdentityReintroduced: false;
};

export type ZavorthAlpha1FootprintRepublishPackNormalization = {
  nativeContract: 'ZavorthAlpha1FootprintRepublishPack/v1';
  packId: '275';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_ALPHA1_FOOTPRINT_REPUBLISH_PACK_RUNTIME_ID;
  decision: ZavorthAlpha1RepublishDecision;
  versionBefore: ZavorthAlpha1Version;
  versionAfter: ZavorthAlpha1Version;
  publicAlphaPolicy: ZavorthAlpha1PublicAlphaPolicy;
  rootPackage: ZavorthAlpha1PackageReadiness;
  createPackage: ZavorthAlpha1PackageReadiness;
  footprintBaselineFrom274: ZavorthAlpha1FootprintFrom274;
  footprintAfterVersionBump: ZavorthAlpha1PackageReadiness;
  publishResults: ZavorthAlpha1PublishResult[];
  postPublishVerification: ZavorthAlpha1PostPublishVerification[];
  npxSmoke: ZavorthAlpha1NpxSmoke[];
  distTagState: ZavorthAlpha1DistTagState;
  publishOrder: ['zavorth', 'create-zavorth'];
  blockedActions: ZavorthAlpha1BlockedAction[];
  validationCommands: string[];
  finalState: ZavorthAlpha1FinalState;
};

export type ZavorthAlpha1FootprintRepublishPackOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_ALPHA1_FOOTPRINT_REPUBLISH_PACK_RUNTIME_ID;
  scenario: ZavorthAlpha1RepublishScenario;
};

function decisionForScenario(scenario: ZavorthAlpha1RepublishScenario): ZavorthAlpha1RepublishDecision {
  if (scenario === 'full-success') {
    return 'zavorth-alpha1-published';
  }
  if (scenario === 'root-failed') {
    return 'zavorth-alpha1-root-publish-failed';
  }
  if (scenario === 'root-success-create-failed') {
    return 'zavorth-alpha1-root-published-create-failed';
  }
  return 'zavorth-alpha1-publish-ready';
}

function rootReadiness(): ZavorthAlpha1PackageReadiness {
  return {
    nativeContract: 'ZavorthAlpha1PackageReadiness/v1',
    packageName: 'zavorth',
    version: '1.1.0-alpha.1',
    workingDirectory: '.',
    bin: ['zavorth', 'zavorth'],
    packageSizeBytes: 5089434,
    unpackedSizeBytes: 35051375,
    fileCount: 6997,
    sourcemapCount: 0,
    dryRunCommand: 'npm pack --dry-run --json',
    dryRunReady: true,
  };
}

function createReadiness(): ZavorthAlpha1PackageReadiness {
  return {
    nativeContract: 'ZavorthAlpha1PackageReadiness/v1',
    packageName: 'create-zavorth',
    version: '1.1.0-alpha.1',
    workingDirectory: 'packages/create-zavorth',
    bin: ['create-zavorth', 'create-zavorth'],
    packageSizeBytes: 1622,
    unpackedSizeBytes: 3813,
    fileCount: 4,
    dryRunCommand: 'npm pack --dry-run --json',
    dryRunReady: true,
  };
}

function footprintFrom274(): ZavorthAlpha1FootprintFrom274 {
  return {
    nativeContract: 'ZavorthAlpha1FootprintFrom274/v1',
    baselinePackageSizeBytes: 8506586,
    baselineUnpackedSizeBytes: 60047405,
    baselineFileCount: 13898,
    optimizedPackageSizeBytes: 5086394,
    optimizedUnpackedSizeBytes: 35026354,
    optimizedFileCount: 6995,
    sourcemapsRemoved: 6905,
  };
}

function publicAlphaPolicy(): ZavorthAlpha1PublicAlphaPolicy {
  return {
    nativeContract: 'ZavorthAlpha1PublicAlphaPolicy/v1',
    productStage: 'public-alpha',
    publishTag: 'alpha',
    stableRelease: false,
    latestTagManuallyChanged: false,
    latestTagMayRemainAlpha: true,
    latestTagManualChangeBlocked: true,
  };
}

function publishResults(scenario: ZavorthAlpha1RepublishScenario): ZavorthAlpha1PublishResult[] {
  const rootAttempted = scenario !== 'prepublish-ready';
  const rootSuccess = scenario === 'full-success' || scenario === 'root-success-create-failed';
  const createAttempted = rootSuccess;
  const createSuccess = scenario === 'full-success';

  return [
    {
      nativeContract: 'ZavorthAlpha1PublishResult/v1',
      packageName: 'zavorth',
      version: '1.1.0-alpha.1',
      command: 'npm publish --access public --tag alpha',
      workingDirectory: '.',
      attempted: rootAttempted,
      success: rootSuccess,
      publishTag: 'alpha',
      stdoutSummary: rootSuccess
        ? '+ zavorth@1.1.0-alpha.1 published with tag alpha'
        : rootAttempted
          ? 'root package publish attempted and failed before create package publish'
          : 'prepared; awaiting publish execution',
      stderrSummary:
        scenario === 'root-failed'
          ? 'EOTP one-time password required; npm browser auth URL was redacted'
          : '',
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthAlpha1PublishResult/v1',
      packageName: 'create-zavorth',
      version: '1.1.0-alpha.1',
      command: 'npm publish --access public --tag alpha',
      workingDirectory: 'packages/create-zavorth',
      attempted: createAttempted,
      success: createSuccess,
      publishTag: 'alpha',
      stdoutSummary: createSuccess
        ? '+ create-zavorth@1.1.0-alpha.1 published with tag alpha'
        : createAttempted
          ? 'create package publish failed after root package publish'
          : 'not attempted until root package publish succeeds',
      stderrSummary: '',
      rawSecretSerialized: false,
    },
  ];
}

function postPublishVerification(
  scenario: ZavorthAlpha1RepublishScenario,
): ZavorthAlpha1PostPublishVerification[] {
  const rootSuccess = scenario === 'full-success' || scenario === 'root-success-create-failed';
  const createSuccess = scenario === 'full-success';
  const rootFailed = scenario === 'root-failed';

  return [
    {
      nativeContract: 'ZavorthAlpha1PostPublishVerification/v1',
      packageName: 'zavorth',
      command: 'npm view zavorth name version dist-tags --json',
      performed: rootSuccess || rootFailed,
      success: rootSuccess,
      observedVersion: rootSuccess ? '1.1.0-alpha.1' : rootFailed ? '1.1.0-alpha.0' : null,
      observedAlphaTag: rootSuccess ? '1.1.0-alpha.1' : rootFailed ? '1.1.0-alpha.0' : null,
      observedLatestTag: rootSuccess || rootFailed ? '1.1.0-alpha.0' : null,
      latestTagManuallyChanged: false,
    },
    {
      nativeContract: 'ZavorthAlpha1PostPublishVerification/v1',
      packageName: 'create-zavorth',
      command: 'npm view create-zavorth name version dist-tags --json',
      performed: createSuccess || rootFailed,
      success: createSuccess,
      observedVersion: createSuccess ? '1.1.0-alpha.1' : rootFailed ? '1.1.0-alpha.0' : null,
      observedAlphaTag: createSuccess ? '1.1.0-alpha.1' : rootFailed ? '1.1.0-alpha.0' : null,
      observedLatestTag: createSuccess || rootFailed ? '1.1.0-alpha.0' : null,
      latestTagManuallyChanged: false,
    },
  ];
}

function npxSmoke(scenario: ZavorthAlpha1RepublishScenario): ZavorthAlpha1NpxSmoke[] {
  const fullSuccess = scenario === 'full-success';
  return [
    {
      nativeContract: 'ZavorthAlpha1NpxSmoke/v1',
      command: 'npx --yes zavorth@latest --help',
      performed: fullSuccess,
      success: fullSuccess,
      runtimePersistentStartPerformed: false,
    },
    {
      nativeContract: 'ZavorthAlpha1NpxSmoke/v1',
      command: 'npx --yes create-zavorth@latest --help',
      performed: fullSuccess,
      success: fullSuccess,
      runtimePersistentStartPerformed: false,
    },
  ];
}

function distTagState(scenario: ZavorthAlpha1RepublishScenario): ZavorthAlpha1DistTagState {
  const rootSuccess = scenario === 'full-success' || scenario === 'root-success-create-failed';
  const createSuccess = scenario === 'full-success';

  return {
    nativeContract: 'ZavorthAlpha1DistTagState/v1',
    before: {
      zavorthAlpha: '1.1.0-alpha.0',
      zavorthLatest: '1.1.0-alpha.0',
      createZavorthAlpha: '1.1.0-alpha.0',
      createZavorthLatest: '1.1.0-alpha.0',
    },
    after: {
      zavorthAlpha: rootSuccess ? '1.1.0-alpha.1' : null,
      zavorthLatest: rootSuccess ? '1.1.0-alpha.0' : null,
      createZavorthAlpha: createSuccess ? '1.1.0-alpha.1' : null,
      createZavorthLatest: createSuccess ? '1.1.0-alpha.0' : null,
    },
    latestTagManuallyChanged: false,
  };
}

function blockedActions(): ZavorthAlpha1BlockedAction[] {
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
  ].map((action) => ({
    nativeContract: 'ZavorthAlpha1BlockedAction/v1',
    action: action as ZavorthAlpha1BlockedAction['action'],
    performed: false,
  }));
}

function validationCommands(): string[] {
  return [
    'npx jest tests/runtime/external-agents/ZavorthAlpha1FootprintRepublishPack.test.ts --runInBand --testTimeout=30000',
    'npm run runtime:check --silent',
    'npm run build --silent',
    'npm pack --dry-run --json',
    'cd packages/create-zavorth && npm pack --dry-run --json',
    'npm publish --access public --tag alpha',
    'cd packages/create-zavorth && npm publish --access public --tag alpha',
    'npm view zavorth name version dist-tags --json',
    'npm view create-zavorth name version dist-tags --json',
    'npx --yes zavorth@latest --help',
    'npx --yes create-zavorth@latest --help',
    'redaction scan',
    'cleanup check',
  ];
}

export function normalizeZavorthAlpha1FootprintRepublishPack(
  options: ZavorthAlpha1FootprintRepublishPackOptions,
): ZavorthAlpha1FootprintRepublishPackNormalization {
  const decision = decisionForScenario(options.scenario);
  const results = publishResults(options.scenario);
  const rootPublished = results[0].success;
  const createPackagePublished = results[1].success;

  return {
    nativeContract: 'ZavorthAlpha1FootprintRepublishPack/v1',
    packId: '275',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision,
    versionBefore: {
      nativeContract: 'ZavorthAlpha1Version/v1',
      rootPackage: '1.1.0-alpha.0',
      createPackage: '1.1.0-alpha.0',
    },
    versionAfter: {
      nativeContract: 'ZavorthAlpha1Version/v1',
      rootPackage: '1.1.0-alpha.1',
      createPackage: '1.1.0-alpha.1',
    },
    publicAlphaPolicy: publicAlphaPolicy(),
    rootPackage: rootReadiness(),
    createPackage: createReadiness(),
    footprintBaselineFrom274: footprintFrom274(),
    footprintAfterVersionBump: rootReadiness(),
    publishResults: results,
    postPublishVerification: postPublishVerification(options.scenario),
    npxSmoke: npxSmoke(options.scenario),
    distTagState: distTagState(options.scenario),
    publishOrder: ['zavorth', 'create-zavorth'],
    blockedActions: blockedActions(),
    validationCommands: validationCommands(),
    finalState: {
      decision,
      rootPublished,
      createPackagePublished,
      publishedVersion: '1.1.0-alpha.1',
      publishTag: 'alpha',
      stableRelease: false,
      latestTagManuallyChanged: false,
      globalInstallPerformed: false,
      runtimePersistentStartPerformed: false,
      domainPurchased: false,
      githubOrgCreatedByThisPack: false,
      trademarkFiled: false,
      rawSecretSerialized: false,
      externalExecutorPublicIdentityReintroduced: false,
    },
  };
}

export class ZavorthAlpha1FootprintRepublishPack {
  public constructor(public readonly normalization: ZavorthAlpha1FootprintRepublishPackNormalization) {}

  public rootFailureBlocksCreatePublish(): boolean {
    if (this.normalization.decision !== 'zavorth-alpha1-root-publish-failed') {
      return true;
    }
    const createResult = this.normalization.publishResults.find((result) => result.packageName === 'create-zavorth');
    return createResult?.attempted === false;
  }

  public blockedActionPerformed(): boolean {
    return this.normalization.blockedActions.some((action) => action.performed);
  }

  public preservesAlphaPolicy(): boolean {
    return (
      this.normalization.publicAlphaPolicy.publishTag === 'alpha' &&
      !this.normalization.publicAlphaPolicy.stableRelease &&
      !this.normalization.publicAlphaPolicy.latestTagManuallyChanged
    );
  }
}

export function createZavorthAlpha1FootprintRepublishPackFixture(): ZavorthAlpha1FootprintRepublishPack {
  return new ZavorthAlpha1FootprintRepublishPack(
    normalizeZavorthAlpha1FootprintRepublishPack({
      generatedAt: ZAVORTH_ALPHA1_FOOTPRINT_REPUBLISH_PACK_NOW,
      runtimeId: ZAVORTH_ALPHA1_FOOTPRINT_REPUBLISH_PACK_RUNTIME_ID,
      scenario: 'root-failed',
    }),
  );
}

export function createZavorthAlpha1FootprintRepublishSuccessFixture(): ZavorthAlpha1FootprintRepublishPack {
  return new ZavorthAlpha1FootprintRepublishPack(
    normalizeZavorthAlpha1FootprintRepublishPack({
      generatedAt: ZAVORTH_ALPHA1_FOOTPRINT_REPUBLISH_PACK_NOW,
      runtimeId: ZAVORTH_ALPHA1_FOOTPRINT_REPUBLISH_PACK_RUNTIME_ID,
      scenario: 'full-success',
    }),
  );
}

export function createZavorthAlpha1FootprintRepublishReadyFixture(): ZavorthAlpha1FootprintRepublishPack {
  return new ZavorthAlpha1FootprintRepublishPack(
    normalizeZavorthAlpha1FootprintRepublishPack({
      generatedAt: ZAVORTH_ALPHA1_FOOTPRINT_REPUBLISH_PACK_NOW,
      runtimeId: ZAVORTH_ALPHA1_FOOTPRINT_REPUBLISH_PACK_RUNTIME_ID,
      scenario: 'prepublish-ready',
    }),
  );
}

export function createZavorthAlpha1FootprintRepublishRootFailureFixture(): ZavorthAlpha1FootprintRepublishPack {
  return new ZavorthAlpha1FootprintRepublishPack(
    normalizeZavorthAlpha1FootprintRepublishPack({
      generatedAt: ZAVORTH_ALPHA1_FOOTPRINT_REPUBLISH_PACK_NOW,
      runtimeId: ZAVORTH_ALPHA1_FOOTPRINT_REPUBLISH_PACK_RUNTIME_ID,
      scenario: 'root-failed',
    }),
  );
}

export function createZavorthAlpha1FootprintRepublishPartialFailureFixture(): ZavorthAlpha1FootprintRepublishPack {
  return new ZavorthAlpha1FootprintRepublishPack(
    normalizeZavorthAlpha1FootprintRepublishPack({
      generatedAt: ZAVORTH_ALPHA1_FOOTPRINT_REPUBLISH_PACK_NOW,
      runtimeId: ZAVORTH_ALPHA1_FOOTPRINT_REPUBLISH_PACK_RUNTIME_ID,
      scenario: 'root-success-create-failed',
    }),
  );
}
