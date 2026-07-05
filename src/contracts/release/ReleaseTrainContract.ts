export type ReleaseTrainCheckStatus = 'pass' | 'warn' | 'fail';

export type ReleaseTrainCheck = {
  id: string;
  title: string;
  status: ReleaseTrainCheckStatus;
  reason: string;
  path?: string;
  evidence?: string[];
};

export type ReleaseTrainLane = 'baseline' | 'patch' | 'minor' | 'breaking';

export type ReleaseTrainVersionPolicy = {
  lane: ReleaseTrainLane;
  versionPattern: string;
  purpose: string;
  allowedScope: string[];
  requiresApprovedPlanning: boolean;
  requiresRollback: boolean;
  gates: string[];
};

export type ReleaseTrainCalendarItem = {
  id: string;
  cadence: 'on-demand' | 'per-release' | 'per-minor';
  trigger: string;
  owner: string;
  output: string;
  alwaysOn: boolean;
};

export type ReleaseCandidateChecklistItem = {
  id: string;
  label: string;
  required: boolean;
  command?: string;
  evidence: string;
};

export type HotfixPlaybookStep = {
  id: string;
  label: string;
  command?: string;
  rollback: string;
  evidence: string;
};

export type ReleaseTrainArtifactResult = {
  id: string;
  status: 'pass' | 'fail';
  evidence: string[];
};

export type ReleaseTrainSnapshot = {
  phase: '59';
  surface: 'release-train';
  generatedAt: string;
  status: 'ready' | 'attention' | 'blocked';
  projectRoot: string;
  websiteRoot: string;
  artifactDir: string;
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  baseline: {
    version: 'v1.0.0';
    channel: 'stable';
    packageVersion: string;
  };
  policies: ReleaseTrainVersionPolicy[];
  calendar: ReleaseTrainCalendarItem[];
  releaseCandidateChecklist: ReleaseCandidateChecklistItem[];
  hotfixPlaybook: HotfixPlaybookStep[];
  artifacts: {
    planPath: string;
    checklistPath: string;
    hotfixPath: string;
  };
  checks: ReleaseTrainCheck[];
  nextRecommendedAction: {
    id: 'cycle-closed';
    title: string;
    reason: string;
  };
};

export const RELEASE_TRAIN_REQUIRED_CORE_SCRIPTS = [
  'release-train',
  'qa:release-train',
  'qa:phase:59',
  'release:status:fast',
  'release:rollback-preview',
  'release:changelog',
  'distribution-hardening',
  'qa:distribution-hardening',
  'release-bundle',
  'qa:release-bundle',
  'integration-showcase',
  'qa:integration-showcase',
  'qa:phase:53',
  'qa:phase:54',
  'qa:phase:55',
  'qa:phase:56',
  'qa:phase:57',
  'qa:phase:58',
] as const;

export const RELEASE_TRAIN_REQUIRED_WEBSITE_FILES = [
  'app/release/page.tsx',
  'app/changelog/page.tsx',
  'app/docs/page.tsx',
  'data/release-bundle.ts',
] as const;

export const RELEASE_TRAIN_REQUIRED_WEBSITE_TERMS = [
  'v1.0.0',
  'v1.0.x',
  'v1.1.0',
  'release train',
  'LTS',
  'hotfix',
  'release candidate',
  'rollback',
  'GitHub Releases',
  'tags',
  'qa:release-train',
  'qa:phase:59',
] as const;

export const RELEASE_TRAIN_FORBIDDEN_CLAIMS = [
  'without rollback',
  'silent breaking change',
  'minor without planning',
  'manual tag without commit',
  'requires always-on process',
] as const;

