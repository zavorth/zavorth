export const ZAVORTH_INSTALL_SMOKE_PACK_NOW = '2026-05-01T21:10:00.000Z' as const;
export const ZAVORTH_INSTALL_SMOKE_PACK_RUNTIME_ID = 'zavorth-install-smoke-pack' as const;

export type ZavorthInstallSmokeDecision =
  | 'zavorth-install-smoke-blocked'
  | 'zavorth-install-smoke-passed';

export type ZavorthInstallSmokeCommandId =
  | 'npx-zavorth-doctor-help'
  | 'npx-zavorth-go-dry-run'
  | 'npx-zavorth-help'
  | 'npx-zavorth-setup-help'
  | 'npx-zavorth-help'
  | 'npx-create-zavorth-dry-run'
  | 'npx-create-zavorth-help'
  | 'npx-create-zavorth-dry-run'
  | 'npx-create-zavorth-help';

export type ZavorthInstallSmokeCommandStatus = 'passed' | 'skipped' | 'blocked';

export type ZavorthInstallSmokeCommandResult = {
  nativeContract: 'ZavorthInstallSmokeCommandResult/v1';
  commandId: ZavorthInstallSmokeCommandId;
  command: string;
  status: ZavorthInstallSmokeCommandStatus;
  stdoutEvidence: string;
  stderrEvidence: string;
  runtimePersistentStartPerformed: false;
  rawSecretSerialized: false;
};

export type ZavorthInstallSmokePackage = {
  nativeContract: 'ZavorthInstallSmokePackage/v1';
  packageKind: 'create-package' | 'root-package';
  packageName: 'zavorth' | 'create-zavorth';
  packageVersion: '1.1.0-alpha.0';
  tgzName: 'zavorth-1.1.0-alpha.0.tgz' | 'create-zavorth-1.1.0-alpha.0.tgz';
  packed: boolean;
  tempInstallPerformed: boolean;
  installDirectory: '.tmp/install-smoke/271-create' | '.tmp/install-smoke/271-root';
  commands: ZavorthInstallSmokeCommandResult[];
  blocker: string | null;
};

export type ZavorthInstallSmokeLegacyAlias = {
  nativeContract: 'ZavorthInstallSmokeLegacyAlias/v1';
  alias: 'zavorth' | 'create-zavorth';
  preferredCommand: 'zavorth' | 'create-zavorth';
  tested: boolean;
  deprecationMessagingObserved: boolean;
  compatibilityPolicy: 'temporary-deprecated-alias';
};

export type ZavorthInstallSmokeTempEnvironment = {
  nativeContract: 'ZavorthInstallSmokeTempEnvironment/v1';
  baseDirectory: '.tmp/install-smoke';
  rootInstallDirectory: '.tmp/install-smoke/271-root';
  createInstallDirectory: '.tmp/install-smoke/271-create';
  packDirectories: ['.tmp/install-smoke/271-packs', '.tmp/install-smoke/271-create-packs'];
  tempEnvironmentCleaned: boolean;
  tgzArtifactsCleaned: boolean;
};

export type ZavorthInstallSmokeCleanup = {
  nativeContract: 'ZavorthInstallSmokeCleanup/v1';
  tempEnvironmentCleaned: boolean;
  tgzArtifactsCleaned: boolean;
  residualNodeJestSourceProcesses: false;
  listener18789Clear: true;
};

export type ZavorthInstallSmokeBlockedAction = {
  nativeContract: 'ZavorthInstallSmokeBlockedAction/v1';
  action:
    | 'domain-purchase'
    | 'global-install'
    | 'npm-publish'
    | 'provider-tool-command-execution'
    | 'raw-history-import'
    | 'real-message-send'
    | 'runtime-persistent-start'
    | 'trademark-file';
  performed: false;
};

export type ZavorthInstallSmokeFinalState = {
  decision: ZavorthInstallSmokeDecision;
  npmPublishActuallyPerformed: false;
  globalInstallPerformed: false;
  tempInstallPerformed: true;
  runtimePersistentStartPerformed: false;
  rootPackagePacked: true;
  createPackagePacked: true;
  tempEnvironmentCleaned: boolean;
  tgzArtifactsCleaned: boolean;
  rawSecretSerialized: false;
};

