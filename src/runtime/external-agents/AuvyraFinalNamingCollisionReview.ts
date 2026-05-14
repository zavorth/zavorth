export const AUVYRA_FINAL_NAMING_COLLISION_REVIEW_NOW = '2026-05-01T18:35:00.000Z' as const;
export const AUVYRA_FINAL_NAMING_COLLISION_REVIEW_RUNTIME_ID = 'auvyra-final-naming-collision-review' as const;

export type AuvyraNamingAvailabilityState = 'available' | 'taken' | 'unknown';

export type AuvyraNamingRiskLevel = 'high' | 'low' | 'medium' | 'unknown';

export type AuvyraFinalDecisionState =
  | 'auvyra-approved-for-rename-planning'
  | 'auvyra-blocked'
  | 'auvyra-needs-manual-reservation'
  | 'auvyra-unknown';

export type AuvyraCollisionRisk = 'high' | 'low' | 'medium';

export type AuvyraCliErgonomics = 'acceptable' | 'strong' | 'weak';

export type AuvyraBrandDistinctiveness = 'acceptable' | 'strong' | 'weak';

export type AuvyraExpectedState =
  | 'candidateProductName=Auvyra'
  | 'cliRenameActuallyPerformed=false'
  | 'currentProductName=Zavorth'
  | 'domainPurchaseActuallyPerformed=false'
  | 'finalOperatorApprovalRequired=true'
  | 'githubOrgCreated=false'
  | 'npmPublishActuallyPerformed=false'
  | 'packageRenameActuallyPerformed=false'
  | 'previousCandidateName=Auvaryn'
  | 'productRenameActuallyPerformed=false'
  | 'trademarkFiled=false';

export type AuvyraManualActionId =
  | 'discard-auvyra-or-get-legal-clearance'
  | 'preserve-zavorth-until-new-candidate'
  | 'review-exact-ai-runtime-conflicts'
  | 'select-new-name-candidate';

export type AuvyraNamingNpmAvailability = {
  nativeContract: 'NamingNpmAvailability/v1';
  packageName: 'auvyra' | 'create-auvyra';
  npmViewCommand: string;
  npmSearchCommand: string;
  availability: AuvyraNamingAvailabilityState;
  exactNpmSearchMatches: number;
  typoGuard: 'correct-spelling-auvyra-not-auvrya';
  conflicts: string[];
};

export type AuvyraNamingGithubAvailability = {
  nativeContract: 'NamingGithubAvailability/v1';
  githubOrgOrUserAvailability: AuvyraNamingAvailabilityState;
  githubGreyvritraRepoAvailability: AuvyraNamingAvailabilityState;
  userUrl: 'https://github.com/auvyra';
  repoUrl: 'https://github.com/greyvritra/auvyra';
  repositorySearchResults: number;
  userSearchResults: number;
  githubConflicts: string[];
  githubOrgCreated: false;
  githubRepoCreated: false;
};

export type AuvyraNamingDomainAvailability = {
  nativeContract: 'NamingDomainAvailability/v1';
  primaryDomains: Array<{
    domain: 'auvyra.app' | 'auvyra.com' | 'auvyra.dev' | 'auvyra.run';
    dnsState: 'activeDnsFound' | 'noActiveDnsFound';
    registrarCheckRequired: true;
    note: 'dns-empty-is-not-availability-proof';
  }>;
  secondaryDomains: Array<{
    domain: 'auvyra.io' | 'auvyra.sh' | 'auvyra.tech' | 'getauvyra.com' | 'useauvyra.com';
    dnsState: 'activeDnsFound' | 'noActiveDnsFound';
    registrarCheckRequired: true;
    note: 'dns-empty-is-not-availability-proof';
  }>;
  domainRisk: AuvyraNamingRiskLevel;
  domainConflicts: string[];
  domainPurchaseActuallyPerformed: false;
};

export type AuvyraNamingCollisionReview = {
  nativeContract: 'NamingCollisionReview/v1';
  comparedNames: ['Auvyra', 'Auvaryn', 'Avaryn', 'AURVYN', 'Veyra', 'Vritra'];
  phoneticCollisionRisk: AuvyraCollisionRisk;
  visualCollisionRisk: AuvyraCollisionRisk;
  cliErgonomics: AuvyraCliErgonomics;
  brandDistinctiveness: AuvyraBrandDistinctiveness;
  cliExamples: ['auvyra setup', 'auvyra go', 'auvyra doctor', 'npm create auvyra'];
  findings: string[];
};

