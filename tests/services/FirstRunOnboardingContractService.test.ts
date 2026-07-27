import { FirstRunOnboardingContractService } from '../../src/services/FirstRunOnboardingContractService';

describe('FirstRunOnboardingContractService', () => {
  it('builds an ok Connector registry8 snapshot from the first-run fixture contract', () => {
    const service = serviceFromFixture();
    const snapshot = service.buildSnapshot();

    expect(snapshot.phase).toBe('first-run-onboarding');
    expect(snapshot.surface).toBe('first-run-onboarding');
    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.status).toBe('ready');
    expect(snapshot.route).toBe('/start');
    expect(snapshot.nextRecommendedGate).toEqual(expect.objectContaining({
      stage: '49',
      title: 'External Docs And Examples',
    }));
  });

  it('fails when the health check state disappears from the fixture', () => {
    const service = serviceFromFixture({
      'website:data/first-run.ts': fixtureText().replace('health-check', 'health-summary'),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'first-run:fixture-contract',
        status: 'fail',
      }),
    ]));
  });

  it('fails when the site no longer links to /start', () => {
    const service = serviceFromFixture({
      'website:components/Hero.tsx': '<a href="/demo">Ver demo</a>',
      'website:components/Navbar.tsx': '',
      'website:components/CTASection.tsx': '',
      'website:components/Footer.tsx': '',
      'website:app/docs/page.tsx': '<section id="first-run">roteiro</section>',
      'website:app/demo/page.tsx': '<a href="/demo">Demo</a>',
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'first-run:public-links',
        status: 'fail',
      }),
    ]));
  });

  it('renders a human report with the next gate recommendation', () => {
    const service = serviceFromFixture();
    const report = service.renderReport();

    expect(report).toContain('Gate first-run-onboarding - Public Onboarding And First Run');
    expect(report).toContain('next step recomendada: 49 - External Docs And Examples');
  });
});

function serviceFromFixture(overrides: Record<string, string> = {}) {
  return new FirstRunOnboardingContractService({
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
        'first-run': 'npx tsx scripts/first-run.ts',
        'qa:first-run': 'npx tsx scripts/first-run.ts --require-pass --build --screenshots',
        'qa:first-run-onboarding': 'node scripts/capability-suite-adoption-check.mjs --gate=first-run-onboarding',
      },
    }),
    'website:package.json': JSON.stringify({
      scripts: {
        'first-run': 'node scripts/first-run-check.mjs',
        'qa:first-run': 'npm run website:build && node scripts/first-run-check.mjs --require-pass',
      },
    }),
    'website:app/start/page.tsx': [
      'First run',
      'Primeiro uso local',
      'Checklist',
      'Detector de requisitos',
      'Preview de setup',
      'Health check',
      'Rollback e cleanup',
      'npm run go',
    ].join('\n'),
    'website:data/first-run.ts': fixtureText(),
    'website:scripts/first-run-check.mjs': 'first run gate',
    'website:components/Hero.tsx': '<a href="/start">Comecar</a>',
    'website:components/Navbar.tsx': '<a href="/start">Comecar</a>',
    'website:components/CTASection.tsx': '<a href="/start">Comecar</a>',
    'website:components/Footer.tsx': '<a href="/start">Comecar</a>',
    'website:app/docs/page.tsx': '<section id="first-run"><a href="/start">/start</a></section>',
    'website:app/demo/page.tsx': '<a href="/docs#first-run">First run</a>',
    ...overrides,
  };
}

function fixtureText() {
  return [
    'requirements',
    'preview',
    'install',
    'first-run',
    'health-check',
    'cleanup',
    'Ready',
    'Missing requirement',
    'Approval needed',
    'Cleanup available',
    'first-run-plan.json',
    'first-run-health.json',
    'first-run-cleanup-preview',
    'fixture/zavorth-first-run-workspace',
    'sem credencial externa obrigatoria',
    'sem watcher persistente por pattern',
  ].join('\n');
}
