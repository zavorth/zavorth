export const ZAVORTH_NAMING_RESERVATION_GATE_NOW = '2026-05-02T04:10:00.000Z' as const;
export const ZAVORTH_NAMING_RESERVATION_GATE_RUNTIME_ID = 'zavorth-naming-reservation-gate' as const;

export type ZavorthNamingDecision =
  | 'zavorth-ready-for-manual-reservation'
  | 'zavorth-needs-review';

export type ZavorthAvailability = 'available' | 'taken' | 'unknown';
export type ZavorthRiskLevel = 'low' | 'medium' | 'high' | 'unknown';

export type ZavorthDiscardedName = {
  name: 'Kyron/Cyron' | 'Nexor' | 'Warden' | 'Kitsune/Vulpix/VULP' | 'Zenor/Zentro/Vyrion/Maverix';
  reason: string;
};

export type ZavorthNpmFinding = {
  nativeContract: 'ZavorthNpmFinding/v1';
  packageName: 'zavorth' | 'create-zavorth';
  viewCommand: string;
  viewResult: '404-not-found' | 'found' | 'unknown';
  searchCommand: string;
  exactMatchFound: boolean;
  similarPackages: string[];
  abandonedPackageRisk: ZavorthRiskLevel;
  availability: ZavorthAvailability;
};

export type ZavorthGithubFinding = {
  nativeContract: 'ZavorthGithubFinding/v1';
  userOrOrgUrl: 'https://github.com/zavorth';
  greyvritraRepoUrl: 'https://github.com/greyvritra/zavorth';
  userOrOrgAvailability: ZavorthAvailability;
  greyvritraRepoAvailability: ZavorthAvailability;
  repositorySearchCount: number;
  userSearchCount: number;
  topicSearchCount: number;
  codeSearchPerformed: boolean;
  strongSoftwareConflictFound: boolean;
  conflicts: string[];
};

export type ZavorthDomainFinding = {
  nativeContract: 'ZavorthDomainFinding/v1';
  domain:
    | 'zavorth.com'
    | 'zavorth.dev'
    | 'zavorth.ai'
    | 'zavorth.app'
    | 'zavorth.run'
    | 'zavorth.sh'
    | 'getzavorth.com'
    | 'usezavorth.com';
  dnsState: 'no-active-dns-found' | 'active-dns-found' | 'unknown';
  registrarCheckRequired: true;
  activeProductConflictFound: boolean;
  note: 'dns-empty-is-not-availability-proof';
};

export type ZavorthWebFinding = {
  nativeContract: 'ZavorthWebFinding/v1';
  searchedTerms: [
    '"Zavorth"',
    '"zavorth"',
    '"Zavorth AI"',
    '"Zavorth agent"',
    '"Zavorth CLI"',
    '"Zavorth software"',
    '"Zavorth developer tool"',
    '"Zavorth security"',
    '"create-zavorth"',
  ];
  strongAiSoftwareSecurityDevtoolConflictFound: boolean;
  conflictRisk: ZavorthRiskLevel;
  notableConflicts: string[];
};

export type ZavorthRegistryFinding = {
  nativeContract: 'ZavorthRegistryFinding/v1';
  registry:
    | 'PyPI'
    | 'Crates.io'
    | 'RubyGems'
    | 'Docker Hub'
    | 'Homebrew'
    | 'VS Code Marketplace'
    | 'JetBrains Marketplace';
  status: 'checked' | 'checked-no-exact-match' | 'query-failed';
  exactMatchFound: boolean;
  conflictRisk: ZavorthRiskLevel;
  notes: string[];
};

export type ZavorthTrademarkFinding = {
  nativeContract: 'ZavorthTrademarkFinding/v1';
  searchedSources: ['USPTO', 'WIPO', 'EUIPO', 'INPI Brasil'];
  trademarkSearchPerformed: true;
  exactZavorthConflictFound: boolean;
  trademarkRisk: ZavorthRiskLevel;
  legalClearanceRequired: true;
  reason: string;
  disclaimer: 'not legal advice; official/legal clearance still required';
};

export type ZavorthManualReservationAction = {
  nativeContract: 'ZavorthManualReservationAction/v1';
  actionId:
    | 'operator-approve-zavorth'
    | 'reserve-npm-zavorth'
    | 'reserve-npm-create-zavorth'
    | 'create-github-org-or-repo'
    | 'perform-registrar-check'
    | 'perform-formal-trademark-clearance'
    | 'plan-rename-pack';
  performedByGate: false;
  requiredBeforeRename: boolean;
  description: string;
};

