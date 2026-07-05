import {
  AgentRunService,
  ProductEntryRuntimeService,
  PublicAdoptionPilotLoopService,
  type PublicAdoptionPilotLoopSnapshot,
  type UniversalAgentRun,
} from '../runtime/agent/index.js';
import type {
  ZavorthFirstRunBootstrapPlan,
  ZavorthWorkspaceIdentityProfileSnapshot,
  ZavorthFirstRunBootstrapPaths,
} from '../contracts/FirstRunWorkspaceBootstrapContract.js';

export function resolvePublicAdoptionPilotLoopCliText(args: string): string {
  return String(args || '')
    .trim()
    .replace(/^(?:(?:public-adoption-pilot-loop|pilot-loop-runtime|pilot-feedback-loop|public-pilot-loop|adoption-pilot|support-pilot-loop|run|status|latest)\b\s*)+/i, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function buildPublicAdoptionPilotLoopCliSnapshot(input: {
  text: string;
  userId: string;
  sessionId: string;
}): PublicAdoptionPilotLoopSnapshot {
  const service = new AgentRunService({
    now: () => new Date('2026-05-04T04:51:00.000Z'),
    productEntryRuntime: new ProductEntryRuntimeService({
      now: () => new Date('2026-05-04T04:51:00.000Z'),
      firstRunProfileService: {
        buildPlan: () => ({
          nativeContract: 'ZavorthFirstRunBootstrapPlan/v1',
          generatedAt: '2026-05-04T04:51:00.000Z',
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
          summary: ['Primeiro uso configured para adoption pilot loop.'],
        } as unknown as ZavorthFirstRunBootstrapPlan),
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
    text: input.text || 'preparar public adoption pilot feedback loop',
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    requestedTools: ['workspace.read'],
    metadata: buildPublicAdoptionPilotLoopFixtureMetadata(),
  });
  return buildPublicAdoptionPilotLoopSnapshotFromRun(run);
}

export function buildPublicAdoptionPilotLoopSnapshotFromRun(
  run: UniversalAgentRun,
): PublicAdoptionPilotLoopSnapshot {
  return new PublicAdoptionPilotLoopService().buildSnapshot({
    run,
    generatedAt: run.updatedAt,
  });
}

export function formatPublicAdoptionPilotLoopSnapshot(
  snapshot: PublicAdoptionPilotLoopSnapshot,
): string {
  const lines = [
    'Public Adoption / Pilot Feedback Loop - Public Adoption Pilot',
    `- contract: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- session: ${snapshot.identifiers.sessionId}`,
    `- status: ${snapshot.status}`,
    `- feedback opt-in: ${String(snapshot.feedbackProductLoop.optInReady)}`,
    `- pilot loop: ${snapshot.pilot.contractStatus}`,
    `- pilotos planejados: ${snapshot.adoptionLoop.plannedPilotCount}`,
    `- zavorthControl agregado: ${String(snapshot.adoptionLoop.zavorthControlAggregationOnly)}`,
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

  lines.push('', 'Superficies');
  for (const surface of snapshot.surfaces) {
    lines.push(`- ${surface.status}: ${surface.label} (${surface.routeOrCommand}) - ${surface.detail}`);
  }

  lines.push('', 'Readiness');
  lines.push(`- feedback product loop ready: ${String(snapshot.readiness.feedbackProductLoopReady)}`);
  lines.push(`- pilot loop linked: ${String(snapshot.readiness.pilotLoopContractLinked)}`);
  lines.push(`- templates ready: ${String(snapshot.readiness.templatesReady)}`);
  lines.push(`- triage ready: ${String(snapshot.readiness.triageReady)}`);
  lines.push(`- ledger ready: ${String(snapshot.readiness.ledgerReady)}`);
  lines.push(`- zavorthControl ready: ${String(snapshot.readiness.zavorthControlReady)}`);
  lines.push(`- controlled pilot: ${String(snapshot.readiness.canStartControlledPilot)}`);

  lines.push('', 'Politica');
  lines.push('- implicit collection was not enabled');
  lines.push('- telemetry was not enabled');
  lines.push('- external submission was not made');
  lines.push('- workspace payload was not stored');
  lines.push('- ledger permanece local');
  lines.push('- zavorthControl usa apenas agregados');
  lines.push('- piloto exige owner explicito');

  lines.push('', 'Rotas e comandos');
  lines.push(`- Feedback: ${snapshot.surface.feedbackRoute}`);
  lines.push(`- Docs: ${snapshot.surface.docsAnchor}`);
  lines.push(`- Pilot loop: ${snapshot.surface.pilotLoopCommand}`);
  lines.push(`- QA: ${snapshot.surface.qaCommand}`);
  lines.push(`- Phase gate: ${snapshot.surface.phaseGateCommand}`);
  lines.push(`- Ledger: ${snapshot.surface.ledgerArtifact}`);
  lines.push(`- ZavorthControl: ${snapshot.surface.zavorthControlArtifact}`);
  lines.push(`- ZavorthControl: ${snapshot.surface.zavorthControlPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);

  return lines.join('\n');
}

function buildPublicAdoptionPilotLoopFixtureMetadata() {
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
      generatedAt: '2026-05-04T04:51:00.000Z',
      status: 'ready',
      websiteRoot: '<website>',
      summary: { ok: true, passed: 12, warnings: 0, failed: 0 },
      requiredRoutes: [
        { route: '/', label: 'landing principal' },
        { route: '/docs', label: 'documentacao publica' },
        { route: '/privacy', label: 'privacidade' },
        { route: '/security', label: 'security' },
      ],
      forbiddenClaims: [],
      checks: [],
    },
    publicDocsRecipes: {
      stage: '56',
      surface: 'public-docs-recipes',
      generatedAt: '2026-05-04T04:51:00.000Z',
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
    },
    publicDemo: {
      stage: '47',
      surface: 'public-demo',
      generatedAt: '2026-05-04T04:51:00.000Z',
      status: 'ready',
      websiteRoot: '<website>',
      summary: { ok: true, passed: 10, warnings: 0, failed: 0 },
      route: '/demo',
      fixturePath: 'data/public-demo.ts',
      requiredStates: ['request', 'plan', 'Approval', 'artifact', 'replay', 'summary'],
      requiredArtifacts: ['demo-build-fix-report.md', 'demo-run-2026-04-25.json'],
      screenshots: [],
      checks: [],
    },
    publicReleaseBundle: {
      stage: '51',
      surface: 'release-bundle',
      generatedAt: '2026-05-04T04:51:00.000Z',
      status: 'ready',
      websiteRoot: '<website>',
      summary: { ok: true, passed: 10, warnings: 0, failed: 0 },
      route: '/release',
      fixturePath: 'data/release-bundle.ts',
      requiredCommands: ['release:status:fast', 'doctor:fast', 'release:changelog', 'release:rollback-preview'],
      screenshots: [],
      checks: [],
    },
    feedbackTelemetry: {
      stage: '52',
      surface: 'feedback-loop',
      generatedAt: '2026-05-04T04:51:00.000Z',
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
    pilotLoop: {
      stage: '57',
      surface: 'pilot-loop',
      generatedAt: '2026-05-04T04:51:00.000Z',
      status: 'ready',
      projectRoot: '<core>',
      websiteRoot: '<website>',
      artifactDir: '.qa/pilot-loop',
      summary: { ok: true, passed: 16, warnings: 0, failed: 0 },
      artifacts: {
        feedbackPreviewPath: '.qa/pilot-loop/feedback-preview-redacted.json',
        pilotLedgerPath: '.qa/pilot-loop/pilot-ledger.json',
        zavorthControlPath: '.qa/pilot-loop/support-zavorthControl.json',
      },
      templates: [
        { id: 'bug', requiredFields: ['a', 'b', 'c', 'd'], redactionRules: ['tokens', 'secrets', 'paths pessoais'], safePrompt: 'Use dados redigidos.' },
        { id: 'docs', requiredFields: ['a', 'b', 'c', 'd'], redactionRules: ['workspace privado', 'logs brutos', 'credenciais'], safePrompt: 'Use exemplo redigido.' },
        { id: 'install', requiredFields: ['a', 'b', 'c', 'd'], redactionRules: ['path pessoal', 'usuario', 'env vars'], safePrompt: 'Use redacted environment.' },
        { id: 'feature', requiredFields: ['a', 'b', 'c', 'd'], redactionRules: ['cliente', 'repo privado', 'documento interno'], safePrompt: 'Use contexto redigido.' },
      ],
      triageRules: [
        { id: 'install-high', area: 'install', severity: 'high', responseTarget: '1 business day', owner: 'runtime', nextAction: 'Reproduzir em fixture.' },
        { id: 'bug-medium', area: 'bug', severity: 'medium', responseTarget: '2 business days', owner: 'runtime', nextAction: 'Triar public command.' },
        { id: 'docs-low', area: 'docs', severity: 'low', responseTarget: '3 business days', owner: 'docs', nextAction: 'Atualizar docs.' },
        { id: 'release-high', area: 'release', severity: 'high', responseTarget: '1 business day', owner: 'release', nextAction: 'Validar rollback preview.' },
        { id: 'feature-low', area: 'feature', severity: 'low', responseTarget: 'next planning cycle', owner: 'product', nextAction: 'Registrar backlog publico.' },
      ],
      pilotLedger: [
        { id: 'pilot-local-engineering', scope: 'Quickstart fixture.', status: 'planned', startedAt: '2026-04-26', result: 'Pendente.', followUp: 'Coletar friccao redigida.', dataPolicy: 'redacted-only' },
        { id: 'pilot-release-operator', scope: 'Release readiness.', status: 'planned', startedAt: '2026-04-26', result: 'Pendente.', followUp: 'Confirmar canais.', dataPolicy: 'no-workspace-payload' },
        { id: 'pilot-feedback-loop', scope: 'Preview e revoke/delete.', status: 'planned', startedAt: '2026-04-26', result: 'Pendente.', followUp: 'Medir template.', dataPolicy: 'redacted-only' },
      ],
      supportPolicy: [
        { id: 'privacy-first', channel: 'public issue or redacted feedback preview', responseWindow: 'best effort', boundaries: ['sem secrets', 'sem payload bruto', 'sem workspace privado'], escalation: 'Pedir preview redigido.' },
        { id: 'install-runtime', channel: 'support issue', responseWindow: '1-2 business days', boundaries: ['public command', 'summarized error', 'redacted environment'], escalation: 'Reproduce through local fixture.' },
        { id: 'feature-planning', channel: 'feature request', responseWindow: 'next planning review', boundaries: ['sem promessa', 'sem dados privados', 'sem parceria implicita'], escalation: 'Converter para proposta.' },
      ],
      zavorthControlMetrics: [
        { id: 'feedback-count-by-area', label: 'Feedback por area', aggregateOnly: true, excludesPayload: true, source: 'redacted feedback preview' },
        { id: 'severity-mix', label: 'Distribuicao por severidade', aggregateOnly: true, excludesPayload: true, source: 'triage rules' },
        { id: 'pilot-status', label: 'Status dos pilotos', aggregateOnly: true, excludesPayload: true, source: 'local pilot ledger' },
        { id: 'follow-up-aging', label: 'Follow-ups pendings', aggregateOnly: true, excludesPayload: true, source: 'local pilot ledger' },
      ],
      checks: [
        { id: 'pilot-loop:feedback-preview', title: 'feedback preview redigido', status: 'pass', reason: 'preview redigido sem envio', evidence: ['feedback-preview-redacted.json'] },
        { id: 'pilot-loop:pilot-ledger', title: 'ledger local de pilotos', status: 'pass', reason: 'ledger local sem payload', evidence: ['pilot-ledger.json'] },
        { id: 'pilot-loop:zavorthControl', title: 'zavorthControl agregado de suporte', status: 'pass', reason: 'zavorthControl agregado sem payload', evidence: ['support-zavorthControl.json'] },
      ],
      nextRecommendedStage: {
        stage: '58',
        title: 'Integration Showcase And Partner Surface',
        reason: 'mostrar integracoes com fixture e degradacao segura',
      },
    },
  };
}
