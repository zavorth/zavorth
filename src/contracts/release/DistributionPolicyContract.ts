export type DistributionPolicyCheckStatus = 'pass' | 'warn' | 'fail';

export type DistributionPolicyCheck = {
  id: string;
  title: string;
  status: DistributionPolicyCheckStatus;
  reason: string;
  path?: string;
  evidence?: string[];
};

export type DistributionPolicyScreenshotSpec = {
  id: 'desktop' | 'mobile';
  fileName: string;
  viewport: {
    width: number;
    height: number;
  };
};

export type DistributionPolicyContractSnapshot = {
  phase: '50';
  surface: 'distribution-policy';
  generatedAt: string;
  status: 'ready' | 'attention' | 'blocked';
  websiteRoot: string;
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  route: '/editions';
  fixturePath: 'data/distribution-policy.ts';
  requiredEditions: string[];
  requiredPolicies: string[];
  screenshots: DistributionPolicyScreenshotSpec[];
  checks: DistributionPolicyCheck[];
  nextRecommendedPhase: {
    phase: '51';
    title: string;
    reason: string;
  };
};

export const DISTRIBUTION_POLICY_REQUIRED_EDITIONS = [
  'Local',
  'Pro Preview',
  'Team Preview',
  'Lab',
] as const;

export const DISTRIBUTION_POLICY_REQUIRED_POLICIES = [
  'Privacidade e dados',
  'Atualizacoes',
  'Plugins e skills externos',
  'Licenciamento inicial',
  'alpha',
  'beta',
  'stable',
] as const;

export const DISTRIBUTION_POLICY_REQUIRED_COPY = [
  'Editions, plans and distribution policy',
  'local-first',
  'Telemetry disabled by default',
  'cloud required',
  'opt-in',
  'No required cloud',
  'Local-first remains functional without a cloud account',
] as const;

export const DISTRIBUTION_POLICY_REQUIRED_LINKS = [
  '/editions',
  '/docs#distribution-policy',
  '/examples',
] as const;

export const DISTRIBUTION_POLICY_FORBIDDEN_CLAIMS = [
  'C:\\TESTES DEV',
  'autonomous without approval',
  'without limits',
  'telemetry enabled by default',
  'cloud required to use',
] as const;

export const DISTRIBUTION_POLICY_SCREENSHOTS: DistributionPolicyScreenshotSpec[] = [
  {
    id: 'desktop',
    fileName: 'distribution-policy-desktop.png',
    viewport: { width: 1440, height: 1200 },
  },
  {
    id: 'mobile',
    fileName: 'distribution-policy-mobile.png',
    viewport: { width: 390, height: 1200 },
  },
];
