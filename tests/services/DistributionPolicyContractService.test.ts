import { DistributionPolicyContractService } from '../../src/services/DistributionPolicyContractService';

describe('DistributionPolicyContractService', () => {
  it('builds an ok Credential vault0 snapshot from the distribution policy fixture', () => {
    const service = serviceFromFixture();
    const snapshot = service.buildSnapshot();

    expect(snapshot.phase).toBe('distribution-policy');
    expect(snapshot.surface).toBe('distribution-policy');
    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.status).toBe('ready');
    expect(snapshot.route).toBe('/editions');
    expect(snapshot.nextRecommendedGate).toEqual(expect.objectContaining({
      stage: '51',
      title: 'Release Bundle And Installer Distribution',
    }));
  });

  it('fails when Team Preview disappears from the edition matrix', () => {
    const service = serviceFromFixture({
      'website:app/editions/page.tsx': policyText().replace('Team Preview', 'Team Later'),
      'website:data/distribution-policy.ts': policyText().replace('Team Preview', 'Team Later'),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'distribution-policy:policy-contract',
        status: 'fail',
      }),
    ]));
  });

  it('fails when the public site no longer links to /editions', () => {
    const service = serviceFromFixture({
      'website:components/Navbar.tsx': '',
      'website:components/CTASection.tsx': '',
      'website:components/Footer.tsx': '',
      'website:app/docs/page.tsx': '<section id="distribution-policy">Policy</section>',
      'website:app/examples/page.tsx': '<a href="/examples">Examples</a>',
      'website:app/changelog/page.tsx': 'Readiness checkpoint 0',
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'distribution-policy:public-links',
        status: 'fail',
      }),
    ]));
  });

  it('renders a human report with the next gate recommendation', () => {
    const service = serviceFromFixture();
    const report = service.renderReport();

    expect(report).toContain('Readiness checkpoint 0 - Editions, Plans And Distribution Policy');
    expect(report).toContain('proximo passo recomendada: 51 - Release Bundle And Installer Distribution');
  });
});

function serviceFromFixture(overrides: Record<string, string> = {}) {
  return new DistributionPolicyContractService({
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
        'distribution-policy': 'npx tsx scripts/distribution-policy.ts',
        'qa:distribution-policy': 'npx tsx scripts/distribution-policy.ts --require-pass --build --screenshots',
      },
    }),
    'website:package.json': JSON.stringify({
      scripts: {
        'distribution-policy': 'node scripts/distribution-policy-check.mjs',
        'qa:distribution-policy': 'npm run website:build && node scripts/distribution-policy-check.mjs --require-pass',
      },
    }),
    'website:app/editions/page.tsx': policyText(),
    'website:data/distribution-policy.ts': policyText(),
    'website:scripts/distribution-policy-check.mjs': 'distribution policy gate',
    'website:components/Navbar.tsx': '<a href="/editions">Edicoes</a>',
    'website:components/CTASection.tsx': '<a href="/editions">Editions</a>',
    'website:components/Footer.tsx': '<a href="/editions">Edicoes</a>',
    'website:app/docs/page.tsx': '<a href="/editions">/editions</a><a href="/docs#distribution-policy">Policy</a>',
    'website:app/examples/page.tsx': '<a href="/examples">Examples</a>',
    'website:app/changelog/page.tsx': 'Readiness checkpoint 0',
    ...overrides,
  };
}

function policyText() {
  return [
    'Editions, plans and distribution policy',
    'Local',
    'Pro Preview',
    'Team Preview',
    'Lab',
    'local-first',
    'Telemetry disabled by default',
    'cloud required',
    'opt-in',
    'No required cloud',
    'local-first remains functional without a cloud account',
    'Privacy and data',
    'Updates',
    'External plugins and skills',
    'Initial licensing',
    'alpha',
    'beta',
    'stable',
    '/editions',
    '/docs#distribution-policy',
    '/examples',
  ].join('\n');
}
