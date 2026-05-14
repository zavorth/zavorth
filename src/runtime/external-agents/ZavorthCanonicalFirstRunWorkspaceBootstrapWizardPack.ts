export const ZAVORTH_CANONICAL_FIRST_RUN_WORKSPACE_BOOTSTRAP_WIZARD_PACK_NOW = '2026-05-02T06:10:00.000Z' as const;
export const ZAVORTH_CANONICAL_FIRST_RUN_WORKSPACE_BOOTSTRAP_WIZARD_PACK_RUNTIME_ID =
  'zavorth-canonical-first-run-workspace-bootstrap-wizard-pack' as const;

export type ZavorthFirstRunWizardDecision = 'zavorth-first-run-workspace-bootstrap-ready';

export type ZavorthFirstRunWizardQuestionContract = {
  nativeContract: 'ZavorthFirstRunWizardQuestion/v1';
  id:
    | 'user-display-name'
    | 'agent-display-name'
    | 'tone-preference'
    | 'workspace-root'
    | 'provider-model'
    | 'memory-mode'
    | 'safety-posture'
    | 'summary-confirmation';
  prompt: string;
  required: boolean;
};

export type ZavorthFirstRunWizardPersistenceContract = {
  nativeContract: 'ZavorthFirstRunWizardPersistence/v1';
  storageRootPolicy: 'workspace-local-data-runtime-first-run';
  profilePath: 'data/runtime/first-run/profile.json';
  workspacePath: 'data/runtime/first-run/workspace.json';
  identityPath: 'data/runtime/first-run/identity.json';
  policyPath: 'data/runtime/first-run/policy.json';
  writesSecrets: false;
  writesTokens: false;
  idempotent: true;
};

export type ZavorthFirstRunWizardCliContract = {
  nativeContract: 'ZavorthFirstRunWizardCli/v1';
  entryCommand: 'zavorth setup';
  dryRunCommand: 'zavorth setup --dry-run';
  jsonDryRunCommand: 'zavorth setup --json --dry-run';
  nonInteractiveBehavior: 'safe-hint-no-hang';
  existingProfileBehavior: 'view-update-cancel';
  nextCommands: ['zavorth doctor', 'zavorth go --dry-run', 'zavorth chat'];
};

export type ZavorthFirstRunWizardContextContract = {
  nativeContract: 'ZavorthFirstRunWizardContext/v1';
  reader: 'FirstRunWorkspaceBootstrapProfileService.buildWorkspaceIdentitySnapshot';
  assembler: 'WorkspaceIdentityContextAssembler';
  exposedFields: [
    'userDisplayName',
    'agentDisplayName',
    'tonePreference',
    'workspaceRoot',
    'memoryMode',
    'safetyPosture',
    'providerStatus',
  ];
  startsRuntime: false;
};

export type ZavorthFirstRunWizardBlockedAction = {
  nativeContract: 'ZavorthFirstRunWizardBlockedAction/v1';
  action:
    | 'npm-publish'
    | 'stable-release'
    | 'global-install'
    | 'runtime-persistent-start'
    | 'provider-execution'
    | 'tool-execution'
    | 'message-send'
    | 'raw-history-import'
    | 'raw-secret-serialization'
    | 'external-vendor-code-copy'
    | 'old-public-identity-leak';
  performed: false;
};

export type ZavorthFirstRunWizardValidationCommand = {
  command: string;
  required: boolean;
  purpose: string;
};

export type ZavorthFirstRunWizardFinalState = {
  decision: ZavorthFirstRunWizardDecision;
  firstRunWizardImplemented: true;
  profilePersistenceImplemented: true;
  workspaceIdentityReadable: true;
  dryRunSupported: true;
  nonInteractiveSafe: true;
  npmPublishActuallyPerformed: false;
  stableRelease: false;
  globalInstallPerformed: false;
  runtimePersistentStartPerformed: false;
  providerExecutionPerformed: false;
  toolExecutionPerformed: false;
  messageSendPerformed: false;
  rawImportPerformed: false;
  rawSecretSerialized: false;
  externalVendorCodeCopied: false;
  oldIdentityPublicLeak: false;
};

