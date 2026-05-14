export const ZAVORTH_PUBLISH_APPROVAL_GATE_NOW = '2026-05-01T21:55:00.000Z' as const;
export const ZAVORTH_PUBLISH_APPROVAL_GATE_RUNTIME_ID = 'zavorth-publish-approval-gate' as const;

export type ZavorthPublishApprovalDecision =
  | 'zavorth-publish-blocked-by-auth'
  | 'zavorth-publish-blocked-by-dry-run-failure'
  | 'zavorth-publish-blocked-by-name-or-ownership'
  | 'zavorth-publish-inconclusive'
  | 'zavorth-publish-ready-awaiting-operator-approval';

export type ZavorthPublishGateChecklistStatus =
  | 'blocked-by-auth'
  | 'blocked-by-dry-run-failure'
  | 'blocked-by-name-collision'
  | 'blocked-by-release-inconsistency'
  | 'go-ready-awaiting-operator-command'
  | 'inconclusive';

export type ZavorthNpmIdentityCheck = {
  nativeContract: 'ZavorthNpmIdentityCheck/v1';
  command: 'npm whoami';
  npmAuthenticated: boolean;
  operatorIdentity: 'greyvritra' | null;
  loginState: 'authenticated' | 'not-authenticated' | 'unknown';
  publishApprovalStillRequired: true;
  authBlocker: string | null;
  npmAuthTokenRead: false;
  npmAuthTokenSerialized: false;
  npmLoginAttempted: false;
};

export type ZavorthPackageNameCheck = {
  nativeContract: 'ZavorthPackageNameCheck/v1';
  packageName: 'zavorth' | 'create-zavorth';
  command: 'npm view zavorth name version' | 'npm view create-zavorth name version';
  availability: 'available' | 'taken' | 'unknown';
  registryResult: '404-not-found' | 'found' | 'ambiguous-error';
  interpretedAs: string;
  ownershipIssue: string | null;
};

export type ZavorthPackagePublishDryRun = {
  nativeContract: 'ZavorthPackagePublishDryRun/v1';
  packageKind: 'create-package' | 'root-package';
  packageName: 'zavorth' | 'create-zavorth';
  packageVersion: '1.1.0-alpha.0';
  workingDirectory: '.' | 'packages/create-zavorth';
  command: 'npm publish --dry-run --tag alpha --access public';
  dryRunPerformed: true;
  dryRunPassed: boolean;
  publishActuallyPerformed: false;
  bin: Record<string, string>;
  tarballSummary: {
    filename: string;
    packageSize: string;
    unpackedSize: string;
    totalFiles: number;
  };
  warnings: string[];
  blocker: string | null;
};

export type ZavorthPublishOrderPlan = {
  nativeContract: 'ZavorthPublishOrderPlan/v1';
  publishOrder: ['zavorth', 'create-zavorth'];
  rationale: string;
};

export type ZavorthPublishTagRecommendation = {
  nativeContract: 'ZavorthPublishTagRecommendation/v1';
  publishTagRecommended: 'alpha' | 'latest';
  prereleaseVersionDetected: boolean;
  latestAllowed: boolean;
  rationale: string;
};

export type ZavorthGoNoGoChecklistItem = {
  nativeContract: 'ZavorthGoNoGoChecklistItem/v1';
  item:
    | 'create-package-dry-run'
    | 'create-package-name'
    | 'final-operator-approval'
    | 'npm-identity'
    | 'publish-tag'
    | 'root-package-dry-run'
    | 'root-package-name'
    | 'smoke-271';
  status: ZavorthPublishGateChecklistStatus;
  evidence: string;
};

export type ZavorthFinalPublishCommand = {
  nativeContract: 'ZavorthFinalPublishCommand/v1';
  packageName: 'zavorth' | 'create-zavorth';
  workingDirectory: '.' | 'packages/create-zavorth';
  command: 'npm publish --access public --tag alpha';
  preparedButNotExecuted: true;
};

