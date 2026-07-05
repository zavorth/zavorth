export type IntegrationShowcaseCheckStatus = 'pass' | 'warn' | 'fail';

export type IntegrationShowcaseCheck = {
  id: string;
  title: string;
  status: IntegrationShowcaseCheckStatus;
  reason: string;
  path?: string;
  evidence?: string[];
};

export type IntegrationShowcaseCategory =
  | 'collaboration'
  | 'code-hosting'
  | 'deployment'
  | 'design';

export type IntegrationShowcaseMode = 'fixture' | 'local' | 'credential';

export type IntegrationShowcaseItem = {
  id: 'slack' | 'github' | 'vercel' | 'figma';
  vendor: string;
  category: IntegrationShowcaseCategory;
  publicRoute: string;
  modes: IntegrationShowcaseMode[];
  capabilities: string[];
  requirements: string[];
  fixtureAvailable: boolean;
  requiresSecretsForLive: boolean;
  smokeCommand: string;
  safeDegradation: string;
  trustPlaneControls: string[];
  partnerStatus: 'compatible' | 'registered-partner';
  formalPartnerRegistered: boolean;
  partnerClaim: string;
  evidence: string[];
};

export type IntegrationCapabilityMatrixEntry = {
  id: IntegrationShowcaseItem['id'];
  vendor: string;
  category: IntegrationShowcaseCategory;
  capabilities: string[];
  modes: IntegrationShowcaseMode[];
  fixtureAvailable: boolean;
  credentialRequiredForLive: boolean;
  degradation: string;
};

export type PartnerSurfacePolicy = {
  registryRequiredForFormalClaim: boolean;
  allowedClaims: string[];
  prohibitedClaims: string[];
  auditArtifacts: string[];
  reviewCadence: string;
};

export type IntegrationShowcaseSmokeResult = {
  id: IntegrationShowcaseItem['id'];
  vendor: string;
  status: 'pass' | 'fail';
  mode: 'fixture';
  networkRequired: boolean;
  secretsRequired: boolean;
  mutatesExternalSystems: boolean;
  degradedSafely: boolean;
  evidence: string[];
};

export type IntegrationShowcaseSnapshot = {
  phase: '58';
  surface: 'integration-showcase';
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
  routes: ['/integrations', '/docs#integration-showcase'];
  integrations: IntegrationShowcaseItem[];
  matrix: IntegrationCapabilityMatrixEntry[];
  partnerPolicy: PartnerSurfacePolicy;
  artifacts: {
    smokePath: string;
    matrixPath: string;
    partnerSurfacePath: string;
  };
  checks: IntegrationShowcaseCheck[];
  nextRecommendedPhase: {
    phase: '59';
    title: string;
    reason: string;
  };
};

export const INTEGRATION_SHOWCASE_REQUIRED_CORE_SCRIPTS = [
  'integration-showcase',
  'qa:integration-showcase',
  'qa:phase:58',
  'pilot-loop',
  'qa:pilot-loop',
  'public-docs-recipes',
  'qa:public-docs-recipes',
  'feedback:preview',
  'ops:trust-plane',
] as const;

export const INTEGRATION_SHOWCASE_REQUIRED_WEBSITE_FILES = [
  'app/integrations/page.tsx',
  'data/integration-showcase.ts',
  'scripts/integration-showcase-check.mjs',
  'app/docs/page.tsx',
  'components/ConnectsSection.tsx',
  'package.json',
] as const;

export const INTEGRATION_SHOWCASE_REQUIRED_WEBSITE_SCRIPTS = [
  'integration-showcase',
  'qa:integration-showcase',
  'website:build',
] as const;

export const INTEGRATION_SHOWCASE_REQUIRED_WEBSITE_TERMS = [
  'Integration Showcase And Partner Surface',
  'Slack',
  'GitHub',
  'Vercel',
  'Figma',
  'fixture',
  'local',
  'real credential',
  'safe degradation',
  'Trust Plane',
  'approval',
  'audit trail',
  'auditable partner surface',
  'no formal partnership promised',
  'npm run integration-showcase',
  'npm run qa:integration-showcase',
] as const;

export const INTEGRATION_SHOWCASE_FORBIDDEN_CLAIMS = [
  'guaranteed official partnership',
  'we are an official partner',
  'official partner',
  'vendor endorsed',
  'credential required',
  'without Trust Plane',
  'bypass Trust Plane',
  'cloud required',
] as const;

