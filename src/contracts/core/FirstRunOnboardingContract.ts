export type FirstRunOnboardingCheckStatus = 'pass' | 'warn' | 'fail';

export type FirstRunOnboardingCheck = {
  id: string;
  title: string;
  status: FirstRunOnboardingCheckStatus;
  reason: string;
  path?: string;
  evidence?: string[];
};

export type FirstRunOnboardingScreenshotSpec = {
  id: 'desktop' | 'mobile';
  fileName: string;
  viewport: {
    width: number;
    height: number;
  };
};

export type FirstRunOnboardingContractSnapshot = {
  phase: '48';
  surface: 'first-run-onboarding';
  generatedAt: string;
  status: 'ready' | 'attention' | 'blocked';
  websiteRoot: string;
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  route: '/start';
  fixturePath: 'data/first-run.ts';
  requiredStates: string[];
  requiredArtifacts: string[];
  screenshots: FirstRunOnboardingScreenshotSpec[];
  checks: FirstRunOnboardingCheck[];
  nextRecommendedPhase: {
    phase: '49';
    title: string;
    reason: string;
  };
};

export const FIRST_RUN_REQUIRED_STATES = [
  'requirements',
  'preview',
  'install',
  'first-run',
  'health-check',
  'cleanup',
  'Ready',
  'Missing requirement',
  'Approval needed',
  'Cleanup available',
] as const;

export const FIRST_RUN_REQUIRED_ARTIFACTS = [
  'first-run-plan.json',
  'first-run-health.json',
  'first-run-cleanup-preview',
  'fixture/zavorth-first-run-workspace',
] as const;

export const FIRST_RUN_REQUIRED_COPY = [
  'Local first run',
  'First run',
  'Checklist',
  'Requirements detector',
  'Setup preview',
  'Health check',
  'Rollback and cleanup',
  'npm run go',
] as const;

export const FIRST_RUN_FORBIDDEN_CLAIMS = [
  'C:\\TESTES DEV',
  'autonomous without approval',
  'without limits',
  'starts persistent watcher by default',
] as const;

export const FIRST_RUN_SCREENSHOTS: FirstRunOnboardingScreenshotSpec[] = [
  {
    id: 'desktop',
    fileName: 'first-run-desktop.png',
    viewport: { width: 1440, height: 1200 },
  },
  {
    id: 'mobile',
    fileName: 'first-run-mobile.png',
    viewport: { width: 390, height: 1200 },
  },
];
