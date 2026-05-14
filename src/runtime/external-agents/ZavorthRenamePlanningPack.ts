export const ZAVORTH_RENAME_PLANNING_PACK_NOW = '2026-05-01T19:40:00.000Z' as const;
export const ZAVORTH_RENAME_PLANNING_PACK_RUNTIME_ID = 'zavorth-rename-planning-pack' as const;

export type ZavorthRenameDecision = 'zavorth-rename-plan-ready';

export type ZavorthZavorthLegacyPolicy =
  | 'full-rename-required'
  | 'internal-codename-retained'
  | 'legacy-alias-only'
  | 'public-name-removed';

export type ZavorthRenameInventoryCategory =
  | 'docs-public-surface'
  | 'package-distribution'
  | 'runtime-tests';

export type ZavorthRenameInventoryAction =
  | 'create-zavorth-counterpart'
  | 'keep-internal-codename'
  | 'rename-public-identity'
  | 'retain-legacy-alias'
  | 'update-public-docs';

export type ZavorthRenameFuturePackId = '270' | '271' | '272';

export type ZavorthRenameBlockedActionId =
  | 'change-bin'
  | 'create-github-org'
  | 'file-trademark'
  | 'purchase-domain'
  | 'publish-npm'
  | 'remove-aliases'
  | 'rename-create-package'
  | 'rename-package-json'
  | 'rewrite-readme-final'
  | 'runtime-behavior-change';

export type ZavorthRenameExpectedState =
  | 'compatibilityRequired=true'
  | 'createPackageRenamed=false'
  | 'decision=zavorth-rename-plan-ready'
  | 'implementationAllowed=false'
  | 'legalClearanceRequired=true'
  | 'manualReservationRequired=true'
  | 'renameReady=true';

export type ZavorthAffectedFileInventoryItem = {
  nativeContract: 'ZavorthAffectedFileInventoryItem/v1';
  category: ZavorthRenameInventoryCategory;
  path: string;
  currentRole: string;
  plannedAction: ZavorthRenameInventoryAction;
  renamePhase: ZavorthRenameFuturePackId | 'post-272' | 'not-planned';
};

export type ZavorthCompatibilityStrategyItem = {
  nativeContract: 'ZavorthCompatibilityStrategyItem/v1';
  legacySurface: string;
  futureSurface: string;
  compatibilityPolicy: 'deprecate-with-message' | 'keep-repo-local' | 'preserve-as-alias' | 'replace-before-publish';
  deprecationMessage: string;
  removalCriteria: string;
};

export type ZavorthFuturePackPlanItem = {
  nativeContract: 'ZavorthFuturePackPlanItem/v1';
  packId: ZavorthRenameFuturePackId;
  title: string;
  scope: string[];
  executionAllowedNow: false;
};

export type ZavorthRenameRisk = {
  nativeContract: 'ZavorthRenameRisk/v1';
  riskId:
    | 'alias-confusion'
    | 'docs-test-breakage'
    | 'domain-legal-unreserved'
    | 'internal-churn'
    | 'local-scrien-useakage'
    | 'name-bin-mismatch'
    | 'publish-before-reservation';
  severity: 'high' | 'medium';
  mitigation: string;
};

export type ZavorthRenameBlockedAction = {
  nativeContract: 'ZavorthRenameBlockedAction/v1';
  actionId: ZavorthRenameBlockedActionId;
  blocked: true;
  performedByPack: false;
};

export type ZavorthRenameFinalState = {
  decision: ZavorthRenameDecision;
  renameReady: true;
  implementationAllowed: false;
  manualReservationRequired: true;
  legalClearanceRequired: true;
  compatibilityRequired: true;
  packageJsonRenamed: false;
  npmPublishActuallyPerformed: false;
  createPackagePublishActuallyPerformed: false;
  runtimeBehaviorChanged: false;
  cliBinChanged: false;
  createPackageRenamed: false;
  githubOrgCreated: false;
  domainPurchased: false;
  trademarkFiled: false;
  rawSecretSerialized: false;
  externalExecutorPublicIdentityReintroduced: false;
};

