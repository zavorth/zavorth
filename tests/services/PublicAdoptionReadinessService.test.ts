import { PublicAdoptionReadinessService } from '../../src/services/PublicAdoptionReadinessService';
import { PUBLIC_ADOPTION_REQUIRED_CORE_SCRIPTS } from '../../src/contracts/PublicAdoptionReadinessContract';

describe('PublicAdoptionReadinessService', () => {
  it('builds an ok Credential vault3 snapshot from the public adoption fixture', () => {
    const service = serviceFromFixture();
    const snapshot = service.buildSnapshot();

    expect(snapshot.phase).toBe('public-adoption-readiness');
    expect(snapshot.surface).toBe('public-adoption-readiness');
    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.summary.failed).toBe(0);
    expect(snapshot.summary.warnings).toBeGreaterThanOrEqual(1);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'public-adoption:website-root',
        status: 'warn',
      }),
    ]));
    expect(snapshot.nextRecommendedGate).toEqual(expect.objectContaining({
      stage: '54',
      title: 'Hosted Website And Demo Operations',
    }));
  });

  it('fails when the public adoption gate alias is missing', () => {
    const service = serviceFromFixture({}, {
      'qa:public-adoption': null,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'core:script:qa:public-adoption',
        status: 'fail',
      }),
    ]));
  });

  it('fails when a public claim loses evidence', () => {
    const service = serviceFromFixture({
      'core:scripts/feedback-loop.ts': 'telemetry opt-in preview redigido',
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'public-adoption:claim:telemetry-opt-in',
        status: 'fail',
      }),
    ]));
  });

  it('fails when qa:public-adoption becomes a heavy build gate', () => {
    const service = serviceFromFixture({}, {
      'qa:public-adoption': 'npx tsx scripts/public-adoption.ts --require-pass --build --screenshots',
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'public-adoption:light-gate',
        status: 'fail',
      }),
    ]));
  });

  it('renders a human report with runbook and next phase', () => {
    const service = serviceFromFixture();

    const report = service.renderReport();

    expect(report).toContain('Readiness checkpoint 3 - Public Adoption Readiness');
    expect(report).toContain('runbook demo 10min');
    expect(report).toContain('proximo passo recomendada: 54 - Hosted Website And Demo Operations');
  });
});

function serviceFromFixture(
  fileOverrides: Record<string, string> = {},
  scriptOverrides: Record<string, string | null> = {},
) {
  return new PublicAdoptionReadinessService({
    projectRoot: 'C:\\repo\\Zavorth',
    websiteRoot: 'C:\\repo\\zavorth-website',
    files: filesFixture(fileOverrides, scriptOverrides),
    existsSync: () => false,
    readFileSync: () => '',
    now: () => new Date('2026-04-25T00:00:00.000Z'),
  });
}

function filesFixture(
  fileOverrides: Record<string, string> = {},
  scriptOverrides: Record<string, string | null> = {},
) {
  return {
    'core:package.json': JSON.stringify({
      name: 'zavorth',
      version: '1.0.0',
      scripts: coreScriptsFixture(scriptOverrides),
    }, null, 2),
    'core:README.md': 'Zavorth runtime governado local-first com approvals e artefatos.',
    'core:docs/product-direction.md': [
      'Public Adoption And Release Operations 53-59',
      'Readiness checkpoint 3 - Public Adoption Readiness',
    ].join('\n'),
    'core:docs/product-direction.md': [
      'Readiness checkpoint 2',
      'Local-first como confianca.',
      'recurso local-first deve continuar funcional sem cloud obrigatoria.',
      'preview obrigatorio',
    ].join('\n'),
    'core:docs/product-direction.md': [
      'Readiness checkpoint 3 - Public Adoption Readiness',
      'Readiness checkpoint 4 - Hosted Website And Demo Operations',
      'gate qa:release:54',
      'Readiness checkpoint 9 - v1.x Release Train And LTS Policy',
    ].join('\n'),
    'core:src/services/WebsitePublicContractService.ts': 'forbiddenClaims public contract',
    'core:src/services/PublicDemoContractService.ts': 'fixture demo contract',
    'core:scripts/public-demo.ts': 'PublicDemoContractService',
    'core:src/services/FeedbackTelemetryContractService.ts': 'telemetry opt-in consent opt',
    'core:scripts/feedback-loop.ts': 'telemetry disabled-by-default preview redigido',
    'core:src/services/PublicReleaseBundleContractService.ts': 'release bundle digest',
    'core:scripts/release-bundle.ts': 'PublicReleaseBundleContractService',
    'core:scripts/website-public.ts': 'website public contract',
    ...fileOverrides,
  };
}

function coreScriptsFixture(scriptOverrides: Record<string, string | null> = {}) {
  const scripts: Record<string, string> = {};
  for (const scriptName of PUBLIC_ADOPTION_REQUIRED_CORE_SCRIPTS) {
    scripts[scriptName] = `echo ${scriptName}`;
  }
  scripts['public-adoption'] = 'npx tsx scripts/public-adoption.ts';
  scripts['qa:public-adoption'] = 'npx tsx scripts/public-adoption.ts --require-pass';
  scripts['qa:public-adoption-readiness'] = 'node scripts/capability-suite-growth-check.mjs --gate=public-adoption-readiness';

  for (const [scriptName, command] of Object.entries(scriptOverrides)) {
    if (command === null) {
      delete scripts[scriptName];
    } else {
      scripts[scriptName] = command;
    }
  }
  return scripts;
}
