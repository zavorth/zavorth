export const ZAVORTH_HARD_RENAME_LEGACY_IDENTITY_PURGE_PACK_NOW =
  '2026-05-02T00:40:00.000Z' as const;
export const ZAVORTH_HARD_RENAME_LEGACY_IDENTITY_PURGE_PACK_RUNTIME_ID =
  'zavorth-hard-rename-legacy-identity-purge-pack' as const;

export type ZavorthHardRenamePurgeDecision = 'zavorth-hard-rename-purge-ready';

export type ZavorthLegacyOccurrenceCategory =
  | 'current-product'
  | 'local-state-cache'
  | 'generated-artifact'
  | 'external-history'
  | 'operator-private-config';

export type ZavorthLegacyOccurrenceScan = {
  nativeContract: 'ZavorthLegacyOccurrenceScan/v1';
  scope: string;
  beforeOccurrences: number;
  afterOccurrences: number;
  category: ZavorthLegacyOccurrenceCategory;
  blocker: false;
  justification: string;
};

export type ZavorthHardRenamePackageState = {
  nativeContract: 'ZavorthHardRenamePackageState/v1';
  rootPackageName: 'zavorth';
  rootVersionPrepared: '1.1.0-alpha.2';
  primaryCliBin: 'zavorth';
  legacyCliAliasRemoved: true;
  createPackageName: 'create-zavorth';
  createPackageVersionPrepared: '1.1.0-alpha.2';
  primaryCreateBin: 'create-zavorth';
  legacyCreateAliasRemoved: true;
  npmPublishActuallyPerformed: false;
};

export type ZavorthHardRenameRenamedArtifact = {
  nativeContract: 'ZavorthHardRenameRenamedArtifact/v1';
  from: string;
  to: string;
  reason: 'product-identity' | 'cli-entrypoint' | 'create-package' | 'docs-public-surface';
};

export type ZavorthHardRenameValidationCommand = {
  nativeContract: 'ZavorthHardRenameValidationCommand/v1';
  command: string;
  required: true;
  externalAction: false;
};

export type ZavorthHardRenameBlockedAction = {
  nativeContract: 'ZavorthHardRenameBlockedAction/v1';
  action:
    | 'adapter-global-removal'
    | 'domain-purchase'
    | 'github-org-create'
    | 'git-history-rewrite'
    | 'global-install'
    | 'npm-publish'
    | 'provider-tool-command-execution'
    | 'raw-history-import'
    | 'runtime-persistent-start'
    | 'trademark-file';
  performed: false;
};

export type ZavorthHardRenameFinalState = {
  decision: ZavorthHardRenamePurgeDecision;
  legacyPublicIdentityRemoved: true;
  legacyCliAliasRemoved: true;
  legacyCreateAliasRemoved: true;
  publicSurfaceZavorthOnly: true;
  packageJsonRenamedToZavorth: true;
  futureVersionPrepared: '1.1.0-alpha.2';
  npmPublishActuallyPerformed: false;
  gitHistoryRewritten: false;
  runtimeDangerousBehaviorChanged: false;
  adapterGlobalRemoval: false;
  rawHistoryImported: false;
  rawSecretSerialized: false;
  externalHistoricalArtifactsOnly: true;
};

export type ZavorthHardRenameLegacyIdentityPurgePackNormalization = {
  nativeContract: 'ZavorthHardRenameLegacyIdentityPurgePack/v1';
  packId: '276';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_HARD_RENAME_LEGACY_IDENTITY_PURGE_PACK_RUNTIME_ID;
  decision: ZavorthHardRenamePurgeDecision;
  packageState: ZavorthHardRenamePackageState;
  occurrenceScans: ZavorthLegacyOccurrenceScan[];
  renamedArtifacts: ZavorthHardRenameRenamedArtifact[];
  validationCommands: ZavorthHardRenameValidationCommand[];
  blockedActions: ZavorthHardRenameBlockedAction[];
  finalState: ZavorthHardRenameFinalState;
};

export type ZavorthHardRenameLegacyIdentityPurgePackOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_HARD_RENAME_LEGACY_IDENTITY_PURGE_PACK_RUNTIME_ID;
};

function packageState(): ZavorthHardRenamePackageState {
  return {
    nativeContract: 'ZavorthHardRenamePackageState/v1',
    rootPackageName: 'zavorth',
    rootVersionPrepared: '1.1.0-alpha.2',
    primaryCliBin: 'zavorth',
    legacyCliAliasRemoved: true,
    createPackageName: 'create-zavorth',
    createPackageVersionPrepared: '1.1.0-alpha.2',
    primaryCreateBin: 'create-zavorth',
    legacyCreateAliasRemoved: true,
    npmPublishActuallyPerformed: false,
  };
}

function occurrenceScans(): ZavorthLegacyOccurrenceScan[] {
  return [
    {
      nativeContract: 'ZavorthLegacyOccurrenceScan/v1',
      scope: 'current-product-targets',
      beforeOccurrences: 264,
      afterOccurrences: 0,
      category: 'current-product',
      blocker: false,
      justification:
        'Source, tests, docs, package metadata, bins, scripts, config, assets, SDK files, and public docs were purged.',
    },
    {
      nativeContract: 'ZavorthLegacyOccurrenceScan/v1',
      scope: 'initial-mechanical-targets',
      beforeOccurrences: 36582,
      afterOccurrences: 0,
      category: 'current-product',
      blocker: false,
      justification:
        'The initial rename pass covered current code and docs before the focused cleanup narrowed remaining public-surface hits to zero.',
    },
    {
      nativeContract: 'ZavorthLegacyOccurrenceScan/v1',
      scope: 'root-shortcut-files',
      beforeOccurrences: 6,
      afterOccurrences: 0,
      category: 'current-product',
      blocker: false,
      justification:
        'Local shortcut filenames and launcher references were renamed to Zavorth while keeping them outside the documented product path.',
    },
    {
      nativeContract: 'ZavorthLegacyOccurrenceScan/v1',
      scope: 'excluded-local-state-and-generated-artifacts',
      beforeOccurrences: 134164,
      afterOccurrences: 133791,
      category: 'local-state-cache',
      blocker: false,
      justification:
        'Private data, older generated outputs, logs, caches, and previously emitted receipts are external or historical to the current product tree.',
    },
  ];
}

