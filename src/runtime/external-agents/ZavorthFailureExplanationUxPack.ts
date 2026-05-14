export const ZAVORTH_FAILURE_EXPLANATION_UX_PACK_NOW = '2026-05-02T07:40:00.000Z' as const;
export const ZAVORTH_FAILURE_EXPLANATION_UX_PACK_RUNTIME_ID =
  'zavorth-failure-explanation-ux-pack' as const;

export type ZavorthFailureExplanationUxDecision = 'zavorth-failure-explanation-ux-ready';

export type ZavorthPackFailureKind =
  | 'missing-config'
  | 'runtime-not-running'
  | 'provider-not-configured'
  | 'permission-required'
  | 'policy-blocked'
  | 'timeout'
  | 'invalid-workspace'
  | 'non-interactive-terminal'
  | 'unexpected-error';

export type ZavorthPackFailureCategoryContract = {
  nativeContract: 'ZavorthFailureCategory/v1';
  kind: ZavorthPackFailureKind;
  defaultRecoveryCommand: string;
  routesToDoctor: boolean;
};

export type ZavorthPackFailureRendererContract = {
  nativeContract: 'ZavorthFailureRenderer/v1';
  helper: 'src/cli/ZavorthCliFailureExplanation.ts';
  requiredLines: [
    'Zavorth could not continue',
    'What happened',
    'Likely cause',
    'Next step',
    'Try',
  ];
  hidesStacktraceByDefault: true;
  debugOnlyStacktrace: true;
  redactsSecrets: true;
};

export type ZavorthPackCoveredCommand = {
  nativeContract: 'ZavorthFailureCoveredCommand/v1';
  command: string;
  coverage: 'renderer' | 'dry-run' | 'help' | 'json-dry-run';
  persistentRuntimeStart: false;
};

export type ZavorthFailureExplanationBlockedAction = {
  nativeContract: 'ZavorthFailureExplanationBlockedAction/v1';
  action:
    | 'npm-publish'
    | 'stable-release'
    | 'global-install'
    | 'runtime-persistent-start'
    | 'provider-execution'
    | 'tool-execution'
    | 'message-send'
    | 'raw-import'
    | 'raw-secret-serialization'
    | 'old-public-identity-leak';
  performed: false;
};

export type ZavorthFailureExplanationValidationCommand = {
  command: string;
  required: boolean;
  purpose: string;
};

export type ZavorthFailureExplanationFinalState = {
  decision: ZavorthFailureExplanationUxDecision;
  stacktraceHiddenByDefault: true;
  publicOutputZavorthOnly: true;
  doctorIsRecoveryHub: true;
  setupDryRunStillNoWrite: true;
  runtimePersistentStartPerformed: false;
  npmPublishPerformed: false;
  stableRelease: false;
  globalInstallPerformed: false;
  providerExecutionPerformed: false;
  toolExecutionPerformed: false;
  messageSendPerformed: false;
  rawImportPerformed: false;
  rawSecretSerialized: false;
};

export type ZavorthFailureExplanationUxPackNormalization = {
  nativeContract: 'ZavorthFailureExplanationUxPack/v1';
  packId: '284';
  runtimeId: typeof ZAVORTH_FAILURE_EXPLANATION_UX_PACK_RUNTIME_ID;
  generatedAt: string;
  decision: ZavorthFailureExplanationUxDecision;
  failureCategories: ZavorthPackFailureCategoryContract[];
  renderer: ZavorthPackFailureRendererContract;
  coveredCommands: ZavorthPackCoveredCommand[];
  blockedActions: ZavorthFailureExplanationBlockedAction[];
  validationCommands: ZavorthFailureExplanationValidationCommand[];
  finalState: ZavorthFailureExplanationFinalState;
};

export type ZavorthFailureExplanationUxPackOptions = {
  generatedAt?: string;
};

const CATEGORY_COMMANDS: Record<ZavorthPackFailureKind, string> = {
  'missing-config': 'zavorth setup',
  'runtime-not-running': 'zavorth doctor',
  'provider-not-configured': 'zavorth setup',
  'permission-required': 'zavorth doctor',
  'policy-blocked': 'zavorth doctor',
  timeout: 'zavorth doctor',
  'invalid-workspace': 'zavorth setup --dry-run',
  'non-interactive-terminal': 'zavorth setup --dry-run',
  'unexpected-error': 'zavorth doctor',
};

function failureCategories(): ZavorthPackFailureCategoryContract[] {
  return (Object.keys(CATEGORY_COMMANDS) as ZavorthPackFailureKind[]).map((kind) => ({
    nativeContract: 'ZavorthFailureCategory/v1',
    kind,
    defaultRecoveryCommand: CATEGORY_COMMANDS[kind],
    routesToDoctor: CATEGORY_COMMANDS[kind].includes('doctor'),
  }));
}