export type ZavorthPublishBlockedAction = {
  nativeContract: 'ZavorthPublishBlockedAction/v1';
  action:
    | 'create-package-publish'
    | 'domain-purchase'
    | 'global-install'
    | 'github-org-create'
    | 'npm-login-automation'
    | 'npm-publish'
    | 'runtime-start'
    | 'secret-token-read'
    | 'trademark-file';
  performed: false;
};

export type ZavorthPublishApprovalFinalState = {
  decision: ZavorthPublishApprovalDecision;
  npmPublishActuallyPerformed: false;
  createPackagePublishActuallyPerformed: false;
  globalInstallPerformed: false;
  domainPurchased: false;
  githubOrgCreatedByThisPack: false;
  trademarkFiled: false;
  runtimeBehaviorChanged: false;
  rawSecretSerialized: false;
  externalExecutorPublicIdentityReintroduced: false;
  publishApprovalStillRequired: true;
};

export type ZavorthPublishApprovalGateNormalization = {
  nativeContract: 'ZavorthPublishApprovalGate/v1';
  packId: '272';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_PUBLISH_APPROVAL_GATE_RUNTIME_ID;
  decision: ZavorthPublishApprovalDecision;
  npmIdentity: ZavorthNpmIdentityCheck;
  rootPackagePublishDryRun: ZavorthPackagePublishDryRun;
  createPackagePublishDryRun: ZavorthPackagePublishDryRun;
  packageNameChecks: ZavorthPackageNameCheck[];
  publishOrder: ZavorthPublishOrderPlan;
  publishTagRecommendation: ZavorthPublishTagRecommendation;
  goNoGoChecklist: ZavorthGoNoGoChecklistItem[];
  finalPublishCommands: ZavorthFinalPublishCommand[];
  blockedActions: ZavorthPublishBlockedAction[];
  validationCommands: string[];
  finalState: ZavorthPublishApprovalFinalState;
};

export type ZavorthPublishApprovalGateOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_PUBLISH_APPROVAL_GATE_RUNTIME_ID;
};

function npmIdentity(): ZavorthNpmIdentityCheck {
  return {
    nativeContract: 'ZavorthNpmIdentityCheck/v1',
    command: 'npm whoami',
    npmAuthenticated: true,
    operatorIdentity: 'greyvritra',
    loginState: 'authenticated',
    publishApprovalStillRequired: true,
    authBlocker: null,
    npmAuthTokenRead: false,
    npmAuthTokenSerialized: false,
    npmLoginAttempted: false,
  };
}

function packageNameChecks(): ZavorthPackageNameCheck[] {
  return [
    {
      nativeContract: 'ZavorthPackageNameCheck/v1',
      packageName: 'zavorth',
      command: 'npm view zavorth name version',
      availability: 'available',
      registryResult: '404-not-found',
      interpretedAs: '404 from npm registry; package name appears available for first publish.',
      ownershipIssue: null,
    },
    {
      nativeContract: 'ZavorthPackageNameCheck/v1',
      packageName: 'create-zavorth',
      command: 'npm view create-zavorth name version',
      availability: 'available',
      registryResult: '404-not-found',
      interpretedAs: '404 from npm registry; create package name appears available for first publish.',
      ownershipIssue: null,
    },
  ];
}

function rootPackagePublishDryRun(): ZavorthPackagePublishDryRun {
  return {
    nativeContract: 'ZavorthPackagePublishDryRun/v1',
    packageKind: 'root-package',
    packageName: 'zavorth',
    packageVersion: '1.1.0-alpha.0',
    workingDirectory: '.',
    command: 'npm publish --dry-run --tag alpha --access public',
    dryRunPerformed: true,
    dryRunPassed: true,
    publishActuallyPerformed: false,
    bin: {
      zavorth: 'bin/zavorth.js',
    },
    tarballSummary: {
      filename: 'zavorth-1.1.0-alpha.0.tgz',
      packageSize: '8.5 MB',
      unpackedSize: '60.0 MB',
      totalFiles: 13894,
    },
    warnings: [
      'initial publish dry-run without --tag failed because prerelease versions must publish with an explicit tag',
      'bin paths were normalized from ./bin/... to bin/... so npm does not auto-remove CLI bins',
      'root package has no explicit license field; confirm before real public publish',
      'root tarball is large because dist and dist-ops are included',
    ],
    blocker: null,
  };
}

