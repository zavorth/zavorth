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
  'sem rollback',
  'breaking change silencioso',
  'minor sem planejamento',
  'tag manual sem commit',
  'exige processo sempre ligado',
] as const;

export const RELEASE_TRAIN_VERSION_POLICIES: ReleaseTrainVersionPolicy[] = [
  {
    lane: 'baseline',
    versionPattern: 'v1.0.0',
    purpose: 'baseline publico estavel para o ciclo 53-59',
    allowedScope: ['documentar baseline', 'referenciar tags', 'referenciar GitHub Releases'],
    requiresApprovedPlanning: false,
    requiresRollback: true,
    gates: ['qa:public-product', 'qa:phase:59', 'release:status:fast'],
  },
  {
    lane: 'patch',
    versionPattern: 'v1.0.x',
    purpose: 'hotfix estreito para bug, docs, seguranca ou installer',
    allowedScope: ['bugfix pequeno', 'docs publica', 'security fix', 'rollback/hotfix'],
    requiresApprovedPlanning: false,
    requiresRollback: true,
    gates: ['qa:release-train', 'release:rollback-preview', 'release:changelog'],
  },
  {
    lane: 'minor',
    versionPattern: 'v1.1.0',
    purpose: 'novo ciclo de feature aprovado antes de implementacao',
    allowedScope: ['fase nova aprovada', 'docs de arquitetura', 'gate dedicado'],
    requiresApprovedPlanning: true,
    requiresRollback: true,
    gates: ['qa:architecture', 'qa:release-train', 'qa:phase:new-cycle'],
  },
  {
    lane: 'breaking',
    versionPattern: 'v2.0.0',
    purpose: 'mudanca quebrante com ciclo explicito e migracao',
    allowedScope: ['novo ciclo explicito', 'migration guide', 'deprecation window'],
    requiresApprovedPlanning: true,
    requiresRollback: true,
    gates: ['qa:architecture', 'qa:release-train', 'migration:preview'],
  },
];

export const RELEASE_TRAIN_CALENDAR: ReleaseTrainCalendarItem[] = [
  {
    id: 'rc-window',
    cadence: 'per-release',
    trigger: 'quando uma versao candidata esta pronta para publicar',
    owner: 'release operator',
    output: 'release candidate checklist preenchido',
    alwaysOn: false,
  },
  {
    id: 'patch-hotfix',
    cadence: 'on-demand',
    trigger: 'bug, security ou docs blocker em v1.0.x',
    owner: 'maintainer',
    output: 'hotfix branch, changelog e rollback preview',
    alwaysOn: false,
  },
  {
    id: 'minor-planning',
    cadence: 'per-minor',
    trigger: 'quando v1.1.0 ou feature train for proposto',
    owner: 'product/architecture',
    output: 'documento de fase aprovado antes de implementacao',
    alwaysOn: false,
  },
  {
    id: 'lts-review',
    cadence: 'per-release',
    trigger: 'antes de encerrar suporte de uma linha v1.x',
    owner: 'release operator',
    output: 'decisao LTS registrada no release train',
    alwaysOn: false,
  },
];

export const RELEASE_CANDIDATE_CHECKLIST: ReleaseCandidateChecklistItem[] = [
  {
    id: 'status',
    label: 'release status',
    required: true,
    command: 'npm run release:status:fast',
    evidence: 'canal, risco e next action revisados',
  },
  {
    id: 'bundle',
    label: 'bundle e installer',
    required: true,
    command: 'npm run qa:release-bundle',
    evidence: 'bundle, digest, installer preview e rollback validados',
  },
  {
    id: 'distribution',
    label: 'distribution hardening',
    required: true,
    command: 'npm run qa:distribution-hardening',
    evidence: 'manifest, checksums e smoke local verdes',
  },
  {
    id: 'integrations',
    label: 'integration showcase',
    required: true,
    command: 'npm run qa:integration-showcase',
    evidence: 'fixtures de integracao e partner surface verdes',
  },
  {
    id: 'rollback',
    label: 'rollback preview',
    required: true,
    command: 'npm run release:rollback-preview',
    evidence: 'rollback sem delecao fora do escopo',
  },
  {
    id: 'changelog',
    label: 'changelog publico',
    required: true,
    command: 'npm run release:changelog',
    evidence: 'notas publicas com risco, rollback e versao',
  },
];

export const HOTFIX_PLAYBOOK: HotfixPlaybookStep[] = [
  {
    id: 'classify',
    label: 'classificar hotfix v1.0.x',
    rollback: 'se escopo crescer, cancelar hotfix e abrir planejamento v1.1.0',
    evidence: 'issue/feedback com severidade e area',
  },
  {
    id: 'branch',
    label: 'criar branch a partir do baseline/tag estavel',
    command: 'git switch -c hotfix/v1.0.x',
    rollback: 'descartar branch se nao houver patch estreito',
    evidence: 'branch isolada sem feature nova',
  },
  {
    id: 'validate',
    label: 'rodar gate de release train',
    command: 'npm run qa:release-train',
    rollback: 'bloquear publish se gate falhar',
    evidence: 'snapshot release-train ready',
  },
  {
    id: 'publish',
    label: 'publicar tag e GitHub Release apontando para main',
    command: 'npm run release:changelog',
    rollback: 'usar release:rollback-preview antes de qualquer reversao',
    evidence: 'tag, release notes e commit final em main',
  },
];
