import { FeedbackTelemetryContractService } from '../../src/services/FeedbackTelemetryContractService';

describe('FeedbackTelemetryContractService', () => {
  it('builds an ok Phase 52 snapshot from the feedback fixture', () => {
    const service = serviceFromFixture();
    const snapshot = service.buildSnapshot();

    expect(snapshot.phase).toBe('52');
    expect(snapshot.surface).toBe('feedback-loop');
    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.status).toBe('ready');
    expect(snapshot.route).toBe('/feedback');
    expect(snapshot.nextRecommendedPhase).toEqual(expect.objectContaining({
      phase: 'complete',
      title: 'Public Productization Complete',
    }));
  });

  it('fails when telemetry off by default disappears from the public route', () => {
    const service = serviceFromFixture({
      'website:app/feedback/page.tsx': feedbackText().replace('Telemetry desligada por padrao', 'Telemetry futura'),
      'website:data/feedback-loop.ts': feedbackText().replace('Telemetry desligada por padrao', 'Telemetry futura'),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'feedback-loop:route-contract',
        status: 'fail',
      }),
    ]));
  });

  it('fails when a feedback command is missing from the core package', () => {
    const service = serviceFromFixture({
      'core:package.json': JSON.stringify({
        scripts: {
          'feedback-loop': 'npx tsx scripts/feedback-loop.ts',
          'feedback:preview': 'npx tsx scripts/feedback-loop.ts --preview',
          'feedback:revoke': 'npx tsx scripts/feedback-loop.ts --revoke',
          'qa:feedback-loop': 'npx tsx scripts/feedback-loop.ts --require-pass --build --screenshots',
          'qa:phase:52': 'node scripts/phases-46-52-check.mjs --phase=52',
        },
      }),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'feedback-loop:public-commands',
        status: 'fail',
      }),
    ]));
  });

  it('fails when the public site no longer links to /feedback', () => {
    const service = serviceFromFixture({
      'website:components/Navbar.tsx': '',
      'website:components/CTASection.tsx': '',
      'website:components/Footer.tsx': '',
      'website:app/docs/page.tsx': '<section id="feedback-loop">Docs</section>',
      'website:app/release/page.tsx': '<a href="/release">Release</a>',
      'website:app/changelog/page.tsx': 'Fase 52',
      'website:app/privacy/page.tsx': '<a href="/privacy">Privacy</a>',
      'website:data/external-docs.ts': '',
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'feedback-loop:public-links',
        status: 'fail',
      }),
    ]));
  });

  it('renders a human report with the cycle completion marker', () => {
    const service = serviceFromFixture();
    const report = service.renderReport();

    expect(report).toContain('Fase 52 - Feedback, Telemetry Opt-In And Product Loop');
    expect(report).toContain('proxima fase recomendada: complete - Public Productization Complete');
  });
});

function serviceFromFixture(overrides: Record<string, string> = {}) {
  return new FeedbackTelemetryContractService({
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
        'feedback-loop': 'npx tsx scripts/feedback-loop.ts',
        'feedback:preview': 'npx tsx scripts/feedback-loop.ts --preview',
        'feedback:revoke': 'npx tsx scripts/feedback-loop.ts --revoke',
        'feedback:delete': 'npx tsx scripts/feedback-loop.ts --delete',
        'qa:feedback-loop': 'npx tsx scripts/feedback-loop.ts --require-pass --build --screenshots',
        'qa:phase:52': 'node scripts/phases-46-52-check.mjs --phase=52',
      },
    }),
    'website:package.json': JSON.stringify({
      scripts: {
        'feedback-loop': 'node scripts/feedback-loop-check.mjs',
        'qa:feedback-loop': 'npm run website:build && node scripts/feedback-loop-check.mjs --require-pass',
      },
    }),
    'website:app/feedback/page.tsx': feedbackText(),
    'website:data/feedback-loop.ts': feedbackText(),
    'website:scripts/feedback-loop-check.mjs': 'feedback loop gate',
    'website:components/Navbar.tsx': '<a href="/feedback">Feedback</a>',
    'website:components/CTASection.tsx': '<a href="/feedback">Feedback</a>',
    'website:components/Footer.tsx': '<a href="/feedback">Feedback</a><a href="/docs#feedback-loop">Feedback docs</a>',
    'website:app/docs/page.tsx': '<a href="/feedback">/feedback</a><a href="/docs#feedback-loop">Feedback loop</a> npm run feedback:preview npm run feedback:revoke npm run feedback:delete',
    'website:app/release/page.tsx': '<a href="/release">Release</a>',
    'website:app/changelog/page.tsx': 'Fase 52',
    'website:app/privacy/page.tsx': '<a href="/privacy">Privacy</a>',
    'website:data/external-docs.ts': '<a href="/feedback">Feedback</a>',
    ...overrides,
  };
}

function feedbackText() {
  return [
    'Feedback, telemetry opt-in and product loop',
    'Telemetry desligada por padrao',
    'Feedback opt-in',
    'preview redigido',
    'revoke/delete local',
    'Product feedback ledger',
    'product-feedback-ledger.json',
    'feedback-preview-redacted.json',
    'issue/report template',
    'agregador sem payload sensivel',
    'sem depender de cloud obrigatoria',
    'npm run feedback:preview',
    'npm run feedback:revoke',
    'npm run feedback:delete',
    '/feedback',
    '/docs#feedback-loop',
    '/privacy',
    '/release',
  ].join('\n');
}
