export const ZAVORTH_OFFICIAL_INSTALLER_SCRIPT_PACK_NOW = '2026-05-02T03:20:00.000Z' as const;
export const ZAVORTH_OFFICIAL_INSTALLER_SCRIPT_PACK_RUNTIME_ID = 'zavorth-official-installer-script-pack' as const;

export type ZavorthOfficialInstallerDecision =
  | 'zavorth-official-installer-scripts-ready'
  | 'zavorth-official-installer-scripts-blocked';

export type ZavorthInstallerShell = 'powershell' | 'bash';

export type ZavorthInstallerMode = {
  nativeContract: 'ZavorthInstallerMode/v1';
  name: 'dry-run' | 'real-install';
  defaultSafeMode: boolean;
  globalInstallAllowed: boolean;
  command: string;
  mutatesExternalState: boolean;
};

export type ZavorthPrerequisiteCheck = {
  nativeContract: 'ZavorthPrerequisiteCheck/v1';
  command: 'node --version' | 'npm --version';
  required: true;
  failureExitCode: 2;
};

export type ZavorthPostInstallCheck = {
  nativeContract: 'ZavorthPostInstallCheck/v1';
  command: 'zavorth --help' | 'zavorth help doctor';
  safe: true;
  startsPersistentRuntime: false;
  writesSecrets: false;
};

export type ZavorthInstallerDefinition = {
  nativeContract: 'ZavorthInstallerDefinition/v1';
  shell: ZavorthInstallerShell;
  path: string;
  ready: boolean;
  dryRunFlag: '-DryRun' | '--dry-run';
  tagFlag: '-Tag' | '--tag';
  defaultTag: 'latest';
  installCommand: 'npm install -g zavorth@latest';
  prerequisiteChecks: ZavorthPrerequisiteCheck[];
  postInstallChecks: ZavorthPostInstallCheck[];
  realInstallOnlyOutsideDryRun: true;
  hostedCommand: string;
  localDryRunCommand: string;
};

export type ZavorthInstallerDocs = {
  nativeContract: 'ZavorthInstallerDocs/v1';
  publicDocsUpdated: boolean;
  hostedInstallerPrepared: boolean;
  hostedInstallerActuallyDeployed: false;
  powershellHostedFutureCommand: 'irm https://zavorth.dev/install.ps1 | iex';
  bashHostedFutureCommand: 'curl -fsSL https://zavorth.dev/install.sh | bash';
  powershellLocalDryRunCommand: 'powershell -ExecutionPolicy Bypass -File scripts/install-zavorth.ps1 -DryRun';
  bashLocalDryRunCommand: 'bash scripts/install-zavorth.sh --dry-run';
};

export type ZavorthInstallerBlockedAction = {
  nativeContract: 'ZavorthInstallerBlockedAction/v1';
  action:
    | 'dns-config'
    | 'domain-purchase'
    | 'github-release-create'
    | 'global-install-during-tests'
    | 'message-send'
    | 'npm-dist-tag-change'
    | 'npm-publish'
    | 'provider-execution'
    | 'raw-import'
    | 'runtime-persistent-start'
    | 'secret-write'
    | 'tool-command-execution'
    | 'version-change';
  performed: false;
};

export type ZavorthInstallerValidationCommand = {
  nativeContract: 'ZavorthInstallerValidationCommand/v1';
  command: string;
  required: boolean;
  mutatesExternalState: false;
};

export type ZavorthInstallerFinalState = {
  decision: ZavorthOfficialInstallerDecision;
  powershellInstallerReady: boolean;
  bashInstallerReady: boolean;
  hostedInstallerPrepared: boolean;
  hostedInstallerActuallyDeployed: false;
  dryRunSupported: true;
  defaultInstallTag: 'latest';
  globalInstallPerformed: false;
  npmPublishActuallyPerformed: false;
  versionChanged: false;
  distTagChanged: false;
  runtimePersistentStartPerformed: false;
  rawSecretSerialized: false;
};

