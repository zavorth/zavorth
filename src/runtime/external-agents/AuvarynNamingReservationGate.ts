export const AUVARYN_NAMING_RESERVATION_GATE_NOW = '2026-05-01T18:20:00.000Z' as const;
export const AUVARYN_NAMING_RESERVATION_GATE_RUNTIME_ID = 'auvaryn-naming-reservation-gate' as const;

export type NamingAvailabilityState = 'available' | 'taken' | 'unknown';

export type NamingReservationDecisionState =
  | 'auvaryn-approved-for-rename-planning'
  | 'auvaryn-blocked'
  | 'auvaryn-needs-manual-reservation'
  | 'auvaryn-unknown';

export type NamingRiskLevel = 'high' | 'low' | 'medium' | 'unknown';

export type DomainCheckState =
  | 'activeDnsFound'
  | 'noActiveDnsFound'
  | 'registrarCheckRequired'
  | 'unknown';

export type AuvarynNamingExpectedState =
  | 'candidateProductName=Auvaryn'
  | 'currentProductName=Zavorth'
  | 'domainPurchaseActuallyPerformed=false'
  | 'finalOperatorApprovalRequired=true'
  | 'githubOrgCreated=false'
  | 'npmPublishActuallyPerformed=false'
  | 'packageRenameActuallyPerformed=false'
  | 'productRenameActuallyPerformed=false'
  | 'trademarkFiled=false';

export type NamingManualActionId =
  | 'confirm-trademark-clearance'
  | 'create-github-org-or-repo'
  | 'decide-domain-reservation'
  | 'decide-npm-placeholder'
  | 'review-avaryn-adjacent-conflict';

export type NamingNpmAvailability = {
  nativeContract: 'NamingNpmAvailability/v1';
  packageName: 'auvaryn' | 'create-auvaryn';
  npmViewCommand: string;
  npmSearchCommand: string;
  availability: NamingAvailabilityState;
  exactNpmSearchMatches: number;
  npmViewResult: '404-not-found' | 'found' | 'unknown';
  conflicts: string[];
};

export type NamingGithubAvailability = {
  nativeContract: 'NamingGithubAvailability/v1';
  githubOrgOrUserAvailability: NamingAvailabilityState;
  githubGreyvritraRepoAvailability: NamingAvailabilityState;
  userUrl: 'https://github.com/auvaryn';
  repoUrl: 'https://github.com/greyvritra/auvaryn';
  repositorySearchResults: number;
  userSearchResults: number;
  githubConflicts: string[];
  githubOrgCreated: false;
  githubRepoCreated: false;
};

export type NamingDomainAvailability = {
  nativeContract: 'NamingDomainAvailability/v1';
  primaryDomains: Array<{
    domain: 'auvaryn.app' | 'auvaryn.com' | 'auvaryn.dev' | 'auvaryn.run';
    dnsState: DomainCheckState;
    rdapState: 'not-found-or-no-rdap' | 'unknown-or-error';
    note: 'dns-empty-is-not-availability-proof';
  }>;
  secondaryDomains: Array<{
    domain: 'auvaryn.io' | 'auvaryn.sh' | 'auvaryn.tech' | 'getauvaryn.com' | 'useauvaryn.com';
    dnsState: DomainCheckState;
    rdapState: 'not-found-or-no-rdap' | 'unknown-or-error';
    note: 'dns-empty-is-not-availability-proof';
  }>;
  registrarCheckRequired: true;
  domainPurchaseActuallyPerformed: false;
  domainRisk: NamingRiskLevel;
  domainConflicts: string[];
};

export type NamingTrademarkRisk = {
  nativeContract: 'NamingTrademarkRisk/v1';
  trademarkSearchPerformed: true;
  searchedTerms: ['Auvaryn', 'AUVARYN'];
  trademarkRisk: NamingRiskLevel;
  notableTrademarkSignals: string[];
  trademarkDisclaimer: 'not legal advice; official/legal clearance still required';
  trademarkFiled: false;
};

