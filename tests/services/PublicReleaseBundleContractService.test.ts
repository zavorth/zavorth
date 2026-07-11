import { PublicReleaseBundleContractService } from '../../src/services/PublicReleaseBundleContractService';

describe('PublicReleaseBundleContractService', () => {
  it('builds an ok Credential vault1 snapshot from the release bundle fixture', () => {
    const service = serviceFromFixture();
    const snapshot = service.buildSnapshot();

    expect(snapshot.phase).toBe('public-release-bundle');
    expect(snapshot.surface).toBe('release-bundle');
    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.status).toBe('ready');
    expect(snapshot.route).toBe('/release');
    expect(snapshot.nextRecommendedGate).toEqual(expect.objectContaining({
      stage: '52',
      title: 'Feedback, Telemetry Opt-In And Product Loop',
    }));
  });

  it('fails when the bundle digest disappears from the public release route', () => {
    const service = serviceFromFixture({
      'website:app/release/page.tsx': releaseText().replace(
        'sha256:faae33f9400fdaf6a75a359a883d887cd5079ceff9f0b1011bc63f9078f74f91',
        'digest pending',
      ),
      'website:data/release-bundle.ts': releaseText().replace(
        'sha256:faae33f9400fdaf6a75a359a883d887cd5079ceff9f0b1011bc63f9078f74f91',
        'digest pending',
      ),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'release-bundle:route-contract',
        status: 'fail',
      }),
    ]));
  });

  it('fails when a documented release command is missing from the core package', () => {
    const service = serviceFromFixture({
      'core:package.json': JSON.stringify({
        scripts: {
          'release-bundle': 'npx tsx scripts/release-bundle.ts',
          'qa:release-bundle': 'npx tsx scripts/release-bundle.ts --require-pass --build --screenshots',
          'qa:public-release-bundle': 'node scripts/capability-suite-adoption-check.mjs --gate=public-release-bundle',
          'release:status:fast': 'npm run cli:fast -- release status',
          'doctor:fast': 'npm run cli:fast -- doctor',
          'release:changelog': 'npx tsx scripts/release-ux-wizard.ts --changelog',
        },
      }),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'release-bundle:public-commands',
        status: 'fail',
      }),
    ]));
  });

  it('fails when the public site no longer links to /release', () => {
    const service = serviceFromFixture({
      'website:components/Navbar.tsx': '',
      'website:components/CTASection.tsx': '',
      'website:components/Footer.tsx': '',
      'website:app/docs/page.tsx': '<section id="release-bundle">Docs</section>',
      'website:app/examples/page.tsx': '<a href="/examples">Examples</a>',
      'website:app/editions/page.tsx': '<a href="/editions">Editions</a>',
      'website:app/changelog/page.tsx': 'Readiness checkpoint 1',
      'website:data/external-docs.ts': '',
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'release-bundle:public-links',
        status: 'fail',
      }),
    ]));
  });

  it('renders a human report with the next gate recommendation', () => {
    const service = serviceFromFixture();
    const report = service.renderReport();

    expect(report).toContain('Readiness checkpoint 1 - Release Bundle And Installer Distribution');
    expect(report).toContain('proximo passo recomendada: 52 - Feedback, Telemetry Opt-In And Product Loop');
  });
});

function serviceFromFixture(overrides: Record<string, string> = {}) {
  return new PublicReleaseBundleContractService({
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
        'release-bundle': 'npx tsx scripts/release-bundle.ts',
        'qa:release-bundle': 'npx tsx scripts/release-bundle.ts --require-pass --build --screenshots',
        'qa:public-release-bundle': 'node scripts/capability-suite-adoption-check.mjs --gate=public-release-bundle',
        'release:status:fast': 'npm run cli:fast -- release status',
        'doctor:fast': 'npm run cli:fast -- doctor',
        'release:changelog': 'npx tsx scripts/release-ux-wizard.ts --changelog',
        'release:rollback-preview': 'npm run cli:fast -- release rollback --preview',
      },
    }),
    'website:package.json': JSON.stringify({
      scripts: {
        'release-bundle': 'node scripts/release-bundle-check.mjs',
        'qa:release-bundle': 'npm run website:build && node scripts/release-bundle-check.mjs --require-pass',
      },
    }),
    'website:app/release/page.tsx': releaseText(),
    'website:data/release-bundle.ts': releaseText(),
    'website:scripts/release-bundle-check.mjs': 'release bundle gate',
    'website:components/Navbar.tsx': '<a href="/release">Release</a>',
    'website:components/CTASection.tsx': '<a href="/release">Release</a>',
    'website:components/Footer.tsx': '<a href="/release">Release</a><a href="/docs#release-bundle">Release docs</a>',
    'website:app/docs/page.tsx': '<a href="/release">/release</a><a href="/docs#release-bundle">Release bundle</a> npm run release:status:fast npm run doctor:fast npm run release:changelog npm run release:rollback-preview',
    'website:app/examples/page.tsx': '<a href="/release">Release</a>',
    'website:app/editions/page.tsx': '<a href="/editions">Editions</a>',
    'website:app/changelog/page.tsx': '<a href="/changelog">Changelog</a> Readiness checkpoint 1',
    'website:data/external-docs.ts': '<a href="/release">Release</a>',
    ...overrides,
  };
}

function releaseText() {
  return [
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
    'npm run release:status:fast',
    'npm run doctor:fast',
    'npm run release:changelog',
    'npm run release:rollback-preview',
    '/release',
    '/docs#release-bundle',
    '/changelog',
    '/editions',
  ].join('\n');
}
