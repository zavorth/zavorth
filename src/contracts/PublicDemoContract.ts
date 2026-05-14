export type PublicDemoCheckStatus = 'pass' | 'warn' | 'fail';

export type PublicDemoCheck = {
  id: string;
  title: string;
  status: PublicDemoCheckStatus;
  reason: string;
  path?: string;
  evidence?: string[];
};

export type PublicDemoScreenshotSpec = {
  id: 'desktop' | 'mobile';
  fileName: string;
  viewport: {
    width: number;
    height: number;
  };
};

export type PublicDemoContractSnapshot = {
  phase: '47';
  surface: 'public-demo';
  generatedAt: string;
  status: 'ready' | 'attention' | 'blocked';
  websiteRoot: string;
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  route: '/demo';
  fixturePath: 'data/public-demo.ts';
  requiredStates: string[];
  requiredArtifacts: string[];
  screenshots: PublicDemoScreenshotSpec[];
  checks: PublicDemoCheck[];
  nextRecommendedPhase: {
    phase: '48';
    title: string;
    reason: string;
  };
};

export const PUBLIC_DEMO_REQUIRED_STATES = [
  'request',
  'plan',
  'approval',
  'execution',
  'artifact',
  'replay',
  'summary',
  'Success',
  'Error',
  'Approval',
  'Rollback',
] as const;

export const PUBLIC_DEMO_REQUIRED_ARTIFACTS = [
  'demo-build-fix-report.md',
  'demo-run-2026-04-25.json',
  'fixture/zavorth-demo-workspace',
] as const;

export const PUBLIC_DEMO_REQUIRED_COPY = [
  'Build fix com aprovacao e replay',
  'Public demo',
  'Guided story',
  'Um fluxo completo',
  'Estados cobertos',
  'Chat comum',
  'Zavorth',
] as const;

export const PUBLIC_DEMO_FORBIDDEN_CLAIMS = [
  'C:\\TESTES DEV',
  'autonomo sem aprovacao',
  'sem limites',
  'sempre ligado por padrao',
] as const;

export const PUBLIC_DEMO_SCREENSHOTS: PublicDemoScreenshotSpec[] = [
  {
    id: 'desktop',
    fileName: 'demo-desktop.png',
    viewport: { width: 1440, height: 1200 },
  },
  {
    id: 'mobile',
    fileName: 'demo-mobile.png',
    viewport: { width: 390, height: 1200 },
  },
];
