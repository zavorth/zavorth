import {
  DistributionHardeningService,
  type DistributionHardeningServiceOptions,
} from '../../src/services/DistributionHardeningService';
import {
  DISTRIBUTION_HARDENING_CHANNELS,
  DISTRIBUTION_HARDENING_MANIFEST_ITEMS,
  DISTRIBUTION_HARDENING_REQUIRED_CORE_SCRIPTS,
} from '../../src/contracts/DistributionHardeningContract';

describe('DistributionHardeningService', () => {
  it('builds an ok Phase 55 snapshot from distribution artifacts', () => {
    const service = serviceFromFixture({}, { requireArtifacts: true });

    const snapshot = service.buildSnapshot();

    expect(snapshot.phase).toBe('55');
    expect(snapshot.surface).toBe('distribution-hardening');
    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.status).toBe('ready');
    expect(snapshot.release.expectedTag).toBe('v1.0.0');
    expect(snapshot.nextRecommendedPhase).toEqual(expect.objectContaining({
      phase: '56',
      title: 'Public Docs, Examples And Recipes Expansion',
    }));
  });

  it('warns about missing artifacts when the gate is not requiring them yet', () => {
    const service = serviceFromFixture({
      'artifact:distribution-manifest.json': undefined,
      'artifact:installer-preview.json': undefined,
      'artifact:install-smoke.json': undefined,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.status).toBe('attention');
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'distribution-hardening:manifest-artifact',
        status: 'warn',
      }),
    ]));
  });

  it('fails when the package baseline drifts away from v1.0.0', () => {
    const service = serviceFromFixture({
      'core:package.json': JSON.stringify({
        name: 'zavorth',
        version: '1.1.0',
        scripts: coreScriptsFixture(),
      }),
    }, { requireArtifacts: true });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'distribution-hardening:package-baseline',
        status: 'fail',
      }),
    ]));
  });

  it('fails when qa:distribution-hardening disappears from package scripts', () => {
    const scripts = coreScriptsFixture();
    delete scripts['qa:distribution-hardening'];
    const service = serviceFromFixture({
      'core:package.json': JSON.stringify({
        name: 'zavorth',
        version: '1.0.0',
        scripts,
      }),
    }, { requireArtifacts: true });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'distribution-hardening:script:qa:distribution-hardening',
        status: 'fail',
      }),
    ]));
  });

  it('fails when the installer preview would mutate the host', () => {
    const service = serviceFromFixture({
      'artifact:installer-preview.json': JSON.stringify({
        ...installerPreviewArtifact(),
        mutatesHost: true,
      }),
    }, { requireArtifacts: true });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'distribution-hardening:installer-preview',
        status: 'fail',
      }),
    ]));
  });

  it('fails when the stable manifest lacks a required gate', () => {
    const channels = DISTRIBUTION_HARDENING_CHANNELS.map((channel) => channel.channel === 'stable'
      ? { ...channel, requiredGates: channel.requiredGates.filter((gate) => gate !== 'qa:architecture') }
      : channel);
    const service = serviceFromFixture({
      'artifact:distribution-manifest.json': JSON.stringify({
        ...distributionManifestArtifact(),
        channels,
      }),
    }, { requireArtifacts: true });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'distribution-hardening:manifest-artifact',
        status: 'fail',
      }),
    ]));
  });

  it('renders a human report with the next phase recommendation', () => {
    const service = serviceFromFixture();

    const report = service.renderReport();

    expect(report).toContain('Fase 55 - Installer And Distribution Hardening');
    expect(report).toContain('proxima fase recomendada: 56 - Public Docs, Examples And Recipes Expansion');
  });
});

function serviceFromFixture(
  fileOverrides: Record<string, string | undefined> = {},
  options: Partial<DistributionHardeningServiceOptions> = {},
) {
  const files = filesFixture();
  for (const [key, value] of Object.entries(fileOverrides)) {
    if (typeof value === 'undefined') {
      delete files[key];
    } else {
      files[key] = value;
    }
  }
  return new DistributionHardeningService({
    projectRoot: 'C:\\repo\\Zavorth',
    artifactDir: 'C:\\repo\\Zavorth\\.qa\\distribution-hardening',
    files,
    existsSync: () => false,
    readFileSync: () => '',
    statSync: () => ({ size: 16_000 }),
    now: () => new Date('2026-04-25T00:00:00.000Z'),
    ...options,
  });
}

