export const ZAVORTH_HARD_RENAME_IMPLEMENTATION_PACK_NOW = '2026-05-02T06:20:00.000Z' as const;
export const ZAVORTH_HARD_RENAME_IMPLEMENTATION_PACK_RUNTIME_ID =
  'zavorth-hard-rename-implementation-pack' as const;

export type ZavorthHardRenameImplementationDecision = 'zavorth-hard-rename-implementation-ready';
export type ZavorthHardRenameLegacyAliasPolicy = 'no-public-alias';

export type ZavorthHardRenameSurface =
  | 'package-distribution'
  | 'bin'
  | 'create-package'
  | 'installer'
  | 'cli-ux'
  | 'runtime-contracts-services'
  | 'docs'
  | 'tests'
  | 'build-artifacts';

export type ZavorthHardRenameArtifact = {
  nativeContract: 'ZavorthHardRenameArtifact/v1';
  surface: ZavorthHardRenameSurface;
  from: string;
  to: string;
  status: 'renamed' | 'updated' | 'removed' | 'prepared';
};

export type ZavorthHardRenameValidationCommand = {
  nativeContract: 'ZavorthHardRenameValidationCommand/v1';
  command: string;
  required: boolean;
  safe: boolean;
};

export type ZavorthHardRenameBlockedAction = {
  nativeContract: 'ZavorthHardRenameBlockedAction/v1';
  action:
    | 'npm-publish'
    | 'dist-tag-change'
    | 'domain-purchase'
    | 'github-create'
    | 'runtime-persistent-start'
    | 'provider-execution'
    | 'tool-command-execution'
    | 'message-send'
    | 'raw-history-import'
    | 'npm-token-read';
  performed: false;
};

export type ZavorthHardRenameImplementationFinalState = {
  decision: ZavorthHardRenameImplementationDecision;
  targetPublicIdentity: 'Zavorth';
  previousPublicIdentity: 'previous-public-identity';
  legacyAliasPolicy: ZavorthHardRenameLegacyAliasPolicy;
  previousCodenameRetained: false;
  previousPublicCompatibilityKept: false;
  rootPackageName: 'zavorth';
  rootBinName: 'zavorth';
  createPackageName: 'create-zavorth';
  createBinName: 'create-zavorth';
  installerRenamed: true;
  publicOutputZavorthOnly: boolean;
  oldIdentityCurrentProductHits: number;
  npmPublishPerformed: false;
  distTagChanged: false;
  runtimePersistentStartPerformed: false;
  rawSecretSerialized: false;
};

export type ZavorthHardRenameImplementationPackNormalization = {
  nativeContract: 'ZavorthHardRenameImplementationPack/v1';
  packId: '288';
  runtimeId: typeof ZAVORTH_HARD_RENAME_IMPLEMENTATION_PACK_RUNTIME_ID;
  generatedAt: string;
  decision: ZavorthHardRenameImplementationDecision;
  targetPublicIdentity: 'Zavorth';
  previousPublicIdentity: 'previous-public-identity';
  githubOrgUrl: 'https://github.com/zavorth';
  npmReservationStatus: 'placeholder-prepared-not-published';
  legacyAliasPolicy: ZavorthHardRenameLegacyAliasPolicy;
  previousCodenameRetained: false;
  previousPublicCompatibilityKept: false;
  rootPackageName: 'zavorth';
  rootBinName: 'zavorth';
  createPackageName: 'create-zavorth';
  createBinName: 'create-zavorth';
  installerRenamed: true;
  publicOutputZavorthOnly: boolean;
  oldIdentityCurrentProductHits: number;
  renamedArtifacts: ZavorthHardRenameArtifact[];
  validationCommands: ZavorthHardRenameValidationCommand[];
  blockedActions: ZavorthHardRenameBlockedAction[];
  finalState: ZavorthHardRenameImplementationFinalState;
};

export type ZavorthHardRenameImplementationPackOptions = {
  generatedAt?: string;
  oldIdentityCurrentProductHits?: number;
};

function renamedArtifacts(): ZavorthHardRenameArtifact[] {
  return [
    {
      nativeContract: 'ZavorthHardRenameArtifact/v1',
      surface: 'package-distribution',
      from: 'previous package and bin identity',
      to: 'package.json:name=zavorth, bin.zavorth',
      status: 'updated',
    },
    {
      nativeContract: 'ZavorthHardRenameArtifact/v1',
      surface: 'bin',
      from: 'previous public bin path',
      to: 'bin/zavorth.js',
      status: 'renamed',
    },
    {
      nativeContract: 'ZavorthHardRenameArtifact/v1',
      surface: 'create-package',
      from: 'previous create package path',
      to: 'packages/create-zavorth',
      status: 'renamed',
    },
    {
      nativeContract: 'ZavorthHardRenameArtifact/v1',
      surface: 'installer',
      from: 'previous installer scripts',
      to: 'scripts/install-zavorth.ps1 and scripts/install-zavorth.sh',
      status: 'renamed',
    },
    {
      nativeContract: 'ZavorthHardRenameArtifact/v1',
      surface: 'cli-ux',
      from: 'previous terminal output and help text',
      to: 'Zavorth terminal output and help text',
      status: 'updated',
    },
    {
      nativeContract: 'ZavorthHardRenameArtifact/v1',
      surface: 'runtime-contracts-services',
      from: 'previous public classes, services, contracts, and pack boundaries',
      to: 'Zavorth* public classes, services, contracts, and pack boundaries',
      status: 'renamed',
    },
    {
      nativeContract: 'ZavorthHardRenameArtifact/v1',
      surface: 'docs',
      from: 'previous public docs and recent handoffs',
      to: 'Zavorth public docs and handoffs',
      status: 'updated',
    },
    {
      nativeContract: 'ZavorthHardRenameArtifact/v1',
      surface: 'tests',
      from: 'previous test names and public output expectations',
      to: 'Zavorth test names and public output expectations',
      status: 'renamed',
    },
    {
      nativeContract: 'ZavorthHardRenameArtifact/v1',
      surface: 'build-artifacts',
      from: 'dist and dist-ops generated from old identity',
      to: 'clean build output generated from Zavorth sources',
      status: 'prepared',
    },
  ];
}