export type NamingCandidateAvailability = {
  nativeContract: 'NamingCandidateAvailability/v1';
  currentProductName: 'Zavorth';
  candidateProductName: 'Auvaryn';
  candidateSlug: 'auvaryn';
  candidateCreatePackageName: 'create-auvaryn';
  npmAuvarynAvailability: NamingAvailabilityState;
  npmCreateAuvarynAvailability: NamingAvailabilityState;
  githubOrgOrUserAvailability: NamingAvailabilityState;
  githubGreyvritraRepoAvailability: NamingAvailabilityState;
  cliCommandCollision: false | true | 'unknown';
  generalSearchRisk: NamingRiskLevel;
  ecosystemRegistryRisk: NamingRiskLevel;
  devMarketplaceRisk: NamingRiskLevel;
  notableConflicts: string[];
};

export type NamingReservationDecision = {
  nativeContract: 'NamingReservationDecision/v1';
  decision: NamingReservationDecisionState;
  rationale: string[];
  nextRecommendedPack: '268-auvaryn-product-rename-planning-pack';
  productRenameActuallyPerformed: false;
  packageRenameActuallyPerformed: false;
  npmPublishActuallyPerformed: false;
  finalOperatorApprovalRequired: true;
};

export type NamingManualAction = {
  nativeContract: 'NamingManualAction/v1';
  actionId: NamingManualActionId;
  requiredBeforeRename: boolean;
  description: string;
  performedByGate: false;
};

export type AuvarynNamingReservationExecutionGate = {
  auvarynNamingReservationGateCreated: true;
  currentProductName: 'Zavorth';
  candidateProductName: 'Auvaryn';
  productRenameActuallyPerformed: false;
  packageRenameActuallyPerformed: false;
  npmPublishActuallyPerformed: false;
  domainPurchaseActuallyPerformed: false;
  githubOrgCreated: false;
  trademarkFiled: false;
  finalOperatorApprovalRequired: true;
  packageJsonRenamedToAuvaryn: false;
  cliRenamedToAuvaryn: false;
  npmLoginAttempted: false;
  credentialsSaved: false;
  rawSecretSerialized: false;
  publicExternalExecutorIdentityLeak: false;
  batFilesNotProductPath: true;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  toolCommandActuallyExecuted: false;
  rawSqliteImportEnabled: false;
  adapterRemovalGlobalAllowed: false;
};

export type AuvarynNamingReservationSource = {
  npmAuvarynAvailability: NamingAvailabilityState;
  npmCreateAuvarynAvailability: NamingAvailabilityState;
  npmAuvarynExactMatches: number;
  npmCreateAuvarynExactMatches: number;
  npmConflicts: string[];
  githubOrgOrUserAvailability: NamingAvailabilityState;
  githubGreyvritraRepoAvailability: NamingAvailabilityState;
  githubRepositorySearchResults: number;
  githubUserSearchResults: number;
  githubConflicts: string[];
  domainConflicts: string[];
  generalSearchRisk: NamingRiskLevel;
  notableConflicts: string[];
  ecosystemRegistryRisk: NamingRiskLevel;
  ecosystemConflicts: string[];
  devMarketplaceRisk: NamingRiskLevel;
  devMarketplaceConflicts: string[];
  trademarkRisk: NamingRiskLevel;
  notableTrademarkSignals: string[];
  cliCommandCollision: false | true | 'unknown';
  productRenameAttempted: false;
  packageRenameAttempted: false;
  npmPublishAttempted: false;
  domainPurchaseAttempted: false;
  githubOrgCreateAttempted: false;
  trademarkFiledAttempted: false;
  npmLoginAttempted: false;
  credentialsSaved: false;
  publicExternalExecutorIdentityExposed: false;
  docsPromoteBatFiles: false;
  messageSendAttempted: false;
  providerExecutionAttempted: false;
  toolCommandExecutionAttempted: false;
  rawSqliteImportEnabled: false;
  adapterGlobalRemovalAttempted: false;
  rawSecretSerialized: false;
};

