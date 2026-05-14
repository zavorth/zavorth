export const ZAVORTH_TERMINAL_PRODUCT_EXPERIENCE_PACK_NOW = '2026-05-02T02:10:00.000Z' as const;
export const ZAVORTH_TERMINAL_PRODUCT_EXPERIENCE_PACK_RUNTIME_ID = 'zavorth-terminal-product-experience-pack' as const;

export type ZavorthTerminalProductExperienceDecision =
  | 'zavorth-terminal-product-experience-ready'
  | 'zavorth-terminal-product-experience-blocked';

export type ZavorthTerminalCommandPolish = {
  nativeContract: 'ZavorthTerminalCommandPolish/v1';
  command: string;
  purpose:
    | 'entry'
    | 'first-run'
    | 'diagnostics'
    | 'launch-dry-run'
    | 'conversation'
    | 'status'
    | 'bootstrap';
  polished: boolean;
  productMessage: string;
  dangerousRuntimeStarted: false;
};

export type ZavorthTerminalVisualLanguage = {
  nativeContract: 'ZavorthTerminalVisualLanguage/v1';
  brand: 'Zavorth';
  asciiSafe: boolean;
  colorOptional: boolean;
  worksWithoutColor: boolean;
  noEmojiRequired: true;
  oldIdentityPublicLeak: false;
};

export type ZavorthTerminalErrorUx = {
  nativeContract: 'ZavorthTerminalErrorUx/v1';
  pattern: 'human-short-error-next-step';
  firstLine: 'what happened';
  secondLine: 'probable cause';
  thirdLine: 'next command';
  stackTraceHiddenByDefault: true;
  debugOptIn: 'ZAVORTH_DEBUG=1';
};

export type ZavorthTerminalBlockedAction = {
  nativeContract: 'ZavorthTerminalBlockedAction/v1';
  action:
    | 'domain-purchase'
    | 'github-org-create'
    | 'global-install'
    | 'message-send'
    | 'npm-publish'
    | 'provider-execution'
    | 'raw-import'
    | 'runtime-persistent-start'
    | 'stable-release'
    | 'tool-command-execution'
    | 'trademark-file';
  performed: false;
};

export type ZavorthTerminalValidationCommand = {
  nativeContract: 'ZavorthTerminalValidationCommand/v1';
  command: string;
  required: boolean;
  mutatesExternalState: false;
};

export type ZavorthTerminalFinalState = {
  decision: ZavorthTerminalProductExperienceDecision;
  terminalProductPolishApplied: boolean;
  publicHelpZavorthOnly: boolean;
  setupHelpPolished: boolean;
  doctorHelpPolished: boolean;
  goDryRunPolished: boolean;
  createPackageHelpPolished: boolean;
  dangerousRuntimeStarted: false;
  npmPublishActuallyPerformed: false;
  stableRelease: false;
  runtimePersistentStartPerformed: false;
  globalInstallPerformed: false;
  providerExecutionPerformed: false;
  toolExecutionPerformed: false;
  messageSendPerformed: false;
  rawImportPerformed: false;
  oldIdentityPublicLeak: false;
  rawSecretSerialized: false;
};

export type ZavorthTerminalProductExperiencePackNormalization = {
  nativeContract: 'ZavorthTerminalProductExperiencePack/v1';
  packId: '278';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_TERMINAL_PRODUCT_EXPERIENCE_PACK_RUNTIME_ID;
  decision: ZavorthTerminalProductExperienceDecision;
  commandPolish: ZavorthTerminalCommandPolish[];
  visualLanguage: ZavorthTerminalVisualLanguage;
  errorUx: ZavorthTerminalErrorUx;
  blockedActions: ZavorthTerminalBlockedAction[];
  validationCommands: ZavorthTerminalValidationCommand[];
  finalState: ZavorthTerminalFinalState;
};

export type ZavorthTerminalProductExperiencePackOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_TERMINAL_PRODUCT_EXPERIENCE_PACK_RUNTIME_ID;
  decision?: ZavorthTerminalProductExperienceDecision;
};

function commandPolish(): ZavorthTerminalCommandPolish[] {
  return [
    {
      nativeContract: 'ZavorthTerminalCommandPolish/v1',
      command: 'zavorth --help',
      purpose: 'entry',
      polished: true,
      productMessage: 'Zavorth is the main product entry with Start, Work, Inspect, and Safety sections.',
      dangerousRuntimeStarted: false,
    },
    {
      nativeContract: 'ZavorthTerminalCommandPolish/v1',
      command: 'zavorth setup --help',
      purpose: 'first-run',
      polished: true,
      productMessage: 'Setup explains first-run checks, provider/model config, SecretRefs, and safe repetition.',
      dangerousRuntimeStarted: false,
    },
    {
      nativeContract: 'ZavorthTerminalCommandPolish/v1',
      command: 'zavorth doctor --help',
      purpose: 'diagnostics',
      polished: true,
      productMessage: 'Doctor is positioned as the safe diagnostic and repair path.',
      dangerousRuntimeStarted: false,
    },
    {
      nativeContract: 'ZavorthTerminalCommandPolish/v1',
      command: 'zavorth go --dry-run --timeout-ms=1000 --poll-ms=250',
      purpose: 'launch-dry-run',
      polished: true,
      productMessage: 'Go dry-run reports a probable cause, the /control destination, and the next command without persistent start.',
      dangerousRuntimeStarted: false,
    },
    {
      nativeContract: 'ZavorthTerminalCommandPolish/v1',
      command: 'zavorth chat --help',
      purpose: 'conversation',
      polished: true,
      productMessage: 'Chat help explains natural-language terminal work without internal prompt noise.',
      dangerousRuntimeStarted: false,
    },
    {
      nativeContract: 'ZavorthTerminalCommandPolish/v1',
      command: 'zavorth status --help',
      purpose: 'status',
      polished: true,
      productMessage: 'Status help describes the local runtime snapshot and next action.',
      dangerousRuntimeStarted: false,
    },
    {
      nativeContract: 'ZavorthTerminalCommandPolish/v1',
      command: 'create-zavorth --help',
      purpose: 'bootstrap',
      polished: true,
      productMessage: 'Create package help explains safe dry-run bootstrap without writes or secrets.',
      dangerousRuntimeStarted: false,
    },
  ];
}

