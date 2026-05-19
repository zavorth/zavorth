export type DistributionHardeningCheckStatus = 'pass' | 'warn' | 'fail';

export type DistributionHardeningCheck = {
  id: string;
  title: string;
  status: DistributionHardeningCheckStatus;
  reason: string;
  path?: string;
  evidence?: string[];
};

export type DistributionHardeningChannel = 'alpha' | 'beta' | 'stable';

export type DistributionHardeningManifestItem = {
  path: string;
  required: boolean;
  present: boolean;
  bytes: number;
  sha256: string;
};

export type DistributionHardeningChannelPolicy = {
  channel: DistributionHardeningChannel;
  purpose: string;
  requiredGates: string[];
  publishRule: string;
  rollbackRule: string;
};

export type DistributionHardeningInstallerPreviewStep = {
  id: string;
  title: string;
  mutation: 'none' | 'preview-only';
  requiresConfirmation: boolean;
  reversible: boolean;
  touchesUserData: false;
};

export type DistributionHardeningSmokeStep = {
  id: 'install-preview' | 'health-check' | 'uninstall-preview' | 'cleanup';
  title: string;
  expected: string;
};

export type DistributionHardeningSnapshot = {
  phase: '55';
  surface: 'distribution-hardening';
  generatedAt: string;
  status: 'ready' | 'attention' | 'blocked';
  projectRoot: string;
  artifactDir: string;
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  release: {
    expectedTag: 'v1.0.0';
    packageName: string;
    packageVersion: string;
  };
  artifacts: {
    manifestPath: string;
    installerPreviewPath: string;
    smokeArtifactPath: string;
  };
  manifestItems: DistributionHardeningManifestItem[];
  channels: DistributionHardeningChannelPolicy[];
  installerPreviewSteps: DistributionHardeningInstallerPreviewStep[];
  smokeSteps: DistributionHardeningSmokeStep[];
  checks: DistributionHardeningCheck[];
  nextRecommendedPhase: {
    phase: '56';
    title: string;
    reason: string;
  };
};

export const DISTRIBUTION_HARDENING_REQUIRED_CORE_SCRIPTS = [
  'release-bundle',
  'qa:release-bundle',
  'distribution-policy',
  'qa:distribution-policy',
  'release:status',
  'release:rollback-preview',
  'distribution-hardening',
  'qa:distribution-hardening',
  'qa:phase:55',
] as const;

export const DISTRIBUTION_HARDENING_MANIFEST_ITEMS = [
  { path: 'package.json', required: true },
  { path: 'README.md', required: true },
  { path: 'docs/product-direction.md', required: true },
  { path: 'docs/product-direction.md', required: true },
  { path: 'scripts/release-bundle.ts', required: true },
  { path: 'scripts/distribution-policy.ts', required: true },
  { path: 'scripts/distribution-hardening.ts', required: true },
] as const;

export const DISTRIBUTION_HARDENING_CHANNELS: DistributionHardeningChannelPolicy[] = [
  {
    channel: 'alpha',
    purpose: 'Validar empacotamento v1.x cedo, sem prometer estabilidade publica.',
    requiredGates: ['runtime:check', 'release-bundle'],
    publishRule: 'Pode publicar somente como preview manual e reversivel.',
    rollbackRule: 'Cancelar preview ou voltar ao ultimo bundle v1.x validado.',
  },
  {
    channel: 'beta',
    purpose: 'Abrir teste publico limitado com manifesto, policy e bundle verificaveis.',
    requiredGates: ['qa:distribution-policy', 'qa:release-bundle', 'qa:public-adoption'],
    publishRule: 'Pode promover quando a experiencia publica estiver em fixture-safe mode.',
    rollbackRule: 'Rebaixar para alpha se smoke ou feedback piloto indicar regressao.',
  },
  {
    channel: 'stable',
    purpose: 'Distribuicao recomendada para pilotos e usuarios externos.',
    requiredGates: ['qa:distribution-hardening', 'qa:hosted-site', 'qa:release-bundle', 'qa:architecture'],
    publishRule: 'Somente promover depois de gates verdes, manifest digest e smoke local.',
    rollbackRule: 'Voltar para ultimo stable com manifest e installer preview preservados.',
  },
];

export const DISTRIBUTION_HARDENING_INSTALLER_PREVIEW_STEPS: DistributionHardeningInstallerPreviewStep[] = [
  {
    id: 'target-plan',
    title: 'Resolver destino local antes de escrever',
    mutation: 'none',
    requiresConfirmation: true,
    reversible: true,
    touchesUserData: false,
  },
  {
    id: 'manifest-plan',
    title: 'Exibir arquivos, bytes e checksums esperados',
    mutation: 'none',
    requiresConfirmation: true,
    reversible: true,
    touchesUserData: false,
  },
  {
    id: 'command-plan',
    title: 'Mostrar comandos de install, health check e cleanup',
    mutation: 'none',
    requiresConfirmation: true,
    reversible: true,
    touchesUserData: false,
  },
  {
    id: 'rollback-plan',
    title: 'Preparar rollback antes de qualquer aplicacao',
    mutation: 'preview-only',
    requiresConfirmation: true,
    reversible: true,
    touchesUserData: false,
  },
  {
    id: 'confirmation',
    title: 'Exigir confirmacao explicita para aplicar',
    mutation: 'none',
    requiresConfirmation: true,
    reversible: true,
    touchesUserData: false,
  },
];

export const DISTRIBUTION_HARDENING_SMOKE_STEPS: DistributionHardeningSmokeStep[] = [
  {
    id: 'install-preview',
    title: 'Install preview em fixture local',
    expected: 'Nao muta o host real e grava somente dentro de .qa/distribution-hardening.',
  },
  {
    id: 'health-check',
    title: 'Health check do fixture instalado',
    expected: 'Manifesto, versao e digest ficam legiveis no alvo de teste.',
  },
  {
    id: 'uninstall-preview',
    title: 'Uninstall preview antes de cleanup',
    expected: 'Lista arquivos que seriam removidos e dados que serao preservados.',
  },
  {
    id: 'cleanup',
    title: 'Cleanup reversivel preservando user data',
    expected: 'Remove somente artefatos gerados pelo installer e preserva dados de usuario.',
  },
];
