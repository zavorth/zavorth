import {
  PublicDocsRecipesService,
  type PublicDocsRecipesServiceOptions,
} from '../../src/services/PublicDocsRecipesService';
import {
  PUBLIC_DOCS_RECIPES,
  PUBLIC_DOCS_RECIPES_REQUIRED_CORE_SCRIPTS,
} from '../../src/contracts/PublicDocsRecipesContract';

describe('PublicDocsRecipesService', () => {
  it('builds an ok Phase 56 snapshot from public docs recipes fixtures', () => {
    const service = serviceFromFixture({}, { requireArtifacts: true });

    const snapshot = service.buildSnapshot();

    expect(snapshot.phase).toBe('56');
    expect(snapshot.surface).toBe('public-docs-recipes');
    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.status).toBe('ready');
    expect(snapshot.recipes.length).toBeGreaterThanOrEqual(3);
    expect(snapshot.nextRecommendedPhase).toEqual(expect.objectContaining({
      phase: '57',
      title: 'Feedback, Support And Pilot Loop',
    }));
  });

  it('warns about the fixture smoke artifact when it is not required yet', () => {
    const service = serviceFromFixture({
      'artifact:recipes-fixture-smoke.json': undefined,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.status).toBe('attention');
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'public-docs-recipes:fixture-smoke',
        status: 'warn',
      }),
    ]));
  });

  it('fails when qa:public-docs-recipes is missing from scripts', () => {
    const scripts = coreScriptsFixture();
    delete scripts['qa:public-docs-recipes'];
    const service = serviceFromFixture({
      'core:package.json': JSON.stringify({ scripts }),
    }, { requireArtifacts: true });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'public-docs-recipes:script:qa:public-docs-recipes',
        status: 'fail',
      }),
    ]));
  });

  it('fails when public docs stop mentioning troubleshooting', () => {
    const service = serviceFromFixture({
      'website:app/docs/page.tsx': docsSource().replace('Troubleshooting', 'Ajuda operacional'),
      'website:data/external-docs.ts': externalDocsData().replace('Troubleshooting', 'Ajuda operacional'),
    }, { requireArtifacts: true });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'public-docs-recipes:website-coverage',
        status: 'fail',
      }),
    ]));
  });

  it('fails when a recipe fixture result mutates the host', () => {
    const artifact = fixtureSmokeArtifact();
    artifact.results[0] = {
      ...artifact.results[0],
      mutatesHost: true,
    };
    const service = serviceFromFixture({
      'artifact:recipes-fixture-smoke.json': JSON.stringify(artifact),
    }, { requireArtifacts: true });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'public-docs-recipes:fixture-smoke',
        status: 'fail',
      }),
    ]));
  });

  it('fails when next phase planning is removed from docs', () => {
    const service = serviceFromFixture({
      'core:docs/76-public-adoption-architecture.md': docs76Source().replace(
        'Fase 57 - Feedback, Support And Pilot Loop',
        'Fase futura',
      ),
      'core:docs/11-roadmap.md': roadmapSource().replace(
        'Fase 57 - Feedback, Support And Pilot Loop',
        'Fase futura',
      ),
    }, { requireArtifacts: true });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'public-docs-recipes:next-phase',
        status: 'fail',
      }),
    ]));
  });

  it('renders a human report with the next phase recommendation', () => {
    const service = serviceFromFixture();

    const report = service.renderReport();

    expect(report).toContain('Fase 56 - Public Docs, Examples And Recipes Expansion');
    expect(report).toContain('proxima fase recomendada: 57 - Feedback, Support And Pilot Loop');
  });
});