export type ZavorthCanonicalFirstRunWorkspaceBootstrapWizardPackNormalization = {
  nativeContract: 'ZavorthCanonicalFirstRunWorkspaceBootstrapWizardPack/v1';
  packId: '283';
  runtimeId: typeof ZAVORTH_CANONICAL_FIRST_RUN_WORKSPACE_BOOTSTRAP_WIZARD_PACK_RUNTIME_ID;
  generatedAt: string;
  decision: ZavorthFirstRunWizardDecision;
  questions: ZavorthFirstRunWizardQuestionContract[];
  persistence: ZavorthFirstRunWizardPersistenceContract;
  cli: ZavorthFirstRunWizardCliContract;
  contextIntegration: ZavorthFirstRunWizardContextContract;
  blockedActions: ZavorthFirstRunWizardBlockedAction[];
  validationCommands: ZavorthFirstRunWizardValidationCommand[];
  finalState: ZavorthFirstRunWizardFinalState;
};

export type ZavorthCanonicalFirstRunWorkspaceBootstrapWizardPackOptions = {
  generatedAt?: string;
};

function questions(): ZavorthFirstRunWizardQuestionContract[] {
  return [
    {
      nativeContract: 'ZavorthFirstRunWizardQuestion/v1',
      id: 'user-display-name',
      prompt: 'Como voce quer que eu te chame?',
      required: true,
    },
    {
      nativeContract: 'ZavorthFirstRunWizardQuestion/v1',
      id: 'agent-display-name',
      prompt: 'Que nome voce quer dar ao Zavorth neste workspace?',
      required: true,
    },
    {
      nativeContract: 'ZavorthFirstRunWizardQuestion/v1',
      id: 'tone-preference',
      prompt: 'Qual tom combina melhor com voce?',
      required: true,
    },
    {
      nativeContract: 'ZavorthFirstRunWizardQuestion/v1',
      id: 'workspace-root',
      prompt: 'Qual e o workspace principal?',
      required: true,
    },
    {
      nativeContract: 'ZavorthFirstRunWizardQuestion/v1',
      id: 'provider-model',
      prompt: 'Qual provider/modelo voce quer deixar registrado?',
      required: false,
    },
    {
      nativeContract: 'ZavorthFirstRunWizardQuestion/v1',
      id: 'memory-mode',
      prompt: 'Como a continuidade local deve funcionar?',
      required: true,
    },
    {
      nativeContract: 'ZavorthFirstRunWizardQuestion/v1',
      id: 'safety-posture',
      prompt: 'Qual postura de seguranca deve ser o padrao?',
      required: true,
    },
    {
      nativeContract: 'ZavorthFirstRunWizardQuestion/v1',
      id: 'summary-confirmation',
      prompt: 'Gravar este perfil canonico agora?',
      required: true,
    },
  ];
}

function persistence(): ZavorthFirstRunWizardPersistenceContract {
  return {
    nativeContract: 'ZavorthFirstRunWizardPersistence/v1',
    storageRootPolicy: 'workspace-local-data-runtime-first-run',
    profilePath: 'data/runtime/first-run/profile.json',
    workspacePath: 'data/runtime/first-run/workspace.json',
    identityPath: 'data/runtime/first-run/identity.json',
    policyPath: 'data/runtime/first-run/policy.json',
    writesSecrets: false,
    writesTokens: false,
    idempotent: true,
  };
}

function cli(): ZavorthFirstRunWizardCliContract {
  return {
    nativeContract: 'ZavorthFirstRunWizardCli/v1',
    entryCommand: 'zavorth setup',
    dryRunCommand: 'zavorth setup --dry-run',
    jsonDryRunCommand: 'zavorth setup --json --dry-run',
    nonInteractiveBehavior: 'safe-hint-no-hang',
    existingProfileBehavior: 'view-update-cancel',
    nextCommands: ['zavorth doctor', 'zavorth go --dry-run', 'zavorth chat'],
  };
}

function contextIntegration(): ZavorthFirstRunWizardContextContract {
  return {
    nativeContract: 'ZavorthFirstRunWizardContext/v1',
    reader: 'FirstRunWorkspaceBootstrapProfileService.buildWorkspaceIdentitySnapshot',
    assembler: 'WorkspaceIdentityContextAssembler',
    exposedFields: [
      'userDisplayName',
      'agentDisplayName',
      'tonePreference',
      'workspaceRoot',
      'memoryMode',
      'safetyPosture',
      'providerStatus',
    ],
    startsRuntime: false,
  };
}

function blockedActions(): ZavorthFirstRunWizardBlockedAction[] {
  return [
    'npm-publish',
    'stable-release',
    'global-install',
    'runtime-persistent-start',
    'provider-execution',
    'tool-execution',
    'message-send',
    'raw-history-import',
    'raw-secret-serialization',
    'external-vendor-code-copy',
    'old-public-identity-leak',
  ].map((action) => ({
    nativeContract: 'ZavorthFirstRunWizardBlockedAction/v1',
    action: action as ZavorthFirstRunWizardBlockedAction['action'],
    performed: false,
  }));
}

