import {
  createCoordinatedNpmPublishApprovalGateFixture,
} from './CoordinatedNpmPublishApprovalGate.js';
import type {
  CoordinatedNpmPublishApprovalNormalization,
} from './CoordinatedNpmPublishApprovalGate.js';

export const NPM_IDENTITY_AND_PACKAGE_NAME_RESOLUTION_GATE_NOW = '2026-05-01T16:50:00.000Z' as const;
export const NPM_IDENTITY_AND_PACKAGE_NAME_RESOLUTION_GATE_RUNTIME_ID = 'npm-identity-and-package-name-resolution-gate' as const;

export type NpmIdentityState = 'authenticated' | 'not-authenticated' | 'unknown';

export type NpmPackageNameAvailabilityState = 'available' | 'taken' | 'unknown';

export type NpmMaintainerRightsState = 'confirmed' | 'not-confirmed' | 'unknown';

export type NpmPublishNamingStrategyDecision =
  | 'blocked-name-conflict'
  | 'operator-login-required'
  | 'publish-under-public-names'
  | 'publish-under-scope-required';

export type NpmIdentityAndPackageNameResolutionExpectedState =
  | 'createPackageName=create-zavorth'
  | 'createPackageNameAvailability=available'
  | 'finalOperatorApprovalRequired=true'
  | 'npmAuthTokenRead=false'
  | 'npmAuthTokenSerialized=false'
  | 'npmIdentityState=not-authenticated'
  | 'npmLoginAttempted=false'
  | 'npmPublishActuallyPerformed=false'
  | 'packageNameAvailability=taken'
  | 'publishNamingStrategy=operator-login-required'
  | 'rootPackageName=zavorth';

export type NpmPublishOperatorActionId =
  | 'approve-final-publish'
  | 'choose-npm-scope'
  | 'confirm-maintainer-rights'
  | 'npm-login';

export type NpmIdentityCheck = {
  nativeContract: 'NpmIdentityCheck/v1';
  npmWhoamiChecked: true;
  npmIdentityState: NpmIdentityState;
  npmIdentityAvailable: boolean;
  npmWhoamiResult: 'authenticated-redacted' | 'ENEEDAUTH' | 'unknown';
  operatorActionRequired: 'none' | 'npm-login';
  npmAuthTokenRead: false;
  npmAuthTokenSerialized: false;
  npmLoginAttempted: false;
  npmPublishActuallyPerformed: false;
};

export type NpmMaintainerRightsCheck = {
  nativeContract: 'NpmMaintainerRightsCheck/v1';
  packageName: 'zavorth' | 'create-zavorth';
  maintainerRights: NpmMaintainerRightsState;
  checkedBy: 'not-authenticated-cannot-confirm' | 'package-not-found' | 'whoami-cross-check';
  reason: string;
  npmAuthTokenRead: false;
  npmAuthTokenSerialized: false;
};

export type NpmPackageNameAvailability = {
  nativeContract: 'NpmPackageNameAvailability/v1';
  packageKind: 'create' | 'root';
  packageName: 'zavorth' | 'create-zavorth';
  packageNameAvailability: NpmPackageNameAvailabilityState;
  npmViewNameVersionCommand: string;
  npmViewMaintainersCommand: string;
  npmViewResult: 'found' | 'not-found' | 'unknown';
  registryVersion: string | null;
  publicMaintainersObserved: string[];
  maintainerRightsCheck: NpmMaintainerRightsCheck;
};

export type NpmPublishNamingStrategy = {
  nativeContract: 'NpmPublishNamingStrategy/v1';
  publishNamingStrategy: NpmPublishNamingStrategyDecision;
  publishUnderPublicNamesAllowed: boolean;
  publishUnderScopeRequiresOperatorApproval: true;
  scopedPackageNameChangeApplied: false;
  suggestedScopeTemplates: [
    '@<operator-scope>/zavorth',
    '@<operator-scope>/create-zavorth',
  ];
  publicNameCommandsPreparedButNotExecuted: [
    'npm publish --access public --tag alpha',
    'cd packages/create-zavorth && npm publish --access public --tag alpha',
  ];
  scopedNameCommandTemplatesPreparedButNotExecuted: [
    'npm pkg set name=@<scope>/zavorth',
    'npm publish --access public --tag alpha',
    'cd packages/create-zavorth',
    'npm pkg set name=@<scope>/create-zavorth',
    'npm publish --access public --tag alpha',
  ];
  reasons: string[];
  npmPublishActuallyPerformed: false;
  createZavorthPublishActuallyPerformed: false;
  finalOperatorApprovalRequired: true;
};

