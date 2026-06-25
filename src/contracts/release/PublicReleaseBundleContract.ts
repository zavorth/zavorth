export type PublicReleaseBundleCheckStatus = 'pass' | 'warn' | 'fail';

export type PublicReleaseBundleCheck = {
  id: string;
  title: string;
  status: PublicReleaseBundleCheckStatus;
  reason: string;
  path?: string;
  evidence?: string[];
};

export type PublicReleaseBundleScreenshotSpec = {
  id: 'desktop' | 'mobile';
  fileName: string;
  viewport: {
    width: number;
    height: number;
  };
};

export type PublicReleaseBundleContractSnapshot = {
  phase: '51';
  surface: 'release-bundle';
  generatedAt: string;
  status: 'ready' | 'attention' | 'blocked';
  websiteRoot: string;
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  route: '/release';
  fixturePath: 'data/release-bundle.ts';
  requiredCommands: string[];
  screenshots: PublicReleaseBundleScreenshotSpec[];
  checks: PublicReleaseBundleCheck[];
  nextRecommendedPhase: {
    phase: '52';
    title: string;
    reason: string;
  };
};

export const PUBLIC_RELEASE_BUNDLE_REQUIRED_COPY = [
  'Release bundle and installer distribution',
  'v0.1 Preview',
  'zavorth-v0.1-preview.zip',
  'sha256:faae33f9400fdaf6a75a359a883d887cd5079ceff9f0b1011bc63f9078f74f91',
  'Installer preview',
  'Aprovacao explicita',
  'Sem cloud obrigatoria',
  'Cleanup limitado',
  'sem rede externa obrigatoria',
  'changelog publico',
] as const;

export const PUBLIC_RELEASE_BUNDLE_REQUIRED_COMMANDS = [
  'release:status:fast',
  'doctor:fast',
  'release:changelog',
  'release:rollback-preview',
] as const;

export const PUBLIC_RELEASE_BUNDLE_REQUIRED_LINKS = [
  '/release',
  '/docs#release-bundle',
  '/changelog',
  '/editions',
] as const;

export const PUBLIC_RELEASE_BUNDLE_FORBIDDEN_CLAIMS = [
  'C:\\TESTES DEV',
  'instala automaticamente',
  'cloud obrigatoria para usar',
  'telemetry ligada por padrao',
  'sem rollback',
  'segredo real',
] as const;

export const PUBLIC_RELEASE_BUNDLE_SCREENSHOTS: PublicReleaseBundleScreenshotSpec[] = [
  {
    id: 'desktop',
    fileName: 'release-bundle-desktop.png',
    viewport: { width: 1440, height: 1200 },
  },
  {
    id: 'mobile',
    fileName: 'release-bundle-mobile.png',
    viewport: { width: 390, height: 1200 },
  },
];