export type ZavorthRenamePlanningPackNormalization = {
  nativeContract: 'ZavorthRenamePlanningPack/v1';
  packId: '269';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_RENAME_PLANNING_PACK_RUNTIME_ID;
  expectedStates: ZavorthRenameExpectedState[];
  decision: ZavorthRenameDecision;
  productNameBefore: 'Zavorth';
  productNameAfter: 'Zavorth';
  cliNameBefore: 'zavorth';
  cliNameAfter: 'zavorth';
  packageNameBefore: 'zavorth';
  packageNameAfter: 'zavorth';
  createPackageBefore: 'create-zavorth';
  createPackageAfter: 'create-zavorth';
  desiredCommands: ['npm create zavorth', 'npx zavorth setup', 'zavorth setup', 'zavorth go', 'zavorth doctor'];
  zavorthLegacyPolicy: ZavorthZavorthLegacyPolicy;
  affectedFileInventory: ZavorthAffectedFileInventoryItem[];
  compatibilityStrategy: ZavorthCompatibilityStrategyItem[];
  futurePackPlan: ZavorthFuturePackPlanItem[];
  risks: ZavorthRenameRisk[];
  blockedActions: ZavorthRenameBlockedAction[];
  validationCommands: string[];
  finalState: ZavorthRenameFinalState;
};

export type ZavorthRenamePlanningPackOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_RENAME_PLANNING_PACK_RUNTIME_ID;
};

function expectedStates(): ZavorthRenameExpectedState[] {
  return [
    'decision=zavorth-rename-plan-ready',
    'renameReady=true',
    'implementationAllowed=false',
    'manualReservationRequired=true',
    'legalClearanceRequired=true',
    'compatibilityRequired=true',
    'createPackageRenamed=false',
  ];
}