export type ZavorthBlockedAction = {
  nativeContract: 'ZavorthBlockedAction/v1';
  actionId:
    | 'rename-product'
    | 'change-package-name'
    | 'change-cli-bin'
    | 'change-installer'
    | 'publish-npm'
    | 'create-create-zavorth-package'
    | 'create-github-org-or-repo'
    | 'buy-domain'
    | 'file-trademark'
    | 'start-persistent-runtime'
    | 'execute-provider-tool-command-message'
    | 'raw-history-import'
    | 'remove-global-adapter';
  performed: false;
};

export type ZavorthNamingReservationGateNormalization = {
  nativeContract: 'ZavorthNamingReservationGate/v1';
  packId: '285';
  runtimeId: typeof ZAVORTH_NAMING_RESERVATION_GATE_RUNTIME_ID;
  generatedAt: string;
  activeProductName: 'Zavorth';
  candidateName: 'Zavorth';
  candidatePackageName: 'zavorth';
  candidateCreatePackageName: 'create-zavorth';
  pronunciation: 'za-vorth';
  decision: ZavorthNamingDecision;
  npmPackageAvailable: boolean;
  npmCreatePackageAvailable: boolean;
  githubOrgOrUserAvailable: boolean;
  githubGreyvritraRepoAvailable: boolean;
  domainRegistrarCheckRequired: true;
  legalClearanceRequired: true;
  npmFindings: [ZavorthNpmFinding, ZavorthNpmFinding];
  githubFindings: ZavorthGithubFinding;
  domainFindings: ZavorthDomainFinding[];
  webFindings: ZavorthWebFinding;
  registryFindings: ZavorthRegistryFinding[];
  trademarkFindings: ZavorthTrademarkFinding;
  discardedNames: ZavorthDiscardedName[];
  reservationActions: ZavorthManualReservationAction[];
  blockedActions: ZavorthBlockedAction[];
  commandsExecuted: string[];
  finalState: {
    renamePerformed: false;
    npmPublishPerformed: false;
    domainPurchasePerformed: false;
    githubReservationPerformed: false;
    packageNameChanged: false;
    publicIdentityChanged: false;
    installerChanged: false;
    versionOrDistTagChanged: false;
    runtimePersistentStartPerformed: false;
    providerToolCommandMessageExecuted: false;
    rawHistoryImported: false;
    globalAdapterRemoved: false;
    rawSecretSerialized: false;
  };
};

export type ZavorthNamingReservationGateOptions = {
  generatedAt?: string;
};

function npmFindings(): [ZavorthNpmFinding, ZavorthNpmFinding] {
  return [
    {
      nativeContract: 'ZavorthNpmFinding/v1',
      packageName: 'zavorth',
      viewCommand: 'npm view zavorth name version',
      viewResult: '404-not-found',
      searchCommand: 'npm search zavorth --json',
      exactMatchFound: false,
      similarPackages: [],
      abandonedPackageRisk: 'low',
      availability: 'available',
    },
    {
      nativeContract: 'ZavorthNpmFinding/v1',
      packageName: 'create-zavorth',
      viewCommand: 'npm view create-zavorth name version',
      viewResult: '404-not-found',
      searchCommand: 'npm search create-zavorth --json',
      exactMatchFound: false,
      similarPackages: [],
      abandonedPackageRisk: 'low',
      availability: 'available',
    },
  ];
}

function githubFindings(): ZavorthGithubFinding {
  return {
    nativeContract: 'ZavorthGithubFinding/v1',
    userOrOrgUrl: 'https://github.com/zavorth',
    greyvritraRepoUrl: 'https://github.com/greyvritra/zavorth',
    userOrOrgAvailability: 'available',
    greyvritraRepoAvailability: 'available',
    repositorySearchCount: 0,
    userSearchCount: 0,
    topicSearchCount: 0,
    codeSearchPerformed: false,
    strongSoftwareConflictFound: false,
    conflicts: [],
  };
}

function domainFindings(): ZavorthDomainFinding[] {
  return [
    'zavorth.com',
    'zavorth.dev',
    'zavorth.ai',
    'zavorth.app',
    'zavorth.run',
    'zavorth.sh',
    'getzavorth.com',
    'usezavorth.com',
  ].map((domain) => ({
    nativeContract: 'ZavorthDomainFinding/v1',
    domain: domain as ZavorthDomainFinding['domain'],
    dnsState: 'no-active-dns-found',
    registrarCheckRequired: true,
    activeProductConflictFound: false,
    note: 'dns-empty-is-not-availability-proof',
  }));
}