function validationCommands(): ZavorthHardRenameValidationCommand[] {
  return [
    'npx jest tests/runtime/external-agents/ZavorthHardRenameImplementationPack.test.ts --runInBand --testTimeout=30000',
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
  ].map((command) => ({
    nativeContract: 'ZavorthHardRenameValidationCommand/v1',
    command,
    required: true,
    safe: true,
  }));
}

function blockedActions(): ZavorthHardRenameBlockedAction[] {
  return [
    'npm-publish',
    'dist-tag-change',
    'domain-purchase',
    'github-create',
    'runtime-persistent-start',
    'provider-execution',
    'tool-command-execution',
    'message-send',
    'raw-history-import',
    'npm-token-read',
  ].map((action) => ({
    nativeContract: 'ZavorthHardRenameBlockedAction/v1',
    action: action as ZavorthHardRenameBlockedAction['action'],
    performed: false,
  }));
}

export function normalizeZavorthHardRenameImplementationPack(
  options: ZavorthHardRenameImplementationPackOptions = {},
): ZavorthHardRenameImplementationPackNormalization {
  const oldIdentityCurrentProductHits = options.oldIdentityCurrentProductHits ?? 0;

  return {
    nativeContract: 'ZavorthHardRenameImplementationPack/v1',
    packId: '288',
    runtimeId: ZAVORTH_HARD_RENAME_IMPLEMENTATION_PACK_RUNTIME_ID,
    generatedAt: options.generatedAt ?? ZAVORTH_HARD_RENAME_IMPLEMENTATION_PACK_NOW,
    decision: 'zavorth-hard-rename-implementation-ready',
    targetPublicIdentity: 'Zavorth',
    previousPublicIdentity: 'previous-public-identity',
    githubOrgUrl: 'https://github.com/zavorth',
    npmReservationStatus: 'placeholder-prepared-not-published',
    legacyAliasPolicy: 'no-public-alias',
    previousCodenameRetained: false,
    previousPublicCompatibilityKept: false,
    rootPackageName: 'zavorth',
    rootBinName: 'zavorth',
    createPackageName: 'create-zavorth',
    createBinName: 'create-zavorth',
    installerRenamed: true,
    publicOutputZavorthOnly: oldIdentityCurrentProductHits === 0,
    oldIdentityCurrentProductHits,
    renamedArtifacts: renamedArtifacts(),
    validationCommands: validationCommands(),
    blockedActions: blockedActions(),
    finalState: {
      decision: 'zavorth-hard-rename-implementation-ready',
      targetPublicIdentity: 'Zavorth',
      previousPublicIdentity: 'previous-public-identity',
      legacyAliasPolicy: 'no-public-alias',
      previousCodenameRetained: false,
      previousPublicCompatibilityKept: false,
      rootPackageName: 'zavorth',
      rootBinName: 'zavorth',
      createPackageName: 'create-zavorth',
      createBinName: 'create-zavorth',
      installerRenamed: true,
      publicOutputZavorthOnly: oldIdentityCurrentProductHits === 0,
      oldIdentityCurrentProductHits,
      npmPublishPerformed: false,
      distTagChanged: false,
      runtimePersistentStartPerformed: false,
      rawSecretSerialized: false,
    },
  };
}

export class ZavorthHardRenameImplementationPack {
  readonly normalization: ZavorthHardRenameImplementationPackNormalization;

  constructor(options: ZavorthHardRenameImplementationPackOptions = {}) {
    this.normalization = normalizeZavorthHardRenameImplementationPack(options);
  }

  blockedActionPerformed(): boolean {
    return this.normalization.blockedActions.some((action) => action.performed);
  }

  hasLegacyPublicCompatibility(): boolean {
    return this.normalization.previousPublicCompatibilityKept;
  }

  requiredCommands(): string[] {
    return this.normalization.validationCommands.map((command) => command.command);
  }
}

export function createZavorthHardRenameImplementationPackFixture(): ZavorthHardRenameImplementationPack {
  return new ZavorthHardRenameImplementationPack();
}