export type NpmPublishOperatorAction = {
  nativeContract: 'NpmPublishOperatorAction/v1';
  actionId: NpmPublishOperatorActionId;
  required: boolean;
  description: string;
  commandTemplate?: string;
  performedByGate: false;
};

export type NpmIdentityAndPackageNameResolutionExecutionGate = {
  npmIdentityAndPackageNameResolutionGateCreated: true;
  npmPublishActuallyPerformed: false;
  createZavorthPublishActuallyPerformed: false;
  npmAuthTokenRead: false;
  npmAuthTokenSerialized: false;
  npmLoginAttempted: false;
  finalOperatorApprovalRequired: true;
  packageNameChanged: false;
  defaultRuntimeZavorthOwned: true;
  publicExternalExecutorIdentityLeak: false;
  batFilesNotProductPath: true;
  rawImportDefaultDisabled: true;
  limitedProductionSendStillGated: true;
  adapterRemovalGlobalAllowed: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  toolCommandActuallyExecuted: false;
};

export type NpmIdentityAndPackageNameResolutionSource = {
  previous265: CoordinatedNpmPublishApprovalNormalization;
  npmWhoamiChecked: true;
  npmIdentityState: NpmIdentityState;
  npmWhoamiResult: 'authenticated-redacted' | 'ENEEDAUTH' | 'unknown';
  rootPackageName: 'zavorth';
  createPackageName: 'create-zavorth';
  rootPackageNameAvailability: NpmPackageNameAvailabilityState;
  createPackageNameAvailability: NpmPackageNameAvailabilityState;
  rootRegistryVersion: string | null;
  createRegistryVersion: string | null;
  rootMaintainersObserved: string[];
  createMaintainersObserved: string[];
  rootMaintainerRights: NpmMaintainerRightsState;
  createMaintainerRights: NpmMaintainerRightsState;
  npmPublishAttempted: false;
  createZavorthPublishAttempted: false;
  npmAuthTokenRead: false;
  npmAuthTokenSerialized: false;
  npmLoginAttempted: false;
  packageNameChanged: false;
  publicExternalExecutorIdentityExposed: false;
  docsPromoteBatFiles: false;
  rawSqliteImportEnabled: false;
  messageSendAttempted: false;
  providerExecutionAttempted: false;
  toolCommandExecutionAttempted: false;
  adapterGlobalRemovalAttempted: false;
  rawSecretSerialized: false;
};

export type NpmIdentityAndPackageNameResolutionNormalization = {
  nativeContract: 'NpmIdentityAndPackageNameResolutionGate/v1';
  generatedAt: string;
  runtimeId: typeof NPM_IDENTITY_AND_PACKAGE_NAME_RESOLUTION_GATE_RUNTIME_ID;
  expectedStates: NpmIdentityAndPackageNameResolutionExpectedState[];
  npmIdentityCheck: NpmIdentityCheck;
  rootPackageNameAvailability: NpmPackageNameAvailability;
  createPackageNameAvailability: NpmPackageNameAvailability;
  publishNamingStrategy: NpmPublishNamingStrategy;
  operatorActions: NpmPublishOperatorAction[];
  executionGate: NpmIdentityAndPackageNameResolutionExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    npmAuthTokenRead: false;
    npmAuthTokenSerialized: false;
    maintainerEmailCopiedIntoPublicDocs: false;
    receiptsRedacted: true;
  };
  terminalGate: 'diagnostic-only-no-publish';
};

export type NpmIdentityAndPackageNameResolutionOptions = {
  generatedAt: string;
  runtimeId: typeof NPM_IDENTITY_AND_PACKAGE_NAME_RESOLUTION_GATE_RUNTIME_ID;
  source: NpmIdentityAndPackageNameResolutionSource;
};

function expectedStates(): NpmIdentityAndPackageNameResolutionExpectedState[] {
  return [
    'npmPublishActuallyPerformed=false',
    'npmAuthTokenRead=false',
    'npmAuthTokenSerialized=false',
    'npmLoginAttempted=false',
    'npmIdentityState=not-authenticated',
    'rootPackageName=zavorth',
    'createPackageName=create-zavorth',
    'packageNameAvailability=taken',
    'createPackageNameAvailability=available',
    'publishNamingStrategy=operator-login-required',
    'finalOperatorApprovalRequired=true',
  ];
}

