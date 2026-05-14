import {
  ReleaseTrainService,
  type ReleaseTrainServiceOptions,
} from '../../src/services/ReleaseTrainService';
import {
  HOTFIX_PLAYBOOK,
  RELEASE_CANDIDATE_CHECKLIST,
  RELEASE_TRAIN_REQUIRED_CORE_SCRIPTS,
  RELEASE_TRAIN_VERSION_POLICIES,
} from '../../src/contracts/ReleaseTrainContract';

describe('ReleaseTrainService', () => {
  it('builds an ok Phase 59 snapshot from release train fixtures', () => {
    const service = serviceFromFixture({}, { requireArtifacts: true });

    const snapshot = service.buildSnapshot();

    expect(snapshot.phase).toBe('59');
    expect(snapshot.surface).toBe('release-train');
    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.status).toBe('ready');
    expect(snapshot.baseline).toEqual(expect.objectContaining({
      version: 'v1.0.0',
      channel: 'stable',
      packageVersion: '1.0.0',
    }));
    expect(snapshot.nextRecommendedAction.id).toBe('cycle-closed');
  });

  it('warns about artifacts when they are not required yet', () => {
    const service = serviceFromFixture({
      'artifact:release-train-plan.json': undefined,
      'artifact:release-candidate-checklist.json': undefined,
      'artifact:hotfix-playbook.json': undefined,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.status).toBe('attention');
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'release-train:plan-artifact',
        status: 'warn',
      }),
    ]));
  });

  it('fails when qa:release-train is missing from scripts', () => {
    const scripts = coreScriptsFixture();
    delete scripts['qa:release-train'];
    const service = serviceFromFixture({
      'core:package.json': JSON.stringify({ version: '1.0.0', scripts }),
    }, { requireArtifacts: true });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'release-train:script:qa:release-train',
        status: 'fail',
      }),
    ]));
  });

  it('accepts the active v1 alpha train while keeping v1.0.0 as baseline', () => {
    const service = serviceFromFixture({
      'core:package.json': JSON.stringify({ version: '1.1.0', scripts: coreScriptsFixture() }),
    }, { requireArtifacts: true });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'release-train:baseline',
        status: 'pass',
      }),
    ]));
  });

  it('fails when the package version leaves the v1 release train', () => {
    const service = serviceFromFixture({
      'core:package.json': JSON.stringify({ version: '2.0.0', scripts: coreScriptsFixture() }),
    }, { requireArtifacts: true });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'release-train:baseline',
        status: 'fail',
      }),
    ]));
  });

  it('fails when website docs stop mentioning v1.1.0 planning', () => {
    const service = serviceFromFixture({
      'website:app/release/page.tsx': websiteReleaseSource().replaceAll('v1.1.0', 'future minor'),
      'website:app/docs/page.tsx': websiteReleaseSource().replaceAll('v1.1.0', 'future minor'),
      'website:app/changelog/page.tsx': websiteReleaseSource().replaceAll('v1.1.0', 'future minor'),
      'website:data/release-bundle.ts': websiteReleaseSource().replaceAll('v1.1.0', 'future minor'),
    }, { requireArtifacts: true });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'release-train:website-coverage',
        status: 'fail',
      }),
    ]));
  });

  it('fails when a release train artifact marks a lane as failed', () => {
    const artifact = planArtifact();
    artifact.results[1] = {
      ...artifact.results[1],
      status: 'fail',
    };
    const service = serviceFromFixture({
      'artifact:release-train-plan.json': JSON.stringify(artifact),
    }, { requireArtifacts: true });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'release-train:plan-artifact',
        status: 'fail',
      }),
    ]));
  });

  it('fails when cycle closure is removed from docs', () => {
    const service = serviceFromFixture({
      'core:docs/76-public-adoption-architecture.md': docs76Source().replaceAll('ciclo 53-59 fechado', 'ciclo em aberto'),
      'core:docs/11-roadmap.md': roadmapSource().replaceAll('ciclo 53-59 fechado', 'ciclo em aberto'),
    }, { requireArtifacts: true });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'release-train:cycle-closure',
        status: 'fail',
      }),
    ]));
  });

  it('renders a human report with the closure recommendation', () => {
    const service = serviceFromFixture();

    const report = service.renderReport();

    expect(report).toContain('Fase 59 - v1.x Release Train And LTS Policy');
    expect(report).toContain('proxima acao recomendada: Ciclo 53-59 fechado');
  });
});