function renderer(): ZavorthPackFailureRendererContract {
  return {
    nativeContract: 'ZavorthFailureRenderer/v1',
    helper: 'src/cli/ZavorthCliFailureExplanation.ts',
    requiredLines: [
      'Zavorth could not continue',
      'What happened',
      'Likely cause',
      'Next step',
      'Try',
    ],
    hidesStacktraceByDefault: true,
    debugOnlyStacktrace: true,
    redactsSecrets: true,
  };
}

function coveredCommands(): ZavorthPackCoveredCommand[] {
  return [
    ['zavorth setup --dry-run', 'dry-run'],
    ['zavorth setup --json --dry-run', 'json-dry-run'],
    ['zavorth setup --non-interactive', 'renderer'],
    ['zavorth doctor --help', 'help'],
    ['zavorth go --dry-run --timeout-ms=1000 --poll-ms=250', 'dry-run'],
    ['zavorth chat --help', 'help'],
    ['zavorth status --help', 'help'],
  ].map(([command, coverage]) => ({
    nativeContract: 'ZavorthFailureCoveredCommand/v1',
    command,
    coverage: coverage as ZavorthPackCoveredCommand['coverage'],
    persistentRuntimeStart: false,
  }));
}

function blockedActions(): ZavorthFailureExplanationBlockedAction[] {
  return [
    'npm-publish',
    'stable-release',
    'global-install',
    'runtime-persistent-start',
    'provider-execution',
    'tool-execution',
    'message-send',
    'raw-import',
    'raw-secret-serialization',
    'old-public-identity-leak',
  ].map((action) => ({
    nativeContract: 'ZavorthFailureExplanationBlockedAction/v1',
    action: action as ZavorthFailureExplanationBlockedAction['action'],
    performed: false,
  }));
}

function validationCommands(): ZavorthFailureExplanationValidationCommand[] {
  return [
    {
      command: 'npx jest tests/runtime/external-agents/ZavorthFailureExplanationUxPack.test.ts --runInBand --testTimeout=30000',
      required: true,
      purpose: 'focused pack, builder and renderer contract',
    },
    {
      command: 'npm run runtime:check --silent',
      required: true,
      purpose: 'TypeScript contract check',
    },
    {
      command: 'npm run build --silent',
      required: true,
      purpose: 'compiled CLI and launcher output',
    },
    {
      command: 'npm run test:cli -- --testTimeout=30000',
      required: true,
      purpose: 'CLI regression for help, setup dry-run and go dry-run',
    },
    {
      command: 'npx jest tests/docs/CommandCenterProductDocs.test.ts --runInBand --testTimeout=30000',
      required: true,
      purpose: 'public docs guard',
    },
  ];
}

export function normalizeZavorthFailureExplanationUxPack(
  options: ZavorthFailureExplanationUxPackOptions = {},
): ZavorthFailureExplanationUxPackNormalization {
  return {
    nativeContract: 'ZavorthFailureExplanationUxPack/v1',
    packId: '284',
    runtimeId: ZAVORTH_FAILURE_EXPLANATION_UX_PACK_RUNTIME_ID,
    generatedAt: options.generatedAt || ZAVORTH_FAILURE_EXPLANATION_UX_PACK_NOW,
    decision: 'zavorth-failure-explanation-ux-ready',
    failureCategories: failureCategories(),
    renderer: renderer(),
    coveredCommands: coveredCommands(),
    blockedActions: blockedActions(),
    validationCommands: validationCommands(),
    finalState: {
      decision: 'zavorth-failure-explanation-ux-ready',
      stacktraceHiddenByDefault: true,
      publicOutputZavorthOnly: true,
      doctorIsRecoveryHub: true,
      setupDryRunStillNoWrite: true,
      runtimePersistentStartPerformed: false,
      npmPublishPerformed: false,
      stableRelease: false,
      globalInstallPerformed: false,
      providerExecutionPerformed: false,
      toolExecutionPerformed: false,
      messageSendPerformed: false,
      rawImportPerformed: false,
      rawSecretSerialized: false,
    },
  };
}

export class ZavorthFailureExplanationUxPack {
  public constructor(public readonly normalization: ZavorthFailureExplanationUxPackNormalization) {}

  public failureKinds(): ZavorthPackFailureKind[] {
    return this.normalization.failureCategories.map((category) => category.kind);
  }

  public blockedActionPerformed(): boolean {
    return this.normalization.blockedActions.some((action) => action.performed);
  }

  public doctorIsRecoveryHub(): boolean {
    return this.normalization.failureCategories
      .filter((category) => category.kind !== 'non-interactive-terminal' && category.kind !== 'invalid-workspace')
      .some((category) => category.routesToDoctor);
  }
}

export function createZavorthFailureExplanationUxPackFixture(): ZavorthFailureExplanationUxPack {
  return new ZavorthFailureExplanationUxPack(
    normalizeZavorthFailureExplanationUxPack({
      generatedAt: ZAVORTH_FAILURE_EXPLANATION_UX_PACK_NOW,
    }),
  );
}
