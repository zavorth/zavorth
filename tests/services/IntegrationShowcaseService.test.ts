import {
  IntegrationShowcaseService,
  type IntegrationShowcaseServiceOptions,
} from '../../src/services/IntegrationShowcaseService';
import {
  INTEGRATION_SHOWCASE_ITEMS,
  INTEGRATION_SHOWCASE_REQUIRED_CORE_SCRIPTS,
  INTEGRATION_SHOWCASE_REQUIRED_WEBSITE_SCRIPTS,
  PARTNER_SURFACE_POLICY,
} from '../../src/contracts/IntegrationShowcaseContract';

describe('IntegrationShowcaseService', () => {
  it('builds an ok Credential vault8 snapshot from integration showcase fixtures', () => {
    const service = serviceFromFixture({}, { requireArtifacts: true });

    const snapshot = service.buildSnapshot();

    expect(snapshot.phase).toBe('integration-showcase');
    expect(snapshot.surface).toBe('integration-showcase');
    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.status).toBe('ready');
    expect(snapshot.integrations.map((item) => item.vendor)).toEqual(expect.arrayContaining([
      'Slack',
      'GitHub',
      'Vercel',
      'Figma',
    ]));
    expect(snapshot.nextRecommendedGate).toEqual(expect.objectContaining({
      stage: '59',
      title: 'v1.x Release Train And LTS Policy',
    }));
  });

  it('warns about generated artifacts when they are not required yet', () => {
    const service = serviceFromFixture({
      'artifact:integration-smoke.json': undefined,
      'artifact:capability-matrix.json': undefined,
      'artifact:partner-surface.json': undefined,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.status).toBe('attention');
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'integration-showcase:smoke-artifact',
        status: 'warn',
      }),
    ]));
  });

  it('fails when qa:integration-showcase is missing from core scripts', () => {
    const scripts = coreScriptsFixture();
    delete scripts['qa:integration-showcase'];
    const service = serviceFromFixture({
      'core:package.json': JSON.stringify({ scripts }),
    }, { requireArtifacts: true });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'integration-showcase:core-script:qa:integration-showcase',
        status: 'fail',
      }),
    ]));
  });

  it('fails when website scripts do not expose the public showcase gate', () => {
    const scripts = websiteScriptsFixture();
    delete scripts['qa:integration-showcase'];
    const service = serviceFromFixture({
      'website:package.json': JSON.stringify({ scripts }),
    }, { requireArtifacts: true });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'integration-showcase:website-script:qa:integration-showcase',
        status: 'fail',
      }),
    ]));
  });

  it('fails when the public route stops mentioning Trust Plane', () => {
    const service = serviceFromFixture({
      'website:app/integrations/page.tsx': integrationsPageSource().replaceAll('Trust Plane', 'controle interno'),
      'website:data/integration-showcase.ts': integrationDataSource().replaceAll('Trust Plane', 'controle interno'),
      'website:scripts/integration-showcase-check.mjs': websiteCheckSource().replaceAll('Trust Plane', 'controle interno'),
      'website:app/docs/page.tsx': docsPageSource().replaceAll('Trust Plane', 'controle interno'),
      'website:components/ConnectsSection.tsx': 'Conexoes /integrations fixture controle interno',
    }, { requireArtifacts: true });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'integration-showcase:website-coverage',
        status: 'fail',
      }),
    ]));
  });

  it('fails when the smoke artifact requires secrets', () => {
    const artifact = smokeArtifact();
    artifact.results[0] = {
      ...artifact.results[0],
      secretsRequired: true,
    };
    const service = serviceFromFixture({
      'artifact:integration-smoke.json': JSON.stringify(artifact),
    }, { requireArtifacts: true });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'integration-showcase:smoke-artifact',
        status: 'fail',
      }),
    ]));
  });

  it('fails when the public copy claims official partnership', () => {
    const service = serviceFromFixture({
      'website:app/integrations/page.tsx': `${integrationsPageSource()}\nofficial partner`,
    }, { requireArtifacts: true });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'integration-showcase:forbidden-claims',
        status: 'fail',
      }),
    ]));
  });

  it('fails when next phase planning is removed from docs', () => {
    const service = serviceFromFixture({
      'core:docs/product-direction.md': docs76Source().replace(
        'Readiness checkpoint 9 - v1.x Release Train And LTS Policy',
        'Etapa futura',
      ),
      'core:docs/product-direction.md': roadmapSource().replace(
        'Readiness checkpoint 9 - v1.x Release Train And LTS Policy',
        'Etapa futura',
      ),
    }, { requireArtifacts: true });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'integration-showcase:next-phase',
        status: 'fail',
      }),
    ]));
  });

  it('renders a human report with the next gate recommendation', () => {
    const service = serviceFromFixture();

    const report = service.renderReport();

    expect(report).toContain('Readiness checkpoint 8 - Integration Showcase And Partner Surface');
    expect(report).toContain('proximo passo recomendada: 59 - v1.x Release Train And LTS Policy');
  });
});