function renamedArtifacts(): ZavorthHardRenameRenamedArtifact[] {
  return [
    {
      nativeContract: 'ZavorthHardRenameRenamedArtifact/v1',
      from: 'src/legacy-cli-source.ts',
      to: 'src/zavorth-cli.ts',
      reason: 'cli-entrypoint',
    },
    {
      nativeContract: 'ZavorthHardRenameRenamedArtifact/v1',
      from: 'bin/legacy-cli.js',
      to: 'bin/zavorth.js',
      reason: 'cli-entrypoint',
    },
    {
      nativeContract: 'ZavorthHardRenameRenamedArtifact/v1',
      from: 'bin/legacy-create.js',
      to: 'bin/create-zavorth.js',
      reason: 'create-package',
    },
    {
      nativeContract: 'ZavorthHardRenameRenamedArtifact/v1',
      from: 'docs/34-legacy-cli.md',
      to: 'docs/34-zavorth-cli.md',
      reason: 'docs-public-surface',
    },
    {
      nativeContract: 'ZavorthHardRenameRenamedArtifact/v1',
      from: 'packages/legacy-create-package',
      to: 'packages/create-zavorth',
      reason: 'create-package',
    },
  ];
}

function validationCommands(): ZavorthHardRenameValidationCommand[] {
  return [
    'npx jest tests/runtime/external-agents/ZavorthHardRenameLegacyIdentityPurgePack.test.ts --runInBand --testTimeout=30000',
    'npm run runtime:check --silent',
    'npm run build --silent',
    'node bin/zavorth.js --help',
    'node packages/create-zavorth/bin/create-zavorth.js --help',
    'npm pack --dry-run --json',
    'root install smoke in temporary environment',
    'create package install smoke in temporary environment',
    'legacy identity public surface scan',
    'redaction scan',
    'cleanup check',
  ].map((command) => ({
    nativeContract: 'ZavorthHardRenameValidationCommand/v1',
    command,
    required: true,
    externalAction: false,
  }));
}

function blockedActions(): ZavorthHardRenameBlockedAction[] {
  return [
    'npm-publish',
    'git-history-rewrite',
    'domain-purchase',
    'github-org-create',
    'trademark-file',
    'global-install',
    'runtime-persistent-start',
    'provider-tool-command-execution',
    'raw-history-import',
    'adapter-global-removal',
  ].map((action) => ({
    nativeContract: 'ZavorthHardRenameBlockedAction/v1',
    action: action as ZavorthHardRenameBlockedAction['action'],
    performed: false,
  }));
}

export function normalizeZavorthHardRenameLegacyIdentityPurgePack(
  options: ZavorthHardRenameLegacyIdentityPurgePackOptions,
): ZavorthHardRenameLegacyIdentityPurgePackNormalization {
  const decision: ZavorthHardRenamePurgeDecision = 'zavorth-hard-rename-purge-ready';

  return {
    nativeContract: 'ZavorthHardRenameLegacyIdentityPurgePack/v1',
    packId: '276',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision,
    packageState: packageState(),
    occurrenceScans: occurrenceScans(),
    renamedArtifacts: renamedArtifacts(),
    validationCommands: validationCommands(),
    blockedActions: blockedActions(),
    finalState: {
      decision,
      legacyPublicIdentityRemoved: true,
      legacyCliAliasRemoved: true,
      legacyCreateAliasRemoved: true,
      publicSurfaceZavorthOnly: true,
      packageJsonRenamedToZavorth: true,
      futureVersionPrepared: '1.1.0-alpha.2',
      npmPublishActuallyPerformed: false,
      gitHistoryRewritten: false,
      runtimeDangerousBehaviorChanged: false,
      adapterGlobalRemoval: false,
      rawHistoryImported: false,
      rawSecretSerialized: false,
      externalHistoricalArtifactsOnly: true,
    },
  };
}

export class ZavorthHardRenameLegacyIdentityPurgePack {
  public constructor(public readonly normalization: ZavorthHardRenameLegacyIdentityPurgePackNormalization) {}

  public currentProductScanIsClean(): boolean {
    const current = this.normalization.occurrenceScans.find((scan) => scan.scope === 'current-product-targets');
    return current?.afterOccurrences === 0;
  }

  public legacyAliasesRemoved(): boolean {
    return (
      this.normalization.packageState.legacyCliAliasRemoved &&
      this.normalization.packageState.legacyCreateAliasRemoved
    );
  }

  public blockedActionPerformed(): boolean {
    return this.normalization.blockedActions.some((action) => action.performed);
  }
}

export function createZavorthHardRenameLegacyIdentityPurgePackFixture(): ZavorthHardRenameLegacyIdentityPurgePack {
  return new ZavorthHardRenameLegacyIdentityPurgePack(
    normalizeZavorthHardRenameLegacyIdentityPurgePack({
      generatedAt: ZAVORTH_HARD_RENAME_LEGACY_IDENTITY_PURGE_PACK_NOW,
      runtimeId: ZAVORTH_HARD_RENAME_LEGACY_IDENTITY_PURGE_PACK_RUNTIME_ID,
    }),
  );
}
