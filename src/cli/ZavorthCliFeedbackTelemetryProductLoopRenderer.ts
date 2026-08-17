import {
  AgentRunService,
  FeedbackTelemetryProductLoopService,
  ProductEntryRuntimeService,
  type FeedbackTelemetryProductLoopSnapshot,
  type UniversalAgentRun,
} from '../runtime/agent/index.js';
import type {
  ZavorthFirstRunBootstrapPlan,
  ZavorthWorkspaceIdentityProfileSnapshot,
  ZavorthFirstRunBootstrapPaths,
} from '../contracts/FirstRunWorkspaceBootstrapContract.js';

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
          summary: ['First use configured for feedback loop.'],
        } as unknown as ZavorthFirstRunBootstrapPlan),
        buildWorkspaceIdentitySnapshot: () => ({
          nativeContract: 'ZavorthWorkspaceIdentityProfileSnapshot/v1',
          configured: true,
          profilePath: 'data/runtime/first-run/profile.json',
          userDisplayName: 'user',
          agentDisplayName: 'Zavorth',
          tonePreference: 'equilibrado',
          workspaceRoot: '<workspace>',
          memoryMode: 'local-metadata',
          safetyPosture: 'preview-first',
          providerStatus: 'deferred',
        } as unknown as ZavorthWorkspaceIdentityProfileSnapshot),
        resolvePaths: () => ({ profilePath: 'data/runtime/first-run/profile.json' } as unknown as ZavorthFirstRunBootstrapPaths),
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
    `- contract: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- session: ${snapshot.identifiers.sessionId}`,
    `- status: ${snapshot.status}`,
    `- feedback: ${snapshot.feedback.contractStatus}`,
    `- redacted preview: ${String(snapshot.telemetry.redactedPreviewAvailable)}`,
    `- ledger: ${String(snapshot.productLoop.ledgerAvailable)}`,
    `- telemetry external: ${String(snapshot.telemetry.externalTelemetryEnabled)}`,
    `- next step: ${snapshot.nextSafeAction}`,
    '',
    'Gates',
  ];

  for (const gate of snapshot.gates) {
    lines.push(
      `- ${gate.status}: ${gate.label}`,
      `  ${gate.source} - ${gate.command} - ${gate.detail}`,
    );
  }

  lines.push('', 'surfaces');
  for (const surface of snapshot.surfaces) {
    lines.push(`- ${surface.status}: ${surface.label} (${surface.routeOrCommand}) - ${surface.detail}`);
  }

  lines.push('', 'Readiness');
  lines.push(`- public sync linked: ${String(snapshot.readiness.publicSiteDocsDemoSyncLinked)}`);
  lines.push(`- feedback contract linked: ${String(snapshot.readiness.feedbackTelemetryContractLinked)}`);
  lines.push(`- feedback route ready: ${String(snapshot.readiness.feedbackRouteReady)}`);
  lines.push(`- preview collect: ${String(snapshot.readiness.canCollectFeedbackPreview)}`);
  lines.push(`- send external: ${String(snapshot.readiness.canSendFeedbackExternally)}`);
  lines.push(`- enable telemetry: ${String(snapshot.readiness.canEnableTelemetry)}`);

  lines.push('', 'Politica');
  lines.push('- telemetry was not enabled');
  lines.push('- feedback was not sent');
  lines.push('- external call was not made');
  lines.push('- raw payload was not serialized');
  lines.push('- consent was not assumed');
  lines.push('- revoke/delete are available');
  lines.push('- explicit opt-in required');

  lines.push('', 'Routes and Commands');
  lines.push(`- Feedback: ${snapshot.surface.feedbackRoute}`);
  lines.push(`- Privacy: ${snapshot.surface.privacyRoute}`);
  lines.push(`- Docs: ${snapshot.surface.docsAnchor}`);
  lines.push(`- Preview: ${snapshot.surface.previewCommand}`);
  lines.push(`- Revoke: ${snapshot.surface.revokeCommand}`);
  lines.push(`- Delete: ${snapshot.surface.deleteCommand}`);
  lines.push(`- ZavorthControl: ${snapshot.surface.zavorthControlPath}`);
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
        { route: '/', label: 'main landing' },
        { route: '/docs', label: 'public documentation' },
        { route: '/privacy', label: 'privacy' },
        { route: '/security', label: 'security' },
      ],
      forbiddenClaims: [],
      checks: [],
      nextRecommendedGate: { stage: '47', title: 'Public Demo', reason: 'demo fixture-first' },
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
      nextRecommendedGate: { stage: '57', title: 'Feedback', reason: 'feedback opt-in' },
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
      nextRecommendedGate: { stage: '48', title: 'Public Onboarding', reason: 'public first-run' },
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
      nextRecommendedGate: {
        stage: '52',
        title: 'Feedback, Telemetry Opt-In And Product Loop',
        reason: 'public loop',
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
      nextRecommendedGate: {
        stage: 'complete',
        title: 'Product feedback loop ready',
        reason: 'opt-in preview without envio external',
      },
    },
  };
}
