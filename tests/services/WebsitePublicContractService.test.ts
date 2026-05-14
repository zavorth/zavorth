import { WebsitePublicContractService } from '../../src/services/WebsitePublicContractService';

describe('WebsitePublicContractService', () => {
  it('builds an ok Phase 46 snapshot from the public website contract fixture', () => {
    const service = serviceFromFixture();
    const snapshot = service.buildSnapshot();

    expect(snapshot.phase).toBe('46');
    expect(snapshot.surface).toBe('website-public');
    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.summary.failed).toBe(0);
    expect(snapshot.canonicalBase.repoName).toBe('zavorth-website');
    expect(snapshot.nextRecommendedPhase).toEqual(expect.objectContaining({
      phase: '47',
      title: 'Public Demo And Guided Story',
    }));
  });

  it('fails when the website package keeps the prototype name', () => {
    const service = serviceFromFixture({
      'website:package.json': JSON.stringify({
        name: 'projeto-alpha',
        scripts: websiteScriptsFixture(),
      }),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'website:package-name',
        status: 'fail',
      }),
    ]));
  });

  it('fails when public copy exposes a forbidden local path', () => {
    const service = serviceFromFixture({
      'website:components/Hero.tsx': [
        '<section id="hero">',
        'A IA local com execucao real, Local-first, Preview, aprovacao, evidencia, runtime unico, replay e opt-in.',
        'C:\\TESTES DEV\\zavorth-website',
        '</section>',
      ].join('\n'),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'website:forbidden-claims',
        status: 'fail',
      }),
    ]));
  });

  it('renders a human report with the next phase recommendation', () => {
    const service = serviceFromFixture({
      now: new Date('2026-04-25T00:00:00.000Z').toISOString(),
    });

    const report = service.renderReport();

    expect(report).toContain('Fase 46 - Website/Landing Real');
    expect(report).toContain('proxima fase recomendada: 47 - Public Demo And Guided Story');
  });
});

function serviceFromFixture(overrides: Record<string, string> = {}) {
  const now = overrides.now ? new Date(overrides.now) : new Date('2026-04-25T00:00:00.000Z');
  const { now: _now, ...fileOverrides } = overrides;
  return new WebsitePublicContractService({
    projectRoot: 'C:\\repo\\Zavorth',
    websiteRoot: 'C:\\repo\\zavorth-website',
    files: filesFixture(fileOverrides),
    existsSync: (targetPath: string) => !targetPath.replace(/\\/g, '/').includes('/out'),
    readFileSync: () => '',
    now: () => now,
  });
}

function filesFixture(overrides: Record<string, string> = {}) {
  return {
    'core:package.json': JSON.stringify({
      scripts: {
        'website:build': 'node scripts/run-external-surface.mjs website npm run website:build',
        'website:public': 'npx tsx scripts/website-public.ts',
        'qa:website-public': 'npx tsx scripts/website-public.ts --require-pass --build --screenshots',
        'qa:phase:46': 'node scripts/phases-46-52-check.mjs --phase=46',
      },
    }),
    'website:package.json': JSON.stringify({
      name: 'zavorth-website',
      scripts: websiteScriptsFixture(),
    }),
    'website:package-lock.json': JSON.stringify({
      name: 'zavorth-website',
    }),
    'website:next.config.js': "module.exports = { output: 'export', images: { unoptimized: true } }",
    'website:README.md': 'Product first. No personal paths, secrets or placeholder legal copy.',
    'website:app/layout.tsx': 'Zavorth local-first runtime',
    'website:app/page.tsx': [
      '<Navbar />',
      '<Hero />',
      '<DemoSection />',
      '<RuntimeSection />',
      '<FeaturesSection />',
      '<ConnectsSection />',
      '<CTASection />',
      '<Footer />',
    ].join('\n'),
    'website:app/docs/page.tsx': 'Quickstart npm install npm run go npm run chat replay',
    'website:app/changelog/page.tsx': 'v0.1 Preview Fase 46',
    'website:app/security/page.tsx': 'Seguranca Aprovacoes opt-in preview',
    'website:app/privacy/page.tsx': 'Privacidade local-first Telemetria opt-in',
    'website:app/terms/page.tsx': 'Termos preview publico',
    'website:components/Hero.tsx': [
      '<section id="hero">',
      'A IA local com execucao real.',
      '<a href="/docs#quickstart">Comecar localmente</a>',
      '<a href="#product">Ver demo</a>',
      '</section>',
    ].join('\n'),
    'website:components/Navbar.tsx': [
      '#runtime',
      '#governance',
      '#connects',
      '#get-started',
      '/docs',
      '/docs#quickstart',
    ].join('\n'),
    'website:components/DemoSection.tsx': '<section id="product">Local-first Preview aprovacao evidencia</section>',
    'website:components/RuntimeSection.tsx': '<section id="runtime">runtime unico</section>',
    'website:components/FeaturesSection.tsx': '<section id="governance">Preview e aprovacao</section>',
    'website:components/ConnectsSection.tsx': '<section id="connects">Conexoes</section>',
    'website:components/CTASection.tsx': [
      '<section id="get-started">',
      'npm run go',
      '/docs#quickstart',
      '/security',
      '/changelog',
      '</section>',
    ].join('\n'),
    'website:components/Footer.tsx': [
      '/#runtime',
      '/#governance',
      '/#connects',
      '/#get-started',
      '/docs',
      '/docs#quickstart',
      '/changelog',
      '/security',
      '/privacy',
      '/terms',
    ].join('\n'),
    ...overrides,
  };
}

function websiteScriptsFixture() {
  return {
    'website:build': 'npm run build',
    'website:public': 'node scripts/website-public-check.mjs',
    'qa:website-public': 'npm run website:build && node scripts/website-public-check.mjs --require-pass',
  };
}
