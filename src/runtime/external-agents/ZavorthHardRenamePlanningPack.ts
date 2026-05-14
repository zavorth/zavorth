export const ZAVORTH_HARD_RENAME_PLANNING_PACK_NOW = '2026-05-02T04:55:00.000Z' as const;
export const ZAVORTH_HARD_RENAME_PLANNING_PACK_RUNTIME_ID =
  'zavorth-hard-rename-planning-pack' as const;

export type ZavorthHardRenamePlanningDecision = 'zavorth-hard-rename-plan-ready';
export type ZavorthLegacyAliasPolicy = 'no-public-alias';

export type ZavorthHardRenameInventoryCategory =
  | 'package-distribution'
  | 'cli'
  | 'create-package'
  | 'installer'
  | 'runtime-contracts-services'
  | 'docs'
  | 'tests'
  | 'generated-build-artifacts'
  | 'out-of-scope-historical';

export type ZavorthHardRenameAffectedSurface = {
  nativeContract: 'ZavorthHardRenameAffectedSurface/v1';
  category: ZavorthHardRenameInventoryCategory;
  currentIdentityExamples: string[];
  targetIdentityExamples: string[];
  actionForImplementation: string;
  noLegacyAlias: boolean;
};

export type ZavorthHardRenameExecutionStep = {
  nativeContract: 'ZavorthHardRenameExecutionStep/v1';
  order: number;
  step:
    | 'reserve-npm-or-publish-direct'
    | 'rename-package-metadata'
    | 'rename-bins'
    | 'rename-create-package'
    | 'rename-installer'
    | 'rename-cli-outputs'
    | 'rename-public-classes-files'
    | 'clean-build-artifacts'
    | 'build'
    | 'public-identity-scan'
    | 'install-smoke-local'
    | 'new-publish-gate';
  description: string;
  mustNotKeepZavorthAlias: true;
};

export type ZavorthHardRenameRisk = {
  nativeContract: 'ZavorthHardRenameRisk/v1';
  riskId:
    | 'published-alpha-breaks-without-alias'
    | 'large-class-file-rename-churn'
    | 'generated-artifact-stale-strings'
    | 'package-create-sync'
    | 'installer-hosted-url-sync'
    | 'docs-tests-snapshot-volume'
    | 'npm-name-race-before-reservation';
  mitigation: string;
};

export type ZavorthHardRenameRollback = {
  nativeContract: 'ZavorthHardRenameRollback/v1';
  strategy: 'pre-publish-revert-only';
  notes: string[];
};

export type ZavorthHardRenameValidation = {
  nativeContract: 'ZavorthHardRenameValidation/v1';
  command: string;
  requiredForFutureImplementation: boolean;
};

export type ZavorthHardRenameBlockedAction = {
  nativeContract: 'ZavorthHardRenameBlockedAction/v1';
  action:
    | 'rename-files'
    | 'change-package-json-name'
    | 'create-zavorth-bin'
    | 'remove-current-bin'
    | 'change-installer'
    | 'publish-npm'
    | 'create-create-zavorth-package'
    | 'buy-domain'
    | 'change-version-dist-tag'
    | 'start-runtime'
    | 'execute-provider-tool-command-message';
  performed: false;
};

export type ZavorthHardRenamePlanningPackNormalization = {
  nativeContract: 'ZavorthHardRenamePlanningPack/v1';
  packId: '286';
  runtimeId: typeof ZAVORTH_HARD_RENAME_PLANNING_PACK_RUNTIME_ID;
  generatedAt: string;
  decision: ZavorthHardRenamePlanningDecision;
  currentPublicIdentity: 'Zavorth';
  targetPublicIdentity: 'Zavorth';
  currentPackageName: 'zavorth';
  targetPackageName: 'zavorth';
  currentCreatePackageName: 'create-zavorth';
  targetCreatePackageName: 'create-zavorth';
  currentCliBin: 'zavorth';
  targetCliBin: 'zavorth';
  legacyAliasPolicy: ZavorthLegacyAliasPolicy;
  zavorthCodenameRetained: false;
  zavorthPublicCompatibilityPlanned: false;
  githubReservationObserved: true;
  githubReservationSource: 'operator-reported-manual-reservation';
  githubOrgUrl: 'https://github.com/zavorth';
  npmReservationRequired: true;
  affectedSurfaces: ZavorthHardRenameAffectedSurface[];
  executionOrder: ZavorthHardRenameExecutionStep[];
  risks: ZavorthHardRenameRisk[];
  rollback: ZavorthHardRenameRollback;
  futureValidations: ZavorthHardRenameValidation[];
  blockedActions: ZavorthHardRenameBlockedAction[];
  finalState: {
    decision: ZavorthHardRenamePlanningDecision;
    targetPublicIdentity: 'Zavorth';
    currentPublicIdentity: 'Zavorth';
    legacyAliasPolicy: ZavorthLegacyAliasPolicy;
    zavorthCodenameRetained: false;
    zavorthPublicCompatibilityPlanned: false;
    zavorthRenamePerformed: false;
    packageNameChanged: false;
    binChanged: false;
    installerChanged: false;
    npmPublishPerformed: false;
    githubReservationObserved: true;
    npmReservationRequired: true;
    runtimePersistentStartPerformed: false;
    rawSecretSerialized: false;
  };
};