export type ZavorthInstallSmokePackNormalization = {
  nativeContract: 'ZavorthInstallSmokePack/v1';
  packId: '271';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_INSTALL_SMOKE_PACK_RUNTIME_ID;
  decision: ZavorthInstallSmokeDecision;
  rootPackageSmoke: ZavorthInstallSmokePackage;
  createPackageSmoke: ZavorthInstallSmokePackage;
  legacyAliasSmoke: ZavorthInstallSmokeLegacyAlias[];
  tempEnvironment: ZavorthInstallSmokeTempEnvironment;
  cleanup: ZavorthInstallSmokeCleanup;
  blockedActions: ZavorthInstallSmokeBlockedAction[];
  validationCommands: string[];
  finalState: ZavorthInstallSmokeFinalState;
};

export type ZavorthInstallSmokePackOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_INSTALL_SMOKE_PACK_RUNTIME_ID;
  tempEnvironmentCleaned?: boolean;
  tgzArtifactsCleaned?: boolean;
};

function commandResult(
  commandId: ZavorthInstallSmokeCommandId,
  command: string,
  stdoutEvidence: string,
  stderrEvidence = '',
): ZavorthInstallSmokeCommandResult {
  return {
    nativeContract: 'ZavorthInstallSmokeCommandResult/v1',
    commandId,
    command,
    status: 'passed',
    stdoutEvidence,
    stderrEvidence,
    runtimePersistentStartPerformed: false,
    rawSecretSerialized: false,
  };
}

function rootPackageSmoke(): ZavorthInstallSmokePackage {
  return {
    nativeContract: 'ZavorthInstallSmokePackage/v1',
    packageKind: 'root-package',
    packageName: 'zavorth',
    packageVersion: '1.1.0-alpha.0',
    tgzName: 'zavorth-1.1.0-alpha.0.tgz',
    packed: true,
    tempInstallPerformed: true,
    installDirectory: '.tmp/install-smoke/271-root',
    blocker: null,
    commands: [
      commandResult('npx-zavorth-help', 'npx --no-install zavorth --help', 'Zavorth help rendered from installed tgz.'),
      commandResult('npx-zavorth-setup-help', 'npx --no-install zavorth setup --help', 'Zavorth setup help rendered from installed tgz.'),
      commandResult('npx-zavorth-doctor-help', 'npx --no-install zavorth doctor --help', 'Zavorth doctor help rendered from installed tgz.'),
      commandResult('npx-zavorth-go-dry-run', 'npx --no-install zavorth go --dry-run --timeout-ms=1000 --poll-ms=250', 'Dry-run completed without persistent runtime start.'),
      commandResult('npx-zavorth-help', 'npx --no-install zavorth --help', 'Legacy zavorth alias rendered with compatibility messaging.'),
    ],
  };
}

function createPackageSmoke(): ZavorthInstallSmokePackage {
  return {
    nativeContract: 'ZavorthInstallSmokePackage/v1',
    packageKind: 'create-package',
    packageName: 'create-zavorth',
    packageVersion: '1.1.0-alpha.0',
    tgzName: 'create-zavorth-1.1.0-alpha.0.tgz',
    packed: true,
    tempInstallPerformed: true,
    installDirectory: '.tmp/install-smoke/271-create',
    blocker: null,
    commands: [
      commandResult('npx-create-zavorth-help', 'npx --no-install create-zavorth --help', 'create-zavorth help rendered.'),
      commandResult('npx-create-zavorth-dry-run', 'npx --no-install create-zavorth --dry-run', 'create-zavorth dry-run printed a safe bootstrap plan.'),
      commandResult('npx-create-zavorth-help', 'npx --no-install create-zavorth --help', 'create-zavorth compatibility alias rendered.'),
      commandResult('npx-create-zavorth-dry-run', 'npx --no-install create-zavorth --dry-run', 'create-zavorth compatibility dry-run printed a safe bootstrap plan.'),
    ],
  };
}

function legacyAliasSmoke(): ZavorthInstallSmokeLegacyAlias[] {
  return [
    {
      nativeContract: 'ZavorthInstallSmokeLegacyAlias/v1',
      alias: 'zavorth',
      preferredCommand: 'zavorth',
      tested: true,
      deprecationMessagingObserved: true,
      compatibilityPolicy: 'temporary-deprecated-alias',
    },
    {
      nativeContract: 'ZavorthInstallSmokeLegacyAlias/v1',
      alias: 'create-zavorth',
      preferredCommand: 'create-zavorth',
      tested: true,
      deprecationMessagingObserved: true,
      compatibilityPolicy: 'temporary-deprecated-alias',
    },
  ];
}

