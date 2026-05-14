export const ZAVORTH_NPM_RESERVATION_PACK_NOW = '2026-05-02T05:35:00.000Z' as const;
export const ZAVORTH_NPM_RESERVATION_PACK_RUNTIME_ID = 'zavorth-npm-reservation-pack' as const;

export type ZavorthNpmReservationDecision =
  | 'zavorth-npm-reservation-ready'
  | 'zavorth-npm-reservation-published';

export type ZavorthReservationPlaceholder = {
  nativeContract: 'ZavorthReservationPlaceholder/v1';
  packageName: 'zavorth' | 'create-zavorth';
  version: '0.0.0-reserved.0';
  tag: 'reserved';
  directory: 'packages/zavorth-reservation' | 'packages/create-zavorth-reservation';
  binName: 'zavorth' | 'create-zavorth';
  binPath: 'bin/zavorth.js' | 'bin/create-zavorth.js';
  readmePath: 'README.md';
  repositoryUrl: 'git+https://github.com/zavorth/zavorth.git';
  homepage: 'https://github.com/zavorth';
  startsRuntime: false;
  writesFiles: false;
  requestsSecrets: false;
  performsNetworkCall: false;
  installsDependencies: false;
};

export type ZavorthReservationPublishCommand = {
  nativeContract: 'ZavorthReservationPublishCommand/v1';
  packageName: 'zavorth' | 'create-zavorth';
  command: string;
  prepared: true;
  executed: boolean;
  requiresExplicitOperatorApproval: true;
};

export type ZavorthReservationValidationCommand = {
  nativeContract: 'ZavorthReservationValidationCommand/v1';
  command: string;
  required: boolean;
  purpose: string;
};

export type ZavorthReservationFinalState = {
  decision: ZavorthNpmReservationDecision;
  candidateName: 'Zavorth';
  zavorthPackageName: 'zavorth';
  createZavorthPackageName: 'create-zavorth';
  reservationVersion: '0.0.0-reserved.0';
  reservationTag: 'reserved';
  rootProductRenamePerformed: false;
  activeProductStillZavorth: true;
  zavorthPlaceholderPrepared: true;
  createZavorthPlaceholderPrepared: true;
  zavorthPublishPerformed: boolean;
  createZavorthPublishPerformed: boolean;
  latestTagChanged: false;
  alphaTagChanged: false;
  runtimeStarted: false;
  secretsRequested: false;
  npmTokenRead: false;
  npmTokenSerialized: false;
  externalActionLimitedToApprovedNpmPublish: boolean;
};

export type ZavorthReservationBlockedAction = {
  nativeContract: 'ZavorthReservationBlockedAction/v1';
  action:
    | 'rename-zavorth'
    | 'change-root-package-name'
    | 'change-current-bin'
    | 'change-current-installer'
    | 'publish-zavorth'
    | 'change-latest-tag'
    | 'change-alpha-tag'
    | 'start-runtime'
    | 'execute-provider-tool-command-message'
    | 'read-or-serialize-npm-token'
    | 'write-secrets';
  performed: false;
};

export type ZavorthNpmReservationPackNormalization = {
  nativeContract: 'ZavorthNpmReservationPack/v1';
  packId: '287';
  runtimeId: typeof ZAVORTH_NPM_RESERVATION_PACK_RUNTIME_ID;
  generatedAt: string;
  decision: ZavorthNpmReservationDecision;
  candidateName: 'Zavorth';
  activeProductName: 'Zavorth';
  reservationVersion: '0.0.0-reserved.0';
  reservationTag: 'reserved';
  placeholders: [ZavorthReservationPlaceholder, ZavorthReservationPlaceholder];
  publishCommands: [ZavorthReservationPublishCommand, ZavorthReservationPublishCommand];
  validationCommands: ZavorthReservationValidationCommand[];
  blockedActions: ZavorthReservationBlockedAction[];
  finalState: ZavorthReservationFinalState;
};

export type ZavorthNpmReservationPackOptions = {
  generatedAt?: string;
  publishPerformed?: boolean;
};

function placeholders(): [ZavorthReservationPlaceholder, ZavorthReservationPlaceholder] {
  return [
    {
      nativeContract: 'ZavorthReservationPlaceholder/v1',
      packageName: 'zavorth',
      version: '0.0.0-reserved.0',
      tag: 'reserved',
      directory: 'packages/zavorth-reservation',
      binName: 'zavorth',
      binPath: 'bin/zavorth.js',
      readmePath: 'README.md',
      repositoryUrl: 'git+https://github.com/zavorth/zavorth.git',
      homepage: 'https://github.com/zavorth',
      startsRuntime: false,
      writesFiles: false,
      requestsSecrets: false,
      performsNetworkCall: false,
      installsDependencies: false,
    },
    {
      nativeContract: 'ZavorthReservationPlaceholder/v1',
      packageName: 'create-zavorth',
      version: '0.0.0-reserved.0',
      tag: 'reserved',
      directory: 'packages/create-zavorth-reservation',
      binName: 'create-zavorth',
      binPath: 'bin/create-zavorth.js',
      readmePath: 'README.md',
      repositoryUrl: 'git+https://github.com/zavorth/zavorth.git',
      homepage: 'https://github.com/zavorth',
      startsRuntime: false,
      writesFiles: false,
      requestsSecrets: false,
      performsNetworkCall: false,
      installsDependencies: false,
    },
  ];
}