export type AuvyraNamingCandidateAvailability = {
  nativeContract: 'NamingCandidateAvailability/v1';
  currentProductName: 'Zavorth';
  previousCandidateName: 'Auvaryn';
  candidateProductName: 'Auvyra';
  candidateSlug: 'auvyra';
  npmAuvyraAvailability: AuvyraNamingAvailabilityState;
  npmCreateAuvyraAvailability: AuvyraNamingAvailabilityState;
  githubOrgOrUserAvailability: AuvyraNamingAvailabilityState;
  githubGreyvritraRepoAvailability: AuvyraNamingAvailabilityState;
  generalSearchRisk: AuvyraNamingRiskLevel;
  ecosystemRegistryRisk: AuvyraNamingRiskLevel;
  devMarketplaceRisk: AuvyraNamingRiskLevel;
  cliCommandCollision: false | true | 'unknown';
  notableConflicts: string[];
};

export type AuvyraNamingTrademarkRisk = {
  nativeContract: 'NamingTrademarkRisk/v1';
  trademarkSearchPerformed: true;
  searchedTerms: ['Auvyra', 'AUVYRA', 'Avaryn', 'Auvaryn', 'AURVYN'];
  trademarkRisk: AuvyraNamingRiskLevel;
  notableTrademarkSignals: string[];
  trademarkDisclaimer: 'not legal advice; official/legal clearance still required';
  trademarkFiled: false;
};

export type AuvyraNamingFinalDecision = {
  nativeContract: 'NamingFinalDecision/v1';
  decision: AuvyraFinalDecisionState;
  rationale: string[];
  nextRecommendedPack: 'select-new-name-candidate' | '269-auvyra-product-rename-planning-pack';
  productRenameActuallyPerformed: false;
  packageRenameActuallyPerformed: false;
  cliRenameActuallyPerformed: false;
  npmPublishActuallyPerformed: false;
  finalOperatorApprovalRequired: true;
};

export type AuvyraNamingManualAction = {
  nativeContract: 'NamingManualAction/v1';
  actionId: AuvyraManualActionId;
  requiredBeforeRename: boolean;
  description: string;
  performedByGate: false;
};