function validationCommands(): ZavorthFirstRunWizardValidationCommand[] {
  return [
    {
      command: 'npx jest tests/runtime/external-agents/ZavorthCanonicalFirstRunWorkspaceBootstrapWizardPack.test.ts --runInBand --testTimeout=30000',
      required: true,
      purpose: 'focused pack and service contract',
    },
    {
      command: 'npm run test:cli -- --testTimeout=30000',
      required: true,
      purpose: 'CLI setup/help visual regression',
    },
    {
      command: 'npm run runtime:check --silent',
      required: true,
      purpose: 'TypeScript contract check',
    },
    {
      command: 'npm run build --silent',
      required: true,
      purpose: 'dist and dist-ops launcher build',
    },
    {
      command: 'node bin/zavorth.js setup --dry-run',
      required: true,
      purpose: 'safe setup dry-run',
    },
    {
      command: 'node bin/zavorth.js setup --help',
      required: true,
      purpose: 'setup help',
    },
    {
      command: 'node bin/zavorth.js --help',
      required: true,
      purpose: 'root help still works',
    },
  ];
}

function finalState(): ZavorthFirstRunWizardFinalState {
  return {
    decision: 'zavorth-first-run-workspace-bootstrap-ready',
    firstRunWizardImplemented: true,
    profilePersistenceImplemented: true,
    workspaceIdentityReadable: true,
    dryRunSupported: true,
    nonInteractiveSafe: true,
    npmPublishActuallyPerformed: false,
    stableRelease: false,
    globalInstallPerformed: false,
    runtimePersistentStartPerformed: false,
    providerExecutionPerformed: false,
    toolExecutionPerformed: false,
    messageSendPerformed: false,
    rawImportPerformed: false,
    rawSecretSerialized: false,
    externalVendorCodeCopied: false,
    oldIdentityPublicLeak: false,
  };
}

export function normalizeZavorthCanonicalFirstRunWorkspaceBootstrapWizardPack(
  options: ZavorthCanonicalFirstRunWorkspaceBootstrapWizardPackOptions = {},
): ZavorthCanonicalFirstRunWorkspaceBootstrapWizardPackNormalization {
  return {
    nativeContract: 'ZavorthCanonicalFirstRunWorkspaceBootstrapWizardPack/v1',
    packId: '283',
    runtimeId: ZAVORTH_CANONICAL_FIRST_RUN_WORKSPACE_BOOTSTRAP_WIZARD_PACK_RUNTIME_ID,
    generatedAt: options.generatedAt || ZAVORTH_CANONICAL_FIRST_RUN_WORKSPACE_BOOTSTRAP_WIZARD_PACK_NOW,
    decision: 'zavorth-first-run-workspace-bootstrap-ready',
    questions: questions(),
    persistence: persistence(),
    cli: cli(),
    contextIntegration: contextIntegration(),
    blockedActions: blockedActions(),
    validationCommands: validationCommands(),
    finalState: finalState(),
  };
}

export class ZavorthCanonicalFirstRunWorkspaceBootstrapWizardPack {
  public readonly normalization: ZavorthCanonicalFirstRunWorkspaceBootstrapWizardPackNormalization;

  constructor(options: ZavorthCanonicalFirstRunWorkspaceBootstrapWizardPackOptions = {}) {
    this.normalization = normalizeZavorthCanonicalFirstRunWorkspaceBootstrapWizardPack(options);
  }

  public blockedActionPerformed(): boolean {
    return this.normalization.blockedActions.some((action) => action.performed);
  }

  public questionIds(): string[] {
    return this.normalization.questions.map((question) => question.id);
  }

  public profilePaths(): string[] {
    return [
      this.normalization.persistence.profilePath,
      this.normalization.persistence.workspacePath,
      this.normalization.persistence.identityPath,
      this.normalization.persistence.policyPath,
    ];
  }
}

export function createZavorthCanonicalFirstRunWorkspaceBootstrapWizardPackFixture(
  options: ZavorthCanonicalFirstRunWorkspaceBootstrapWizardPackOptions = {},
): ZavorthCanonicalFirstRunWorkspaceBootstrapWizardPack {
  return new ZavorthCanonicalFirstRunWorkspaceBootstrapWizardPack(options);
}