export type AuvarynNamingReservationNormalization = {
  nativeContract: 'AuvarynNamingReservationGate/v1';
  generatedAt: string;
  runtimeId: typeof AUVARYN_NAMING_RESERVATION_GATE_RUNTIME_ID;
  expectedStates: AuvarynNamingExpectedState[];
  candidateAvailability: NamingCandidateAvailability;
  npmAvailability: [NamingNpmAvailability, NamingNpmAvailability];
  githubAvailability: NamingGithubAvailability;
  domainAvailability: NamingDomainAvailability;
  trademarkRisk: NamingTrademarkRisk;
  decision: NamingReservationDecision;
  manualActions: NamingManualAction[];
  executionGate: AuvarynNamingReservationExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    credentialsSerialized: false;
    paidReservationReceiptSerialized: false;
    receiptsRedacted: true;
  };
  terminalGate: 'decision-only-no-rename-no-reservation';
};

export type AuvarynNamingReservationOptions = {
  generatedAt: string;
  runtimeId: typeof AUVARYN_NAMING_RESERVATION_GATE_RUNTIME_ID;
  source: AuvarynNamingReservationSource;
};

function expectedStates(): AuvarynNamingExpectedState[] {
  return [
    'currentProductName=Zavorth',
    'candidateProductName=Auvaryn',
    'productRenameActuallyPerformed=false',
    'packageRenameActuallyPerformed=false',
    'npmPublishActuallyPerformed=false',
    'domainPurchaseActuallyPerformed=false',
    'githubOrgCreated=false',
    'trademarkFiled=false',
    'finalOperatorApprovalRequired=true',
  ];
}

function npmAvailability(source: AuvarynNamingReservationSource): [NamingNpmAvailability, NamingNpmAvailability] {
  return [
    {
      nativeContract: 'NamingNpmAvailability/v1',
      packageName: 'auvaryn',
      npmViewCommand: 'npm view auvaryn name version',
      npmSearchCommand: 'npm search auvaryn',
      availability: source.npmAuvarynAvailability,
      exactNpmSearchMatches: source.npmAuvarynExactMatches,
      npmViewResult: source.npmAuvarynAvailability === 'available' ? '404-not-found' : 'unknown',
      conflicts: source.npmConflicts,
    },
    {
      nativeContract: 'NamingNpmAvailability/v1',
      packageName: 'create-auvaryn',
      npmViewCommand: 'npm view create-auvaryn name version',
      npmSearchCommand: 'npm search create-auvaryn',
      availability: source.npmCreateAuvarynAvailability,
      exactNpmSearchMatches: source.npmCreateAuvarynExactMatches,
      npmViewResult: source.npmCreateAuvarynAvailability === 'available' ? '404-not-found' : 'unknown',
      conflicts: source.npmConflicts,
    },
  ];
}

function githubAvailability(source: AuvarynNamingReservationSource): NamingGithubAvailability {
  return {
    nativeContract: 'NamingGithubAvailability/v1',
    githubOrgOrUserAvailability: source.githubOrgOrUserAvailability,
    githubGreyvritraRepoAvailability: source.githubGreyvritraRepoAvailability,
    userUrl: 'https://github.com/auvaryn',
    repoUrl: 'https://github.com/greyvritra/auvaryn',
    repositorySearchResults: source.githubRepositorySearchResults,
    userSearchResults: source.githubUserSearchResults,
    githubConflicts: source.githubConflicts,
    githubOrgCreated: false,
    githubRepoCreated: false,
  };
}

