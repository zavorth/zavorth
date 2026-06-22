import {
  AgentRunService,
  ProductEntryRuntimeService,
  PublicSiteDocsDemoSyncService,
  type PublicSiteDocsDemoSyncSnapshot,
  type UniversalAgentRun,
} from '../runtime/agent/index.js';

export function resolvePublicSiteDocsDemoSyncCliText(args: string): string {
  return String(args || '')
    .trim()
    .replace(/^(?:(?:public-sync|site-docs-demo|public-site-sync|docs-demo-sync|public-product-sync|public-runtime|run|status|latest)\b\s*)+/i, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function buildPublicSiteDocsDemoSyncCliSnapshot(input: {
  text: string;
  userId: string;
  sessionId: string;
}): PublicSiteDocsDemoSyncSnapshot {
  const service = new AgentRunService({
    now: () => new Date('2026-05-04T02:49:00.000Z'),
    productEntryRuntime: new ProductEntryRuntimeService({
      now: () => new Date('2026-05-04T02:49:00.000Z'),
      firstRunProfileService: {
        buildPlan: () => ({
          nativeContract: 'ZavorthFirstRunBootstrapPlan/v1',
          generatedAt: '2026-05-04T02:49:00.000Z',
          mode: 'dry-run',
          status: 'ready',
          dryRun: true,
          nonInteractiveSafe: true,
          paths: {
            storageRoot: '<workspace>',
            runtimeDir: 'data/runtime/first-run',
            profilePath: 'data/runtime/first-run/profile.json',
            workspacePath: 'data/runtime/first-run/workspace.json',
            identityPath: 'data/runtime/first-run/identity.json',
            policyPath: 'data/runtime/first-run/policy.json',
          },
          questions: [],
          writes: [
            { path: 'data/runtime/first-run/profile.json', action: 'skip', reason: 'profile existente' },
          ],
          summary: ['Primeiro uso configurado para public sync.'],
        } as any),
        buildWorkspaceIdentitySnapshot: () => ({
          nativeContract: 'ZavorthWorkspaceIdentityProfileSnapshot/v1',
          configured: true,
          profilePath: 'data/runtime/first-run/profile.json',
          userDisplayName: 'usuario',
          agentDisplayName: 'Zavorth',
          tonePreference: 'equilibrado',
          workspaceRoot: '<workspace>',
          memoryMode: 'local-metadata',
          safetyPosture: 'preview-first',
          providerStatus: 'deferred',
        } as any),
        resolvePaths: () => ({ profilePath: 'data/runtime/first-run/profile.json' } as any),
      },
      personalizationService: {
        getStatus: () => ({
          pending: false,
          reasons: [],
          files: {
            identity: 'IDENTITY.md',
            soul: 'SOUL.md',
            user: 'USER.md',
            bootstrap: 'BOOTSTRAP.md',
            domain: 'DOMAIN.md',
            learningStyle: 'LEARNING-STYLE.md',
            errorHandling: 'ERROR-HANDLING.md',
            outputFormat: 'OUTPUT-FORMAT.md',
            timeAutomation: 'TIME-AUTOMATION.md',
          },
          bootstrapExists: false,
          missingUserFields: [],
          identityName: 'Zavorth',
        }),
      },
    }),
  });
  const run = service.createRun({
    userId: input.userId,
    channel: 'cli',
    sessionId: input.sessionId,
    text: input.text || 'sincronizar site docs demo publico',
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    requestedTools: ['workspace.read'],
    metadata: buildPublicSyncFixtureMetadata(),
  });
  return buildPublicSiteDocsDemoSyncSnapshotFromRun(run);
}

export function buildPublicSiteDocsDemoSyncSnapshotFromRun(
  run: UniversalAgentRun,
): PublicSiteDocsDemoSyncSnapshot {
  return new PublicSiteDocsDemoSyncService().buildSnapshot({
    run,
    generatedAt: run.updatedAt,
  });
}

export function formatPublicSiteDocsDemoSyncSnapshot(
  snapshot: PublicSiteDocsDemoSyncSnapshot,
): string {
  const lines = [
    'Public Site / Docs / Demo Sync - Channel mesh9',
    `- contrato: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- sessao: ${snapshot.identifiers.sessionId}`,
    `- status: ${snapshot.status}`,
    `- release path: ${snapshot.sync.releasePathStatus ?? 'ausente'}`,
    `- site: ${snapshot.publicSite.status}`,
    `- docs: ${snapshot.docs.status} (${snapshot.docs.recipeCount} recipes)`,
    `- demo: ${snapshot.demo.status}`,
    `- stable claim: ${snapshot.readiness.canAnnounceStable ? 'liberado' : 'bloqueado'}`,
    `- proximo passo: ${snapshot.nextSafeAction}`,
    '',
    'Gates',
  ];

  for (const gate of snapshot.gates) {
    lines.push(
      `- ${gate.status}: ${gate.label}`,
      `  ${gate.source} - ${gate.command} - ${gate.detail}`,
    );
  }

  lines.push('', 'Superficies');
  for (const surface of snapshot.surfaces) {
    lines.push(`- ${surface.status}: ${surface.label} (${surface.routeOrCommand}) - ${surface.detail}`);
  }

  lines.push('', 'Readiness');
  lines.push(`- release path linked: ${String(snapshot.readiness.releaseInstallerRollbackPathLinked)}`);
  lines.push(`- website linked: ${String(snapshot.readiness.websitePublicLinked)}`);
  lines.push(`- docs linked: ${String(snapshot.readiness.publicDocsRecipesLinked)}`);
  lines.push(`- demo linked: ${String(snapshot.readiness.publicDemoLinked)}`);
  lines.push(`- site preview: ${String(snapshot.readiness.canPublishSitePreview)}`);
  lines.push(`- announce stable: ${String(snapshot.readiness.canAnnounceStable)}`);
  lines.push(`- canary: ${String(snapshot.readiness.canStartCanary)}`);

  lines.push('', 'Politica');
  lines.push('- build publico nao foi executado');
  lines.push('- deploy publico nao foi executado');
  lines.push('- demo live nao foi executada');
  lines.push('- telemetry externa nao foi ligada');
  lines.push('- stable claim nao foi publicado');
  lines.push('- secrets nao foram serializados');

  lines.push('', 'Rotas');
  lines.push(`- Website: ${snapshot.surface.websiteRoute}`);
  lines.push(`- Docs: ${snapshot.surface.docsRoute}`);
  lines.push(`- Examples: ${snapshot.surface.examplesRoute}`);
  lines.push(`- Demo: ${snapshot.surface.demoRoute}`);
  lines.push(`- Release: ${snapshot.surface.releaseRoute}`);
  lines.push(`- Dashboard: ${snapshot.surface.dashboardPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);

  return lines.join('\n');
}

function buildPublicSyncFixtureMetadata() {
  return {
    productizationContract: {
      source: 'ZavorthProductizationContractService',
      stage: 'C9',
      status: 'ready',
      control: { ready: true },
      cli: { ready: true },
      sdk: { ready: true },
      docs: { ready: true },
      website: { ready: true },
    },
    releaseStatus: {
      status: 'preview',
      channel: 'preview',
      version: 'v0.1-preview',
      rollbackAvailable: true,
    },
    websitePublic: {
      stage: '46',
      surface: 'website-public',
      generatedAt: '2026-05-04T02:49:00.000Z',
      status: 'ready',
      websiteRoot: '<website>',
      summary: { ok: true, passed: 12, warnings: 0, failed: 0 },
      requiredRoutes: [
        { route: '/', label: 'landing principal' },
        { route: '/docs', label: 'documentacao publica' },
        { route: '/changelog', label: 'changelog publico' },
        { route: '/security', label: 'seguranca' },
      ],
      forbiddenClaims: [],
      checks: [],
      nextRecommendedStage: { stage: '47', title: 'Public Demo', reason: 'demo fixture-first' },
    },
    publicDocsRecipes: {
      stage: '56',
      surface: 'public-docs-recipes',
      generatedAt: '2026-05-04T02:49:00.000Z',
      status: 'ready',
      projectRoot: '<core>',
      websiteRoot: '<website>',
      artifactDir: '<artifacts>',
      summary: { ok: true, passed: 10, warnings: 0, failed: 0 },
      routes: ['/docs', '/examples'],
      recipes: [
        { id: 'quickstart-first-result' },
        { id: 'release-readiness-audit' },
        { id: 'replay-artifact-review' },
      ],
      troubleshooting: [],
      noSecretsMatrix: [
        { id: 'first-run', runsWithoutSecrets: true },
        { id: 'release', runsWithoutSecrets: true },
      ],
      artifacts: { fixtureSmokePath: '<artifact>' },
      checks: [],
      nextRecommendedStage: { stage: '57', title: 'Feedback', reason: 'feedback opt-in' },
    },
    publicDemo: {
      stage: '47',
      surface: 'public-demo',
      generatedAt: '2026-05-04T02:49:00.000Z',
      status: 'ready',
      websiteRoot: '<website>',
      summary: { ok: true, passed: 10, warnings: 0, failed: 0 },
      route: '/demo',
      fixturePath: 'data/public-demo.ts',
      requiredStates: ['request', 'plan', 'Approval', 'artifact', 'replay', 'summary'],
      requiredArtifacts: ['demo-build-fix-report.md', 'demo-run-2026-04-25.json'],
      screenshots: [],
      checks: [],
      nextRecommendedStage: { stage: '48', title: 'Public Onboarding', reason: 'first-run publico' },
    },
    publicReleaseBundle: {
      stage: '51',
      surface: 'release-bundle',
      generatedAt: '2026-05-04T02:49:00.000Z',
      status: 'ready',
      websiteRoot: '<website>',
      summary: { ok: true, passed: 10, warnings: 0, failed: 0 },
      route: '/release',
      fixturePath: 'data/release-bundle.ts',
      requiredCommands: ['release:status:fast', 'doctor:fast', 'release:changelog', 'release:rollback-preview'],
      screenshots: [],
      checks: [],
      nextRecommendedStage: {
        stage: '52',
        title: 'Feedback, Telemetry Opt-In And Product Loop',
        reason: 'loop publico',
      },
    },
  };
}
