import {
  AgentRunService,
  FeedbackTelemetryProductLoopService,
  ProductEntryRuntimeService,
  type FeedbackTelemetryProductLoopSnapshot,
  type UniversalAgentRun,
} from '../runtime/agent/index.js';

export function resolveFeedbackTelemetryProductLoopCliText(args: string): string {
  return String(args || '')
    .trim()
    .replace(/^(?:(?:feedback-product-loop|feedback-runtime|telemetry-opt-in|product-loop|feedback-loop-runtime|feedback-sync|run|status|latest)\b\s*)+/i, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function buildFeedbackTelemetryProductLoopCliSnapshot(input: {
  text: string;
  userId: string;
  sessionId: string;
}): FeedbackTelemetryProductLoopSnapshot {
  const service = new AgentRunService({
    now: () => new Date('2026-05-04T03:50:00.000Z'),
    productEntryRuntime: new ProductEntryRuntimeService({
      now: () => new Date('2026-05-04T03:50:00.000Z'),
      firstRunProfileService: {
        buildPlan: () => ({
          nativeContract: 'ZavorthFirstRunBootstrapPlan/v1',
          generatedAt: '2026-05-04T03:50:00.000Z',
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
          writes: [],
          summary: ['Primeiro uso configurado para feedback loop.'],
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
    text: input.text || 'preparar feedback telemetry opt-in product loop',
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    requestedTools: ['workspace.read'],
    metadata: buildFeedbackTelemetryProductLoopFixtureMetadata(),
  });
  return buildFeedbackTelemetryProductLoopSnapshotFromRun(run);
}

export function buildFeedbackTelemetryProductLoopSnapshotFromRun(
  run: UniversalAgentRun,
): FeedbackTelemetryProductLoopSnapshot {
  return new FeedbackTelemetryProductLoopService().buildSnapshot({
    run,
    generatedAt: run.updatedAt,
  });
}

export function formatFeedbackTelemetryProductLoopSnapshot(
  snapshot: FeedbackTelemetryProductLoopSnapshot,
): string {
  const lines = [
    'Feedback / Telemetry Opt-In / Product Loop - Feedback Telemetry',
    `- contrato: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- sessao: ${snapshot.identifiers.sessionId}`,
    `- status: ${snapshot.status}`,
    `- feedback: ${snapshot.feedback.contractStatus}`,
    `- preview redigido: ${String(snapshot.telemetry.redactedPreviewAvailable)}`,
    `- ledger: ${String(snapshot.productLoop.ledgerAvailable)}`,
    `- telemetry externa: ${String(snapshot.telemetry.externalTelemetryEnabled)}`,
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
  lines.push(`- public sync linked: ${String(snapshot.readiness.publicSiteDocsDemoSyncLinked)}`);
  lines.push(`- feedback contract linked: ${String(snapshot.readiness.feedbackTelemetryContractLinked)}`);
  lines.push(`- feedback route ready: ${String(snapshot.readiness.feedbackRouteReady)}`);
  lines.push(`- preview collect: ${String(snapshot.readiness.canCollectFeedbackPreview)}`);
  lines.push(`- send externo: ${String(snapshot.readiness.canSendFeedbackExternally)}`);
  lines.push(`- enable telemetry: ${String(snapshot.readiness.canEnableTelemetry)}`);

  lines.push('', 'Politica');
  lines.push('- telemetry nao foi ligada');
  lines.push('- feedback nao foi enviado');
  lines.push('- chamada externa nao foi feita');
  lines.push('- payload bruto nao foi serializado');
  lines.push('- consentimento nao foi assumido');
  lines.push('- revoke/delete estao disponiveis');
  lines.push('- opt-in explicito obrigatorio');

  lines.push('', 'Rotas e comandos');
  lines.push(`- Feedback: ${snapshot.surface.feedbackRoute}`);
  lines.push(`- Privacy: ${snapshot.surface.privacyRoute}`);
  lines.push(`- Docs: ${snapshot.surface.docsAnchor}`);
  lines.push(`- Preview: ${snapshot.surface.previewCommand}`);
  lines.push(`- Revoke: ${snapshot.surface.revokeCommand}`);
  lines.push(`- Delete: ${snapshot.surface.deleteCommand}`);
  lines.push(`- Dashboard: ${snapshot.surface.dashboardPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);

  return lines.join('\n');
}

function buildFeedbackTelemetryProductLoopFixtureMetadata() {
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
      generatedAt: '2026-05-04T03:50:00.000Z',
      status: 'ready',
      websiteRoot: '<website>',
      summary: { ok: true, passed: 12, warnings: 0, failed: 0 },
      requiredRoutes: [
        { route: '/', label: 'landing principal' },
        { route: '/docs', label: 'documentacao publica' },
        { route: '/privacy', label: 'privacidade' },
        { route: '/security', label: 'seguranca' },
      ],
      forbiddenClaims: [],
      checks: [],
      nextRecommendedStage: { stage: '47', title: 'Public Demo', reason: 'demo fixture-first' },
    },
    publicDocsRecipes: {
      stage: '56',
      surface: 'public-docs-recipes',
      generatedAt: '2026-05-04T03:50:00.000Z',
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
      generatedAt: '2026-05-04T03:50:00.000Z',
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
      generatedAt: '2026-05-04T03:50:00.000Z',
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
    feedbackTelemetry: {
      stage: '52',
      surface: 'feedback-loop',
      generatedAt: '2026-05-04T03:50:00.000Z',
      status: 'ready',
      websiteRoot: '<website>',
      summary: { ok: true, passed: 11, warnings: 0, failed: 0 },
      route: '/feedback',
      fixturePath: 'data/feedback-loop.ts',
      requiredCommands: ['feedback:preview', 'feedback:revoke', 'feedback:delete'],
      screenshots: [],
      checks: [
        {
          id: 'feedback-loop:route-contract',
          title: 'Feedback route contract',
          status: 'pass',
          reason: 'Product feedback ledger and issue/report template ready.',
          evidence: ['product-feedback-ledger.json', 'feedback-preview-redacted.json', 'issue/report template'],
        },
      ],
      nextRecommendedStage: {
        stage: 'complete',
        title: 'Product feedback loop ready',
        reason: 'opt-in preview sem envio externo',
      },
    },
  };
}
