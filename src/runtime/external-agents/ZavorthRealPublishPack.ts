export const ZAVORTH_REAL_PUBLISH_PACK_NOW = '2026-05-01T22:30:00.000Z' as const;
export const ZAVORTH_REAL_PUBLISH_PACK_RUNTIME_ID = 'zavorth-real-publish-pack' as const;

export type ZavorthRealPublishDecision =
  | 'zavorth-real-publish-awaiting-operator-confirmation'
  | 'zavorth-published-alpha'
  | 'zavorth-root-publish-failed'
  | 'zavorth-root-published-create-package-failed';

export type ZavorthRealPublishPackageName = 'zavorth' | 'create-zavorth';

export type ZavorthRealPublishReceipt = {
  nativeContract: 'ZavorthRealPublishReceipt/v1';
  packageName: ZavorthRealPublishPackageName;
  packageVersion: '1.1.0-alpha.0';
  command: 'npm publish --access public --tag alpha';
  workingDirectory: '.' | 'packages/create-zavorth';
  attempted: boolean;
  success: boolean;
  tag: 'alpha';
  registry: 'https://registry.npmjs.org/';
  stdoutSummary: string;
  stderrSummary: string;
  rawSecretSerialized: false;
};

export type ZavorthRealPublishVerification = {
  nativeContract: 'ZavorthRealPublishVerification/v1';
  packageName: ZavorthRealPublishPackageName;
  command: 'npm view zavorth name version dist-tags --json' | 'npm view create-zavorth name version dist-tags --json';
  required: boolean;
  performed: boolean;
  success: boolean;
  expectedVersion: '1.1.0-alpha.0';
  observedVersion: '1.1.0-alpha.0' | null;
  observedDistTagAlpha: '1.1.0-alpha.0' | null;
  rawSecretSerialized: false;
};

export type ZavorthRealPublishOrder = {
  nativeContract: 'ZavorthRealPublishOrder/v1';
  publishOrder: ['zavorth', 'create-zavorth'];
  createPackageRequiresRootSuccess: true;
  rationale: string;
};

export type ZavorthRealPublishPartialFailureHandling = {
  nativeContract: 'ZavorthRealPublishPartialFailureHandling/v1';
  rootFailureBlocksCreatePackagePublish: true;
  createFailureAfterRootPublishRecordedAsPartial: true;
  rollbackInvented: false;
  scopedFallbackAllowedAutomatically: false;
  versionChangeAllowedMidPack: false;
};

export type ZavorthRealPublishBlockedAction = {
  nativeContract: 'ZavorthRealPublishBlockedAction/v1';
  action:
    | 'domain-purchase'
    | 'global-install'
    | 'github-org-create'
    | 'latest-publish'
    | 'other-package-publish'
    | 'raw-history-import'
    | 'runtime-persistent-start'
    | 'trademark-file';
  performed: false;
};

export type ZavorthRealPublishFinalState = {
  decision: ZavorthRealPublishDecision;
  rootPublished: boolean;
  createPackagePublished: boolean;
  globalInstallPerformed: false;
  domainPurchased: false;
  githubOrgCreatedByThisPack: false;
  trademarkFiled: false;
  runtimePersistentStartPerformed: false;
  rawSecretSerialized: false;
  externalExecutorPublicIdentityReintroduced: false;
};

export type ZavorthRealPublishPackNormalization = {
  nativeContract: 'ZavorthRealPublishPack/v1';
  packId: '273';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_REAL_PUBLISH_PACK_RUNTIME_ID;
  decision: ZavorthRealPublishDecision;
  operatorIdentity: 'greyvritra';
  rootPublish: ZavorthRealPublishReceipt;
  createPackagePublish: ZavorthRealPublishReceipt;
  publishOrder: ZavorthRealPublishOrder;
  publishTag: 'alpha';
  receipts: ZavorthRealPublishReceipt[];
  postPublishVerification: ZavorthRealPublishVerification[];
  partialFailureHandling: ZavorthRealPublishPartialFailureHandling;
  blockedActions: ZavorthRealPublishBlockedAction[];
  validationCommands: string[];
  finalState: ZavorthRealPublishFinalState;
};

export type ZavorthRealPublishScenario =
  | 'awaiting-confirmation'
  | 'full-success'
  | 'root-failed'
  | 'root-success-create-failed';

export type ZavorthRealPublishPackOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_REAL_PUBLISH_PACK_RUNTIME_ID;
  scenario: ZavorthRealPublishScenario;
};