export type ZavorthOfficialInstallerScriptPackNormalization = {
  nativeContract: 'ZavorthOfficialInstallerScriptPack/v1';
  packId: '280';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_OFFICIAL_INSTALLER_SCRIPT_PACK_RUNTIME_ID;
  decision: ZavorthOfficialInstallerDecision;
  installers: ZavorthInstallerDefinition[];
  powershellInstaller: ZavorthInstallerDefinition;
  bashInstaller: ZavorthInstallerDefinition;
  installModes: ZavorthInstallerMode[];
  dryRunBehavior: {
    nativeContract: 'ZavorthInstallerDryRunBehavior/v1';
    performsGlobalInstall: false;
    startsPersistentRuntime: false;
    writesSecrets: false;
    callsProviderToolCommandOrMessage: false;
    printsPlannedCommands: true;
  };
  prerequisiteChecks: ZavorthPrerequisiteCheck[];
  postInstallChecks: ZavorthPostInstallCheck[];
  docs: ZavorthInstallerDocs;
  blockedActions: ZavorthInstallerBlockedAction[];
  validationCommands: ZavorthInstallerValidationCommand[];
  finalState: ZavorthInstallerFinalState;
};

export type ZavorthOfficialInstallerScriptPackOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_OFFICIAL_INSTALLER_SCRIPT_PACK_RUNTIME_ID;
  decision?: ZavorthOfficialInstallerDecision;
};

function prerequisiteChecks(): ZavorthPrerequisiteCheck[] {
  return [
    {
      nativeContract: 'ZavorthPrerequisiteCheck/v1',
      command: 'node --version',
      required: true,
      failureExitCode: 2,
    },
    {
      nativeContract: 'ZavorthPrerequisiteCheck/v1',
      command: 'npm --version',
      required: true,
      failureExitCode: 2,
    },
  ];
}

function postInstallChecks(): ZavorthPostInstallCheck[] {
  return [
    {
      nativeContract: 'ZavorthPostInstallCheck/v1',
      command: 'zavorth --help',
      safe: true,
      startsPersistentRuntime: false,
      writesSecrets: false,
    },
    {
      nativeContract: 'ZavorthPostInstallCheck/v1',
      command: 'zavorth help doctor',
      safe: true,
      startsPersistentRuntime: false,
      writesSecrets: false,
    },
  ];
}

function installerDefinitions(): ZavorthInstallerDefinition[] {
  const checks = prerequisiteChecks();
  const postChecks = postInstallChecks();
  return [
    {
      nativeContract: 'ZavorthInstallerDefinition/v1',
      shell: 'powershell',
      path: 'scripts/install-zavorth.ps1',
      ready: true,
      dryRunFlag: '-DryRun',
      tagFlag: '-Tag',
      defaultTag: 'latest',
      installCommand: 'npm install -g zavorth@latest',
      prerequisiteChecks: checks,
      postInstallChecks: postChecks,
      realInstallOnlyOutsideDryRun: true,
      hostedCommand: 'irm https://zavorth.dev/install.ps1 | iex',
      localDryRunCommand: 'powershell -ExecutionPolicy Bypass -File scripts/install-zavorth.ps1 -DryRun',
    },
    {
      nativeContract: 'ZavorthInstallerDefinition/v1',
      shell: 'bash',
      path: 'scripts/install-zavorth.sh',
      ready: true,
      dryRunFlag: '--dry-run',
      tagFlag: '--tag',
      defaultTag: 'latest',
      installCommand: 'npm install -g zavorth@latest',
      prerequisiteChecks: checks,
      postInstallChecks: postChecks,
      realInstallOnlyOutsideDryRun: true,
      hostedCommand: 'curl -fsSL https://zavorth.dev/install.sh | bash',
      localDryRunCommand: 'bash scripts/install-zavorth.sh --dry-run',
    },
  ];
}

function installModes(): ZavorthInstallerMode[] {
  return [
    {
      nativeContract: 'ZavorthInstallerMode/v1',
      name: 'dry-run',
      defaultSafeMode: true,
      globalInstallAllowed: false,
      command: 'scripts/install-zavorth.* dry-run',
      mutatesExternalState: false,
    },
    {
      nativeContract: 'ZavorthInstallerMode/v1',
      name: 'real-install',
      defaultSafeMode: false,
      globalInstallAllowed: true,
      command: 'npm install -g zavorth@latest',
      mutatesExternalState: true,
    },
  ];
}