function serviceFromFixture(
  overrides: Record<string, string | undefined> = {},
  options: Partial<IntegrationShowcaseServiceOptions> = {},
) {
  const files = filesFixture();
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === 'undefined') {
      delete files[key];
    } else {
      files[key] = value;
    }
  }
  return new IntegrationShowcaseService({
    projectRoot: 'C:\\repo\\Zavorth',
    websiteRoot: 'C:\\repo\\zavorth-website',
    artifactDir: 'C:\\repo\\Zavorth\\.qa\\integration-showcase',
    files,
    existsSync: (targetPath: string) => {
      const normalized = targetPath.replace(/\\/g, '/');
      if (normalized === 'C:/repo/zavorth-website') {
        return true;
      }
      return [
        '/app/integrations/page.tsx',
        '/data/integration-showcase.ts',
        '/scripts/integration-showcase-check.mjs',
        '/app/docs/page.tsx',
        '/components/ConnectsSection.tsx',
        '/package.json',
      ].some((suffix) => normalized.endsWith(suffix));
    },
    readFileSync: () => '',
    now: () => new Date('2026-04-25T00:00:00.000Z'),
    ...options,
  });
}

function filesFixture(): Record<string, string> {
  return {
    'core:package.json': JSON.stringify({
      scripts: coreScriptsFixture(),
    }, null, 2),
    'core:docs/product-direction.md': docs76Source(),
    'core:docs/product-direction.md': roadmapSource(),
    'website:package.json': JSON.stringify({
      scripts: websiteScriptsFixture(),
    }, null, 2),
    'website:app/integrations/page.tsx': integrationsPageSource(),
    'website:data/integration-showcase.ts': integrationDataSource(),
    'website:scripts/integration-showcase-check.mjs': websiteCheckSource(),
    'website:app/docs/page.tsx': docsPageSource(),
    'website:components/ConnectsSection.tsx': 'Conexoes /integrations fixture Trust Plane',
    'website:components/Navbar.tsx': '/integrations /docs#integration-showcase',
    'website:components/Footer.tsx': '/integrations /docs#integration-showcase',
    'website:components/CTASection.tsx': '/integrations',
    'artifact:integration-smoke.json': JSON.stringify(smokeArtifact()),
    'artifact:capability-matrix.json': JSON.stringify(matrixArtifact()),
    'artifact:partner-surface.json': JSON.stringify(partnerSurfaceArtifact()),
  };
}

function coreScriptsFixture() {
  const scripts: Record<string, string> = {};
  for (const scriptName of INTEGRATION_SHOWCASE_REQUIRED_CORE_SCRIPTS) {
    scripts[scriptName] = `echo ${scriptName}`;
  }
  return scripts;
}

function websiteScriptsFixture() {
  const scripts: Record<string, string> = {};
  for (const scriptName of INTEGRATION_SHOWCASE_REQUIRED_WEBSITE_SCRIPTS) {
    scripts[scriptName] = `echo ${scriptName}`;
  }
  return scripts;
}

function integrationsPageSource() {
  return [
    'Integration Showcase And Partner Surface',
    'Slack',
    'GitHub',
    'Vercel',
    'Figma',
    'fixture',
    'local',
    'credencial real',
    'degradacao segura',
    'Trust Plane',
    'approval',
    'audit trail',
    'partner surface auditavel',
    'sem parceria formal prometida',
    'npm run integration-showcase',
    'npm run qa:integration-showcase',
  ].join('\n');
}

function integrationDataSource() {
  return integrationsPageSource();
}

function websiteCheckSource() {
  return integrationsPageSource();
}

function docsPageSource() {
  return integrationsPageSource();
}

function docs76Source() {
  return [
    'Readiness checkpoint 8 - Integration Showcase And Partner Surface',
    'integration showcase',
    'partner surface',
    'Slack',
    'GitHub',
    'Vercel',
    'Figma',
    'fixture',
    'degradacao segura',
    'Trust Plane',
    'qa:integration-showcase',
    'qa:integration-showcase',
    'Readiness checkpoint 9 - v1.x Release Train And LTS Policy',
    'qa:release-train',
  ].join('\n');
}

function roadmapSource() {
  return [
    'Readiness checkpoint 8 - Integration Showcase And Partner Surface: implementada.',
    'integration showcase partner surface Slack GitHub Vercel Figma fixture degradacao segura Trust Plane',
    'qa:integration-showcase',
    'qa:integration-showcase',
    'Readiness checkpoint 9 - v1.x Release Train And LTS Policy',
    'qa:release-train',
  ].join('\n');
}

function smokeArtifact() {
  return {
    schemaVersion: '1.0.0',
    stage: '58',
    generatedAt: '2026-04-25T00:00:00.000Z',
    mode: 'fixture',
    ok: true,
    results: INTEGRATION_SHOWCASE_ITEMS.map((item) => ({
      id: item.id,
      vendor: item.vendor,
      status: 'pass',
      mode: 'fixture',
      networkRequired: false,
      secretsRequired: false,
      mutatesExternalSystems: false,
      degradedSafely: true,
      evidence: item.evidence,
    })),
  };
}

function matrixArtifact() {
  return {
    schemaVersion: '1.0.0',
    stage: '58',
    generatedAt: '2026-04-25T00:00:00.000Z',
    ok: true,
    matrix: INTEGRATION_SHOWCASE_ITEMS.map((item) => ({
      id: item.id,
      vendor: item.vendor,
      category: item.category,
      capabilities: item.capabilities,
      modes: item.modes,
      fixtureAvailable: item.fixtureAvailable,
      credentialRequiredForLive: item.requiresSecretsForLive,
      degradation: item.safeDegradation,
    })),
  };
}

function partnerSurfaceArtifact() {
  return {
    schemaVersion: '1.0.0',
    stage: '58',
    generatedAt: '2026-04-25T00:00:00.000Z',
    ok: true,
    formalPartnersRegistered: 0,
    policy: PARTNER_SURFACE_POLICY,
  };
}