function filesFixture(): Record<string, string> {
  return {
    'core:package.json': JSON.stringify({
      name: 'zavorth',
      version: '1.0.0',
      scripts: coreScriptsFixture(),
    }, null, 2),
    'core:README.md': 'Zavorth v1.0.0 public runtime',
    'core:docs/75-public-productization-architecture.md': [
      'Fase 50 - Editions, Plans And Distribution Policy',
      'Fase 51 - Release Bundle And Installer Distribution',
    ].join('\n'),
    'core:docs/76-public-adoption-architecture.md': [
      'Fase 55 - Installer And Distribution Hardening',
      'manifest de distribuicao',
      'checksums sha256',
      'installer preview',
      'install smoke',
      'cleanup',
      'qa:distribution-hardening',
      'qa:phase:55',
      'Fase 56 - Public Docs, Examples And Recipes Expansion',
      'qa:phase:56',
    ].join('\n'),
    'core:docs/11-roadmap.md': [
      'Fase 55 - Installer And Distribution Hardening: implementada.',
      'manifest checksum preview install cleanup',
      'qa:distribution-hardening',
      'qa:phase:55',
      'Fase 56 - Public Docs, Examples And Recipes Expansion',
      'qa:phase:56',
    ].join('\n'),
    'core:src/contracts/PublicReleaseBundleContract.ts': 'sha256:faae33f9400fdaf6a75a359a883d887cd5079ceff9f0b1011bc63f9078f74f91',
    'core:scripts/release-bundle.ts': 'new PublicReleaseBundleContractService()',
    'core:src/services/DistributionPolicyContractService.ts': 'export class DistributionPolicyContractService {}',
    'core:scripts/distribution-policy.ts': 'new DistributionPolicyContractService()',
    'core:scripts/distribution-hardening.ts': 'new DistributionHardeningService()',
    'artifact:distribution-manifest.json': JSON.stringify(distributionManifestArtifact()),
    'artifact:installer-preview.json': JSON.stringify(installerPreviewArtifact()),
    'artifact:install-smoke.json': JSON.stringify(smokeArtifact()),
  };
}

function coreScriptsFixture() {
  const scripts: Record<string, string> = {};
  for (const scriptName of DISTRIBUTION_HARDENING_REQUIRED_CORE_SCRIPTS) {
    scripts[scriptName] = `echo ${scriptName}`;
  }
  scripts['qa:hosted-site'] = 'npx tsx scripts/hosted-site.ts --require-pass --build --smoke --screenshots';
  scripts['qa:architecture'] = 'npx tsx scripts/zavorth-architecture-scorecard.ts --require-pass';
  return scripts;
}

function distributionManifestArtifact() {
  return {
    schemaVersion: '1.0.0',
    version: 'v1.0.0',
    generatedAt: '2026-04-25T00:00:00.000Z',
    ok: true,
    items: DISTRIBUTION_HARDENING_MANIFEST_ITEMS.map((item) => ({
      path: item.path,
      required: item.required,
      present: true,
      bytes: 128,
      sha256: 'a'.repeat(64),
    })),
    channels: DISTRIBUTION_HARDENING_CHANNELS,
    integrity: {
      algorithm: 'sha256',
      aggregateSha256: 'b'.repeat(64),
      reproducibleInputs: DISTRIBUTION_HARDENING_MANIFEST_ITEMS.map((item) => item.path),
    },
  };
}

function installerPreviewArtifact() {
  return {
    schemaVersion: '1.0.0',
    version: 'v1.0.0',
    generatedAt: '2026-04-25T00:00:00.000Z',
    ok: true,
    mutatesHost: false,
    requiresConfirmation: true,
    targetRoot: 'C:\\repo\\Zavorth\\.qa\\distribution-hardening\\fixture-install',
    steps: [
      { id: 'target-plan' },
      { id: 'manifest-plan' },
      { id: 'command-plan' },
      { id: 'rollback-plan' },
      { id: 'confirmation' },
    ],
    rollbackPlan: ['remove generated files'],
    cleanupPlan: {
      preserveUserData: true,
      requiresOptInForUserData: true,
      removesOnlyInstallerArtifacts: true,
    },
  };
}

function smokeArtifact() {
  return {
    schemaVersion: '1.0.0',
    version: 'v1.0.0',
    generatedAt: '2026-04-25T00:00:00.000Z',
    ok: true,
    targetRoot: 'C:\\repo\\Zavorth\\.qa\\distribution-hardening\\fixture-install',
    userDataPreserved: true,
    steps: [
      { id: 'install-preview', status: 'pass', mutatesHost: false },
      { id: 'health-check', status: 'pass', mutatesHost: false },
      { id: 'uninstall-preview', status: 'pass', mutatesHost: false },
      { id: 'cleanup', status: 'pass', mutatesHost: false },
    ],
  };
}
