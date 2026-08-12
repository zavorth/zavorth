import {
  HostedSiteOperationsService,
  type HostedSiteOperationsServiceOptions,
} from '../../src/services/HostedSiteOperationsService';
import { HOSTED_SITE_REQUIRED_CORE_SCRIPTS } from '../../src/contracts/HostedSiteOperationsContract';

describe('HostedSiteOperationsService', () => {
  it('builds an ok Credential vault4 snapshot from the hosted site fixture', () => {
    const service = serviceFromFixture();
    const snapshot = service.buildSnapshot();

    expect(snapshot.phase).toBe('hosted-site-operations');
    expect(snapshot.surface).toBe('hosted-site-operations');
    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.summary.failed).toBe(0);
    expect(snapshot.summary.warnings).toBeGreaterThanOrEqual(1);
    expect(snapshot.release.expectedVersion).toBe('v1.0.0');
    expect(snapshot.nextRecommendedGate).toEqual(expect.objectContaining({
      stage: '55',
      title: 'Installer And Distribution Hardening',
    }));
  });

  it('fails when the site still exposes an old preview release', () => {
    const service = serviceFromFixture({
      'website:data/release-bundle.ts': releaseBundleFixture('v0.1 Preview'),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'hosted-site:release-visible',
        status: 'fail',
      }),
    ]));
  });

  it('fails when website build depends on next dev instead of isolated export', () => {
    const service = serviceFromFixture({
      'website:package.json': JSON.stringify({
        name: 'zavorth-website',
        version: '1.0.0',
        scripts: {
          ...websiteScriptsFixture(),
          'website:build': 'next dev',
        },
      }),
      'website:scripts/website-build.mjs': 'spawnSync("next", ["dev"])',
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'hosted-site:build-isolation',
        status: 'fail',
      }),
    ]));
  });

  it('fails when smoke is required but artifact is missing', () => {
    const service = serviceFromFixture({}, {
      requireSmoke: true,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'hosted-site:smoke-artifact',
        status: 'fail',
      }),
    ]));
  });

  it('renders a human report with rollback runbook and next phase', () => {
    const service = serviceFromFixture();

    const report = service.renderReport();

    expect(report).toContain('Readiness checkpoint 4 - Hosted Website And Demo Operations');
    expect(report).toContain('runbook publish/rollback');
    expect(report).toContain('proximo passo recomendada: 55 - Installer And Distribution Hardening');
  });
});

function serviceFromFixture(
  fileOverrides: Record<string, string> = {},
  options: Partial<HostedSiteOperationsServiceOptions> = {},
) {
  return new HostedSiteOperationsService({
    projectRoot: 'C:\\repo\\Zavorth',
    websiteRoot: 'C:\\repo\\zavorth-website',
    files: filesFixture(fileOverrides),
    existsSync: () => false,
    readFileSync: () => '',
    statSync: () => ({ size: 16_000 }),
    now: () => new Date('2026-04-25T00:00:00.000Z'),
    ...options,
  });
}

function filesFixture(overrides: Record<string, string> = {}) {
  return {
    'core:package.json': JSON.stringify({
      name: 'zavorth',
      version: '1.0.0',
      scripts: coreScriptsFixture(),
    }, null, 2),
    'core:docs/product-direction.md': [
      'Readiness checkpoint 4 - Hosted Website And Demo Operations',
      'qa:hosted-site',
      'preview',
      'publish',
      'rollback',
      'smoke',
      'Readiness checkpoint 5 - Installer And Distribution Hardening',
      'qa:distribution-hardening',
    ].join('\n'),
    'website:package.json': JSON.stringify({
      name: 'zavorth-website',
      version: '1.0.0',
      scripts: websiteScriptsFixture(),
    }, null, 2),
    'website:next.config.js': [
      "const distDir = process.env.ZAVORTH_NEXT_DIST_DIR || '.next'",
      "module.exports = { output: 'export', distDir, images: { unoptimized: true } }",
    ].join('\n'),
    'website:scripts/website-build.mjs': [
      "const qaDistDir = '.next-zavorth-qa'",
      "process.env.NEXT_TELEMETRY_DISABLED = '1'",
      "removeGeneratedBuildDir('out')",
    ].join('\n'),
    'website:app/page.tsx': '<Hero /><DemoSection /><RuntimeSection /><CTASection />',
    'website:components/Hero.tsx': 'Zavorth Agent Runtime /demo /start',
    'website:components/DemoSection.tsx': 'Local-first Zavorth',
    'website:components/RuntimeSection.tsx': 'runtime',
    'website:components/CTASection.tsx': 'Comecar localmente',
    'website:app/demo/page.tsx': 'Public demo Guided story',
    'website:data/public-demo.ts': 'fixture sem secrets',
    'website:app/start/page.tsx': 'First run preview cleanup',
    'website:data/first-run.ts': 'First run preview cleanup',
    'website:app/docs/page.tsx': 'Quickstart npm run go release feedback',
    'website:data/external-docs.ts': 'release feedback',
    'website:app/release/page.tsx': 'Release releaseBundle.version',
    'website:data/release-bundle.ts': releaseBundleFixture('v1.0.0'),
    'website:app/feedback/page.tsx': 'Feedback opt-in preview revoke',
    'website:data/feedback-loop.ts': 'Feedback opt-in preview revoke',
    ...overrides,
  };
}

function coreScriptsFixture() {
  const scripts: Record<string, string> = {};
  for (const scriptName of HOSTED_SITE_REQUIRED_CORE_SCRIPTS) {
    scripts[scriptName] = `echo ${scriptName}`;
  }
  scripts['hosted-site'] = 'npx tsx scripts/hosted-site.ts';
  scripts['qa:hosted-site'] = 'npx tsx scripts/hosted-site.ts --require-pass --build --smoke --screenshots';
  scripts['qa:hosted-site-operations'] = 'node scripts/capability-suite-growth-check.mjs --gate=hosted-site-operations';
  return scripts;
}

function websiteScriptsFixture() {
  return {
    'website:build': 'node scripts/website-build.mjs',
    'website:public': 'node scripts/website-public-check.mjs',
    'public-demo': 'node scripts/public-demo-check.mjs',
    'qa:website-public': 'npm run website:build && node scripts/website-public-check.mjs --require-pass',
    'qa:public-demo': 'npm run website:build && node scripts/public-demo-check.mjs --require-pass',
  };
}

function releaseBundleFixture(version: string) {
  return [
    `export const releaseBundle = { version: '${version}', channel: 'stable',`,
    "bundle: { fileName: 'zavorth-v1.0.0.zip', digest: 'sha256:faae33f9400fdaf6a75a359a883d887cd5079ceff9f0b1011bc63f9078f74f91' },",
    "rollbackPlan: ['rollback'] }",
  ].join('\n');
}