export const RELEASE_TRAIN_VERSION_POLICIES: ReleaseTrainVersionPolicy[] = [
  {
    lane: 'baseline',
    versionPattern: 'v1.0.0',
    purpose: 'stable public baseline for cycle 53-59',
    allowedScope: ['document baseline', 'reference tags', 'reference GitHub Releases'],
    requiresApprovedPlanning: false,
    requiresRollback: true,
    gates: ['qa:public-product', 'qa:phase:59', 'release:status:fast'],
  },
  {
    lane: 'patch',
    versionPattern: 'v1.0.x',
    purpose: 'narrow hotfix for bug, docs, security, or installer',
    allowedScope: ['small bugfix', 'public docs', 'security fix', 'rollback/hotfix'],
    requiresApprovedPlanning: false,
    requiresRollback: true,
    gates: ['qa:release-train', 'release:rollback-preview', 'release:changelog'],
  },
  {
    lane: 'minor',
    versionPattern: 'v1.1.0',
    purpose: 'new feature cycle approved before implementation',
    allowedScope: ['approved new stage', 'architecture docs', 'dedicated gate'],
    requiresApprovedPlanning: true,
    requiresRollback: true,
    gates: ['qa:architecture', 'qa:release-train', 'qa:phase:new-cycle'],
  },
  {
    lane: 'breaking',
    versionPattern: 'v2.0.0',
    purpose: 'breaking change with explicit cycle and migration',
    allowedScope: ['explicit new cycle', 'migration guide', 'deprecation window'],
    requiresApprovedPlanning: true,
    requiresRollback: true,
    gates: ['qa:architecture', 'qa:release-train', 'migration:preview'],
  },
];

export const RELEASE_TRAIN_CALENDAR: ReleaseTrainCalendarItem[] = [
  {
    id: 'rc-window',
    cadence: 'per-release',
    trigger: 'when a release candidate is ready to publish',
    owner: 'release operator',
    output: 'completed release candidate checklist',
    alwaysOn: false,
  },
  {
    id: 'patch-hotfix',
    cadence: 'on-demand',
    trigger: 'bug, security, or docs blocker in v1.0.x',
    owner: 'maintainer',
    output: 'hotfix branch, changelog, and rollback preview',
    alwaysOn: false,
  },
  {
    id: 'minor-planning',
    cadence: 'per-minor',
    trigger: 'when v1.1.0 or a feature train is proposed',
    owner: 'product/architecture',
    output: 'stage document approved before implementation',
    alwaysOn: false,
  },
  {
    id: 'lts-review',
    cadence: 'per-release',
    trigger: 'before ending support for a v1.x line',
    owner: 'release operator',
    output: 'LTS decision recorded in the release train',
    alwaysOn: false,
  },
];

export const RELEASE_CANDIDATE_CHECKLIST: ReleaseCandidateChecklistItem[] = [
  {
    id: 'status',
    label: 'release status',
    required: true,
    command: 'npm run release:status:fast',
    evidence: 'channel, risk, and next action reviewed',
  },
  {
    id: 'bundle',
    label: 'bundle and installer',
    required: true,
    command: 'npm run qa:release-bundle',
    evidence: 'bundle, digest, installer preview, and rollback validated',
  },
  {
    id: 'distribution',
    label: 'distribution hardening',
    required: true,
    command: 'npm run qa:distribution-hardening',
    evidence: 'manifest, checksums, and local smoke are green',
  },
  {
    id: 'integrations',
    label: 'integration showcase',
    required: true,
    command: 'npm run qa:integration-showcase',
    evidence: 'integration fixtures and partner surface are green',
  },
  {
    id: 'rollback',
    label: 'rollback preview',
    required: true,
    command: 'npm run release:rollback-preview',
    evidence: 'rollback without deletion outside scope',
  },
  {
    id: 'changelog',
    label: 'public changelog',
    required: true,
    command: 'npm run release:changelog',
    evidence: 'public notes with risk, rollback, and version',
  },
];

export const HOTFIX_PLAYBOOK: HotfixPlaybookStep[] = [
  {
    id: 'classify',
    label: 'classify hotfix v1.0.x',
    rollback: 'if scope grows, cancel hotfix and open v1.1.0 planning',
    evidence: 'issue/feedback with severity and area',
  },
  {
    id: 'branch',
    label: 'create branch from stable baseline/tag',
    command: 'git switch -c hotfix/v1.0.x',
    rollback: 'discard branch if there is no narrow patch',
    evidence: 'isolated branch with no new feature',
  },
  {
    id: 'validate',
    label: 'run release train gate',
    command: 'npm run qa:release-train',
    rollback: 'block publish if the gate fails',
    evidence: 'snapshot release-train ready',
  },
  {
    id: 'publish',
    label: 'publish tag and GitHub Release pointing to main',
    command: 'npm run release:changelog',
    rollback: 'use release:rollback-preview before any reversal',
    evidence: 'tag, release notes, and final commit on main',
  },
];
