import { PublicDemoContractService } from '../../src/services/PublicDemoContractService';

describe('PublicDemoContractService', () => {
  it('builds an ok Connector registry7 snapshot from the demo fixture contract', () => {
    const service = serviceFromFixture();
    const snapshot = service.buildSnapshot();

    expect(snapshot.phase).toBe('public-demo');
    expect(snapshot.surface).toBe('public-demo');
    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.status).toBe('ready');
    expect(snapshot.route).toBe('/demo');
    expect(snapshot.nextRecommendedGate).toEqual(expect.objectContaining({
      stage: '48',
      title: 'Public Onboarding And First Run',
    }));
  });

  it('fails when the approval state disappears from the fixture', () => {
    const service = serviceFromFixture({
      'website:data/public-demo.ts': fixtureText().replace('approval', 'manual-review'),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'demo:fixture-contract',
        status: 'fail',
      }),
    ]));
  });

  it('fails when the site no longer links to /demo', () => {
    const service = serviceFromFixture({
      'website:components/Hero.tsx': '<a href="/docs#quickstart">Comecar</a>',
      'website:components/Navbar.tsx': '',
      'website:components/CTASection.tsx': '',
      'website:components/Footer.tsx': '',
      'website:app/docs/page.tsx': '<section id="demo">roteiro</section>',
      'website:app/changelog/page.tsx': 'Gate public-demo',
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'demo:public-links',
        status: 'fail',
      }),
    ]));
  });

  it('renders a human report with the next gate recommendation', () => {
    const service = serviceFromFixture();
    const report = service.renderReport();

    expect(report).toContain('Gate public-demo - Public Demo And Guided Story');
    expect(report).toContain('proximo passo recomendada: 48 - Public Onboarding And First Run');
  });
});

function serviceFromFixture(overrides: Record<string, string> = {}) {
  return new PublicDemoContractService({
    projectRoot: 'C:\\repo\\Zavorth',
    websiteRoot: 'C:\\repo\\zavorth-website',
    files: filesFixture(overrides),
    existsSync: (targetPath: string) => !targetPath.replace(/\\/g, '/').includes('/out'),
    readFileSync: () => '',
    now: () => new Date('2026-04-25T00:00:00.000Z'),
  });
}

function filesFixture(overrides: Record<string, string> = {}) {
  return {
    'core:package.json': JSON.stringify({
      scripts: {
        'public-demo': 'npx tsx scripts/public-demo.ts',
        'qa:public-demo': 'npx tsx scripts/public-demo.ts --require-pass --build --screenshots',
      },
    }),
    'website:package.json': JSON.stringify({
      scripts: {
        'public-demo': 'node scripts/public-demo-check.mjs',
        'qa:public-demo': 'npm run website:build && node scripts/public-demo-check.mjs --require-pass',
      },
    }),
    'website:app/demo/page.tsx': [
      'Public demo',
      'Guided story',
      'Um fluxo completo',
      'Estados cobertos',
      'Build fix com aprovacao e replay',
      'Chat comum',
      'Zavorth',
    ].join('\n'),
    'website:data/public-demo.ts': fixtureText(),
    'website:scripts/public-demo-check.mjs': 'public demo gate',
    'website:components/Hero.tsx': '<a href="/demo">Ver demo</a>',
    'website:components/Navbar.tsx': '<a href="/demo">Demo</a>',
    'website:components/CTASection.tsx': '<a href="/demo">Demo</a>',
    'website:components/Footer.tsx': '<a href="/demo">Demo</a>',
    'website:app/docs/page.tsx': '<section id="demo"><a href="/demo">/demo</a></section>',
    'website:app/changelog/page.tsx': 'Gate public-demo /docs#demo',
    ...overrides,
  };
}

function fixtureText() {
  return [
    'request',
    'plan',
    'approval',
    'execution',
    'artifact',
    'replay',
    'summary',
    'Success',
    'Error',
    'Approval',
    'Rollback',
    'demo-build-fix-report.md',
    'demo-run-2026-04-25.json',
    'fixture/zavorth-demo-workspace',
    'sem rede externa obrigatoria',
  ].join('\n');
}