function domainAvailability(source: AuvarynNamingReservationSource): NamingDomainAvailability {
  const primaryDomains: NamingDomainAvailability['primaryDomains'] = [
    'auvaryn.dev',
    'auvaryn.run',
    'auvaryn.app',
    'auvaryn.com',
  ].map((domain) => ({
    domain: domain as NamingDomainAvailability['primaryDomains'][number]['domain'],
    dnsState: 'noActiveDnsFound',
    rdapState: 'not-found-or-no-rdap',
    note: 'dns-empty-is-not-availability-proof',
  }));

  const secondaryDomains: NamingDomainAvailability['secondaryDomains'] = [
    'auvaryn.io',
    'auvaryn.tech',
    'auvaryn.sh',
    'getauvaryn.com',
    'useauvaryn.com',
  ].map((domain) => ({
    domain: domain as NamingDomainAvailability['secondaryDomains'][number]['domain'],
    dnsState: 'noActiveDnsFound',
    rdapState: domain === 'auvaryn.tech' || domain === 'useauvaryn.com'
      ? 'unknown-or-error'
      : 'not-found-or-no-rdap',
    note: 'dns-empty-is-not-availability-proof',
  }));

  return {
    nativeContract: 'NamingDomainAvailability/v1',
    primaryDomains,
    secondaryDomains,
    registrarCheckRequired: true,
    domainPurchaseActuallyPerformed: false,
    domainRisk: source.domainConflicts.length > 0 ? 'medium' : 'unknown',
    domainConflicts: source.domainConflicts,
  };
}

function candidateAvailability(source: AuvarynNamingReservationSource): NamingCandidateAvailability {
  return {
    nativeContract: 'NamingCandidateAvailability/v1',
    currentProductName: 'Zavorth',
    candidateProductName: 'Auvaryn',
    candidateSlug: 'auvaryn',
    candidateCreatePackageName: 'create-auvaryn',
    npmAuvarynAvailability: source.npmAuvarynAvailability,
    npmCreateAuvarynAvailability: source.npmCreateAuvarynAvailability,
    githubOrgOrUserAvailability: source.githubOrgOrUserAvailability,
    githubGreyvritraRepoAvailability: source.githubGreyvritraRepoAvailability,
    cliCommandCollision: source.cliCommandCollision,
    generalSearchRisk: source.generalSearchRisk,
    ecosystemRegistryRisk: source.ecosystemRegistryRisk,
    devMarketplaceRisk: source.devMarketplaceRisk,
    notableConflicts: source.notableConflicts,
  };
}

function trademarkRisk(source: AuvarynNamingReservationSource): NamingTrademarkRisk {
  return {
    nativeContract: 'NamingTrademarkRisk/v1',
    trademarkSearchPerformed: true,
    searchedTerms: ['Auvaryn', 'AUVARYN'],
    trademarkRisk: source.trademarkRisk,
    notableTrademarkSignals: source.notableTrademarkSignals,
    trademarkDisclaimer: 'not legal advice; official/legal clearance still required',
    trademarkFiled: false,
  };
}

function hasProhibitedAttempt(source: AuvarynNamingReservationSource): boolean {
  return source.productRenameAttempted ||
    source.packageRenameAttempted ||
    source.npmPublishAttempted ||
    source.domainPurchaseAttempted ||
    source.githubOrgCreateAttempted ||
    source.trademarkFiledAttempted ||
    source.npmLoginAttempted ||
    source.credentialsSaved ||
    source.publicExternalExecutorIdentityExposed ||
    source.docsPromoteBatFiles ||
    source.messageSendAttempted ||
    source.providerExecutionAttempted ||
    source.toolCommandExecutionAttempted ||
    source.rawSqliteImportEnabled ||
    source.adapterGlobalRemovalAttempted ||
    source.rawSecretSerialized;
}