function inventory(): ZavorthAffectedFileInventoryItem[] {
  const item = (
    category: ZavorthRenameInventoryCategory,
    path: string,
    currentRole: string,
    plannedAction: ZavorthRenameInventoryAction,
    renamePhase: ZavorthAffectedFileInventoryItem['renamePhase'],
  ): ZavorthAffectedFileInventoryItem => ({
    nativeContract: 'ZavorthAffectedFileInventoryItem/v1',
    category,
    path,
    currentRole,
    plannedAction,
    renamePhase,
  });

  return [
    item('package-distribution', 'package.json', 'Root npm package, bin mapping, files list, scripts, prepack/build.', 'rename-public-identity', '270'),
    item('package-distribution', 'package-lock.json', 'Lockfile metadata may record package name and package entries.', 'rename-public-identity', '270'),
    item('package-distribution', 'bin/zavorth.js', 'Current installed CLI entrypoint.', 'retain-legacy-alias', '270'),
    item('package-distribution', 'bin/create-zavorth.js', 'Root create helper and legacy bootstrap alias.', 'retain-legacy-alias', '270'),
    item('package-distribution', 'bin/zavorth.js', 'Future installed CLI entrypoint.', 'create-zavorth-counterpart', '270'),
    item('package-distribution', 'bin/create-zavorth.js', 'Future root create helper.', 'create-zavorth-counterpart', '270'),
    item('package-distribution', 'packages/create-zavorth/package.json', 'Standalone bootstrap package bridge.', 'retain-legacy-alias', '270'),
    item('package-distribution', 'packages/create-zavorth/bin/create-zavorth.js', 'Standalone create-zavorth bin.', 'retain-legacy-alias', '270'),
    item('package-distribution', 'packages/create-zavorth/package.json', 'Future standalone create-zavorth package.', 'create-zavorth-counterpart', '270'),
    item('package-distribution', 'scripts/setup-v3.ts', 'First-run setup script behind npm run setup and CLI setup.', 'keep-internal-codename', 'not-planned'),
    item('package-distribution', 'scripts/ops-go.ts', 'Local go launcher used by repo scripts.', 'keep-internal-codename', 'not-planned'),
    item('package-distribution', 'scripts/ops-doctor.ts', 'Local doctor script used by repo scripts.', 'keep-internal-codename', 'not-planned'),
    item('docs-public-surface', 'README.md', 'Primary public product identity and install path.', 'update-public-docs', '270'),
    item('docs-public-surface', 'docs/00-overview.md', 'Public overview and product name.', 'update-public-docs', '270'),
    item('docs-public-surface', 'docs/01-product-pitch.md', 'Public pitch and product positioning.', 'update-public-docs', '270'),
    item('docs-public-surface', 'docs/02-quickstart.md', 'Short install/go/doctor path.', 'update-public-docs', '270'),
    item('docs-public-surface', 'docs/06-telegram.md', 'Public channel docs and visible command aliases such as /zavorth.', 'update-public-docs', '270'),
    item('docs-public-surface', 'docs/09-operations.md', 'Operations commands and runtime language.', 'update-public-docs', '270'),
    item('docs-public-surface', 'docs/10-troubleshooting.md', 'First-run troubleshooting and command names.', 'update-public-docs', '270'),
    item('docs-public-surface', 'docs/34-zavorth-cli.md', 'CLI reference that may need new Zavorth counterpart or rename.', 'update-public-docs', '270'),
    item('docs-public-surface', 'docs/248-post-absorption-release-docs-install-cleanup.md', 'Release-era public docs policy.', 'update-public-docs', '270'),
    item('docs-public-surface', 'docs/249-post-absorption-release-candidate-report.md', 'Release candidate report naming baseline.', 'update-public-docs', '270'),
    item('docs-public-surface', 'docs/250-post-absorption-final-release-notes-and-handoff.md', 'Operational handoff naming baseline.', 'update-public-docs', '270'),
    item('docs-public-surface', 'docs/258-product-launch-ux-and-install-architecture-pack.md', 'Launch UX architecture with Zavorth commands.', 'update-public-docs', '270'),
    item('docs-public-surface', 'docs/259-product-launch-ux-final-polish-pack.md', 'Final UX polish naming references.', 'update-public-docs', '270'),
    item('docs-public-surface', 'docs/260-product-install-distribution-bootstrap-pack.md', 'Distribution/bootstrap package naming.', 'update-public-docs', '270'),
    item('docs-public-surface', 'docs/261-product-install-smoke-temp-environment-pack.md', 'Install smoke expectations.', 'update-public-docs', '270'),
    item('docs-public-surface', 'docs/262-post-absorption-public-release-and-final-capability-pack.md', 'Public release readiness naming state.', 'update-public-docs', '270'),
    item('docs-public-surface', 'docs/263-post-absorption-publish-create-and-stability-gate.md', 'Publish/create naming strategy.', 'update-public-docs', '270'),
    item('docs-public-surface', 'docs/264-create-zavorth-package-bridge-pack.md', 'Create package bridge naming.', 'update-public-docs', '270'),
    item('docs-public-surface', 'docs/265-coordinated-npm-publish-approval-gate.md', 'Coordinated publish approval naming.', 'update-public-docs', '270'),
    item('docs-public-surface', 'docs/266-npm-identity-and-package-name-resolution-gate.md', 'NPM identity/name strategy history.', 'update-public-docs', '270'),
    item('docs-public-surface', 'docs/267-auvaryn-naming-reservation-gate.md', 'Previous candidate history.', 'keep-internal-codename', 'not-planned'),
    item('docs-public-surface', 'docs/268-zavorth-naming-reservation-gate.md', 'Zavorth reservation evidence.', 'keep-internal-codename', 'not-planned'),
    item('docs-public-surface', 'NAMING_DECISION.md', 'Naming decision ledger.', 'update-public-docs', '270'),
    item('runtime-tests', 'src/runtime/external-agents/*', 'Planning, gates, boundaries, and historical absorption contracts.', 'keep-internal-codename', 'not-planned'),
    item('runtime-tests', 'src/runtime/external-agents/contracts.ts', 'Internal governing runtime contracts with Zavorth boundary naming.', 'keep-internal-codename', 'not-planned'),
    item('runtime-tests', 'src/runtime/agent/contracts/index.ts', 'Runtime public ecosystem aliases that expose Zavorth type names.', 'rename-public-identity', 'post-272'),
    item('runtime-tests', 'src/contracts/public/*', 'Mostly brand-neutral REST/SSE/WS DTO surfaces.', 'keep-internal-codename', 'not-planned'),
    item('runtime-tests', 'src/zavorth-cli.ts', 'Current CLI source entrypoint and command router.', 'retain-legacy-alias', '270'),
    item('runtime-tests', 'src/zavorth-cli.ts', 'Future CLI source entrypoint or wrapper.', 'create-zavorth-counterpart', '270'),
    item('runtime-tests', 'src/cli/ZavorthCli*', 'Current CLI renderers and user-facing help strings.', 'retain-legacy-alias', '270'),
    item('runtime-tests', 'src/ai-gateway/app/(dashboard)/control/command-center/contracts/zavorthCommandCenterContracts.ts', 'Command Center assimilation IDs and public-ish contract names.', 'keep-internal-codename', 'post-272'),
    item('runtime-tests', 'src/ai-gateway/app/(dashboard)/control/**/*', 'Human-facing Command Center copy that may still say Zavorth.', 'rename-public-identity', '270'),
    item('runtime-tests', 'tests/runtime/external-agents/*', 'Gate and boundary tests with Zavorth historical assertions.', 'keep-internal-codename', 'not-planned'),
    item('runtime-tests', 'tests/docs/CommandCenterProductDocs.test.ts', 'Public docs guard likely needs Zavorth expectations.', 'rename-public-identity', '270'),
    item('runtime-tests', 'tests/cli/*', 'CLI public command tests and visual contract tests.', 'rename-public-identity', '270'),
    item('runtime-tests', 'tests/services/*', 'Public surface and product quality services.', 'rename-public-identity', '270'),
  ];
}