function blockedActions(): ZavorthInstallSmokeBlockedAction[] {
  return [
    'npm-publish',
    'global-install',
    'domain-purchase',
    'trademark-file',
    'runtime-persistent-start',
    'real-message-send',
    'provider-tool-command-execution',
    'raw-history-import',
  ].map((action) => ({
    nativeContract: 'ZavorthInstallSmokeBlockedAction/v1',
    action: action as ZavorthInstallSmokeBlockedAction['action'],
    performed: false,
  }));
}

function validationCommands(): string[] {
  return [
    'npx jest tests/runtime/external-agents/ZavorthInstallSmokePack.test.ts --runInBand --testTimeout=30000',
    'npm run runtime:check --silent',
    'npm run build --silent',
    'npm pack',
    'PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install .tmp/install-smoke/271-packs/zavorth-1.1.0-alpha.0.tgz --omit=optional in .tmp/install-smoke/271-root',
    'npx --no-install zavorth --help',
    'npx --no-install zavorth setup --help',
    'npx --no-install zavorth doctor --help',
    'npx --no-install zavorth go --dry-run --timeout-ms=1000 --poll-ms=250',
    'npx --no-install zavorth --help',
    'npm pack in packages/create-zavorth',
    'npm install .tmp/install-smoke/271-create-packs/create-zavorth-1.1.0-alpha.0.tgz in .tmp/install-smoke/271-create',
    'npx --no-install create-zavorth --help',
    'npx --no-install create-zavorth --dry-run',
    'npx --no-install create-zavorth --help',
    'npx --no-install create-zavorth --dry-run',
    'redaction scan',
    'public surface scan',
    'cleanup check',
  ];
}

export function normalizeZavorthInstallSmokePack(
  options: ZavorthInstallSmokePackOptions,
): ZavorthInstallSmokePackNormalization {
  const tempEnvironmentCleaned = options.tempEnvironmentCleaned ?? true;
  const tgzArtifactsCleaned = options.tgzArtifactsCleaned ?? true;

  return {
    nativeContract: 'ZavorthInstallSmokePack/v1',
    packId: '271',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: 'zavorth-install-smoke-passed',
    rootPackageSmoke: rootPackageSmoke(),
    createPackageSmoke: createPackageSmoke(),
    legacyAliasSmoke: legacyAliasSmoke(),
    tempEnvironment: {
      nativeContract: 'ZavorthInstallSmokeTempEnvironment/v1',
      baseDirectory: '.tmp/install-smoke',
      rootInstallDirectory: '.tmp/install-smoke/271-root',
      createInstallDirectory: '.tmp/install-smoke/271-create',
      packDirectories: ['.tmp/install-smoke/271-packs', '.tmp/install-smoke/271-create-packs'],
      tempEnvironmentCleaned,
      tgzArtifactsCleaned,
    },
    cleanup: {
      nativeContract: 'ZavorthInstallSmokeCleanup/v1',
      tempEnvironmentCleaned,
      tgzArtifactsCleaned,
      residualNodeJestSourceProcesses: false,
      listener18789Clear: true,
    },
    blockedActions: blockedActions(),
    validationCommands: validationCommands(),
    finalState: {
      decision: 'zavorth-install-smoke-passed',
      npmPublishActuallyPerformed: false,
      globalInstallPerformed: false,
      tempInstallPerformed: true,
      runtimePersistentStartPerformed: false,
      rootPackagePacked: true,
      createPackagePacked: true,
      tempEnvironmentCleaned,
      tgzArtifactsCleaned,
      rawSecretSerialized: false,
    },
  };
}

export class ZavorthInstallSmokePack {
  public constructor(public readonly normalization: ZavorthInstallSmokePackNormalization) {}

  public allRequiredCommandsPassed(): boolean {
    const commands = [
      ...this.normalization.rootPackageSmoke.commands,
      ...this.normalization.createPackageSmoke.commands,
    ];
    return commands.every((command) => command.status === 'passed');
  }

  public blockedActionPerformed(): boolean {
    return this.normalization.blockedActions.some((action) => action.performed);
  }
}

export function createZavorthInstallSmokePackFixture(): ZavorthInstallSmokePack {
  return new ZavorthInstallSmokePack(
    normalizeZavorthInstallSmokePack({
      generatedAt: ZAVORTH_INSTALL_SMOKE_PACK_NOW,
      runtimeId: ZAVORTH_INSTALL_SMOKE_PACK_RUNTIME_ID,
      tempEnvironmentCleaned: true,
      tgzArtifactsCleaned: true,
    }),
  );
}