export const INTEGRATION_SHOWCASE_ITEMS: IntegrationShowcaseItem[] = [
  {
    id: 'slack',
    vendor: 'Slack',
    category: 'collaboration',
    publicRoute: '/integrations#slack',
    modes: ['fixture', 'credential'],
    capabilities: ['thread triage', 'support reply draft', 'feedback intake'],
    requirements: ['Slack token only for real sending', 'workspace and channel explicitly approved'],
    fixtureAvailable: true,
    requiresSecretsForLive: true,
    smokeCommand: 'npm run integration-showcase -- --smoke',
    safeDegradation: 'Without a token, generates a redacted preview and does not send a message.',
    trustPlaneControls: ['approval before send', 'redaction policy', 'audit trail'],
    partnerStatus: 'compatible',
    formalPartnerRegistered: false,
    partnerClaim: 'Documented technical compatibility; no formal partnership.',
    evidence: ['slack fixture', 'feedback loop', 'support triage'],
  },
  {
    id: 'github',
    vendor: 'GitHub',
    category: 'code-hosting',
    publicRoute: '/integrations#github',
    modes: ['fixture', 'local', 'credential'],
    capabilities: ['pull request draft', 'check summary', 'release notes'],
    requirements: ['authenticated gh only for publishing', 'repository authorized by scope'],
    fixtureAvailable: true,
    requiresSecretsForLive: true,
    smokeCommand: 'npm run integration-showcase -- --smoke',
    safeDegradation: 'Without auth, generates a plan, diff, and PR body without publishing.',
    trustPlaneControls: ['diff preview', 'repo-scoped policy', 'rollback note', 'audit trail'],
    partnerStatus: 'compatible',
    formalPartnerRegistered: false,
    partnerClaim: 'Compatibility through public API/CLI; no vendor endorsement.',
    evidence: ['git fixture', 'PR body fixture', 'release notes fixture'],
  },
  {
    id: 'vercel',
    vendor: 'Vercel',
    category: 'deployment',
    publicRoute: '/integrations#vercel',
    modes: ['fixture', 'credential'],
    capabilities: ['preview deploy status', 'runtime log review', 'assisted rollback'],
    requirements: ['real token only for deploy', 'linked and approved project'],
    fixtureAvailable: true,
    requiresSecretsForLive: true,
    smokeCommand: 'npm run integration-showcase -- --smoke',
    safeDegradation: 'Without a token, validates contract and shows a safe command without publishing build.',
    trustPlaneControls: ['deploy budget', 'publish approval', 'audit trail'],
    partnerStatus: 'compatible',
    formalPartnerRegistered: false,
    partnerClaim: 'Partner surface cataloged; no formal partnership promised.',
    evidence: ['deploy status fixture', 'rollback fixture', 'budget control'],
  },
  {
    id: 'figma',
    vendor: 'Figma',
    category: 'design',
    publicRoute: '/integrations#figma',
    modes: ['fixture', 'credential'],
    capabilities: ['component mapping', 'handoff review', 'design token audit'],
    requirements: ['real file and token only for approved operation', 'scope by file key'],
    fixtureAvailable: true,
    requiresSecretsForLive: true,
    smokeCommand: 'npm run integration-showcase -- --smoke',
    safeDegradation: 'Without access, creates a handoff checklist and public gaps.',
    trustPlaneControls: ['file-scoped policy', 'change preview', 'audit trail'],
    partnerStatus: 'compatible',
    formalPartnerRegistered: false,
    partnerClaim: 'Integrates as an auditable surface, with no formal partnership claim.',
    evidence: ['node fixture', 'component map fixture', 'token audit fixture'],
  },
];

export const INTEGRATION_CAPABILITY_MATRIX: IntegrationCapabilityMatrixEntry[] = INTEGRATION_SHOWCASE_ITEMS.map((item) => ({
  id: item.id,
  vendor: item.vendor,
  category: item.category,
  capabilities: item.capabilities,
  modes: item.modes,
  fixtureAvailable: item.fixtureAvailable,
  credentialRequiredForLive: item.requiresSecretsForLive,
  degradation: item.safeDegradation,
}));

export const PARTNER_SURFACE_POLICY: PartnerSurfacePolicy = {
  registryRequiredForFormalClaim: true,
  allowedClaims: [
    'technical compatibility',
    'demonstrable fixture',
    'supported public API or CLI',
    'auditable partner surface',
  ],
  prohibitedClaims: [
    'official partnership without registry',
    'vendor endorsed without contract',
    'credential required to try',
    'Trust Plane bypass',
  ],
  auditArtifacts: [
    'integration-smoke.json',
    'capability-matrix.json',
    'partner-surface.json',
  ],
  reviewCadence: 'review on each v1.x release train or vendor API change',
};
