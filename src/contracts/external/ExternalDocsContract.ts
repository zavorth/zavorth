export type ExternalDocsCheckStatus = 'pass' | 'warn' | 'fail';

export type ExternalDocsCheck = {
  id: string;
  title: string;
  status: ExternalDocsCheckStatus;
  reason: string;
  path?: string;
  evidence?: string[];
};

export type ExternalDocsScreenshotSpec = {
  id: 'docs-desktop' | 'docs-mobile' | 'examples-desktop' | 'examples-mobile';
  route: '/docs' | '/examples';
  fileName: string;
  viewport: {
    width: number;
    height: number;
  };
};

export type ExternalDocsContractSnapshot = {
  gate: 'external-docs';
  surface: 'external-docs';
  generatedAt: string;
  status: 'ready' | 'attention' | 'blocked';
  websiteRoot: string;
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  routes: ['/docs', '/examples'];
  fixturePath: 'data/external-docs.ts';
  requiredSections: string[];
  requiredCommands: string[];
  screenshots: ExternalDocsScreenshotSpec[];
  checks: ExternalDocsCheck[];
  nextRecommendedGate: {
    gate: 'distribution-policy';
    title: string;
    reason: string;
  };
};

export const EXTERNAL_DOCS_REQUIRED_SECTIONS = [
  'external-docs',
  'quickstart',
  'first-run',
  'local-first-security',
  'demo',
  'examples',
  'troubleshooting',
  'feature-maturity',
] as const;

export const EXTERNAL_DOCS_REQUIRED_COMMANDS = [
  'install',
  'go',
  'chat',
  'doctor',
  'status:fast',
  'release:status:fast',
] as const;

export const EXTERNAL_DOCS_REQUIRED_COPY = [
  'External docs',
  'Quickstart',
  'Primeiro uso local',
  'Seguranca local-first',
  'Examples',
  'Troubleshooting',
  'Feature maturity',
  'Approvals',
  'artifacts',
  'replay',
  'Tenants',
] as const;

export const EXTERNAL_DOCS_REQUIRED_LINKS = [
  '/docs#external-docs',
  '/docs#quickstart',
  '/docs#first-run',
  '/docs#examples',
  '/docs#troubleshooting',
  '/docs#feature-maturity',
  '/examples',
  '/start',
  '/demo',
  '/security',
  '/privacy',
] as const;

export const EXTERNAL_DOCS_FORBIDDEN_CLAIMS = [
  'C:\\TESTES DEV',
  'autonomous without approval',
  'without limits',
  'sempre ligado por padrao',
] as const;

export const EXTERNAL_DOCS_SCREENSHOTS: ExternalDocsScreenshotSpec[] = [
  {
    id: 'docs-desktop',
    route: '/docs',
    fileName: 'docs-desktop.png',
    viewport: { width: 1440, height: 1200 },
  },
  {
    id: 'docs-mobile',
    route: '/docs',
    fileName: 'docs-mobile.png',
    viewport: { width: 390, height: 1200 },
  },
  {
    id: 'examples-desktop',
    route: '/examples',
    fileName: 'examples-desktop.png',
    viewport: { width: 1440, height: 1200 },
  },
  {
    id: 'examples-mobile',
    route: '/examples',
    fileName: 'examples-mobile.png',
    viewport: { width: 390, height: 1200 },
  },
];
