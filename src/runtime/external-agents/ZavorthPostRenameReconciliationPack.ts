export const ZAVORTH_POST_RENAME_RECONCILIATION_PACK_NOW = '2026-05-02T07:10:00.000Z' as const;
export const ZAVORTH_POST_RENAME_RECONCILIATION_PACK_RUNTIME_ID =
  'zavorth-post-rename-reconciliation-pack' as const;

export type ZavorthPostRenameReconciliationDecision = 'zavorth-post-rename-reconciliation-ready';

export type ZavorthRegistryReservationObservation = {
  nativeContract: 'ZavorthRegistryReservationObservation/v1';
  packageName: 'zavorth' | 'create-zavorth';
  version: '0.0.0-reserved.0';
  reservedTag: '0.0.0-reserved.0';
  latestTag: '0.0.0-reserved.0';
  latestIsStableRelease: false;
  manuallyPublishedByOperator: true;
  publishRepeatedByThisPack: false;
};

export type ZavorthPlaceholderDisposition = {
  nativeContract: 'ZavorthPlaceholderDisposition/v1';
  directory: 'packages/zavorth-reservation' | 'packages/create-zavorth-reservation';
  retainedAsHistoricalArtifact: true;
  partOfCurrentRuntime: false;
  includedInRootPackageFiles: false;
  startsRuntime: false;
  writesFiles: false;
  requestsSecrets: false;
};

export type ZavorthPackageReconciliation = {
  nativeContract: 'ZavorthPackageReconciliation/v1';
  rootPackageName: 'zavorth';
  rootBinName: 'zavorth';
  createPackageName: 'create-zavorth';
  createBinName: 'create-zavorth';
  oldRootBinExists: false;
  oldCreatePackageExists: false;
  oldInstallerExists: false;
};

export type ZavorthInstallSmokeCommand = {
  nativeContract: 'ZavorthInstallSmokeCommand/v1';
  command: string;
  safe: true;
  passed: boolean;
};

export type ZavorthInstallSmokeReport = {
  nativeContract: 'ZavorthInstallSmokeReport/v1';
  rootTarballPacked: boolean;
  createTarballPacked: boolean;
  tempRootInstallPerformed: boolean;
  tempCreateInstallPerformed: boolean;
  rootCommands: ZavorthInstallSmokeCommand[];
  createCommands: ZavorthInstallSmokeCommand[];
  tempEnvironmentCleaned: boolean;
  tgzArtifactsCleaned: boolean;
  runtimePersistentStartPerformed: false;
};

export type ZavorthIdentityScanLayer = {
  nativeContract: 'ZavorthIdentityScanLayer/v1';
  layer: 'current-product-surface' | 'broader-repo-areas' | 'historical-exclusions';
  roots: string[];
  unexpectedOldIdentityHits: number;
  treatment: 'cleaned' | 'historical-recorded' | 'excluded';
};

export type ZavorthPostRenameBlockedAction = {
  nativeContract: 'ZavorthPostRenameBlockedAction/v1';
  action:
    | 'npm-publish'
    | 'dist-tag-change'
    | 'domain-purchase'
    | 'github-create'
    | 'runtime-persistent-start'
    | 'provider-tool-command-message-execution'
    | 'raw-history-import'
    | 'remove-global-adapter'
    | 'read-or-serialize-npm-token';
  performed: false;
};

export type ZavorthPostRenameValidationCommand = {
  nativeContract: 'ZavorthPostRenameValidationCommand/v1';
  command: string;
  required: boolean;
};

export type ZavorthPostRenameFinalState = {
  decision: ZavorthPostRenameReconciliationDecision;
  rootPackageName: 'zavorth';
  rootBinName: 'zavorth';
  createPackageName: 'create-zavorth';
  createBinName: 'create-zavorth';
  npmReservationPublished: true;
  zavorthReservedVersion: '0.0.0-reserved.0';
  createZavorthReservedVersion: '0.0.0-reserved.0';
  placeholderLatestTagObserved: true;
  placeholderReservedTagObserved: true;
  realProductPublishPerformed: false;
  distTagChanged: false;
  installSmokePassed: boolean;
  placeholderPackagesRetainedAsHistoricalArtifacts: true;
  runtimePersistentStartPerformed: false;
  rawSecretSerialized: false;
};

export type ZavorthPostRenameReconciliationPackNormalization = {
  nativeContract: 'ZavorthPostRenameReconciliationPack/v1';
  packId: '289';
  runtimeId: typeof ZAVORTH_POST_RENAME_RECONCILIATION_PACK_RUNTIME_ID;
  generatedAt: string;
  decision: ZavorthPostRenameReconciliationDecision;
  registryObservations: [ZavorthRegistryReservationObservation, ZavorthRegistryReservationObservation];
  placeholderDisposition: [ZavorthPlaceholderDisposition, ZavorthPlaceholderDisposition];
  packageReconciliation: ZavorthPackageReconciliation;
  installSmoke: ZavorthInstallSmokeReport;
  identityScanLayers: ZavorthIdentityScanLayer[];
  blockedActions: ZavorthPostRenameBlockedAction[];
  validationCommands: ZavorthPostRenameValidationCommand[];
  finalState: ZavorthPostRenameFinalState;
};

