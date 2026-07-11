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
  gate: 'hosted-site-operations';
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
  nextRecommendedGate: {
    gate: 'distribution-hardening';
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
  'qa:hosted-site-operations',
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
    label: 'public landing',
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
    label: 'guided public demo',
    sourcePaths: ['app/demo/page.tsx', 'data/public-demo.ts'],
    outputCandidates: ['demo.html', 'demo/index.html'],
    requiredPhrases: ['Public demo', 'Guided story', 'fixture', 'no secrets'],
  },
  {
    route: '/start',
    label: 'public first run',
    sourcePaths: ['app/start/page.tsx', 'data/first-run.ts'],
    outputCandidates: ['start.html', 'start/index.html'],
    requiredPhrases: ['First run', 'preview', 'cleanup'],
  },
  {
    route: '/docs',
    label: 'public docs',
    sourcePaths: ['app/docs/page.tsx', 'data/external-docs.ts'],
    outputCandidates: ['docs.html', 'docs/index.html'],
    requiredPhrases: ['Quickstart', 'npm run go', 'release', 'feedback'],
  },
  {
    route: '/release',
    label: 'verifiable release',
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
    label: 'Local static export',
    command: 'npm run website:build',
    guardrail: 'Runs with ZAVORTH_NEXT_DIST_DIR=.next-zavorth-qa and clean out/ before smoke.',
  },
  {
    id: 'preview',
    label: 'Publishable preview',
    command: 'vercel deploy --prebuilt',
    guardrail: 'Preview stays separate from production and requires smoke before promote.',
  },
  {
    id: 'production',
    label: 'Controlled promote',
    command: 'vercel promote <preview-url>',
    guardrail: 'Production only receives an already validated build with documented rollback.',
  },
];

export const HOSTED_SITE_ROLLBACK_RUNBOOK: HostedSiteRunbookStep[] = [
  {
    id: 'preflight',
    label: 'Preflight local',
    command: 'npm run website:build',
    proof: 'out/ generated without depending on a live next dev process.',
    rollback: 'Delete only out/ and .next-zavorth-qa if the build fails.',
  },
  {
    id: 'smoke',
    label: 'Static smoke',
    command: 'npm run hosted-site -- --smoke',
    proof: 'Routes /, /demo, /start, /docs, /release, and /feedback return 200.',
    rollback: 'Do not publish preview if any route fails.',
  },
  {
    id: 'preview',
    label: 'Deploy preview',
    command: 'vercel deploy --prebuilt',
    proof: 'Preview URL separated from production and ready for review.',
    rollback: 'Abandon preview and keep current production.',
  },
  {
    id: 'publish',
    label: 'Promote/publish',
    command: 'vercel promote <preview-url>',
    proof: 'Promote happens only after smoke and screenshots.',
    rollback: 'Promote the last known-good deployment or revert alias to the previous release.',
  },
];

export const HOSTED_SITE_FORBIDDEN_VISUAL_CLAIMS = [
  'C:\\TESTES DEV',
  '100% seguro',
  'without limits',
  'always-on',
  'autonomous without approval',
  'production without rollback',
] as const;