function resolveDecision(source: AuvarynNamingReservationSource): NamingReservationDecisionState {
  if (hasProhibitedAttempt(source)) {
    return 'auvaryn-blocked';
  }

  if (
    source.npmAuvarynAvailability === 'available' &&
    source.npmCreateAuvarynAvailability === 'available' &&
    source.githubOrgOrUserAvailability === 'available' &&
    source.githubGreyvritraRepoAvailability === 'available' &&
    source.generalSearchRisk !== 'high' &&
    source.trademarkRisk !== 'high' &&
    source.cliCommandCollision === false
  ) {
    return 'auvaryn-needs-manual-reservation';
  }

  if (source.npmAuvarynAvailability === 'taken' || source.trademarkRisk === 'high') {
    return 'auvaryn-blocked';
  }

  return 'auvaryn-unknown';
}

function decision(source: AuvarynNamingReservationSource): NamingReservationDecision {
  const state = resolveDecision(source);

  return {
    nativeContract: 'NamingReservationDecision/v1',
    decision: state,
    rationale: [
      'Exact npm package names auvaryn and create-auvaryn returned 404 and no exact npm search matches.',
      'GitHub user/org and greyvritra/auvaryn repository returned 404 with zero search results.',
      'No local CLI command collision was found for auvaryn or create-auvaryn.',
      'Domain checks found no active DNS, but registrar confirmation is still required and auvaryn.com has an external newly-registered-domain signal.',
      'A close software/AI naming neighbor, Avaryn, exists; this makes official clearance and manual reservation prudent before any rename.',
    ],
    nextRecommendedPack: '268-auvaryn-product-rename-planning-pack',
    productRenameActuallyPerformed: false,
    packageRenameActuallyPerformed: false,
    npmPublishActuallyPerformed: false,
    finalOperatorApprovalRequired: true,
  };
}

function manualActions(): NamingManualAction[] {
  return [
    {
      nativeContract: 'NamingManualAction/v1',
      actionId: 'review-avaryn-adjacent-conflict',
      requiredBeforeRename: true,
      description: 'Review the close Avaryn AI/runtime naming neighbor before committing to Auvaryn.',
      performedByGate: false,
    },
    {
      nativeContract: 'NamingManualAction/v1',
      actionId: 'create-github-org-or-repo',
      requiredBeforeRename: true,
      description: 'Reserve the GitHub org/user or greyvritra/auvaryn repository only with explicit operator approval.',
      performedByGate: false,
    },
    {
      nativeContract: 'NamingManualAction/v1',
      actionId: 'decide-domain-reservation',
      requiredBeforeRename: true,
      description: 'Check registrar availability and reserve chosen domains manually; DNS empty is not proof of availability.',
      performedByGate: false,
    },
    {
      nativeContract: 'NamingManualAction/v1',
      actionId: 'decide-npm-placeholder',
      requiredBeforeRename: true,
      description: 'Decide whether to publish npm placeholders after auth and final approval, or wait for the rename pack.',
      performedByGate: false,
    },
    {
      nativeContract: 'NamingManualAction/v1',
      actionId: 'confirm-trademark-clearance',
      requiredBeforeRename: true,
      description: 'Run official trademark/legal clearance before filing or public brand launch.',
      performedByGate: false,
    },
  ];
}

function executionGate(): AuvarynNamingReservationExecutionGate {
  return {
    auvarynNamingReservationGateCreated: true,
    currentProductName: 'Zavorth',
    candidateProductName: 'Auvaryn',
    productRenameActuallyPerformed: false,
    packageRenameActuallyPerformed: false,
    npmPublishActuallyPerformed: false,
    domainPurchaseActuallyPerformed: false,
    githubOrgCreated: false,
    trademarkFiled: false,
    finalOperatorApprovalRequired: true,
    packageJsonRenamedToAuvaryn: false,
    cliRenamedToAuvaryn: false,
    npmLoginAttempted: false,
    credentialsSaved: false,
    rawSecretSerialized: false,
    publicExternalExecutorIdentityLeak: false,
    batFilesNotProductPath: true,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    toolCommandActuallyExecuted: false,
    rawSqliteImportEnabled: false,
    adapterRemovalGlobalAllowed: false,
  };
}