export type ZavorthHardRenamePlanningPackOptions = {
  generatedAt?: string;
};

function affectedSurfaces(): ZavorthHardRenameAffectedSurface[] {
  return [
    {
      nativeContract: 'ZavorthHardRenameAffectedSurface/v1',
      category: 'package-distribution',
      currentIdentityExamples: ['package.json:name=zavorth', 'package-lock.json', 'bin/zavorth.js', 'README/package metadata', 'npm pack files'],
      targetIdentityExamples: ['package.json:name=zavorth', 'bin/zavorth.js', 'README/package metadata says Zavorth', 'future alpha version for Zavorth'],
      actionForImplementation: 'Rename package metadata, bin mapping, lockfile, files allowlist and tarball policy in one future implementation pack.',
      noLegacyAlias: true,
    },
    {
      nativeContract: 'ZavorthHardRenameAffectedSurface/v1',
      category: 'cli',
      currentIdentityExamples: ['zavorth --help', 'zavorth setup', 'ZavorthCli* renderers', 'failure explanation output', 'setup wizard prompts'],
      targetIdentityExamples: ['zavorth --help', 'zavorth setup', 'ZavorthCli* renderers', 'Zavorth-only public output'],
      actionForImplementation: 'Replace public CLI command, help, setup, doctor, status, go, chat and failure UX strings; do not keep zavorth as an alias.',
      noLegacyAlias: true,
    },
    {
      nativeContract: 'ZavorthHardRenameAffectedSurface/v1',
      category: 'create-package',
      currentIdentityExamples: ['packages/create-zavorth', 'create-zavorth', 'npm create zavorth'],
      targetIdentityExamples: ['packages/create-zavorth', 'create-zavorth', 'npm create zavorth'],
      actionForImplementation: 'Create/rename the bootstrap package to create-zavorth with dry-run preserved and no create-zavorth alias.',
      noLegacyAlias: true,
    },
    {
      nativeContract: 'ZavorthHardRenameAffectedSurface/v1',
      category: 'installer',
      currentIdentityExamples: ['scripts/install-zavorth.ps1', 'scripts/install-zavorth.sh', 'future hosted zavorth.dev install docs'],
      targetIdentityExamples: ['scripts/install-zavorth.ps1', 'scripts/install-zavorth.sh', 'future hosted Zavorth installer docs'],
      actionForImplementation: 'Rename installer scripts and hosted examples; old installer names must not be recommended.',
      noLegacyAlias: true,
    },
    {
      nativeContract: 'ZavorthHardRenameAffectedSurface/v1',
      category: 'runtime-contracts-services',
      currentIdentityExamples: ['Zavorth* classes', 'Zavorth* contracts', 'Zavorth* services', 'external-agent pack names'],
      targetIdentityExamples: ['Zavorth* public classes/contracts/services', 'Zavorth external-agent pack names where current identity is public'],
      actionForImplementation: 'Rename current identity-bearing classes and files where they are part of product identity, leaving only historical out-of-scope records outside the package.',
      noLegacyAlias: true,
    },
    {
      nativeContract: 'ZavorthHardRenameAffectedSurface/v1',
      category: 'docs',
      currentIdentityExamples: ['README.md', 'docs/02-quickstart.md', 'docs/09-operations.md', 'docs/10-troubleshooting.md', 'docs/34-zavorth-cli.md', 'docs/270+ handoffs'],
      targetIdentityExamples: ['README and public docs Zavorth-only', 'docs/34-zavorth-cli.md', 'naming docs describe Zavorth only as historical external artifact if needed'],
      actionForImplementation: 'Convert public docs to Zavorth and quarantine historical mentions outside current product docs.',
      noLegacyAlias: true,
    },
    {
      nativeContract: 'ZavorthHardRenameAffectedSurface/v1',
      category: 'tests',
      currentIdentityExamples: ['tests/cli/ZavorthCli*.test.ts', 'docs tests', 'external-agent tests', 'output snapshot tests', 'install smoke tests'],
      targetIdentityExamples: ['Zavorth CLI/doc/runtime tests', 'Zavorth-only public identity scan', 'no Zavorth output snapshots'],
      actionForImplementation: 'Rename tests and assertions together with implementation; add hard scan that Zavorth is absent from package/product current surface.',
      noLegacyAlias: true,
    },
    {
      nativeContract: 'ZavorthHardRenameAffectedSurface/v1',
      category: 'generated-build-artifacts',
      currentIdentityExamples: ['dist', 'dist-ops', 'npm pack tarball contents', 'build output from prior identity'],
      targetIdentityExamples: ['clean dist/dist-ops generated from Zavorth sources', 'tarball without Zavorth strings'],
      actionForImplementation: 'Clean generated artifacts before build, then prove no stale Zavorth strings enter the future package.',
      noLegacyAlias: true,
    },
    {
      nativeContract: 'ZavorthHardRenameAffectedSurface/v1',
      category: 'out-of-scope-historical',
      currentIdentityExamples: ['.git history', 'old npm versions', 'logs/caches/receipts outside current package', 'data/runtime old local state', 'node_modules', 'temp folders'],
      targetIdentityExamples: ['no rewrite or deletion; excluded from current package/product identity scan'],
      actionForImplementation: 'Document exclusions clearly; do not rewrite history or mutate external historical records.',
      noLegacyAlias: true,
    },
  ];
}