function createPackagePublishDryRun(): ZavorthPackagePublishDryRun {
  return {
    nativeContract: 'ZavorthPackagePublishDryRun/v1',
    packageKind: 'create-package',
    packageName: 'create-zavorth',
    packageVersion: '1.1.0-alpha.0',
    workingDirectory: 'packages/create-zavorth',
    command: 'npm publish --dry-run --tag alpha --access public',
    dryRunPerformed: true,
    dryRunPassed: true,
    publishActuallyPerformed: false,
    bin: {
      'create-zavorth': 'bin/create-zavorth.js',
    },
    tarballSummary: {
      filename: 'create-zavorth-1.1.0-alpha.0.tgz',
      packageSize: '1.6 kB',
      unpackedSize: '3.8 kB',
      totalFiles: 4,
    },
    warnings: [
      'create package license is UNLICENSED while private is false; confirm before real public publish',
      'create-zavorth remains a temporary compatibility alias',
    ],
    blocker: null,
  };
}

function publishOrder(): ZavorthPublishOrderPlan {
  return {
    nativeContract: 'ZavorthPublishOrderPlan/v1',
    publishOrder: ['zavorth', 'create-zavorth'],
    rationale: 'Publish the runtime package first so npm create zavorth can point users at an already available zavorth package.',
  };
}

function publishTagRecommendation(): ZavorthPublishTagRecommendation {
  return {
    nativeContract: 'ZavorthPublishTagRecommendation/v1',
    publishTagRecommended: 'alpha',
    prereleaseVersionDetected: true,
    latestAllowed: false,
    rationale: '1.1.0-alpha.0 is a prerelease; npm rejected a no-tag dry-run and the release should not become latest by accident.',
  };
}

function goNoGoChecklist(): ZavorthGoNoGoChecklistItem[] {
  return [
    {
      nativeContract: 'ZavorthGoNoGoChecklistItem/v1',
      item: 'npm-identity',
      status: 'go-ready-awaiting-operator-command',
      evidence: 'npm whoami returned greyvritra; no token was read or serialized.',
    },
    {
      nativeContract: 'ZavorthGoNoGoChecklistItem/v1',
      item: 'root-package-name',
      status: 'go-ready-awaiting-operator-command',
      evidence: 'npm view zavorth name version returned E404, interpreted as available.',
    },
    {
      nativeContract: 'ZavorthGoNoGoChecklistItem/v1',
      item: 'create-package-name',
      status: 'go-ready-awaiting-operator-command',
      evidence: 'npm view create-zavorth name version returned E404, interpreted as available.',
    },
    {
      nativeContract: 'ZavorthGoNoGoChecklistItem/v1',
      item: 'root-package-dry-run',
      status: 'go-ready-awaiting-operator-command',
      evidence: 'npm publish --dry-run --tag alpha --access public passed for zavorth.',
    },
    {
      nativeContract: 'ZavorthGoNoGoChecklistItem/v1',
      item: 'create-package-dry-run',
      status: 'go-ready-awaiting-operator-command',
      evidence: 'npm publish --dry-run --tag alpha --access public passed for create-zavorth.',
    },
    {
      nativeContract: 'ZavorthGoNoGoChecklistItem/v1',
      item: 'publish-tag',
      status: 'go-ready-awaiting-operator-command',
      evidence: 'alpha tag is required and prepared for both packages.',
    },
    {
      nativeContract: 'ZavorthGoNoGoChecklistItem/v1',
      item: 'smoke-271',
      status: 'go-ready-awaiting-operator-command',
      evidence: '271 install smoke passed for zavorth/create-zavorth and legacy aliases.',
    },
    {
      nativeContract: 'ZavorthGoNoGoChecklistItem/v1',
      item: 'final-operator-approval',
      status: 'go-ready-awaiting-operator-command',
      evidence: 'real npm publish remains prepared only and requires a separate explicit operator command.',
    },
  ];
}