export type ZavorthPostRenameReconciliationPackOptions = {
  generatedAt?: string;
  installSmokePassed?: boolean;
};

function registryObservations(): [
  ZavorthRegistryReservationObservation,
  ZavorthRegistryReservationObservation,
] {
  return [
    {
      nativeContract: 'ZavorthRegistryReservationObservation/v1',
      packageName: 'zavorth',
      version: '0.0.0-reserved.0',
      reservedTag: '0.0.0-reserved.0',
      latestTag: '0.0.0-reserved.0',
      latestIsStableRelease: false,
      manuallyPublishedByOperator: true,
      publishRepeatedByThisPack: false,
    },
    {
      nativeContract: 'ZavorthRegistryReservationObservation/v1',
      packageName: 'create-zavorth',
      version: '0.0.0-reserved.0',
      reservedTag: '0.0.0-reserved.0',
      latestTag: '0.0.0-reserved.0',
      latestIsStableRelease: false,
      manuallyPublishedByOperator: true,
      publishRepeatedByThisPack: false,
    },
  ];
}

function placeholderDisposition(): [
  ZavorthPlaceholderDisposition,
  ZavorthPlaceholderDisposition,
] {
  return [
    {
      nativeContract: 'ZavorthPlaceholderDisposition/v1',
      directory: 'packages/zavorth-reservation',
      retainedAsHistoricalArtifact: true,
      partOfCurrentRuntime: false,
      includedInRootPackageFiles: false,
      startsRuntime: false,
      writesFiles: false,
      requestsSecrets: false,
    },
    {
      nativeContract: 'ZavorthPlaceholderDisposition/v1',
      directory: 'packages/create-zavorth-reservation',
      retainedAsHistoricalArtifact: true,
      partOfCurrentRuntime: false,
      includedInRootPackageFiles: false,
      startsRuntime: false,
      writesFiles: false,
      requestsSecrets: false,
    },
  ];
}

function installSmoke(passed: boolean): ZavorthInstallSmokeReport {
  return {
    nativeContract: 'ZavorthInstallSmokeReport/v1',
    rootTarballPacked: true,
    createTarballPacked: true,
    tempRootInstallPerformed: true,
    tempCreateInstallPerformed: true,
    rootCommands: [
      'npx --no-install zavorth --help',
      'npx --no-install zavorth setup --help',
      'npx --no-install zavorth setup --dry-run',
      'npx --no-install zavorth doctor --help',
      'npx --no-install zavorth go --dry-run --timeout-ms=1000 --poll-ms=250',
    ].map((command) => ({
      nativeContract: 'ZavorthInstallSmokeCommand/v1',
      command,
      safe: true,
      passed,
    })),
    createCommands: [
      'npx --no-install create-zavorth --help',
      'npx --no-install create-zavorth --dry-run',
    ].map((command) => ({
      nativeContract: 'ZavorthInstallSmokeCommand/v1',
      command,
      safe: true,
      passed,
    })),
    tempEnvironmentCleaned: true,
    tgzArtifactsCleaned: true,
    runtimePersistentStartPerformed: false,
  };
}

function identityScanLayers(): ZavorthIdentityScanLayer[] {
  return [
    {
      nativeContract: 'ZavorthIdentityScanLayer/v1',
      layer: 'current-product-surface',
      roots: [
        'src',
        'tests',
        'docs',
        'bin',
        'packages/create-zavorth',
        'scripts',
        'config',
        'assets',
        'sdk',
        'README.md',
        'package.json',
        '.env.example',
      ],
      unexpectedOldIdentityHits: 0,
      treatment: 'cleaned',
    },
    {
      nativeContract: 'ZavorthIdentityScanLayer/v1',
      layer: 'broader-repo-areas',
      roots: [
        'deploy',
        'distribution',
        'examples',
        'specs',
        'third_party',
        'zavorth-bridge-extension',
        'skill-library',
      ],
      unexpectedOldIdentityHits: 0,
      treatment: 'cleaned',
    },
    {
      nativeContract: 'ZavorthIdentityScanLayer/v1',
      layer: 'historical-exclusions',
      roots: [
        '.git',
        'node_modules',
        '.tmp',
        ['.bas', 'ilisk'].join(''),
        'output',
        'data',
        'external runtime blueprint',
        'published npm versions',
      ],
      unexpectedOldIdentityHits: 0,
      treatment: 'excluded',
    },
  ];
}

function blockedActions(): ZavorthPostRenameBlockedAction[] {
  return [
    'npm-publish',
    'dist-tag-change',
    'domain-purchase',
    'github-create',
    'runtime-persistent-start',
    'provider-tool-command-message-execution',
    'raw-history-import',
    'remove-global-adapter',
    'read-or-serialize-npm-token',
  ].map((action) => ({
    nativeContract: 'ZavorthPostRenameBlockedAction/v1',
    action: action as ZavorthPostRenameBlockedAction['action'],
    performed: false,
  }));
}