function decisionForScenario(scenario: ZavorthRealPublishScenario): ZavorthRealPublishDecision {
  if (scenario === 'full-success') {
    return 'zavorth-published-alpha';
  }
  if (scenario === 'root-failed') {
    return 'zavorth-root-publish-failed';
  }
  if (scenario === 'root-success-create-failed') {
    return 'zavorth-root-published-create-package-failed';
  }
  return 'zavorth-real-publish-awaiting-operator-confirmation';
}

function rootReceipt(scenario: ZavorthRealPublishScenario): ZavorthRealPublishReceipt {
  const attempted = scenario !== 'awaiting-confirmation';
  const success = scenario === 'full-success' || scenario === 'root-success-create-failed';

  return {
    nativeContract: 'ZavorthRealPublishReceipt/v1',
    packageName: 'zavorth',
    packageVersion: '1.1.0-alpha.0',
    command: 'npm publish --access public --tag alpha',
    workingDirectory: '.',
    attempted,
    success,
    tag: 'alpha',
    registry: 'https://registry.npmjs.org/',
    stdoutSummary: success
      ? '+ zavorth@1.1.0-alpha.0 published with tag alpha'
      : attempted
        ? 'npm prepared the zavorth tarball; registry rejected the publish request before package creation'
        : 'prepared; awaiting action-time operator confirmation',
    stderrSummary: attempted && !success
      ? 'E403 Forbidden: two-factor authentication or granular access token with bypass 2FA is required to publish packages'
      : '',
    rawSecretSerialized: false,
  };
}

function createReceipt(scenario: ZavorthRealPublishScenario): ZavorthRealPublishReceipt {
  const attempted = scenario === 'full-success' || scenario === 'root-success-create-failed';
  const success = scenario === 'full-success';

  return {
    nativeContract: 'ZavorthRealPublishReceipt/v1',
    packageName: 'create-zavorth',
    packageVersion: '1.1.0-alpha.0',
    command: 'npm publish --access public --tag alpha',
    workingDirectory: 'packages/create-zavorth',
    attempted,
    success,
    tag: 'alpha',
    registry: 'https://registry.npmjs.org/',
    stdoutSummary: success
      ? '+ create-zavorth@1.1.0-alpha.0 published with tag alpha'
      : attempted
        ? 'create package publish failed after root package publish'
        : 'not attempted because root publish did not succeed',
    stderrSummary: '',
    rawSecretSerialized: false,
  };
}

function publishOrder(): ZavorthRealPublishOrder {
  return {
    nativeContract: 'ZavorthRealPublishOrder/v1',
    publishOrder: ['zavorth', 'create-zavorth'],
    createPackageRequiresRootSuccess: true,
    rationale: 'Publish the main Zavorth CLI/runtime first, then publish npm create zavorth bootstrap.',
  };
}

function verificationForScenario(scenario: ZavorthRealPublishScenario): ZavorthRealPublishVerification[] {
  const rootSuccess = scenario === 'full-success' || scenario === 'root-success-create-failed';
  const createSuccess = scenario === 'full-success';

  return [
    {
      nativeContract: 'ZavorthRealPublishVerification/v1',
      packageName: 'zavorth',
      command: 'npm view zavorth name version dist-tags --json',
      required: true,
      performed: rootSuccess,
      success: rootSuccess,
      expectedVersion: '1.1.0-alpha.0',
      observedVersion: rootSuccess ? '1.1.0-alpha.0' : null,
      observedDistTagAlpha: rootSuccess ? '1.1.0-alpha.0' : null,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthRealPublishVerification/v1',
      packageName: 'create-zavorth',
      command: 'npm view create-zavorth name version dist-tags --json',
      required: rootSuccess,
      performed: createSuccess,
      success: createSuccess,
      expectedVersion: '1.1.0-alpha.0',
      observedVersion: createSuccess ? '1.1.0-alpha.0' : null,
      observedDistTagAlpha: createSuccess ? '1.1.0-alpha.0' : null,
      rawSecretSerialized: false,
    },
  ];
}

function partialFailureHandling(): ZavorthRealPublishPartialFailureHandling {
  return {
    nativeContract: 'ZavorthRealPublishPartialFailureHandling/v1',
    rootFailureBlocksCreatePackagePublish: true,
    createFailureAfterRootPublishRecordedAsPartial: true,
    rollbackInvented: false,
    scopedFallbackAllowedAutomatically: false,
    versionChangeAllowedMidPack: false,
  };
}