function finalPublishCommands(): ZavorthFinalPublishCommand[] {
  return [
    {
      nativeContract: 'ZavorthFinalPublishCommand/v1',
      packageName: 'zavorth',
      workingDirectory: '.',
      command: 'npm publish --access public --tag alpha',
      preparedButNotExecuted: true,
    },
    {
      nativeContract: 'ZavorthFinalPublishCommand/v1',
      packageName: 'create-zavorth',
      workingDirectory: 'packages/create-zavorth',
      command: 'npm publish --access public --tag alpha',
      preparedButNotExecuted: true,
    },
  ];
}

function blockedActions(): ZavorthPublishBlockedAction[] {
  return [
    'npm-publish',
    'create-package-publish',
    'global-install',
    'domain-purchase',
    'github-org-create',
    'trademark-file',
    'npm-login-automation',
    'secret-token-read',
    'runtime-start',
  ].map((action) => ({
    nativeContract: 'ZavorthPublishBlockedAction/v1',
    action: action as ZavorthPublishBlockedAction['action'],
    performed: false,
  }));
}

function validationCommands(): string[] {
  return [
    'npx jest tests/runtime/external-agents/ZavorthPublishApprovalGate.test.ts --runInBand --testTimeout=30000',
    'npm run runtime:check --silent',
    'npm run build --silent',
    'npm whoami',
    'npm view zavorth name version',
    'npm view create-zavorth name version',
    'npm publish --dry-run --tag alpha --access public',
    'cd packages/create-zavorth && npm publish --dry-run --tag alpha --access public',
    'redaction scan',
    'public surface scan',
    'cleanup check',
  ];
}

export function normalizeZavorthPublishApprovalGate(
  options: ZavorthPublishApprovalGateOptions,
): ZavorthPublishApprovalGateNormalization {
  return {
    nativeContract: 'ZavorthPublishApprovalGate/v1',
    packId: '272',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: 'zavorth-publish-ready-awaiting-operator-approval',
    npmIdentity: npmIdentity(),
    rootPackagePublishDryRun: rootPackagePublishDryRun(),
    createPackagePublishDryRun: createPackagePublishDryRun(),
    packageNameChecks: packageNameChecks(),
    publishOrder: publishOrder(),
    publishTagRecommendation: publishTagRecommendation(),
    goNoGoChecklist: goNoGoChecklist(),
    finalPublishCommands: finalPublishCommands(),
    blockedActions: blockedActions(),
    validationCommands: validationCommands(),
    finalState: {
      decision: 'zavorth-publish-ready-awaiting-operator-approval',
      npmPublishActuallyPerformed: false,
      createPackagePublishActuallyPerformed: false,
      globalInstallPerformed: false,
      domainPurchased: false,
      githubOrgCreatedByThisPack: false,
      trademarkFiled: false,
      runtimeBehaviorChanged: false,
      rawSecretSerialized: false,
      externalExecutorPublicIdentityReintroduced: false,
      publishApprovalStillRequired: true,
    },
  };
}

export class ZavorthPublishApprovalGate {
  public constructor(public readonly normalization: ZavorthPublishApprovalGateNormalization) {}

  public isReadyAwaitingOperatorApproval(): boolean {
    return (
      this.normalization.decision === 'zavorth-publish-ready-awaiting-operator-approval'
      && this.normalization.npmIdentity.npmAuthenticated
      && this.normalization.rootPackagePublishDryRun.dryRunPassed
      && this.normalization.createPackagePublishDryRun.dryRunPassed
      && this.normalization.packageNameChecks.every((check) => check.availability === 'available')
      && this.normalization.finalState.publishApprovalStillRequired
    );
  }

  public blockedActionPerformed(): boolean {
    return this.normalization.blockedActions.some((action) => action.performed);
  }
}

export function createZavorthPublishApprovalGateFixture(): ZavorthPublishApprovalGate {
  return new ZavorthPublishApprovalGate(
    normalizeZavorthPublishApprovalGate({
      generatedAt: ZAVORTH_PUBLISH_APPROVAL_GATE_NOW,
      runtimeId: ZAVORTH_PUBLISH_APPROVAL_GATE_RUNTIME_ID,
    }),
  );
}