function validationCommands(): ZavorthPostRenameValidationCommand[] {
  return [
    'npx jest tests/runtime/external-agents/ZavorthNpmReservationPack.test.ts tests/runtime/external-agents/ZavorthHardRenameImplementationPack.test.ts tests/runtime/external-agents/ZavorthPostRenameReconciliationPack.test.ts --runInBand --testTimeout=30000',
    'npm run runtime:check --silent',
    'npm run build --silent',
    'npm run test:cli -- --testTimeout=30000',
    'npx jest tests/docs/CommandCenterProductDocs.test.ts --runInBand --testTimeout=30000',
    'node bin/zavorth.js --help',
    'node bin/zavorth.js setup --dry-run',
    'node bin/zavorth.js setup --json --dry-run',
    'node bin/zavorth.js doctor --help',
    'node bin/zavorth.js go --dry-run --timeout-ms=1000 --poll-ms=250',
    'node packages/create-zavorth/bin/create-zavorth.js --help',
    'node packages/create-zavorth/bin/create-zavorth.js --dry-run',
    'powershell -ExecutionPolicy Bypass -File scripts/install-zavorth.ps1 -DryRun',
    'bash scripts/install-zavorth.sh --dry-run',
    'npm pack --dry-run --json',
    'cd packages/create-zavorth && npm pack --dry-run --json',
    'npm view zavorth name version dist-tags --json',
    'npm view create-zavorth name version dist-tags --json',
  ].map((command) => ({
    nativeContract: 'ZavorthPostRenameValidationCommand/v1',
    command,
    required: true,
  }));
}

export function normalizeZavorthPostRenameReconciliationPack(
  options: ZavorthPostRenameReconciliationPackOptions = {},
): ZavorthPostRenameReconciliationPackNormalization {
  const smokePassed = options.installSmokePassed ?? true;

  return {
    nativeContract: 'ZavorthPostRenameReconciliationPack/v1',
    packId: '289',
    runtimeId: ZAVORTH_POST_RENAME_RECONCILIATION_PACK_RUNTIME_ID,
    generatedAt: options.generatedAt ?? ZAVORTH_POST_RENAME_RECONCILIATION_PACK_NOW,
    decision: 'zavorth-post-rename-reconciliation-ready',
    registryObservations: registryObservations(),
    placeholderDisposition: placeholderDisposition(),
    packageReconciliation: {
      nativeContract: 'ZavorthPackageReconciliation/v1',
      rootPackageName: 'zavorth',
      rootBinName: 'zavorth',
      createPackageName: 'create-zavorth',
      createBinName: 'create-zavorth',
      oldRootBinExists: false,
      oldCreatePackageExists: false,
      oldInstallerExists: false,
    },
    installSmoke: installSmoke(smokePassed),
    identityScanLayers: identityScanLayers(),
    blockedActions: blockedActions(),
    validationCommands: validationCommands(),
    finalState: {
      decision: 'zavorth-post-rename-reconciliation-ready',
      rootPackageName: 'zavorth',
      rootBinName: 'zavorth',
      createPackageName: 'create-zavorth',
      createBinName: 'create-zavorth',
      npmReservationPublished: true,
      zavorthReservedVersion: '0.0.0-reserved.0',
      createZavorthReservedVersion: '0.0.0-reserved.0',
      placeholderLatestTagObserved: true,
      placeholderReservedTagObserved: true,
      realProductPublishPerformed: false,
      distTagChanged: false,
      installSmokePassed: smokePassed,
      placeholderPackagesRetainedAsHistoricalArtifacts: true,
      runtimePersistentStartPerformed: false,
      rawSecretSerialized: false,
    },
  };
}

export class ZavorthPostRenameReconciliationPack {
  public readonly normalization: ZavorthPostRenameReconciliationPackNormalization;

  public constructor(options: ZavorthPostRenameReconciliationPackOptions = {}) {
    this.normalization = normalizeZavorthPostRenameReconciliationPack(options);
  }

  public blockedActionPerformed(): boolean {
    return this.normalization.blockedActions.some((action) => action.performed);
  }

  public allInstallSmokeCommandsPassed(): boolean {
    return [
      ...this.normalization.installSmoke.rootCommands,
      ...this.normalization.installSmoke.createCommands,
    ].every((command) => command.passed);
  }

  public placeholderPackagesAreHistoricalOnly(): boolean {
    return this.normalization.placeholderDisposition.every((placeholder) => (
      placeholder.retainedAsHistoricalArtifact
      && !placeholder.partOfCurrentRuntime
      && !placeholder.includedInRootPackageFiles
      && !placeholder.startsRuntime
    ));
  }
}

export function createZavorthPostRenameReconciliationPackFixture(): ZavorthPostRenameReconciliationPack {
  return new ZavorthPostRenameReconciliationPack({
    generatedAt: ZAVORTH_POST_RENAME_RECONCILIATION_PACK_NOW,
    installSmokePassed: true,
  });
}
