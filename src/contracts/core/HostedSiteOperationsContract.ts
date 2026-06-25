export type HostedSiteOperationsCheckStatus = 'pass' | 'warn' | 'fail';

export type HostedSiteOperationsCheck = {
  id: string;
  title: string;
  status: HostedSiteOperationsCheckStatus;
  reason: string;
  path?: string;
  evidence?: string[];
};

export type HostedSiteRouteSpec = {
  route: string;
  label: string;
  sourcePaths: string[];
  outputCandidates: string[];
  requiredPhrases: string[];
};

export type HostedSiteScreenshotSpec = {
  id: 'landing-desktop' | 'landing-mobile';
  route: '/';
  fileName: string;
  viewport: {
    width: number;
    height: number;
  };
};

export type HostedSiteDeployTarget = {
  id: 'local-static' | 'preview' | 'production';
  label: string;
  command: string;
  guardrail: string;
};

export type HostedSiteRunbookStep = {
  id: string;
  label: string;
  command: string;
  proof: string;
  rollback: string;
};

export type HostedSiteOperationsSnapshot = {
  phase: '54';
  surface: 'hosted-site-operations';
  generatedAt: string;
  projectRoot: string;
  websiteRoot: string;
  status: 'ready' | 'attention' | 'blocked';
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  release: {
    expectedVersion: 'v1.0.0';
    packageVersion: string;
    websiteVersion: string;
  };
  requiredRoutes: HostedSiteRouteSpec[];
  deployTargets: HostedSiteDeployTarget[];
  rollbackRunbook: HostedSiteRunbookStep[];
  screenshots: HostedSiteScreenshotSpec[];
  checks: HostedSiteOperationsCheck[];
  nextRecommendedPhase: {
    phase: '55';
    title: string;
    reason: string;
  };
};

export const HOSTED_SITE_REQUIRED_CORE_SCRIPTS = [
  'website:build',
  'website:public',
  'qa:website-public',
  'public-demo',
  'qa:public-demo',
  'hosted-site',
  'qa:hosted-site',
  'qa:phase:54',
] as const;

export const HOSTED_SITE_REQUIRED_WEBSITE_SCRIPTS = [
  'website:build',
  'website:public',
  'public-demo',
  'qa:website-public',
  'qa:public-demo',
] as const;

export const HOSTED_SITE_REQUIRED_ROUTES: HostedSiteRouteSpec[] = [
  {
    route: '/',
    label: 'landing publica',
    sourcePaths: [
      'app/page.tsx',
      'components/Hero.tsx',
      'components/DemoSection.tsx',
      'components/RuntimeSection.tsx',
      'components/CTASection.tsx',
    ],
    outputCandidates: ['index.html'],
    requiredPhrases: ['Zavorth', 'Agent Runtime', 'Local-first', '/demo', '/start'],
  },
  {
    route: '/demo',
    label: 'demo publica guiada',
    sourcePaths: ['app/demo/page.tsx', 'data/public-demo.ts'],
    outputCandidates: ['demo.html', 'demo/index.html'],
    requiredPhrases: ['Public demo', 'Guided story', 'fixture', 'sem secrets'],
  },
  {
    route: '/start',
    label: 'first run publico',
    sourcePaths: ['app/start/page.tsx', 'data/first-run.ts'],
    outputCandidates: ['start.html', 'start/index.html'],
    requiredPhrases: ['First run', 'preview', 'cleanup'],
  },
  {
    route: '/docs',
    label: 'docs publicas',
    sourcePaths: ['app/docs/page.tsx', 'data/external-docs.ts'],
    outputCandidates: ['docs.html', 'docs/index.html'],
    requiredPhrases: ['Quickstart', 'npm run go', 'release', 'feedback'],
  },
  {
    route: '/release',
    label: 'release verificavel',
    sourcePaths: ['app/release/page.tsx', 'data/release-bundle.ts'],
    outputCandidates: ['release.html', 'release/index.html'],
    requiredPhrases: ['Release', 'v1.0.0', 'sha256', 'rollback'],
  },
  {
    route: '/feedback',
    label: 'feedback opt-in',
    sourcePaths: ['app/feedback/page.tsx', 'data/feedback-loop.ts'],
    outputCandidates: ['feedback.html', 'feedback/index.html'],
    requiredPhrases: ['Feedback', 'opt-in', 'preview', 'revoke'],
  },
];

export const HOSTED_SITE_SCREENSHOTS: HostedSiteScreenshotSpec[] = [
  {
    id: 'landing-desktop',
    route: '/',
    fileName: 'hosted-landing-desktop.png',
    viewport: { width: 1440, height: 1200 },
  },
  {
    id: 'landing-mobile',
    route: '/',
    fileName: 'hosted-landing-mobile.png',
    viewport: { width: 390, height: 1100 },
  },
];

export const HOSTED_SITE_DEPLOY_TARGETS: HostedSiteDeployTarget[] = [
  {
    id: 'local-static',
    label: 'Export local estatico',
    command: 'npm run website:build',
    guardrail: 'Roda com ZAVORTH_NEXT_DIST_DIR=.next-zavorth-qa e out/ limpo antes do smoke.',
  },
  {
    id: 'preview',
    label: 'Preview publicavel',
    command: 'vercel deploy --prebuilt',
    guardrail: 'Preview fica separado de producao e exige smoke antes de promote.',
  },
  {
    id: 'production',
    label: 'Promote controlado',
    command: 'vercel promote <preview-url>',
    guardrail: 'Producao so recebe build ja validado e com rollback documentado.',
  },
];

export const HOSTED_SITE_ROLLBACK_RUNBOOK: HostedSiteRunbookStep[] = [
  {
    id: 'preflight',
    label: 'Preflight local',
    command: 'npm run website:build',
    proof: 'out/ gerado sem depender de next dev vivo.',
    rollback: 'Apagar apenas out/ e .next-zavorth-qa se o build falhar.',
  },
  {
    id: 'smoke',
    label: 'Smoke estatico',
    command: 'npm run hosted-site -- --smoke',
    proof: 'Rotas /, /demo, /start, /docs, /release e /feedback retornam 200.',
    rollback: 'Nao publicar preview se qualquer rota falhar.',
  },
  {
    id: 'preview',
    label: 'Deploy preview',
    command: 'vercel deploy --prebuilt',
    proof: 'URL preview separada de producao e pronta para revisao.',
    rollback: 'Abandonar preview e manter producao atual.',
  },
  {
    id: 'publish',
    label: 'Promote/publish',
    command: 'vercel promote <preview-url>',
    proof: 'Promote acontece apenas depois do smoke e screenshots.',
    rollback: 'Promover ultimo deployment bom ou reverter alias para release anterior.',
  },
];

export const HOSTED_SITE_FORBIDDEN_VISUAL_CLAIMS = [
  'C:\\TESTES DEV',
  '100% seguro',
  'sem limites',
  'always-on',
  'autonomo sem aprovacao',
  'production without rollback',
] as const;