function blockedActions(): ZavorthRealPublishBlockedAction[] {
  return [
    'global-install',
    'domain-purchase',
    'github-org-create',
    'trademark-file',
    'runtime-persistent-start',
    'latest-publish',
    'other-package-publish',
    'raw-history-import',
  ].map((action) => ({
    nativeContract: 'ZavorthRealPublishBlockedAction/v1',
    action: action as ZavorthRealPublishBlockedAction['action'],
    performed: false,
  }));
}

function validationCommands(): string[] {
  return [
    'npx jest tests/runtime/external-agents/ZavorthRealPublishPack.test.ts --runInBand --testTimeout=30000',
    'npm run runtime:check --silent',
    'npm run build --silent',
    'npm publish --access public --tag alpha',
    'cd packages/create-zavorth && npm publish --access public --tag alpha',
    'npm view zavorth name version dist-tags --json',
    'npm view create-zavorth name version dist-tags --json',
    'redaction scan',
    'cleanup check',
  ];
}

export function normalizeZavorthRealPublishPack(
  options: ZavorthRealPublishPackOptions,
): ZavorthRealPublishPackNormalization {
  const decision = decisionForScenario(options.scenario);
  const rootPublish = rootReceipt(options.scenario);
  const createPackagePublish = createReceipt(options.scenario);

  return {
    nativeContract: 'ZavorthRealPublishPack/v1',
    packId: '273',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision,
    operatorIdentity: 'greyvritra',
    rootPublish,
    createPackagePublish,
    publishOrder: publishOrder(),
    publishTag: 'alpha',
    receipts: [rootPublish, createPackagePublish],
    postPublishVerification: verificationForScenario(options.scenario),
    partialFailureHandling: partialFailureHandling(),
    blockedActions: blockedActions(),
    validationCommands: validationCommands(),
    finalState: {
      decision,
      rootPublished: rootPublish.success,
      createPackagePublished: createPackagePublish.success,
      globalInstallPerformed: false,
      domainPurchased: false,
      githubOrgCreatedByThisPack: false,
      trademarkFiled: false,
      runtimePersistentStartPerformed: false,
      rawSecretSerialized: false,
      externalExecutorPublicIdentityReintroduced: false,
    },
  };
}

export class ZavorthRealPublishPack {
  public constructor(public readonly normalization: ZavorthRealPublishPackNormalization) {}

  public rootFailureBlocksCreatePackagePublish(): boolean {
    if (this.normalization.decision !== 'zavorth-root-publish-failed') {
      return true;
    }
    return !this.normalization.createPackagePublish.attempted;
  }

  public blockedActionPerformed(): boolean {
    return this.normalization.blockedActions.some((action) => action.performed);
  }
}

export function createZavorthRealPublishPackFixture(): ZavorthRealPublishPack {
  return new ZavorthRealPublishPack(
    normalizeZavorthRealPublishPack({
      generatedAt: ZAVORTH_REAL_PUBLISH_PACK_NOW,
      runtimeId: ZAVORTH_REAL_PUBLISH_PACK_RUNTIME_ID,
      scenario: 'root-failed',
    }),
  );
}

export function createZavorthRealPublishSuccessFixture(): ZavorthRealPublishPack {
  return new ZavorthRealPublishPack(
    normalizeZavorthRealPublishPack({
      generatedAt: ZAVORTH_REAL_PUBLISH_PACK_NOW,
      runtimeId: ZAVORTH_REAL_PUBLISH_PACK_RUNTIME_ID,
      scenario: 'full-success',
    }),
  );
}

export function createZavorthRealPublishRootFailureFixture(): ZavorthRealPublishPack {
  return new ZavorthRealPublishPack(
    normalizeZavorthRealPublishPack({
      generatedAt: ZAVORTH_REAL_PUBLISH_PACK_NOW,
      runtimeId: ZAVORTH_REAL_PUBLISH_PACK_RUNTIME_ID,
      scenario: 'root-failed',
    }),
  );
}

export function createZavorthRealPublishPartialFailureFixture(): ZavorthRealPublishPack {
  return new ZavorthRealPublishPack(
    normalizeZavorthRealPublishPack({
      generatedAt: ZAVORTH_REAL_PUBLISH_PACK_NOW,
      runtimeId: ZAVORTH_REAL_PUBLISH_PACK_RUNTIME_ID,
      scenario: 'root-success-create-failed',
    }),
  );
}
