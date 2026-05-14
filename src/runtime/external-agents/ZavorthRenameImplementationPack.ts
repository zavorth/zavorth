export const ZAVORTH_RENAME_IMPLEMENTATION_PACK_NOW = '2026-05-01T20:20:00.000Z' as const;
export const ZAVORTH_RENAME_IMPLEMENTATION_PACK_RUNTIME_ID = 'zavorth-rename-implementation-pack' as const;

export type ZavorthRenameImplementationDecision = 'zavorth-public-rename-implemented';

export type ZavorthRenameImplementationCheckId =
  | 'adapter-global-removal-blocked'
  | 'zavorth-bin-created'
  | 'zavorth-legacy-bin-preserved'
  | 'create-zavorth-package-prepared'
  | 'docs-public-zavorth-first'
  | 'external-executor-public-identity-not-reintroduced'
  | 'package-root-renamed'
  | 'publish-not-performed'
  | 'runtime-internal-codename-retained';

export type ZavorthRenameImplementationCheck = {
  nativeContract: 'ZavorthRenameImplementationCheck/v1';
  checkId: ZavorthRenameImplementationCheckId;
  status: 'passed';
  evidence: string;
};

export type ZavorthRenameImplementationCompatibility = {
  nativeContract: 'ZavorthRenameImplementationCompatibility/v1';
  legacySurface: 'zavorth' | 'create-zavorth' | 'npm-run-scripts' | 'internal-zavorth-codename';
  preferredSurface: 'zavorth' | 'create-zavorth' | 'npm-run-scripts' | 'internal-zavorth-codename';
  policy: 'deprecated-alias' | 'preserved-local-contract' | 'retained-internal-codename';
  removalCriteria: string;
};

export type ZavorthRenameImplementationDistribution = {
  nativeContract: 'ZavorthRenameImplementationDistribution/v1';
  rootPackageName: 'zavorth';
  rootPackageVersion: '1.1.0-alpha.0';
  primaryCliBin: 'zavorth';
  legacyCliBin: 'zavorth';
  createPackageName: 'create-zavorth';
  legacyCreatePackageName: 'create-zavorth';
  githubOrgUrl: 'https://github.com/zavorth';
  primaryDomainCandidate: 'zavorth.dev';
  dotComUnavailable: true;
  scopedFallbackReserved: false;
};

export type ZavorthRenameImplementationBlockedAction = {
  nativeContract: 'ZavorthRenameImplementationBlockedAction/v1';
  action:
    | 'adapter-global-removal'
    | 'create-package-publish'
    | 'domain-purchase'
    | 'github-org-create'
    | 'npm-publish'
    | 'provider-tool-command-execution'
    | 'raw-history-import'
    | 'real-message-send'
    | 'trademark-file';
  performed: false;
};

export type ZavorthRenameImplementationFinalState = {
  decision: ZavorthRenameImplementationDecision;
  publicProductName: 'Zavorth';
  rootPackageName: 'zavorth';
  primaryCliBin: 'zavorth';
  legacyCliBin: 'zavorth';
  createPackageName: 'create-zavorth';
  legacyCreatePackageName: 'create-zavorth';
  githubOrgUrl: 'https://github.com/zavorth';
  primaryDomainCandidate: 'zavorth.dev';
  dotComUnavailable: true;
  scopedFallbackReserved: false;
  npmPublishActuallyPerformed: false;
  createPackagePublishActuallyPerformed: false;
  githubOrgCreatedByThisPack: false;
  domainPurchased: false;
  trademarkFiled: false;
  runtimeDangerousBehaviorChanged: false;
  externalExecutorPublicIdentityReintroduced: false;
  adapterGlobalRemoval: false;
  rawSecretSerialized: false;
  rawHistoryImported: false;
};

export type ZavorthRenameImplementationPackNormalization = {
  nativeContract: 'ZavorthRenameImplementationPack/v1';
  packId: '270';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_RENAME_IMPLEMENTATION_PACK_RUNTIME_ID;
  decision: ZavorthRenameImplementationDecision;
  implementationSource: '269-zavorth-rename-planning-pack';
  publicProductName: 'Zavorth';
  internalCodenamePolicy: 'zavorth-internal-codename-retained';
  distribution: ZavorthRenameImplementationDistribution;
  compatibility: ZavorthRenameImplementationCompatibility[];
  checks: ZavorthRenameImplementationCheck[];
  blockedActions: ZavorthRenameImplementationBlockedAction[];
  validationCommands: string[];
  finalState: ZavorthRenameImplementationFinalState;
};

export type ZavorthRenameImplementationPackOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_RENAME_IMPLEMENTATION_PACK_RUNTIME_ID;
};

function distribution(): ZavorthRenameImplementationDistribution {
  return {
    nativeContract: 'ZavorthRenameImplementationDistribution/v1',
    rootPackageName: 'zavorth',
    rootPackageVersion: '1.1.0-alpha.0',
    primaryCliBin: 'zavorth',
    legacyCliBin: 'zavorth',
    createPackageName: 'create-zavorth',
    legacyCreatePackageName: 'create-zavorth',
    githubOrgUrl: 'https://github.com/zavorth',
    primaryDomainCandidate: 'zavorth.dev',
    dotComUnavailable: true,
    scopedFallbackReserved: false,
  };
}

function compatibility(): ZavorthRenameImplementationCompatibility[] {
  return [
    {
      nativeContract: 'ZavorthRenameImplementationCompatibility/v1',
      legacySurface: 'zavorth',
      preferredSurface: 'zavorth',
      policy: 'deprecated-alias',
      removalCriteria: 'Keep through the alpha rename window and one documented compatibility cycle.',
    },
    {
      nativeContract: 'ZavorthRenameImplementationCompatibility/v1',
      legacySurface: 'create-zavorth',
      preferredSurface: 'create-zavorth',
      policy: 'deprecated-alias',
      removalCriteria: 'Keep if already published or needed for local smoke; otherwise document as legacy-only.',
    },
    {
      nativeContract: 'ZavorthRenameImplementationCompatibility/v1',
      legacySurface: 'npm-run-scripts',
      preferredSurface: 'npm-run-scripts',
      policy: 'preserved-local-contract',
      removalCriteria: 'No planned removal; repo-local setup/go/doctor scripts remain stable.',
    },
    {
      nativeContract: 'ZavorthRenameImplementationCompatibility/v1',
      legacySurface: 'internal-zavorth-codename',
      preferredSurface: 'internal-zavorth-codename',
      policy: 'retained-internal-codename',
      removalCriteria: 'Only revisit after public package, docs, and compatibility smoke are stable.',
    },
  ];
}

function checks(): ZavorthRenameImplementationCheck[] {
  return [
    { nativeContract: 'ZavorthRenameImplementationCheck/v1', checkId: 'package-root-renamed', status: 'passed', evidence: 'package.json name is zavorth.' },
    { nativeContract: 'ZavorthRenameImplementationCheck/v1', checkId: 'zavorth-bin-created', status: 'passed', evidence: 'bin/zavorth.js launches the existing compiled CLI.' },
    { nativeContract: 'ZavorthRenameImplementationCheck/v1', checkId: 'zavorth-legacy-bin-preserved', status: 'passed', evidence: 'bin/zavorth.js remains as a deprecated alias.' },
    { nativeContract: 'ZavorthRenameImplementationCheck/v1', checkId: 'create-zavorth-package-prepared', status: 'passed', evidence: 'packages/create-zavorth exposes create-zavorth.' },
    { nativeContract: 'ZavorthRenameImplementationCheck/v1', checkId: 'docs-public-zavorth-first', status: 'passed', evidence: 'README, quickstart, operations, troubleshooting, and CLI docs prefer Zavorth.' },
    { nativeContract: 'ZavorthRenameImplementationCheck/v1', checkId: 'runtime-internal-codename-retained', status: 'passed', evidence: 'No broad runtime class/contract rename was performed.' },
    { nativeContract: 'ZavorthRenameImplementationCheck/v1', checkId: 'publish-not-performed', status: 'passed', evidence: 'No npm publish command is part of this pack.' },
    { nativeContract: 'ZavorthRenameImplementationCheck/v1', checkId: 'external-executor-public-identity-not-reintroduced', status: 'passed', evidence: 'Public docs remain Zavorth-first and do not add external source identity requirements.' },
    { nativeContract: 'ZavorthRenameImplementationCheck/v1', checkId: 'adapter-global-removal-blocked', status: 'passed', evidence: 'Adapter global removal remains explicitly out of scope.' },
  ];
}

