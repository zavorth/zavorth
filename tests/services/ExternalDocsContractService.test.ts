import { ExternalDocsContractService } from '../../src/services/ExternalDocsContractService';

describe('ExternalDocsContractService', () => {
  it('builds an ok Connector registry9 snapshot from the external docs fixture contract', () => {
    const service = serviceFromFixture();
    const snapshot = service.buildSnapshot();

    expect(snapshot.phase).toBe('external-docs');
    expect(snapshot.surface).toBe('external-docs');
    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.status).toBe('ready');
    expect(snapshot.routes).toEqual(['/docs', '/examples']);
    expect(snapshot.nextRecommendedGate).toEqual(expect.objectContaining({
      stage: '50',
      title: 'Editions, Plans And Distribution Policy',
    }));
  });

  it('fails when troubleshooting disappears from public docs', () => {
    const service = serviceFromFixture({
      'website:app/docs/page.tsx': docsText().replace('id="troubleshooting"', 'id="support"'),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'external-docs:docs-contract',
        status: 'fail',
      }),
    ]));
  });

  it('fails when a documented public command is missing from package.json', () => {
    const service = serviceFromFixture({
      'core:package.json': JSON.stringify({
        scripts: {
          go: 'npx tsx scripts/ops-go.ts',
          chat: 'npm run cli -- chat',
          doctor: 'npm run cli -- doctor',
          'status:fast': 'npm run cli:fast -- status',
          'external-docs': 'npx tsx scripts/external-docs.ts',
          'qa:external-docs': 'npx tsx scripts/external-docs.ts --require-pass --build --screenshots',
        },
      }),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'external-docs:public-commands',
        status: 'fail',
      }),
    ]));
  });

  it('renders a human report with the next gate recommendation', () => {
    const service = serviceFromFixture();
    const report = service.renderReport();

    expect(report).toContain('Gate external-docs - External Docs And Examples');
    expect(report).toContain('next step recomendada: 50 - Editions, Plans And Distribution Policy');
  });
});

function serviceFromFixture(overrides: Record<string, string> = {}) {
  return new ExternalDocsContractService({
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
        go: 'npx tsx scripts/ops-go.ts',
        chat: 'npm run cli -- chat',
        doctor: 'npm run cli -- doctor',
        'status:fast': 'npm run cli:fast -- status',
        'release:status:fast': 'npm run cli:fast -- release status',
        'external-docs': 'npx tsx scripts/external-docs.ts',
        'qa:external-docs': 'npx tsx scripts/external-docs.ts --require-pass --build --screenshots',
      },
    }),
    'website:package.json': JSON.stringify({
      scripts: {
        'external-docs': 'node scripts/external-docs-check.mjs',
        'qa:external-docs': 'npm run website:build && node scripts/external-docs-check.mjs --require-pass',
      },
    }),
    'website:app/docs/page.tsx': docsText(),
    'website:app/examples/page.tsx': examplesText(),
    'website:data/external-docs.ts': externalDocsText(),
    'website:scripts/external-docs-check.mjs': 'external docs gate',
    'website:components/Navbar.tsx': '<a href="/examples">Exemplos</a>',
    'website:components/CTASection.tsx': '<a href="/examples">Examples</a>',
    'website:components/Footer.tsx': '<a href="/examples">Exemplos</a>',
    'website:app/changelog/page.tsx': 'Gate external-docs /docs#external-docs',
    ...overrides,
  };
}

function docsText() {
  return [
    'External docs',
    'Quickstart',
    'Primeiro uso local',
    'Seguranca local-first',
    'Examples',
    'Troubleshooting',
    'Feature maturity',
    'Approvals',
    'artifacts',
    'replay',
    'Tenants',
    'id="external-docs"',
    'id="quickstart"',
    'id="first-run"',
    'id="local-first-security"',
    'id="demo"',
    'id="examples"',
    'id="troubleshooting"',
    'id="feature-maturity"',
    '/docs#external-docs',
    '/docs#quickstart',
    '/docs#first-run',
    '/docs#examples',
    '/docs#troubleshooting',
    '/docs#feature-maturity',
    '/examples',
    '/start',
    '/demo',
    '/security',
    '/privacy',
    'npm install',
    'npm run go',
    'npm run chat',
    'npm run doctor',
    'npm run status:fast',
    'npm run release:status:fast',
  ].join('\n');
}

function examplesText() {
  return [
    'Exemplos externos por caso de uso',
    'Engineering',
    'Release',
    'Artifacts',
    'replay',
    'guardrail',
    'engineering',
    'release',
    'replay-artifacts',
    'npm run chat',
    'npm run release:status:fast',
    'npm run status:fast',
    '/docs#external-docs',
  ].join('\n');
}

function externalDocsText() {
  return [
    'External docs',
    'Quickstart',
    'Primeiro uso local',
    'Seguranca local-first',
    'Examples',
    'Troubleshooting',
    'Feature maturity',
    'Approvals',
    'artifacts',
    'replay',
    'Tenants',
    '/docs#external-docs',
    '/docs#quickstart',
    '/docs#first-run',
    '/docs#examples',
    '/docs#troubleshooting',
    '/docs#feature-maturity',
    '/examples',
    '/start',
    '/demo',
    '/security',
    '/privacy',
    'npm install',
    'npm run go',
    'npm run chat',
    'npm run doctor',
    'npm run status:fast',
    'npm run release:status:fast',
    examplesText(),
    'Docs externas e exemplos',
  ].join('\n');
}
