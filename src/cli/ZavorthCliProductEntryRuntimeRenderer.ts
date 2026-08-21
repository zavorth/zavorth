import {
  AgentRunService,
  ProductEntryRuntimeService,
  type ProductEntryRuntimeSnapshot,
  type UniversalAgentRun,
} from '../runtime/agent/index.js';

export function resolveProductEntryRuntimeCliText(args: string): string {
  return String(args || '')
    .trim()
    .replace(/^(?:(?:product-entry|entry|first-run-runtime|first-run-state|start-runtime|first-run|start|run|status|latest)\b\s*)+/i, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function buildProductEntryRuntimeCliSnapshot(input: {
  text: string;
  userId: string;
  sessionId: string;
}): ProductEntryRuntimeSnapshot {
  const service = new AgentRunService({
    now: () => new Date('2026-05-04T02:47:00.000Z'),
  });
  const run = service.createRun({
    userId: input.userId,
    channel: 'cli',
    sessionId: input.sessionId,
    text: input.text || 'prepare the first product entry',
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    requestedTools: ['workspace.read'],
    metadata: {
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
        rollbackAvailable: false,
      },
      workspaceIdentityProfile: {
        nativeContract: 'ZavorthWorkspaceIdentityProfileSnapshot/v1',
        configured: true,
        profilePath: 'data/runtime/first-run/profile.json',
        userDisplayName: 'user',
        agentDisplayName: 'Zavorth',
        tonePreference: 'balanced',
        workspaceRoot: '<workspace>',
        memoryMode: 'local-metadata',
        safetyPosture: 'preview-first',
        providerStatus: 'deferred',
      },
      firstRunBootstrapPlan: {
        nativeContract: 'ZavorthFirstRunBootstrapPlan/v1',
        generatedAt: '2026-05-04T02:47:00.000Z',
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
        profile: {},
        existingProfile: {
          exists: true,
          path: 'data/runtime/first-run/profile.json',
          summary: 'Zavorth for user at <workspace>',
        },
        writes: [
          { path: 'data/runtime/first-run/profile.json', action: 'skip', reason: 'profile existente' },
        ],
        summary: ['First use configured for fixture CLI.'],
        willNotWrite: ['tokens ou API keys'],
        nextCommands: ['zavorth doctor', 'zavorth go --dry-run', 'zavorth chat'],
        redactedJson: '{}',
        safety: {
          canApply: false,
          requiresConfirmation: true,
          rawSecretSerialized: false,
          runtimePersistentStartPerformed: false,
          providerExecutionPerformed: false,
          toolExecutionPerformed: false,
          messageSendPerformed: false,
          rawImportPerformed: false,
          warnings: [],
          blockers: [],
        },
      },
      firstRunPersonalizationStatus: {
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
      },
      firstRunOnboarding: {
        stage: '48',
        surface: 'first-run-onboarding',
        generatedAt: '2026-05-04T02:47:00.000Z',
        status: 'ready',
        websiteRoot: '<website>',
        summary: { ok: true, passed: 9, warnings: 0, failed: 0 },
        route: '/start',
        fixturePath: 'data/first-run.ts',
        requiredStates: [],
        requiredArtifacts: [],
        screenshots: [],
        checks: [],
        nextRecommendedGate: {
          stage: '49',
          title: 'External Docs And Examples',
          reason: 'external docs after first-run',
        },
      },
    },
  });
  return buildProductEntryRuntimeSnapshotFromRun(run);
}

export function buildProductEntryRuntimeSnapshotFromRun(
  run: UniversalAgentRun,
): ProductEntryRuntimeSnapshot {
  return new ProductEntryRuntimeService().buildSnapshot({
    run,
    generatedAt: run.updatedAt,
  });
}

export function formatProductEntryRuntimeSnapshot(
  snapshot: ProductEntryRuntimeSnapshot,
): string {
  const lines = [
    'Product Entry Runtime / First Run - Channel mesh7',
    `- contract: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- session: ${snapshot.identifiers.sessionId}`,
    `- status: ${snapshot.status}`,
    `- surface: ${snapshot.entry.requestedSurface}`,
    `- handoff: ${snapshot.entry.handoffAllowed ? 'released' : 'awaiting first-run'}`,
    `- profile: ${snapshot.firstRun.profileConfigured ? 'configured' : 'pending'}`,
    `- onboarding: ${snapshot.firstRun.onboardingStatus}`,
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

  lines.push('', 'Surfaces');
  for (const surface of snapshot.surfaces) {
    lines.push(`- ${surface.status}: ${surface.label} (${surface.commandOrPath}) -> ${surface.entryState}`);
  }

  lines.push('', 'Readiness');
  lines.push(`- productization evidence: ${String(snapshot.readiness.productizationEvidenceLinked)}`);
  lines.push(`- release preview: ${String(snapshot.readiness.releasePreviewReady)}`);
  lines.push(`- first-run required: ${String(snapshot.readiness.firstRunRequired)}`);
  lines.push(`- doctor required: ${String(snapshot.readiness.doctorRequired)}`);
  lines.push(`- handoff to AgentGateway: ${String(snapshot.readiness.handoffToAgentRuntime)}`);

  lines.push('', 'Policy');
  lines.push('- snapshot does not write the profile');
  lines.push('- does not start persistent runtime');
  lines.push('- does not execute provider/tool');
  lines.push('- does not send external messages');
  lines.push('- first-run and state are shared across surfaces');
  lines.push('- secrets were not serialized');

  lines.push('', 'surfaces de consumption');
  lines.push(`- ZavorthControl: ${snapshot.surface.zavorthControlPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);
  lines.push(`- Public start: ${snapshot.surface.publicStartRoute}`);
  lines.push(`- Go: ${snapshot.surface.goCommand}`);

  return lines.join('\n');
}