function blockedActions(): ZavorthInstallerBlockedAction[] {
  return [
    'npm-publish',
    'version-change',
    'npm-dist-tag-change',
    'global-install-during-tests',
    'runtime-persistent-start',
    'secret-write',
    'provider-execution',
    'tool-command-execution',
    'message-send',
    'raw-import',
    'domain-purchase',
    'dns-config',
    'github-release-create',
  ].map((action) => ({
    nativeContract: 'ZavorthInstallerBlockedAction/v1',
    action: action as ZavorthInstallerBlockedAction['action'],
    performed: false,
  }));
}

function validationCommands(): ZavorthInstallerValidationCommand[] {
  return [
    'npx jest tests/runtime/external-agents/ZavorthOfficialInstallerScriptPack.test.ts --runInBand --testTimeout=30000',
    'npm run runtime:check --silent',
    'npm run build --silent',
    'powershell -ExecutionPolicy Bypass -File scripts/install-zavorth.ps1 -DryRun',
    'bash scripts/install-zavorth.sh --dry-run',
    'redaction scan',
    'public output scan',
    'cleanup check',
  ].map((command) => ({
    nativeContract: 'ZavorthInstallerValidationCommand/v1',
    command,
    required: true,
    mutatesExternalState: false,
  }));
}

export function normalizeZavorthOfficialInstallerScriptPack(
  options: ZavorthOfficialInstallerScriptPackOptions,
): ZavorthOfficialInstallerScriptPackNormalization {
  const decision = options.decision || 'zavorth-official-installer-scripts-ready';
  const ready = decision === 'zavorth-official-installer-scripts-ready';
  const installers = installerDefinitions();
  return {
    nativeContract: 'ZavorthOfficialInstallerScriptPack/v1',
    packId: '280',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision,
    installers,
    powershellInstaller: installers[0],
    bashInstaller: installers[1],
    installModes: installModes(),
    dryRunBehavior: {
      nativeContract: 'ZavorthInstallerDryRunBehavior/v1',
      performsGlobalInstall: false,
      startsPersistentRuntime: false,
      writesSecrets: false,
      callsProviderToolCommandOrMessage: false,
      printsPlannedCommands: true,
    },
    prerequisiteChecks: prerequisiteChecks(),
    postInstallChecks: postInstallChecks(),
    docs: {
      nativeContract: 'ZavorthInstallerDocs/v1',
      publicDocsUpdated: ready,
      hostedInstallerPrepared: true,
      hostedInstallerActuallyDeployed: false,
      powershellHostedFutureCommand: 'irm https://zavorth.dev/install.ps1 | iex',
      bashHostedFutureCommand: 'curl -fsSL https://zavorth.dev/install.sh | bash',
      powershellLocalDryRunCommand: 'powershell -ExecutionPolicy Bypass -File scripts/install-zavorth.ps1 -DryRun',
      bashLocalDryRunCommand: 'bash scripts/install-zavorth.sh --dry-run',
    },
    blockedActions: blockedActions(),
    validationCommands: validationCommands(),
    finalState: {
      decision,
      powershellInstallerReady: ready,
      bashInstallerReady: ready,
      hostedInstallerPrepared: true,
      hostedInstallerActuallyDeployed: false,
      dryRunSupported: true,
      defaultInstallTag: 'latest',
      globalInstallPerformed: false,
      npmPublishActuallyPerformed: false,
      versionChanged: false,
      distTagChanged: false,
      runtimePersistentStartPerformed: false,
      rawSecretSerialized: false,
    },
  };
}

export class ZavorthOfficialInstallerScriptPack {
  public constructor(public readonly normalization: ZavorthOfficialInstallerScriptPackNormalization) {}

  public allInstallersReady(): boolean {
    return this.normalization.installers.every((installer) => installer.ready && installer.defaultTag === 'latest');
  }

  public blockedActionPerformed(): boolean {
    return this.normalization.blockedActions.some((action) => action.performed);
  }
}

export function createZavorthOfficialInstallerScriptPackFixture(): ZavorthOfficialInstallerScriptPack {
  return new ZavorthOfficialInstallerScriptPack(
    normalizeZavorthOfficialInstallerScriptPack({
      generatedAt: ZAVORTH_OFFICIAL_INSTALLER_SCRIPT_PACK_NOW,
      runtimeId: ZAVORTH_OFFICIAL_INSTALLER_SCRIPT_PACK_RUNTIME_ID,
    }),
  );
}