function identityCheck(source: NpmIdentityAndPackageNameResolutionSource): NpmIdentityCheck {
  return {
    nativeContract: 'NpmIdentityCheck/v1',
    npmWhoamiChecked: true,
    npmIdentityState: source.npmIdentityState,
    npmIdentityAvailable: source.npmIdentityState === 'authenticated',
    npmWhoamiResult: source.npmWhoamiResult,
    operatorActionRequired: source.npmIdentityState === 'not-authenticated' ? 'npm-login' : 'none',
    npmAuthTokenRead: false,
    npmAuthTokenSerialized: false,
    npmLoginAttempted: false,
    npmPublishActuallyPerformed: false,
  };
}

function maintainerRightsCheck(
  packageName: 'zavorth' | 'create-zavorth',
  availability: NpmPackageNameAvailabilityState,
  maintainerRights: NpmMaintainerRightsState,
  identityState: NpmIdentityState,
): NpmMaintainerRightsCheck {
  if (availability === 'available') {
    return {
      nativeContract: 'NpmMaintainerRightsCheck/v1',
      packageName,
      maintainerRights: 'unknown',
      checkedBy: 'package-not-found',
      reason: 'Package name was not found by npm view; first publish still requires authenticated operator approval.',
      npmAuthTokenRead: false,
      npmAuthTokenSerialized: false,
    };
  }

  return {
    nativeContract: 'NpmMaintainerRightsCheck/v1',
    packageName,
    maintainerRights,
    checkedBy: identityState === 'authenticated' ? 'whoami-cross-check' : 'not-authenticated-cannot-confirm',
    reason: identityState === 'authenticated'
      ? 'Maintainer rights depend on matching the authenticated npm identity with the package maintainer list.'
      : 'npm whoami returned ENEEDAUTH, so maintainer rights cannot be confirmed safely in this gate.',
    npmAuthTokenRead: false,
    npmAuthTokenSerialized: false,
  };
}

function packageAvailability(
  packageKind: 'create' | 'root',
  packageName: 'zavorth' | 'create-zavorth',
  availability: NpmPackageNameAvailabilityState,
  registryVersion: string | null,
  maintainers: string[],
  maintainerRights: NpmMaintainerRightsState,
  identityState: NpmIdentityState,
): NpmPackageNameAvailability {
  return {
    nativeContract: 'NpmPackageNameAvailability/v1',
    packageKind,
    packageName,
    packageNameAvailability: availability,
    npmViewNameVersionCommand: `npm view ${packageName} name version`,
    npmViewMaintainersCommand: `npm view ${packageName} maintainers`,
    npmViewResult: availability === 'available'
      ? 'not-found'
      : availability === 'taken'
        ? 'found'
        : 'unknown',
    registryVersion,
    publicMaintainersObserved: maintainers,
    maintainerRightsCheck: maintainerRightsCheck(packageName, availability, maintainerRights, identityState),
  };
}

function hasProhibitedAttempt(source: NpmIdentityAndPackageNameResolutionSource): boolean {
  return source.npmPublishAttempted ||
    source.createZavorthPublishAttempted ||
    source.npmAuthTokenRead ||
    source.npmAuthTokenSerialized ||
    source.npmLoginAttempted ||
    source.packageNameChanged ||
    source.publicExternalExecutorIdentityExposed ||
    source.docsPromoteBatFiles ||
    source.rawSqliteImportEnabled ||
    source.messageSendAttempted ||
    source.providerExecutionAttempted ||
    source.toolCommandExecutionAttempted ||
    source.adapterGlobalRemovalAttempted ||
    source.rawSecretSerialized;
}

function resolveNamingStrategy(source: NpmIdentityAndPackageNameResolutionSource): NpmPublishNamingStrategyDecision {
  if (source.npmIdentityState === 'not-authenticated' || source.npmIdentityState === 'unknown') {
    return 'operator-login-required';
  }

  const rootPublicNameAllowed = source.rootPackageNameAvailability === 'available' ||
    source.rootMaintainerRights === 'confirmed';
  const createPublicNameAllowed = source.createPackageNameAvailability === 'available' ||
    source.createMaintainerRights === 'confirmed';

  if (rootPublicNameAllowed && createPublicNameAllowed) {
    return 'publish-under-public-names';
  }

  if (source.rootPackageNameAvailability === 'taken' && source.rootMaintainerRights !== 'confirmed') {
    return 'publish-under-scope-required';
  }

  return 'blocked-name-conflict';
}