function compatibilityStrategy(): ZavorthCompatibilityStrategyItem[] {
  return [
    {
      nativeContract: 'ZavorthCompatibilityStrategyItem/v1',
      legacySurface: 'zavorth CLI bin',
      futureSurface: 'zavorth CLI bin',
      compatibilityPolicy: 'deprecate-with-message',
      deprecationMessage: 'zavorth is now Zavorth; use zavorth <command>. This alias remains during the alpha compatibility window.',
      removalCriteria: 'Remove after a stable Zavorth release and at least one documented compatibility cycle.',
    },
    {
      nativeContract: 'ZavorthCompatibilityStrategyItem/v1',
      legacySurface: 'create-zavorth package/bin',
      futureSurface: 'create-zavorth package/bin',
      compatibilityPolicy: 'preserve-as-alias',
      deprecationMessage: 'create-zavorth is the legacy bootstrap alias; use npm create zavorth for new projects.',
      removalCriteria: 'If create-zavorth was never published, prioritize create-zavorth and keep only local alias docs; if published, maintain deprecation package.',
    },
    {
      nativeContract: 'ZavorthCompatibilityStrategyItem/v1',
      legacySurface: 'npm run setup/go/doctor',
      futureSurface: 'npm run setup/go/doctor',
      compatibilityPolicy: 'keep-repo-local',
      deprecationMessage: 'Repo-local npm scripts stay stable and do not need Zavorth-prefixed names.',
      removalCriteria: 'No planned removal; these are local scripts, not product package names.',
    },
    {
      nativeContract: 'ZavorthCompatibilityStrategyItem/v1',
      legacySurface: 'public docs using Zavorth as product name',
      futureSurface: 'public docs using Zavorth as product name',
      compatibilityPolicy: 'replace-before-publish',
      deprecationMessage: 'Zavorth remains a build codename/internal lineage; Zavorth is the public product name.',
      removalCriteria: 'Public release docs must prefer Zavorth before npm publish.',
    },
  ];
}

function futurePackPlan(): ZavorthFuturePackPlanItem[] {
  return [
    {
      nativeContract: 'ZavorthFuturePackPlanItem/v1',
      packId: '270',
      title: 'Zavorth Rename Implementation Pack',
      scope: [
        'apply package/bin/docs rename',
        'create create-zavorth package bridge',
        'preserve zavorth CLI alias with deprecation message',
        'update public docs and focused docs/CLI tests',
      ],
      executionAllowedNow: false,
    },
    {
      nativeContract: 'ZavorthFuturePackPlanItem/v1',
      packId: '271',
      title: 'Zavorth Install Smoke Pack',
      scope: [
        'npm pack root package',
        'npm pack create-zavorth package',
        'install into temporary environment',
        'test zavorth help/setup/doctor/go dry-run and legacy aliases',
      ],
      executionAllowedNow: false,
    },
    {
      nativeContract: 'ZavorthFuturePackPlanItem/v1',
      packId: '272',
      title: 'Zavorth Publish Approval Gate',
      scope: [
        'npm whoami',
        'npm view zavorth and create-zavorth',
        'npm publish dry-run',
        'prepare alpha publish commands without executing publish',
      ],
      executionAllowedNow: false,
    },
  ];
}