function publishCommands(publishPerformed: boolean): [ZavorthReservationPublishCommand, ZavorthReservationPublishCommand] {
  return [
    {
      nativeContract: 'ZavorthReservationPublishCommand/v1',
      packageName: 'zavorth',
      command: 'cd packages/zavorth-reservation && npm publish --access public --tag reserved',
      prepared: true,
      executed: publishPerformed,
      requiresExplicitOperatorApproval: true,
    },
    {
      nativeContract: 'ZavorthReservationPublishCommand/v1',
      packageName: 'create-zavorth',
      command: 'cd packages/create-zavorth-reservation && npm publish --access public --tag reserved',
      prepared: true,
      executed: publishPerformed,
      requiresExplicitOperatorApproval: true,
    },
  ];
}

function validationCommands(): ZavorthReservationValidationCommand[] {
  return [
    ['npx jest tests/runtime/external-agents/ZavorthNpmReservationPack.test.ts --runInBand --testTimeout=30000', 'focused reservation pack contract'],
    ['npm run runtime:check --silent', 'TypeScript contract check'],
    ['npm run build --silent', 'ensure current Zavorth build remains intact'],
    ['npm whoami', 'verify operator npm identity without reading tokens'],
    ['npm view zavorth name version dist-tags --json', 'observe reserved package registry state'],
    ['npm view create-zavorth name version dist-tags --json', 'observe reserved create package registry state'],
    ['node packages/zavorth-reservation/bin/zavorth.js', 'placeholder bin smoke'],
    ['node packages/create-zavorth-reservation/bin/create-zavorth.js', 'create placeholder bin smoke'],
    ['cd packages/zavorth-reservation && npm pack --dry-run --json', 'root placeholder package contents'],
    ['cd packages/zavorth-reservation && npm publish --dry-run --access public --tag reserved', 'root placeholder publish dry-run'],
    ['cd packages/create-zavorth-reservation && npm pack --dry-run --json', 'create placeholder package contents'],
    ['cd packages/create-zavorth-reservation && npm publish --dry-run --access public --tag reserved', 'create placeholder publish dry-run'],
  ].map(([command, purpose]) => ({
    nativeContract: 'ZavorthReservationValidationCommand/v1',
    command,
    required: true,
    purpose,
  }));
}

function blockedActions(): ZavorthReservationBlockedAction[] {
  return [
    'rename-zavorth',
    'change-root-package-name',
    'change-current-bin',
    'change-current-installer',
    'publish-zavorth',
    'change-latest-tag',
    'change-alpha-tag',
    'start-runtime',
    'execute-provider-tool-command-message',
    'read-or-serialize-npm-token',
    'write-secrets',
  ].map((action) => ({
    nativeContract: 'ZavorthReservationBlockedAction/v1',
    action: action as ZavorthReservationBlockedAction['action'],
    performed: false,
  }));
}

export function normalizeZavorthNpmReservationPack(
  options: ZavorthNpmReservationPackOptions = {},
): ZavorthNpmReservationPackNormalization {
  const publishPerformed = options.publishPerformed === true;
  return {
    nativeContract: 'ZavorthNpmReservationPack/v1',
    packId: '287',
    runtimeId: ZAVORTH_NPM_RESERVATION_PACK_RUNTIME_ID,
    generatedAt: options.generatedAt || ZAVORTH_NPM_RESERVATION_PACK_NOW,
    decision: publishPerformed ? 'zavorth-npm-reservation-published' : 'zavorth-npm-reservation-ready',
    candidateName: 'Zavorth',
    activeProductName: 'Zavorth',
    reservationVersion: '0.0.0-reserved.0',
    reservationTag: 'reserved',
    placeholders: placeholders(),
    publishCommands: publishCommands(publishPerformed),
    validationCommands: validationCommands(),
    blockedActions: blockedActions(),
    finalState: {
      decision: publishPerformed ? 'zavorth-npm-reservation-published' : 'zavorth-npm-reservation-ready',
      candidateName: 'Zavorth',
      zavorthPackageName: 'zavorth',
      createZavorthPackageName: 'create-zavorth',
      reservationVersion: '0.0.0-reserved.0',
      reservationTag: 'reserved',
      rootProductRenamePerformed: false,
      activeProductStillZavorth: true,
      zavorthPlaceholderPrepared: true,
      createZavorthPlaceholderPrepared: true,
      zavorthPublishPerformed: publishPerformed,
      createZavorthPublishPerformed: publishPerformed,
      latestTagChanged: false,
      alphaTagChanged: false,
      runtimeStarted: false,
      secretsRequested: false,
      npmTokenRead: false,
      npmTokenSerialized: false,
      externalActionLimitedToApprovedNpmPublish: publishPerformed,
    },
  };
}

export class ZavorthNpmReservationPack {
  public constructor(public readonly normalization: ZavorthNpmReservationPackNormalization) {}

  public publishPerformed(): boolean {
    return this.normalization.finalState.zavorthPublishPerformed
      || this.normalization.finalState.createZavorthPublishPerformed;
  }

  public blockedActionPerformed(): boolean {
    return this.normalization.blockedActions.some((action) => action.performed);
  }

  public placeholderPackageNames(): string[] {
    return this.normalization.placeholders.map((placeholder) => placeholder.packageName);
  }
}

export function createZavorthNpmReservationPackFixture(): ZavorthNpmReservationPack {
  return new ZavorthNpmReservationPack(
    normalizeZavorthNpmReservationPack({
      generatedAt: ZAVORTH_NPM_RESERVATION_PACK_NOW,
      publishPerformed: true,
    }),
  );
}