function blockedActions(): ZavorthTerminalBlockedAction[] {
  return [
    'npm-publish',
    'stable-release',
    'global-install',
    'runtime-persistent-start',
    'provider-execution',
    'tool-command-execution',
    'message-send',
    'raw-import',
    'domain-purchase',
    'github-org-create',
    'trademark-file',
  ].map((action) => ({
    nativeContract: 'ZavorthTerminalBlockedAction/v1',
    action: action as ZavorthTerminalBlockedAction['action'],
    performed: false,
  }));
}

function validationCommands(): ZavorthTerminalValidationCommand[] {
  return [
    'npx jest tests/runtime/external-agents/ZavorthTerminalProductExperiencePack.test.ts --runInBand --testTimeout=30000',
    'npm run runtime:check --silent',
    'npm run build --silent',
    'node bin/zavorth.js --help',
    'node bin/zavorth.js setup --help',
    'node bin/zavorth.js doctor --help',
    'node bin/zavorth.js go --dry-run --timeout-ms=1000 --poll-ms=250',
    'node packages/create-zavorth/bin/create-zavorth.js --help',
    'node packages/create-zavorth/bin/create-zavorth.js --dry-run',
    'npm pack --dry-run --json',
    'redaction scan',
    'public output scan',
    'cleanup check',
  ].map((command) => ({
    nativeContract: 'ZavorthTerminalValidationCommand/v1',
    command,
    required: true,
    mutatesExternalState: false,
  }));
}

export function normalizeZavorthTerminalProductExperiencePack(
  options: ZavorthTerminalProductExperiencePackOptions,
): ZavorthTerminalProductExperiencePackNormalization {
  const decision = options.decision || 'zavorth-terminal-product-experience-ready';
  const ready = decision === 'zavorth-terminal-product-experience-ready';
  return {
    nativeContract: 'ZavorthTerminalProductExperiencePack/v1',
    packId: '278',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision,
    commandPolish: commandPolish(),
    visualLanguage: {
      nativeContract: 'ZavorthTerminalVisualLanguage/v1',
      brand: 'Zavorth',
      asciiSafe: true,
      colorOptional: true,
      worksWithoutColor: true,
      noEmojiRequired: true,
      oldIdentityPublicLeak: false,
    },
    errorUx: {
      nativeContract: 'ZavorthTerminalErrorUx/v1',
      pattern: 'human-short-error-next-step',
      firstLine: 'what happened',
      secondLine: 'probable cause',
      thirdLine: 'next command',
      stackTraceHiddenByDefault: true,
      debugOptIn: 'ZAVORTH_DEBUG=1',
    },
    blockedActions: blockedActions(),
    validationCommands: validationCommands(),
    finalState: {
      decision,
      terminalProductPolishApplied: ready,
      publicHelpZavorthOnly: ready,
      setupHelpPolished: ready,
      doctorHelpPolished: ready,
      goDryRunPolished: ready,
      createPackageHelpPolished: ready,
      dangerousRuntimeStarted: false,
      npmPublishActuallyPerformed: false,
      stableRelease: false,
      runtimePersistentStartPerformed: false,
      globalInstallPerformed: false,
      providerExecutionPerformed: false,
      toolExecutionPerformed: false,
      messageSendPerformed: false,
      rawImportPerformed: false,
      oldIdentityPublicLeak: false,
      rawSecretSerialized: false,
    },
  };
}

export class ZavorthTerminalProductExperiencePack {
  public constructor(public readonly normalization: ZavorthTerminalProductExperiencePackNormalization) {}

  public blockedActionPerformed(): boolean {
    return this.normalization.blockedActions.some((action) => action.performed);
  }

  public allRequiredCommandsPolished(): boolean {
    return this.normalization.commandPolish.every((command) => command.polished && !command.dangerousRuntimeStarted);
  }
}

export function createZavorthTerminalProductExperiencePackFixture(): ZavorthTerminalProductExperiencePack {
  return new ZavorthTerminalProductExperiencePack(
    normalizeZavorthTerminalProductExperiencePack({
      generatedAt: ZAVORTH_TERMINAL_PRODUCT_EXPERIENCE_PACK_NOW,
      runtimeId: ZAVORTH_TERMINAL_PRODUCT_EXPERIENCE_PACK_RUNTIME_ID,
    }),
  );
}