export class AuvarynNamingReservationGate {
  public constructor(public readonly normalization: AuvarynNamingReservationNormalization) {}

  public expectedState(state: AuvarynNamingExpectedState): boolean {
    return this.normalization.expectedStates.includes(state);
  }

  public renameAllowed(): boolean {
    return false;
  }
}

export function createAuvarynNamingReservationSource(
  overrides: Partial<AuvarynNamingReservationSource> = {},
): AuvarynNamingReservationSource {
  return {
    npmAuvarynAvailability: 'available',
    npmCreateAuvarynAvailability: 'available',
    npmAuvarynExactMatches: 0,
    npmCreateAuvarynExactMatches: 0,
    npmConflicts: [],
    githubOrgOrUserAvailability: 'available',
    githubGreyvritraRepoAvailability: 'available',
    githubRepositorySearchResults: 0,
    githubUserSearchResults: 0,
    githubConflicts: [],
    domainConflicts: ['auvaryn.com appears in a January 2026 newly registered domain list; registrar confirmation required.'],
    generalSearchRisk: 'medium',
    notableConflicts: [
      'Avaryn is an adjacent AI product name with CLI/daemon/REST/runtime positioning; spelling differs but category proximity is relevant.',
      'AURVYN appears as a similar USPTO pharmaceutical application signal; category differs but legal clearance is still required.',
    ],
    ecosystemRegistryRisk: 'low',
    ecosystemConflicts: [],
    devMarketplaceRisk: 'low',
    devMarketplaceConflicts: [],
    trademarkRisk: 'medium',
    notableTrademarkSignals: [
      'No exact AUVARYN conflict was found in public web searches used by this gate.',
      'Similar AURVYN trademark signal exists outside software; official clearance still required.',
    ],
    cliCommandCollision: false,
    productRenameAttempted: false,
    packageRenameAttempted: false,
    npmPublishAttempted: false,
    domainPurchaseAttempted: false,
    githubOrgCreateAttempted: false,
    trademarkFiledAttempted: false,
    npmLoginAttempted: false,
    credentialsSaved: false,
    publicExternalExecutorIdentityExposed: false,
    docsPromoteBatFiles: false,
    messageSendAttempted: false,
    providerExecutionAttempted: false,
    toolCommandExecutionAttempted: false,
    rawSqliteImportEnabled: false,
    adapterGlobalRemovalAttempted: false,
    rawSecretSerialized: false,
    ...overrides,
  };
}

export function normalizeAuvarynNamingReservationGate(
  options: AuvarynNamingReservationOptions,
): AuvarynNamingReservationNormalization {
  const source = options.source;

  return {
    nativeContract: 'AuvarynNamingReservationGate/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    expectedStates: expectedStates(),
    candidateAvailability: candidateAvailability(source),
    npmAvailability: npmAvailability(source),
    githubAvailability: githubAvailability(source),
    domainAvailability: domainAvailability(source),
    trademarkRisk: trademarkRisk(source),
    decision: decision(source),
    manualActions: manualActions(),
    executionGate: executionGate(),
    redaction: {
      rawSecretSerialized: false,
      credentialsSerialized: false,
      paidReservationReceiptSerialized: false,
      receiptsRedacted: true,
    },
    terminalGate: 'decision-only-no-rename-no-reservation',
  };
}

export function createAuvarynNamingReservationGateFixture(
  overrides: Partial<AuvarynNamingReservationSource> = {},
): AuvarynNamingReservationGate {
  return new AuvarynNamingReservationGate(
    normalizeAuvarynNamingReservationGate({
      generatedAt: AUVARYN_NAMING_RESERVATION_GATE_NOW,
      runtimeId: AUVARYN_NAMING_RESERVATION_GATE_RUNTIME_ID,
      source: createAuvarynNamingReservationSource(overrides),
    }),
  );
}