function webFindings(): ZavorthWebFinding {
  return {
    nativeContract: 'ZavorthWebFinding/v1',
    searchedTerms: [
      '"Zavorth"',
      '"zavorth"',
      '"Zavorth AI"',
      '"Zavorth agent"',
      '"Zavorth CLI"',
      '"Zavorth software"',
      '"Zavorth developer tool"',
      '"Zavorth security"',
      '"create-zavorth"',
    ],
    strongAiSoftwareSecurityDevtoolConflictFound: false,
    conflictRisk: 'low',
    notableConflicts: [
      'No exact Zavorth AI/software/security/devtool product found in the checked search surfaces.',
      'Adjacent search noise such as ZAVRO, Zorac, Varro, Barko, and Zork is not an exact Zavorth conflict.',
    ],
  };
}

function registryFindings(): ZavorthRegistryFinding[] {
  return [
    ['PyPI', 'checked-no-exact-match', 'https://pypi.org/pypi/zavorth/json returned 404.'],
    ['Crates.io', 'checked-no-exact-match', 'https://crates.io/api/v1/crates/zavorth returned 404.'],
    ['RubyGems', 'checked-no-exact-match', 'https://rubygems.org/api/v1/gems/zavorth.json returned 404.'],
    ['Docker Hub', 'checked-no-exact-match', 'Docker Hub repository search returned count=0.'],
    ['Homebrew', 'checked-no-exact-match', 'Homebrew formula API returned 404.'],
    ['VS Code Marketplace', 'checked-no-exact-match', 'Visual Studio Marketplace extension query returned count=0.'],
    ['JetBrains Marketplace', 'query-failed', 'JetBrains endpoint rejected the unauthenticated query; web search found no exact Zavorth plugin result.'],
  ].map(([registry, status, note]) => ({
    nativeContract: 'ZavorthRegistryFinding/v1',
    registry: registry as ZavorthRegistryFinding['registry'],
    status: status as ZavorthRegistryFinding['status'],
    exactMatchFound: false,
    conflictRisk: status === 'query-failed' ? 'unknown' : 'low',
    notes: [note],
  }));
}

function trademarkFindings(): ZavorthTrademarkFinding {
  return {
    nativeContract: 'ZavorthTrademarkFinding/v1',
    searchedSources: ['USPTO', 'WIPO', 'EUIPO', 'INPI Brasil'],
    trademarkSearchPerformed: true,
    exactZavorthConflictFound: false,
    trademarkRisk: 'low',
    legalClearanceRequired: true,
    reason: 'Basic web and official search-entrypoint checks did not surface an exact Zavorth mark, but this is not a legal clearance.',
    disclaimer: 'not legal advice; official/legal clearance still required',
  };
}

function discardedNames(): ZavorthDiscardedName[] {
  return [
    { name: 'Kyron/Cyron', reason: 'conflicts in AI/software naming space' },
    { name: 'Nexor', reason: 'npm, domain, and cybersecurity adjacency risk' },
    { name: 'Warden', reason: 'npm, domains, security, and developer-tool collisions' },
    { name: 'Kitsune/Vulpix/VULP', reason: 'cultural, npm, and GitHub collisions' },
    { name: 'Zenor/Zentro/Vyrion/Maverix', reason: 'AI/software conflict or ownability concerns' },
  ];
}

function reservationActions(): ZavorthManualReservationAction[] {
  return [
    ['operator-approve-zavorth', true, 'Operator explicitly approves Zavorth as the next active rename candidate.'],
    ['reserve-npm-zavorth', true, 'Publish or reserve the zavorth npm name only after explicit approval.'],
    ['reserve-npm-create-zavorth', true, 'Publish or reserve the create-zavorth npm name only after explicit approval.'],
    ['create-github-org-or-repo', true, 'Create the GitHub org/user/repo manually if the operator chooses this name.'],
    ['perform-registrar-check', true, 'Use a registrar to confirm and reserve priority domains; DNS emptiness is not proof.'],
    ['perform-formal-trademark-clearance', true, 'Run official legal clearance before brand launch or trademark filing.'],
    ['plan-rename-pack', false, 'Create a later rename planning pack after manual reservation decisions.'],
  ].map(([actionId, requiredBeforeRename, description]) => ({
    nativeContract: 'ZavorthManualReservationAction/v1',
    actionId: actionId as ZavorthManualReservationAction['actionId'],
    performedByGate: false,
    requiredBeforeRename: Boolean(requiredBeforeRename),
    description: String(description),
  }));
}