function namingStrategy(source: NpmIdentityAndPackageNameResolutionSource): NpmPublishNamingStrategy {
  const strategy = hasProhibitedAttempt(source) ? 'blocked-name-conflict' : resolveNamingStrategy(source);
  const reasons: string[] = [];

  if (source.npmIdentityState === 'not-authenticated') {
    reasons.push('npm whoami returned ENEEDAUTH; operator must run npm login before rights can be confirmed.');
  }
  if (source.rootPackageNameAvailability === 'taken' && source.rootMaintainerRights !== 'confirmed') {
    reasons.push('Public npm already has zavorth at 0.3.9; direct public-name publish requires confirmed maintainer rights.');
  }
  if (source.createPackageNameAvailability === 'available') {
    reasons.push('create-zavorth returned 404 from npm view, so the name appears available but still requires authenticated first publish approval.');
  }
  if (strategy === 'publish-under-scope-required') {
    reasons.push('If maintainer rights for zavorth are not available after login, use an explicit approved npm scope instead of changing package.json automatically.');
  }
  if (hasProhibitedAttempt(source)) {
    reasons.push('A prohibited publish/auth/package-name/runtime action was detected; gate cannot authorize publish.');
  }

  return {
    nativeContract: 'NpmPublishNamingStrategy/v1',
    publishNamingStrategy: strategy,
    publishUnderPublicNamesAllowed: strategy === 'publish-under-public-names',
    publishUnderScopeRequiresOperatorApproval: true,
    scopedPackageNameChangeApplied: false,
    suggestedScopeTemplates: [
      '@<operator-scope>/zavorth',
      '@<operator-scope>/create-zavorth',
    ],
    publicNameCommandsPreparedButNotExecuted: [
      'npm publish --access public --tag alpha',
      'cd packages/create-zavorth && npm publish --access public --tag alpha',
    ],
    scopedNameCommandTemplatesPreparedButNotExecuted: [
      'npm pkg set name=@<scope>/zavorth',
      'npm publish --access public --tag alpha',
      'cd packages/create-zavorth',
      'npm pkg set name=@<scope>/create-zavorth',
      'npm publish --access public --tag alpha',
    ],
    reasons,
    npmPublishActuallyPerformed: false,
    createZavorthPublishActuallyPerformed: false,
    finalOperatorApprovalRequired: true,
  };
}

function operatorActions(source: NpmIdentityAndPackageNameResolutionSource): NpmPublishOperatorAction[] {
  return [
    {
      nativeContract: 'NpmPublishOperatorAction/v1',
      actionId: 'npm-login',
      required: source.npmIdentityState !== 'authenticated',
      description: 'Operator authenticates locally with npm; this gate does not request, read, or store tokens.',
      commandTemplate: 'npm login',
      performedByGate: false,
    },
    {
      nativeContract: 'NpmPublishOperatorAction/v1',
      actionId: 'confirm-maintainer-rights',
      required: source.rootPackageNameAvailability === 'taken' && source.rootMaintainerRights !== 'confirmed',
      description: 'Operator confirms maintainer rights for the existing public zavorth package before direct public-name publish.',
      performedByGate: false,
    },
    {
      nativeContract: 'NpmPublishOperatorAction/v1',
      actionId: 'choose-npm-scope',
      required: source.rootPackageNameAvailability === 'taken' && source.rootMaintainerRights !== 'confirmed',
      description: 'If maintainer rights are unavailable, operator chooses an explicit approved npm scope before any package name change.',
      commandTemplate: 'npm pkg set name=@<scope>/zavorth',
      performedByGate: false,
    },
    {
      nativeContract: 'NpmPublishOperatorAction/v1',
      actionId: 'approve-final-publish',
      required: true,
      description: 'Operator gives explicit final approval after identity, naming, and package dry-runs are green.',
      performedByGate: false,
    },
  ];
}