function executionOrder(): ZavorthHardRenameExecutionStep[] {
  return [
    ['reserve-npm-or-publish-direct', 'Reserve npm zavorth and create-zavorth, or explicitly decide to publish direct in the implementation gate.'],
    ['rename-package-metadata', 'Change package.json, package-lock.json, README metadata, files list and future version policy.'],
    ['rename-bins', 'Replace zavorth bin with zavorth and remove public alias planning.'],
    ['rename-create-package', 'Replace packages/create-zavorth with packages/create-zavorth and create-zavorth bin.'],
    ['rename-installer', 'Replace install-zavorth scripts/docs with install-zavorth scripts/docs.'],
    ['rename-cli-outputs', 'Convert help, setup, doctor, status, go, chat, failure UX and public text to Zavorth.'],
    ['rename-public-classes-files', 'Rename current identity-bearing classes/files that are public product surface.'],
    ['clean-build-artifacts', 'Remove stale dist/dist-ops and generated package artifacts before rebuild.'],
    ['build', 'Run the normal build and runtime checks after the rename.'],
    ['public-identity-scan', 'Run a hard scan proving Zavorth is absent from current package/product surfaces.'],
    ['install-smoke-local', 'Pack and install root/create packages in temp dirs and test Zavorth commands.'],
    ['new-publish-gate', 'Create a new publish approval gate for zavorth and create-zavorth.'],
  ].map(([step, description], index) => ({
    nativeContract: 'ZavorthHardRenameExecutionStep/v1',
    order: index + 1,
    step: step as ZavorthHardRenameExecutionStep['step'],
    description,
    mustNotKeepZavorthAlias: true,
  }));
}

function risks(): ZavorthHardRenameRisk[] {
  return [
    {
      nativeContract: 'ZavorthHardRenameRisk/v1',
      riskId: 'published-alpha-breaks-without-alias',
      mitigation: 'Treat the rename as a new alpha identity and document that old npm versions remain historical only.',
    },
    {
      nativeContract: 'ZavorthHardRenameRisk/v1',
      riskId: 'large-class-file-rename-churn',
      mitigation: 'Rename identity-bearing files in coherent batches and keep behavior changes out of the rename pack.',
    },
    {
      nativeContract: 'ZavorthHardRenameRisk/v1',
      riskId: 'generated-artifact-stale-strings',
      mitigation: 'Delete/rebuild dist and dist-ops, then scan package contents before publish.',
    },
    {
      nativeContract: 'ZavorthHardRenameRisk/v1',
      riskId: 'package-create-sync',
      mitigation: 'Update root and create package versions, bins and smoke tests in the same implementation sequence.',
    },
    {
      nativeContract: 'ZavorthHardRenameRisk/v1',
      riskId: 'installer-hosted-url-sync',
      mitigation: 'Keep hosted installer commands disabled until scripts, docs and package names agree.',
    },
    {
      nativeContract: 'ZavorthHardRenameRisk/v1',
      riskId: 'docs-tests-snapshot-volume',
      mitigation: 'Use focused scans and snapshots to catch current public identity leaks without rewriting historical records.',
    },
    {
      nativeContract: 'ZavorthHardRenameRisk/v1',
      riskId: 'npm-name-race-before-reservation',
      mitigation: 'Reserve or publish under zavorth/create-zavorth before announcing the rename.',
    },
  ];
}

function rollback(): ZavorthHardRenameRollback {
  return {
    nativeContract: 'ZavorthHardRenameRollback/v1',
    strategy: 'pre-publish-revert-only',
    notes: [
      'Before publish, rollback is a normal source revert of the implementation branch.',
      'After publish, npm versions cannot be overwritten; use a new corrective prerelease instead.',
      'Do not rewrite git history, delete old npm versions, or mutate external logs as rollback.',
    ],
  };
}