function blockedActions(): ZavorthBlockedAction[] {
  return [
    'rename-product',
    'change-package-name',
    'change-cli-bin',
    'change-installer',
    'publish-npm',
    'create-create-zavorth-package',
    'create-github-org-or-repo',
    'buy-domain',
    'file-trademark',
    'start-persistent-runtime',
    'execute-provider-tool-command-message',
    'raw-history-import',
    'remove-global-adapter',
  ].map((actionId) => ({
    nativeContract: 'ZavorthBlockedAction/v1',
    actionId: actionId as ZavorthBlockedAction['actionId'],
    performed: false,
  }));
}

function commandsExecuted(): string[] {
  return [
    'npm view zavorth name version',
    'npm view create-zavorth name version',
    'npm search zavorth --json',
    'npm search create-zavorth --json',
    'Resolve-DnsName zavorth.com zavorth.dev zavorth.ai zavorth.app zavorth.run zavorth.sh getzavorth.com usezavorth.com',
    'where zavorth',
    'where create-zavorth',
    'HEAD https://github.com/zavorth',
    'HEAD https://github.com/greyvritra/zavorth',
    'GitHub API search repositories/users/topics for zavorth',
    'registry checks: PyPI, Crates.io, RubyGems, Docker Hub, Homebrew, VS Code Marketplace, JetBrains Marketplace',
    'web search: Zavorth, Zavorth AI, Zavorth agent, Zavorth CLI, Zavorth software, Zavorth developer tool, Zavorth security, create-zavorth',
    'basic trademark web search: USPTO, WIPO, EUIPO, INPI Brasil',
  ];
}

export function normalizeZavorthNamingReservationGate(
  options: ZavorthNamingReservationGateOptions = {},
): ZavorthNamingReservationGateNormalization {
  return {
    nativeContract: 'ZavorthNamingReservationGate/v1',
    packId: '285',
    runtimeId: ZAVORTH_NAMING_RESERVATION_GATE_RUNTIME_ID,
    generatedAt: options.generatedAt || ZAVORTH_NAMING_RESERVATION_GATE_NOW,
    activeProductName: 'Zavorth',
    candidateName: 'Zavorth',
    candidatePackageName: 'zavorth',
    candidateCreatePackageName: 'create-zavorth',
    pronunciation: 'za-vorth',
    decision: 'zavorth-ready-for-manual-reservation',
    npmPackageAvailable: true,
    npmCreatePackageAvailable: true,
    githubOrgOrUserAvailable: true,
    githubGreyvritraRepoAvailable: true,
    domainRegistrarCheckRequired: true,
    legalClearanceRequired: true,
    npmFindings: npmFindings(),
    githubFindings: githubFindings(),
    domainFindings: domainFindings(),
    webFindings: webFindings(),
    registryFindings: registryFindings(),
    trademarkFindings: trademarkFindings(),
    discardedNames: discardedNames(),
    reservationActions: reservationActions(),
    blockedActions: blockedActions(),
    commandsExecuted: commandsExecuted(),
    finalState: {
      renamePerformed: false,
      npmPublishPerformed: false,
      domainPurchasePerformed: false,
      githubReservationPerformed: false,
      packageNameChanged: false,
      publicIdentityChanged: false,
      installerChanged: false,
      versionOrDistTagChanged: false,
      runtimePersistentStartPerformed: false,
      providerToolCommandMessageExecuted: false,
      rawHistoryImported: false,
      globalAdapterRemoved: false,
      rawSecretSerialized: false,
    },
  };
}

export class ZavorthNamingReservationGate {
  public constructor(public readonly normalization: ZavorthNamingReservationGateNormalization) {}

  public renameAllowed(): boolean {
    return false;
  }

  public blockedActionPerformed(): boolean {
    return this.normalization.blockedActions.some((action) => action.performed);
  }

  public manualReservationRequired(): boolean {
    return this.normalization.reservationActions.some((action) => action.requiredBeforeRename);
  }
}

export function createZavorthNamingReservationGateFixture(): ZavorthNamingReservationGate {
  return new ZavorthNamingReservationGate(
    normalizeZavorthNamingReservationGate({
      generatedAt: ZAVORTH_NAMING_RESERVATION_GATE_NOW,
    }),
  );
}
