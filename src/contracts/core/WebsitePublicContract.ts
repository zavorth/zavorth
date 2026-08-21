export type WebsitePublicCheckStatus = 'pass' | 'warn' | 'fail';

export type WebsitePublicCheck = {
  id: string;
  title: string;
  status: WebsitePublicCheckStatus;
  reason: string;
  path?: string;
  evidence?: string[];
};

export type WebsitePublicRouteSpec = {
  route: string;
  label: string;
  sourcePath: string;
  outputCandidates: string[];
  requiredPhrases: string[];
};

export type WebsitePublicLinkSpec = {
  href: string;
  label: string;
  requiredAnchor?: string;
};

export type WebsitePublicScreenshotSpec = {
  id: 'desktop' | 'mobile';
  fileName: string;
  viewport: {
    width: number;
    height: number;
  };
};

export type WebsitePublicContractSnapshot = {
  gate: 'website-public';
  surface: 'website-public';
  generatedAt: string;
  status: 'ready' | 'attention' | 'blocked';
  websiteRoot: string;
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  canonicalBase: {
    repoName: 'zavorth-website';
    envOverride: 'ZAVORTH_WEBSITE_REPO_ROOT';
    expectedPackageName: 'zavorth-website';
  };
  narrative: {
    headline: string;
    promise: string;
    requiredSections: string[];
  };
  requiredRoutes: WebsitePublicRouteSpec[];
  requiredLinks: WebsitePublicLinkSpec[];
  screenshots: WebsitePublicScreenshotSpec[];
  forbiddenClaims: string[];
  checks: WebsitePublicCheck[];
  nextRecommendedGate: {
    gate: 'public-demo';
    title: string;
    reason: string;
  };
};

export const WEBSITE_PUBLIC_REQUIRED_ROUTES: WebsitePublicRouteSpec[] = [
  {
    route: '/',
    label: 'main landing',
    sourcePath: 'app/page.tsx',
    outputCandidates: ['index.html'],
    requiredPhrases: ['Navbar', 'Hero', 'DemoSection', 'RuntimeSection', 'CTASection'],
  },
  {
    route: '/docs',
    label: 'public documentation',
    sourcePath: 'app/docs/page.tsx',
    outputCandidates: ['docs.html', 'docs/index.html'],
    requiredPhrases: ['Quickstart', 'npm run go', 'npm run chat'],
  },
  {
    route: '/changelog',
    label: 'public changelog',
    sourcePath: 'app/changelog/page.tsx',
    outputCandidates: ['changelog.html', 'changelog/index.html'],
    requiredPhrases: ['v0.1 Preview', 'Website'],
  },
  {
    route: '/security',
    label: 'security posture',
    sourcePath: 'app/security/page.tsx',
    outputCandidates: ['security.html', 'security/index.html'],
    requiredPhrases: ['Security', 'Approvals', 'opt-in'],
  },
  {
    route: '/privacy',
    label: 'privacy',
    sourcePath: 'app/privacy/page.tsx',
    outputCandidates: ['privacy.html', 'privacy/index.html'],
    requiredPhrases: ['Privacy', 'local-first', 'Telemetry'],
  },
  {
    route: '/terms',
    label: 'terms',
    sourcePath: 'app/terms/page.tsx',
    outputCandidates: ['terms.html', 'terms/index.html'],
    requiredPhrases: ['Terms', 'public preview'],
  },
];

export const WEBSITE_PUBLIC_REQUIRED_LINKS: WebsitePublicLinkSpec[] = [
  { href: '/docs', label: 'docs' },
  { href: '/docs#quickstart', label: 'quickstart', requiredAnchor: 'quickstart' },
  { href: '/changelog', label: 'changelog' },
  { href: '/security', label: 'security' },
  { href: '/privacy', label: 'privacy' },
  { href: '/terms', label: 'terms' },
  { href: '#product', label: 'demo section', requiredAnchor: 'product' },
  { href: '#runtime', label: 'runtime section', requiredAnchor: 'runtime' },
  { href: '#governance', label: 'governance section', requiredAnchor: 'governance' },
  { href: '#connects', label: 'connects section', requiredAnchor: 'connects' },
  { href: '#get-started', label: 'start section', requiredAnchor: 'get-started' },
];

export const WEBSITE_PUBLIC_SCREENSHOTS: WebsitePublicScreenshotSpec[] = [
  {
    id: 'desktop',
    fileName: 'desktop.png',
    viewport: { width: 1440, height: 1200 },
  },
  {
    id: 'mobile',
    fileName: 'mobile.png',
    viewport: { width: 390, height: 1100 },
  },
];

export const WEBSITE_PUBLIC_REQUIRED_SECTIONS = [
  'hero',
  'product',
  'runtime',
  'governance',
  'connects',
  'get-started',
] as const;

export const WEBSITE_PUBLIC_FORBIDDEN_CLAIMS = [
  'C:\\TESTES DEV',
  'Replace this summary',
  '100% safe',
  'without limits',
  'always-on',
  'autonomous without approval',
  'autonomous without approval',
] as const;