function futureValidations(): ZavorthHardRenameValidation[] {
  return [
    'npm run runtime:check --silent',
    'npm run build --silent',
    'node bin/zavorth.js --help',
    'node bin/zavorth.js setup --dry-run',
    'node bin/zavorth.js setup --json --dry-run',
    'node bin/zavorth.js doctor --help',
    'node bin/zavorth.js go --dry-run --timeout-ms=1000 --poll-ms=250',
    'node packages/create-zavorth/bin/create-zavorth.js --help',
    'node packages/create-zavorth/bin/create-zavorth.js --dry-run',
    'npm pack --dry-run --json',
    'install smoke temp root package',
    'install smoke temp create package',
    'public identity scan: no Zavorth in current package/product surface',
    'redaction scan',
    'cleanup check',
  ].map((command) => ({
    nativeContract: 'ZavorthHardRenameValidation/v1',
    command,
    requiredForFutureImplementation: true,
  }));
}

function blockedActions(): ZavorthHardRenameBlockedAction[] {
  return [
    'rename-files',
    'change-package-json-name',
    'create-zavorth-bin',
    'remove-current-bin',
    'change-installer',
    'publish-npm',
    'create-create-zavorth-package',
    'buy-domain',
    'change-version-dist-tag',
    'start-runtime',
    'execute-provider-tool-command-message',
  ].map((action) => ({
    nativeContract: 'ZavorthHardRenameBlockedAction/v1',
    action: action as ZavorthHardRenameBlockedAction['action'],
    performed: false,
  }));
}

export function normalizeZavorthHardRenamePlanningPack(
  options: ZavorthHardRenamePlanningPackOptions = {},
): ZavorthHardRenamePlanningPackNormalization {
  return {
    nativeContract: 'ZavorthHardRenamePlanningPack/v1',
    packId: '286',
    runtimeId: ZAVORTH_HARD_RENAME_PLANNING_PACK_RUNTIME_ID,
    generatedAt: options.generatedAt || ZAVORTH_HARD_RENAME_PLANNING_PACK_NOW,
    decision: 'zavorth-hard-rename-plan-ready',
    currentPublicIdentity: 'Zavorth',
    targetPublicIdentity: 'Zavorth',
    currentPackageName: 'zavorth',
    targetPackageName: 'zavorth',
    currentCreatePackageName: 'create-zavorth',
    targetCreatePackageName: 'create-zavorth',
    currentCliBin: 'zavorth',
    targetCliBin: 'zavorth',
    legacyAliasPolicy: 'no-public-alias',
    zavorthCodenameRetained: false,
    zavorthPublicCompatibilityPlanned: false,
    githubReservationObserved: true,
    githubReservationSource: 'operator-reported-manual-reservation',
    githubOrgUrl: 'https://github.com/zavorth',
    npmReservationRequired: true,
    affectedSurfaces: affectedSurfaces(),
    executionOrder: executionOrder(),
    risks: risks(),
    rollback: rollback(),
    futureValidations: futureValidations(),
    blockedActions: blockedActions(),
    finalState: {
      decision: 'zavorth-hard-rename-plan-ready',
      targetPublicIdentity: 'Zavorth',
      currentPublicIdentity: 'Zavorth',
      legacyAliasPolicy: 'no-public-alias',
      zavorthCodenameRetained: false,
      zavorthPublicCompatibilityPlanned: false,
      zavorthRenamePerformed: false,
      packageNameChanged: false,
      binChanged: false,
      installerChanged: false,
      npmPublishPerformed: false,
      githubReservationObserved: true,
      npmReservationRequired: true,
      runtimePersistentStartPerformed: false,
      rawSecretSerialized: false,
    },
  };
}

export class ZavorthHardRenamePlanningPack {
  public constructor(public readonly normalization: ZavorthHardRenamePlanningPackNormalization) {}

  public renamePerformed(): boolean {
    return this.normalization.finalState.zavorthRenamePerformed;
  }

  public plansZavorthAlias(): boolean {
    return this.normalization.legacyAliasPolicy !== 'no-public-alias'
      || this.normalization.zavorthPublicCompatibilityPlanned;
  }

  public blockedActionPerformed(): boolean {
    return this.normalization.blockedActions.some((action) => action.performed);
  }
}

export function createZavorthHardRenamePlanningPackFixture(): ZavorthHardRenamePlanningPack {
  return new ZavorthHardRenamePlanningPack(
    normalizeZavorthHardRenamePlanningPack({
      generatedAt: ZAVORTH_HARD_RENAME_PLANNING_PACK_NOW,
    }),
  );
}