export type AuvyraFinalNamingExecutionGate = {
  auvyraFinalNamingCollisionReviewCreated: true;
  currentProductName: 'Zavorth';
  previousCandidateName: 'Auvaryn';
  candidateProductName: 'Auvyra';
  productRenameActuallyPerformed: false;
  packageRenameActuallyPerformed: false;
  cliRenameActuallyPerformed: false;
  npmPublishActuallyPerformed: false;
  domainPurchaseActuallyPerformed: false;
  githubOrgCreated: false;
  trademarkFiled: false;
  packageJsonRenamedToAuvyra: false;
  cliRenamedToAuvyra: false;
  finalOperatorApprovalRequired: true;
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

export type AuvyraFinalNamingSource = {
  npmAuvyraAvailability: AuvyraNamingAvailabilityState;
  npmCreateAuvyraAvailability: AuvyraNamingAvailabilityState;
  npmAuvyraExactMatches: number;
  npmCreateAuvyraExactMatches: number;
  npmConflicts: string[];
  githubOrgOrUserAvailability: AuvyraNamingAvailabilityState;
  githubGreyvritraRepoAvailability: AuvyraNamingAvailabilityState;
  githubRepositorySearchResults: number;
  githubUserSearchResults: number;
  githubConflicts: string[];
  generalSearchRisk: AuvyraNamingRiskLevel;
  notableConflicts: string[];
  ecosystemRegistryRisk: AuvyraNamingRiskLevel;
  ecosystemConflicts: string[];
  devMarketplaceRisk: AuvyraNamingRiskLevel;
  devMarketplaceConflicts: string[];
  domainConflicts: string[];
  trademarkRisk: AuvyraNamingRiskLevel;
  notableTrademarkSignals: string[];
  phoneticCollisionRisk: AuvyraCollisionRisk;
  visualCollisionRisk: AuvyraCollisionRisk;
  cliErgonomics: AuvyraCliErgonomics;
  brandDistinctiveness: AuvyraBrandDistinctiveness;
  cliCommandCollision: false | true | 'unknown';
  productRenameAttempted: false;
  packageRenameAttempted: false;
  cliRenameAttempted: false;
  npmPublishAttempted: false;
  domainPurchaseAttempted: false;
  githubOrgCreateAttempted: false;
  trademarkFiledAttempted: false;
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

export type AuvyraFinalNamingCollisionReviewNormalization = {
  nativeContract: 'AuvyraFinalNamingCollisionReview/v1';
  generatedAt: string;
  runtimeId: typeof AUVYRA_FINAL_NAMING_COLLISION_REVIEW_RUNTIME_ID;
  expectedStates: AuvyraExpectedState[];
  candidateAvailability: AuvyraNamingCandidateAvailability;
  npmAvailability: [AuvyraNamingNpmAvailability, AuvyraNamingNpmAvailability];
  githubAvailability: AuvyraNamingGithubAvailability;
  domainAvailability: AuvyraNamingDomainAvailability;
  collisionReview: AuvyraNamingCollisionReview;
  trademarkRisk: AuvyraNamingTrademarkRisk;
  finalDecision: AuvyraNamingFinalDecision;
  manualActions: AuvyraNamingManualAction[];
  executionGate: AuvyraFinalNamingExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    credentialsSerialized: false;
    paidReservationReceiptSerialized: false;
    receiptsRedacted: true;
  };
  terminalGate: 'final-name-review-no-rename';
};

export type AuvyraFinalNamingCollisionReviewOptions = {
  generatedAt: string;
  runtimeId: typeof AUVYRA_FINAL_NAMING_COLLISION_REVIEW_RUNTIME_ID;
  source: AuvyraFinalNamingSource;
};

function expectedStates(): AuvyraExpectedState[] {
  return [
    'currentProductName=Zavorth',
    'previousCandidateName=Auvaryn',
    'candidateProductName=Auvyra',
    'productRenameActuallyPerformed=false',
    'packageRenameActuallyPerformed=false',
    'cliRenameActuallyPerformed=false',
    'npmPublishActuallyPerformed=false',
    'domainPurchaseActuallyPerformed=false',
    'githubOrgCreated=false',
    'trademarkFiled=false',
    'finalOperatorApprovalRequired=true',
  ];
}

function hasProhibitedAttempt(source: AuvyraFinalNamingSource): boolean {
  return source.productRenameAttempted ||
    source.packageRenameAttempted ||
    source.cliRenameAttempted ||
    source.npmPublishAttempted ||
    source.domainPurchaseAttempted ||
    source.githubOrgCreateAttempted ||
    source.trademarkFiledAttempted ||
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

function npmAvailability(source: AuvyraFinalNamingSource): [AuvyraNamingNpmAvailability, AuvyraNamingNpmAvailability] {
  return [
    {
      nativeContract: 'NamingNpmAvailability/v1',
      packageName: 'auvyra',
      npmViewCommand: 'npm view auvyra name version',
      npmSearchCommand: 'npm search auvyra',
      availability: source.npmAuvyraAvailability,
      exactNpmSearchMatches: source.npmAuvyraExactMatches,
      typoGuard: 'correct-spelling-auvyra-not-auvrya',
      conflicts: source.npmConflicts,
    },
    {
      nativeContract: 'NamingNpmAvailability/v1',
      packageName: 'create-auvyra',
      npmViewCommand: 'npm view create-auvyra name version',
      npmSearchCommand: 'npm search create-auvyra',
      availability: source.npmCreateAuvyraAvailability,
      exactNpmSearchMatches: source.npmCreateAuvyraExactMatches,
      typoGuard: 'correct-spelling-auvyra-not-auvrya',
      conflicts: source.npmConflicts,
    },
  ];
}

function githubAvailability(source: AuvyraFinalNamingSource): AuvyraNamingGithubAvailability {
  return {
    nativeContract: 'NamingGithubAvailability/v1',
    githubOrgOrUserAvailability: source.githubOrgOrUserAvailability,
    githubGreyvritraRepoAvailability: source.githubGreyvritraRepoAvailability,
    userUrl: 'https://github.com/auvyra',
    repoUrl: 'https://github.com/greyvritra/auvyra',
    repositorySearchResults: source.githubRepositorySearchResults,
    userSearchResults: source.githubUserSearchResults,
    githubConflicts: source.githubConflicts,
    githubOrgCreated: false,
    githubRepoCreated: false,
  };
}

function domainAvailability(source: AuvyraFinalNamingSource): AuvyraNamingDomainAvailability {
  const primaryDomains: AuvyraNamingDomainAvailability['primaryDomains'] = [
    { domain: 'auvyra.dev', dnsState: 'noActiveDnsFound' },
    { domain: 'auvyra.run', dnsState: 'noActiveDnsFound' },
    { domain: 'auvyra.app', dnsState: 'noActiveDnsFound' },
    { domain: 'auvyra.com', dnsState: 'activeDnsFound' },
  ].map((entry) => ({
    domain: entry.domain as AuvyraNamingDomainAvailability['primaryDomains'][number]['domain'],
    dnsState: entry.dnsState as AuvyraNamingDomainAvailability['primaryDomains'][number]['dnsState'],
    registrarCheckRequired: true,
    note: 'dns-empty-is-not-availability-proof',
  }));

  const secondaryDomains: AuvyraNamingDomainAvailability['secondaryDomains'] = [
    'auvyra.io',
    'auvyra.tech',
    'auvyra.sh',
    'getauvyra.com',
    'useauvyra.com',
  ].map((domain) => ({
    domain: domain as AuvyraNamingDomainAvailability['secondaryDomains'][number]['domain'],
    dnsState: 'noActiveDnsFound',
    registrarCheckRequired: true,
    note: 'dns-empty-is-not-availability-proof',
  }));

  return {
    nativeContract: 'NamingDomainAvailability/v1',
    primaryDomains,
    secondaryDomains,
    domainRisk: 'high',
    domainConflicts: source.domainConflicts,
    domainPurchaseActuallyPerformed: false,
  };
}

function collisionReview(source: AuvyraFinalNamingSource): AuvyraNamingCollisionReview {
  return {
    nativeContract: 'NamingCollisionReview/v1',
    comparedNames: ['Auvyra', 'Auvaryn', 'Avaryn', 'AURVYN', 'Veyra', 'Vritra'],
    phoneticCollisionRisk: source.phoneticCollisionRisk,
    visualCollisionRisk: source.visualCollisionRisk,
    cliErgonomics: source.cliErgonomics,
    brandDistinctiveness: source.brandDistinctiveness,
    cliExamples: ['auvyra setup', 'auvyra go', 'auvyra doctor', 'npm create auvyra'],
    findings: [
      'Auvyra is easier to type than Auvaryn and separates visually from Avaryn by one extra syllable pattern.',
      'Auvyra still shares the Auv-/Av- opening with Auvaryn, Avaryn, and AURVYN.',
      'Exact Auvyra usage in AI agents and Auvyra TTS runtime tooling makes product-category collision higher than the Auvaryn candidate.',
      'Vritra remains more distinct from Avaryn/Auvaryn/AURVYN than Auvyra does.',
    ],
  };
}

function candidateAvailability(source: AuvyraFinalNamingSource): AuvyraNamingCandidateAvailability {
  return {
    nativeContract: 'NamingCandidateAvailability/v1',
    currentProductName: 'Zavorth',
    previousCandidateName: 'Auvaryn',
    candidateProductName: 'Auvyra',
    candidateSlug: 'auvyra',
    npmAuvyraAvailability: source.npmAuvyraAvailability,
    npmCreateAuvyraAvailability: source.npmCreateAuvyraAvailability,
    githubOrgOrUserAvailability: source.githubOrgOrUserAvailability,
    githubGreyvritraRepoAvailability: source.githubGreyvritraRepoAvailability,
    generalSearchRisk: source.generalSearchRisk,
    ecosystemRegistryRisk: source.ecosystemRegistryRisk,
    devMarketplaceRisk: source.devMarketplaceRisk,
    cliCommandCollision: source.cliCommandCollision,
    notableConflicts: source.notableConflicts,
  };
}

function trademarkRisk(source: AuvyraFinalNamingSource): AuvyraNamingTrademarkRisk {
  return {
    nativeContract: 'NamingTrademarkRisk/v1',
    trademarkSearchPerformed: true,
    searchedTerms: ['Auvyra', 'AUVYRA', 'Avaryn', 'Auvaryn', 'AURVYN'],
    trademarkRisk: source.trademarkRisk,
    notableTrademarkSignals: source.notableTrademarkSignals,
    trademarkDisclaimer: 'not legal advice; official/legal clearance still required',
    trademarkFiled: false,
  };
}

function resolveDecision(source: AuvyraFinalNamingSource): AuvyraFinalDecisionState {
  if (hasProhibitedAttempt(source)) {
    return 'auvyra-blocked';
  }

  if (
    source.generalSearchRisk === 'high' ||
    source.devMarketplaceRisk === 'high' ||
    source.trademarkRisk === 'high' ||
    source.domainConflicts.length > 0
  ) {
    return 'auvyra-blocked';
  }

  if (
    source.npmAuvyraAvailability === 'available' &&
    source.npmCreateAuvyraAvailability === 'available' &&
    source.githubOrgOrUserAvailability === 'available' &&
    source.githubGreyvritraRepoAvailability === 'available' &&
    source.phoneticCollisionRisk !== 'high' &&
    source.visualCollisionRisk !== 'high' &&
    source.cliCommandCollision === false
  ) {
    return 'auvyra-approved-for-rename-planning';
  }

  return 'auvyra-unknown';
}

function finalDecision(source: AuvyraFinalNamingSource): AuvyraNamingFinalDecision {
  const decision = resolveDecision(source);

  return {
    nativeContract: 'NamingFinalDecision/v1',
    decision,
    rationale: [
      'The npm names auvyra and create-auvyra appear available, but npm availability is not sufficient for public product naming.',
      'GitHub exact org/user and greyvritra/auvyra repository checks appear available, with one non-exact user-search hit.',
      'General search found exact Auvyra usage in AI agents for clinics and in an Auvyra TTS runtime/plugin product.',
      'Auvyra.com has active DNS and Auvyra.com.br is an active commerce site, so domain/product footprint is not clean.',
      'Compared with Auvaryn, Auvyra reduces the Avaryn spelling overlap slightly but increases exact-category conflict risk.',
    ],
    nextRecommendedPack: decision === 'auvyra-approved-for-rename-planning'
      ? '269-auvyra-product-rename-planning-pack'
      : 'select-new-name-candidate',
    productRenameActuallyPerformed: false,
    packageRenameActuallyPerformed: false,
    cliRenameActuallyPerformed: false,
    npmPublishActuallyPerformed: false,
    finalOperatorApprovalRequired: true,
  };
}

function manualActions(): AuvyraNamingManualAction[] {
  return [
    {
      nativeContract: 'NamingManualAction/v1',
      actionId: 'review-exact-ai-runtime-conflicts',
      requiredBeforeRename: true,
      description: 'Review the exact Auvyra AI-agent and Auvyra TTS runtime/plugin conflicts before any public rename.',
      performedByGate: false,
    },
    {
      nativeContract: 'NamingManualAction/v1',
      actionId: 'discard-auvyra-or-get-legal-clearance',
      requiredBeforeRename: true,
      description: 'Either discard Auvyra or obtain explicit legal/brand clearance acknowledging the exact conflicts.',
      performedByGate: false,
    },
    {
      nativeContract: 'NamingManualAction/v1',
      actionId: 'select-new-name-candidate',
      requiredBeforeRename: true,
      description: 'Prefer a new candidate with no exact AI/dev/runtime conflicts.',
      performedByGate: false,
    },
    {
      nativeContract: 'NamingManualAction/v1',
      actionId: 'preserve-zavorth-until-new-candidate',
      requiredBeforeRename: true,
      description: 'Keep Zavorth unchanged until a cleaner candidate passes final naming review.',
      performedByGate: false,
    },
  ];
}

function executionGate(): AuvyraFinalNamingExecutionGate {
  return {
    auvyraFinalNamingCollisionReviewCreated: true,
    currentProductName: 'Zavorth',
    previousCandidateName: 'Auvaryn',
    candidateProductName: 'Auvyra',
    productRenameActuallyPerformed: false,
    packageRenameActuallyPerformed: false,
    cliRenameActuallyPerformed: false,
    npmPublishActuallyPerformed: false,
    domainPurchaseActuallyPerformed: false,
    githubOrgCreated: false,
    trademarkFiled: false,
    packageJsonRenamedToAuvyra: false,
    cliRenamedToAuvyra: false,
    finalOperatorApprovalRequired: true,
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

export class AuvyraFinalNamingCollisionReview {
  public constructor(public readonly normalization: AuvyraFinalNamingCollisionReviewNormalization) {}

  public expectedState(state: AuvyraExpectedState): boolean {
    return this.normalization.expectedStates.includes(state);
  }

  public renameAllowed(): boolean {
    return false;
  }
}

export function createAuvyraFinalNamingSource(
  overrides: Partial<AuvyraFinalNamingSource> = {},
): AuvyraFinalNamingSource {
  return {
    npmAuvyraAvailability: 'available',
    npmCreateAuvyraAvailability: 'available',
    npmAuvyraExactMatches: 0,
    npmCreateAuvyraExactMatches: 0,
    npmConflicts: [],
    githubOrgOrUserAvailability: 'available',
    githubGreyvritraRepoAvailability: 'available',
    githubRepositorySearchResults: 0,
    githubUserSearchResults: 1,
    githubConflicts: ['Non-exact GitHub user-search hit: auvyrafrostlily-create.'],
    generalSearchRisk: 'high',
    notableConflicts: [
      'Auvyra Core markets AI agents for clinics and professionals, including WhatsApp, web, voice, scheduling, and automation.',
      'Auvyra TTS is a runtime text-to-speech plugin with AI/runtime tags on Fab.',
      'Auvyra.com.br is an active commerce site using the exact name.',
      'AUVYRA LTD appears as an active Cyprus company signal.',
    ],
    ecosystemRegistryRisk: 'low',
    ecosystemConflicts: [],
    devMarketplaceRisk: 'high',
    devMarketplaceConflicts: ['Fab lists Auvyra TTS as a runtime/plugin product.'],
    domainConflicts: [
      'auvyra.com has active DNS.',
      'auvyra.com.br is an active exact-name commerce site.',
    ],
    trademarkRisk: 'high',
    notableTrademarkSignals: [
      'Exact AUVYRA commercial/company signals exist, including AUVYRA LTD and active Auvyra-branded sites.',
      'AURVYN remains a similar-spelling trademark signal from the previous review.',
      'Official trademark/legal clearance is required; this gate is not legal advice.',
    ],
    phoneticCollisionRisk: 'medium',
    visualCollisionRisk: 'medium',
    cliErgonomics: 'strong',
    brandDistinctiveness: 'weak',
    cliCommandCollision: false,
    productRenameAttempted: false,
    packageRenameAttempted: false,
    cliRenameAttempted: false,
    npmPublishAttempted: false,
    domainPurchaseAttempted: false,
    githubOrgCreateAttempted: false,
    trademarkFiledAttempted: false,
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

export function normalizeAuvyraFinalNamingCollisionReview(
  options: AuvyraFinalNamingCollisionReviewOptions,
): AuvyraFinalNamingCollisionReviewNormalization {
  const source = options.source;

  return {
    nativeContract: 'AuvyraFinalNamingCollisionReview/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    expectedStates: expectedStates(),
    candidateAvailability: candidateAvailability(source),
    npmAvailability: npmAvailability(source),
    githubAvailability: githubAvailability(source),
    domainAvailability: domainAvailability(source),
    collisionReview: collisionReview(source),
    trademarkRisk: trademarkRisk(source),
    finalDecision: finalDecision(source),
    manualActions: manualActions(),
    executionGate: executionGate(),
    redaction: {
      rawSecretSerialized: false,
      credentialsSerialized: false,
      paidReservationReceiptSerialized: false,
      receiptsRedacted: true,
    },
    terminalGate: 'final-name-review-no-rename',
  };
}

export function createAuvyraFinalNamingCollisionReviewFixture(
  overrides: Partial<AuvyraFinalNamingSource> = {},
): AuvyraFinalNamingCollisionReview {
  return new AuvyraFinalNamingCollisionReview(
    normalizeAuvyraFinalNamingCollisionReview({
      generatedAt: AUVYRA_FINAL_NAMING_COLLISION_REVIEW_NOW,
      runtimeId: AUVYRA_FINAL_NAMING_COLLISION_REVIEW_RUNTIME_ID,
      source: createAuvyraFinalNamingSource(overrides),
    }),
  );
}