function serviceFromFixture(
  overrides: Record<string, string | undefined> = {},
  options: Partial<PublicDocsRecipesServiceOptions> = {},
) {
  const files = filesFixture();
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === 'undefined') {
      delete files[key];
    } else {
      files[key] = value;
    }
  }
  return new PublicDocsRecipesService({
    projectRoot: 'C:\\repo\\Zavorth',
    websiteRoot: 'C:\\repo\\zavorth-website',
    artifactDir: 'C:\\repo\\Zavorth\\.qa\\public-docs-recipes',
    files,
    existsSync: (targetPath: string) => {
      const normalized = targetPath.replace(/\\/g, '/');
      if (normalized === 'C:/repo/zavorth-website') {
        return true;
      }
      return [
        '/app/docs/page.tsx',
        '/app/examples/page.tsx',
        '/data/external-docs.ts',
        '/scripts/external-docs-check.mjs',
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
      scripts: coreScriptsFixture(),
    }, null, 2),
    'core:docs/10-troubleshooting.md': [
      'install npm run doctor',
      'runtime npm run status:fast',
      'site npm run website:build',
      'feedback npm run feedback:preview',
    ].join('\n'),
    'core:docs/76-public-adoption-architecture.md': docs76Source(),
    'core:docs/11-roadmap.md': roadmapSource(),
    'website:app/docs/page.tsx': docsSource(),
    'website:app/examples/page.tsx': examplesSource(),
    'website:data/external-docs.ts': externalDocsData(),
    'website:scripts/external-docs-check.mjs': 'external docs check',
    'artifact:recipes-fixture-smoke.json': JSON.stringify(fixtureSmokeArtifact()),
  };
}

function coreScriptsFixture() {
  const scripts: Record<string, string> = {};
  for (const scriptName of PUBLIC_DOCS_RECIPES_REQUIRED_CORE_SCRIPTS) {
    scripts[scriptName] = `echo ${scriptName}`;
  }
  scripts['artifact:workbench'] = 'npx tsx scripts/artifact-replay-workbench.ts';
  scripts['qa:artifact-workbench'] = 'npx tsx scripts/artifact-replay-workbench.ts --require-pass';
  scripts['public-demo'] = 'npx tsx scripts/public-demo.ts';
  scripts['remote:publish'] = 'node scripts/publish-remote.mjs';
  return scripts;
}

function docsSource() {
  return [
    'Quickstart',
    'Examples',
    'Troubleshooting',
    'Approvals',
    'artifacts',
    'replay',
    'fixture',
    'npm install',
    'npm run go',
    'npm run chat',
    'npm run release:status:fast',
    'npm run feedback:preview',
    'npm run website:build',
    '/start',
    '/demo',
    '/release',
    '/feedback',
    'runtime',
    'install',
    'site',
  ].join('\n');
}

function examplesSource() {
  return [
    'Exemplos externos por caso de uso',
    'engineering',
    'release',
    'replay-artifacts',
    'guardrail',
    'npm run chat',
    'npm run release:status:fast',
    'npm run status:fast',
  ].join('\n');
}

function externalDocsData() {
  return [
    docsSource(),
    examplesSource(),
    'installation security examples release feedback',
  ].join('\n');
}

function docs76Source() {
  return [
    'Fase 56 - Public Docs, Examples And Recipes Expansion',
    'Public docs',
    'recipes',
    'pre-requisitos',
    'fixture',
    'sem secrets',
    'troubleshooting',
    'qa:public-docs-recipes',
    'qa:phase:56',
    'Fase 57 - Feedback, Support And Pilot Loop',
    'qa:phase:57',
  ].join('\n');
}

function roadmapSource() {
  return [
    'Fase 56 - Public Docs, Examples And Recipes Expansion: implementada.',
    'Public docs recipes pre-requisitos fixture sem secrets troubleshooting',
    'qa:public-docs-recipes',
    'qa:phase:56',
    'Fase 57 - Feedback, Support And Pilot Loop',
    'qa:phase:57',
  ].join('\n');
}

function fixtureSmokeArtifact() {
  return {
    schemaVersion: '1.0.0',
    phase: '56',
    generatedAt: '2026-04-25T00:00:00.000Z',
    mode: 'fixture',
    ok: true,
    results: PUBLIC_DOCS_RECIPES.map((recipe) => ({
      id: recipe.id,
      status: 'pass',
      mode: 'fixture',
      commandsChecked: recipe.commands,
      requiresSecrets: false,
      mutatesHost: false,
      evidence: recipe.evidence,
    })),
  };
}