function serviceFromFixture(
  overrides: Record<string, string | undefined> = {},
  options: Partial<ReleaseTrainServiceOptions> = {},
) {
  const files = filesFixture();
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === 'undefined') {
      delete files[key];
    } else {
      files[key] = value;
    }
  }
  return new ReleaseTrainService({
    projectRoot: 'C:\\repo\\Zavorth',
    websiteRoot: 'C:\\repo\\zavorth-website',
    artifactDir: 'C:\\repo\\Zavorth\\.qa\\release-train',
    files,
    existsSync: (targetPath: string) => {
      const normalized = targetPath.replace(/\\/g, '/');
      if (normalized === 'C:/repo/zavorth-website') {
        return true;
      }
      return [
        '/app/release/page.tsx',
        '/app/changelog/page.tsx',
        '/app/docs/page.tsx',
        '/data/release-bundle.ts',
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
      version: '1.0.0',
      scripts: coreScriptsFixture(),
    }, null, 2),
    'core:docs/76-public-adoption-architecture.md': docs76Source(),
    'core:docs/11-roadmap.md': roadmapSource(),
    'website:app/release/page.tsx': websiteReleaseSource(),
    'website:app/changelog/page.tsx': websiteReleaseSource(),
    'website:app/docs/page.tsx': websiteReleaseSource(),
    'website:data/release-bundle.ts': websiteReleaseSource(),
    'artifact:release-train-plan.json': JSON.stringify(planArtifact()),
    'artifact:release-candidate-checklist.json': JSON.stringify(checklistArtifact()),
    'artifact:hotfix-playbook.json': JSON.stringify(hotfixArtifact()),
  };
}

function coreScriptsFixture() {
  const scripts: Record<string, string> = {};
  for (const scriptName of RELEASE_TRAIN_REQUIRED_CORE_SCRIPTS) {
    scripts[scriptName] = `echo ${scriptName}`;
  }
  scripts['qa:architecture'] = 'npm run ops:architecture -- --require-pass';
  return scripts;
}

function websiteReleaseSource() {
  return [
    'v1.0.0',
    'stable',
    'baseline',
    'v1.0.x',
    'v1.1.0',
    'release train',
    'LTS',
    'hotfix',
    'release candidate',
    'rollback',
    'GitHub Releases',
    'tags',
    'qa:release-train',
    'qa:phase:59',
  ].join('\n');
}

function docs76Source() {
  return [
    'Fase 59 - v1.x Release Train And LTS Policy',
    'release train',
    'LTS',
    'v1.0.0',
    'stable',
    'baseline',
    'v1.0.x',
    'v1.1.0',
    'hotfix',
    'release candidate',
    'rollback',
    'GitHub Releases',
    'qa:release-train',
    'qa:phase:59',
    'Nao Objetivos',
    'ciclo 53-59 fechado',
  ].join('\n');
}

function roadmapSource() {
  return [
    'Fase 59 - v1.x Release Train And LTS Policy: implementada.',
    'release train LTS v1.0.0 stable baseline v1.0.x v1.1.0 hotfix release candidate rollback GitHub Releases',
    'qa:release-train',
    'qa:phase:59',
    'Nao Objetivos',
    'ciclo 53-59 fechado',
  ].join('\n');
}

function planArtifact() {
  return {
    schemaVersion: '1.0.0',
    phase: '59',
    generatedAt: '2026-04-25T00:00:00.000Z',
    ok: true,
    results: RELEASE_TRAIN_VERSION_POLICIES.map((policy) => ({
      id: policy.lane,
      status: 'pass',
      evidence: [policy.versionPattern, policy.purpose],
    })),
  };
}

function checklistArtifact() {
  return {
    schemaVersion: '1.0.0',
    phase: '59',
    generatedAt: '2026-04-25T00:00:00.000Z',
    ok: true,
    results: RELEASE_CANDIDATE_CHECKLIST.map((item) => ({
      id: item.id,
      status: 'pass',
      evidence: [item.command || '<manual>', item.evidence],
    })),
  };
}

function hotfixArtifact() {
  return {
    schemaVersion: '1.0.0',
    phase: '59',
    generatedAt: '2026-04-25T00:00:00.000Z',
    ok: true,
    results: HOTFIX_PLAYBOOK.map((step) => ({
      id: step.id,
      status: 'pass',
      evidence: [step.command || '<manual>', step.rollback, step.evidence],
    })),
  };
}
