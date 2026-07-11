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
  gate: 'distribution-hardening';
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
  nextRecommendedGate: {
    gate: 'public-docs-recipes';
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
] as const;

export const DISTRIBUTION_HARDENING_MANIFEST_ITEMS = [
  { path: 'package.json', required: true },
  { path: 'README.md', required: true },
  { path: 'docs/product-direction.md', required: true },
  { path: 'scripts/release-bundle.ts', required: true },
  { path: 'scripts/distribution-policy.ts', required: true },
  { path: 'scripts/distribution-hardening.ts', required: true },
] as const;

export const DISTRIBUTION_HARDENING_CHANNELS: DistributionHardeningChannelPolicy[] = [
  {
    channel: 'alpha',
    purpose: 'Validate v1.x packaging early without promising public stability.',
    requiredGates: ['runtime:check', 'release-bundle'],
    publishRule: 'Can publish only as a manual and reversible preview.',
    rollbackRule: 'Cancel preview or return to the last validated v1.x bundle.',
  },
  {
    channel: 'beta',
    purpose: 'Open limited public testing with verifiable manifest, policy, and bundle.',
    requiredGates: ['qa:distribution-policy', 'qa:release-bundle', 'qa:public-adoption'],
    publishRule: 'Can promote when the public experience is in fixture-safe mode.',
    rollbackRule: 'Demote to alpha if smoke or pilot feedback indicates regression.',
  },
  {
    channel: 'stable',
    purpose: 'Recommended distribution for pilots and external users.',
    requiredGates: ['qa:distribution-hardening', 'qa:hosted-site', 'qa:release-bundle', 'qa:architecture'],
    publishRule: 'Promote only after green gates, manifest digest, and local smoke.',
    rollbackRule: 'Return to the last stable with manifest and installer preview preserved.',
  },
];

export const DISTRIBUTION_HARDENING_INSTALLER_PREVIEW_STEPS: DistributionHardeningInstallerPreviewStep[] = [
  {
    id: 'target-plan',
    title: 'Resolve local target before writing',
    mutation: 'none',
    requiresConfirmation: true,
    reversible: true,
    touchesUserData: false,
  },
  {
    id: 'manifest-plan',
    title: 'Show expected files, bytes, and checksums',
    mutation: 'none',
    requiresConfirmation: true,
    reversible: true,
    touchesUserData: false,
  },
  {
    id: 'command-plan',
    title: 'Show install, health check, and cleanup commands',
    mutation: 'none',
    requiresConfirmation: true,
    reversible: true,
    touchesUserData: false,
  },
  {
    id: 'rollback-plan',
    title: 'Prepare rollback before any application',
    mutation: 'preview-only',
    requiresConfirmation: true,
    reversible: true,
    touchesUserData: false,
  },
  {
    id: 'confirmation',
    title: 'Require explicit confirmation to apply',
    mutation: 'none',
    requiresConfirmation: true,
    reversible: true,
    touchesUserData: false,
  },
];

export const DISTRIBUTION_HARDENING_SMOKE_STEPS: DistributionHardeningSmokeStep[] = [
  {
    id: 'install-preview',
    title: 'Install preview in local fixture',
    expected: 'Does not mutate the real host and writes only inside .qa/distribution-hardening.',
  },
  {
    id: 'health-check',
    title: 'Installed fixture health check',
    expected: 'Manifest, version, and digest remain readable in the test target.',
  },
  {
    id: 'uninstall-preview',
    title: 'Uninstall preview before cleanup',
    expected: 'Lists files that would be removed and data that will be preserved.',
  },
  {
    id: 'cleanup',
    title: 'Reversible cleanup preserving user data',
    expected: 'Removes only installer-generated artifacts and preserves user data.',
  },
];