function risks(): ZavorthRenameRisk[] {
  return [
    {
      nativeContract: 'ZavorthRenameRisk/v1',
      riskId: 'local-scrien-useakage',
      severity: 'medium',
      mitigation: 'Keep npm run setup/go/doctor unchanged and test both CLI and repo-local paths.',
    },
    {
      nativeContract: 'ZavorthRenameRisk/v1',
      riskId: 'docs-test-breakage',
      severity: 'medium',
      mitigation: 'Update public docs and docs tests in the same implementation pack.',
    },
    {
      nativeContract: 'ZavorthRenameRisk/v1',
      riskId: 'name-bin-mismatch',
      severity: 'high',
      mitigation: 'Keep package name, bin mapping, create package, and smoke tests in one focused rename pack.',
    },
    {
      nativeContract: 'ZavorthRenameRisk/v1',
      riskId: 'alias-confusion',
      severity: 'medium',
      mitigation: 'Use explicit deprecation messages and a documented compatibility window.',
    },
    {
      nativeContract: 'ZavorthRenameRisk/v1',
      riskId: 'internal-churn',
      severity: 'high',
      mitigation: 'Retain Zavorth as internal codename/legacy namespace for now; avoid broad class/contract churn.',
    },
    {
      nativeContract: 'ZavorthRenameRisk/v1',
      riskId: 'domain-legal-unreserved',
      severity: 'high',
      mitigation: 'Manual domain reservation and legal clearance must precede publish approval.',
    },
    {
      nativeContract: 'ZavorthRenameRisk/v1',
      riskId: 'publish-before-reservation',
      severity: 'high',
      mitigation: '272 must re-check npm names and require explicit operator approval before publish.',
    },
  ];
}

function blockedActions(): ZavorthRenameBlockedAction[] {
  return [
    'rename-package-json',
    'change-bin',
    'rename-create-package',
    'rewrite-readme-final',
    'publish-npm',
    'purchase-domain',
    'create-github-org',
    'file-trademark',
    'remove-aliases',
    'runtime-behavior-change',
  ].map((actionId) => ({
    nativeContract: 'ZavorthRenameBlockedAction/v1',
    actionId: actionId as ZavorthRenameBlockedActionId,
    blocked: true,
    performedByPack: false,
  }));
}

function validationCommands(): string[] {
  return [
    'npx jest tests/runtime/external-agents/ZavorthRenamePlanningPack.test.ts --runInBand --testTimeout=30000',
    'npm run runtime:check --silent',
    'redaction scan on touched files',
    'public surface scan basic',
    'cleanup check for jest/node/external-executor processes and 127.0.0.1:18789',
  ];
}

function finalState(): ZavorthRenameFinalState {
  return {
    decision: 'zavorth-rename-plan-ready',
    renameReady: true,
    implementationAllowed: false,
    manualReservationRequired: true,
    legalClearanceRequired: true,
    compatibilityRequired: true,
    packageJsonRenamed: false,
    npmPublishActuallyPerformed: false,
    createPackagePublishActuallyPerformed: false,
    runtimeBehaviorChanged: false,
    cliBinChanged: false,
    createPackageRenamed: false,
    githubOrgCreated: false,
    domainPurchased: false,
    trademarkFiled: false,
    rawSecretSerialized: false,
    externalExecutorPublicIdentityReintroduced: false,
  };
}

export function normalizeZavorthRenamePlanningPack(
  options: ZavorthRenamePlanningPackOptions,
): ZavorthRenamePlanningPackNormalization {
  return {
    nativeContract: 'ZavorthRenamePlanningPack/v1',
    packId: '269',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    expectedStates: expectedStates(),
    decision: 'zavorth-rename-plan-ready',
    productNameBefore: 'Zavorth',
    productNameAfter: 'Zavorth',
    cliNameBefore: 'zavorth',
    cliNameAfter: 'zavorth',
    packageNameBefore: 'zavorth',
    packageNameAfter: 'zavorth',
    createPackageBefore: 'create-zavorth',
    createPackageAfter: 'create-zavorth',
    desiredCommands: ['npm create zavorth', 'npx zavorth setup', 'zavorth setup', 'zavorth go', 'zavorth doctor'],
    zavorthLegacyPolicy: 'internal-codename-retained',
    affectedFileInventory: inventory(),
    compatibilityStrategy: compatibilityStrategy(),
    futurePackPlan: futurePackPlan(),
    risks: risks(),
    blockedActions: blockedActions(),
    validationCommands: validationCommands(),
    finalState: finalState(),
  };
}

export class ZavorthRenamePlanningPack {
  public constructor(public readonly normalization: ZavorthRenamePlanningPackNormalization) {}

  public expectedState(state: ZavorthRenameExpectedState): boolean {
    return this.normalization.expectedStates.includes(state);
  }

  public implementationAllowed(): boolean {
    return this.normalization.finalState.implementationAllowed;
  }
}

export function createZavorthRenamePlanningPackFixture(): ZavorthRenamePlanningPack {
  return new ZavorthRenamePlanningPack(
    normalizeZavorthRenamePlanningPack({
      generatedAt: ZAVORTH_RENAME_PLANNING_PACK_NOW,
      runtimeId: ZAVORTH_RENAME_PLANNING_PACK_RUNTIME_ID,
    }),
  );
}