function blockedActions(): ZavorthRenameImplementationBlockedAction[] {
  return [
    'npm-publish',
    'create-package-publish',
    'domain-purchase',
    'github-org-create',
    'trademark-file',
    'adapter-global-removal',
    'raw-history-import',
    'real-message-send',
    'provider-tool-command-execution',
  ].map((action) => ({
    nativeContract: 'ZavorthRenameImplementationBlockedAction/v1',
    action: action as ZavorthRenameImplementationBlockedAction['action'],
    performed: false,
  }));
}

function validationCommands(): string[] {
  return [
    'npx jest tests/runtime/external-agents/ZavorthRenameImplementationPack.test.ts --runInBand --testTimeout=30000',
    'npm run runtime:check --silent',
    'npm run build --silent',
    'node bin/zavorth.js --help',
    'node bin/zavorth.js --help',
    'node packages/create-zavorth/bin/create-zavorth.js --help',
    'npm pack --dry-run',
    'npm run test:cli -- --testTimeout=30000',
    'npx jest tests/docs/CommandCenterProductDocs.test.ts --runInBand --testTimeout=30000',
    'redaction scan',
    'public surface scan',
    'cleanup check for node/jest/external-executor processes and 127.0.0.1:18789',
  ];
}

function finalState(): ZavorthRenameImplementationFinalState {
  return {
    decision: 'zavorth-public-rename-implemented',
    publicProductName: 'Zavorth',
    rootPackageName: 'zavorth',
    primaryCliBin: 'zavorth',
    legacyCliBin: 'zavorth',
    createPackageName: 'create-zavorth',
    legacyCreatePackageName: 'create-zavorth',
    githubOrgUrl: 'https://github.com/zavorth',
    primaryDomainCandidate: 'zavorth.dev',
    dotComUnavailable: true,
    scopedFallbackReserved: false,
    npmPublishActuallyPerformed: false,
    createPackagePublishActuallyPerformed: false,
    githubOrgCreatedByThisPack: false,
    domainPurchased: false,
    trademarkFiled: false,
    runtimeDangerousBehaviorChanged: false,
    externalExecutorPublicIdentityReintroduced: false,
    adapterGlobalRemoval: false,
    rawSecretSerialized: false,
    rawHistoryImported: false,
  };
}

export function normalizeZavorthRenameImplementationPack(
  options: ZavorthRenameImplementationPackOptions,
): ZavorthRenameImplementationPackNormalization {
  return {
    nativeContract: 'ZavorthRenameImplementationPack/v1',
    packId: '270',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: 'zavorth-public-rename-implemented',
    implementationSource: '269-zavorth-rename-planning-pack',
    publicProductName: 'Zavorth',
    internalCodenamePolicy: 'zavorth-internal-codename-retained',
    distribution: distribution(),
    compatibility: compatibility(),
    checks: checks(),
    blockedActions: blockedActions(),
    validationCommands: validationCommands(),
    finalState: finalState(),
  };
}

export class ZavorthRenameImplementationPack {
  public constructor(public readonly normalization: ZavorthRenameImplementationPackNormalization) {}

  public checkPassed(checkId: ZavorthRenameImplementationCheckId): boolean {
    return this.normalization.checks.some((check) => check.checkId === checkId && check.status === 'passed');
  }

  public dangerousActionPerformed(): boolean {
    return this.normalization.blockedActions.some((action) => action.performed);
  }
}

export function createZavorthRenameImplementationPackFixture(): ZavorthRenameImplementationPack {
  return new ZavorthRenameImplementationPack(
    normalizeZavorthRenameImplementationPack({
      generatedAt: ZAVORTH_RENAME_IMPLEMENTATION_PACK_NOW,
      runtimeId: ZAVORTH_RENAME_IMPLEMENTATION_PACK_RUNTIME_ID,
    }),
  );
}