function executionGate(): NpmIdentityAndPackageNameResolutionExecutionGate {
  return {
    npmIdentityAndPackageNameResolutionGateCreated: true,
    npmPublishActuallyPerformed: false,
    createZavorthPublishActuallyPerformed: false,
    npmAuthTokenRead: false,
    npmAuthTokenSerialized: false,
    npmLoginAttempted: false,
    finalOperatorApprovalRequired: true,
    packageNameChanged: false,
    defaultRuntimeZavorthOwned: true,
    publicExternalExecutorIdentityLeak: false,
    batFilesNotProductPath: true,
    rawImportDefaultDisabled: true,
    limitedProductionSendStillGated: true,
    adapterRemovalGlobalAllowed: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    toolCommandActuallyExecuted: false,
  };
}

export class NpmIdentityAndPackageNameResolutionGate {
  public constructor(public readonly normalization: NpmIdentityAndPackageNameResolutionNormalization) {}

  public expectedState(state: NpmIdentityAndPackageNameResolutionExpectedState): boolean {
    return this.normalization.expectedStates.includes(state);
  }

  public publishAllowed(): boolean {
    return false;
  }
}

export function createNpmIdentityAndPackageNameResolutionSource(
  overrides: Partial<NpmIdentityAndPackageNameResolutionSource> = {},
): NpmIdentityAndPackageNameResolutionSource {
  return {
    previous265: createCoordinatedNpmPublishApprovalGateFixture().normalization,
    npmWhoamiChecked: true,
    npmIdentityState: 'not-authenticated',
    npmWhoamiResult: 'ENEEDAUTH',
    rootPackageName: 'zavorth',
    createPackageName: 'create-zavorth',
    rootPackageNameAvailability: 'taken',
    createPackageNameAvailability: 'available',
    rootRegistryVersion: '0.3.9',
    createRegistryVersion: null,
    rootMaintainersObserved: ['shuttlebrad <public npm maintainer; email not copied>'],
    createMaintainersObserved: [],
    rootMaintainerRights: 'unknown',
    createMaintainerRights: 'unknown',
    npmPublishAttempted: false,
    createZavorthPublishAttempted: false,
    npmAuthTokenRead: false,
    npmAuthTokenSerialized: false,
    npmLoginAttempted: false,
    packageNameChanged: false,
    publicExternalExecutorIdentityExposed: false,
    docsPromoteBatFiles: false,
    rawSqliteImportEnabled: false,
    messageSendAttempted: false,
    providerExecutionAttempted: false,
    toolCommandExecutionAttempted: false,
    adapterGlobalRemovalAttempted: false,
    rawSecretSerialized: false,
    ...overrides,
  };
}

export function normalizeNpmIdentityAndPackageNameResolutionGate(
  options: NpmIdentityAndPackageNameResolutionOptions,
): NpmIdentityAndPackageNameResolutionNormalization {
  const source = options.source;

  return {
    nativeContract: 'NpmIdentityAndPackageNameResolutionGate/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    expectedStates: expectedStates(),
    npmIdentityCheck: identityCheck(source),
    rootPackageNameAvailability: packageAvailability(
      'root',
      'zavorth',
      source.rootPackageNameAvailability,
      source.rootRegistryVersion,
      source.rootMaintainersObserved,
      source.rootMaintainerRights,
      source.npmIdentityState,
    ),
    createPackageNameAvailability: packageAvailability(
      'create',
      'create-zavorth',
      source.createPackageNameAvailability,
      source.createRegistryVersion,
      source.createMaintainersObserved,
      source.createMaintainerRights,
      source.npmIdentityState,
    ),
    publishNamingStrategy: namingStrategy(source),
    operatorActions: operatorActions(source),
    executionGate: executionGate(),
    redaction: {
      rawSecretSerialized: false,
      npmAuthTokenRead: false,
      npmAuthTokenSerialized: false,
      maintainerEmailCopiedIntoPublicDocs: false,
      receiptsRedacted: true,
    },
    terminalGate: 'diagnostic-only-no-publish',
  };
}

export function createNpmIdentityAndPackageNameResolutionGateFixture(
  overrides: Partial<NpmIdentityAndPackageNameResolutionSource> = {},
): NpmIdentityAndPackageNameResolutionGate {
  return new NpmIdentityAndPackageNameResolutionGate(
    normalizeNpmIdentityAndPackageNameResolutionGate({
      generatedAt: NPM_IDENTITY_AND_PACKAGE_NAME_RESOLUTION_GATE_NOW,
      runtimeId: NPM_IDENTITY_AND_PACKAGE_NAME_RESOLUTION_GATE_RUNTIME_ID,
      source: createNpmIdentityAndPackageNameResolutionSource(overrides),
    }),
  );
}
