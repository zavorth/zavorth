import {
  AgentRunService,
  ReleaseInstallerRollbackPathService,
  ProductEntryRuntimeService,
  type ReleaseInstallerRollbackPathSnapshot,
  type UniversalAgentRun,
} from '../runtime/agent/index.js';
import type {
  ZavorthFirstRunBootstrapPlan,
  ZavorthWorkspaceIdentityProfileSnapshot,
  ZavorthFirstRunBootstrapPaths,
} from '../contracts/FirstRunWorkspaceBootstrapContract.js';

export function resolveReleaseInstallerRollbackCliText(args: string): string {
  return String(args || '')
    .trim()
    .replace(/^(?:(?:release-path|release-installer|installer-rollback|release-readiness-path|rollback-path|release-runtime|run|status|latest)\b\s*)+/i, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function buildReleaseInstallerRollbackCliSnapshot(input: {
  text: string;
  userId: string;
  sessionId: string;
}): ReleaseInstallerRollbackPathSnapshot {
  const service = new AgentRunService({
    now: () => new Date('2026-05-04T02:48:00.000Z'),
    productEntryRuntime: new ProductEntryRuntimeService({
      now: () => new Date('2026-05-04T02:48:00.000Z'),
      firstRunProfileService: {
        buildPlan: () => ({
          nativeContract: 'ZavorthFirstRunBootstrapPlan/v1',
          generatedAt: '2026-05-04T02:48:00.000Z',
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
            summary: 'Zavorth configured para fixture CLI.',
          },
          writes: [
            { path: 'data/runtime/first-run/profile.json', action: 'skip', reason: 'profile existente' },
          ],
          summary: ['First use configured for release path.'],
          willNotWrite: ['tokens ou API keys'],
          nextCommands: ['zavorth doctor', 'zavorth go --dry-run', 'zavorth release-path'],
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
        } as unknown as ZavorthFirstRunBootstrapPlan),
        buildWorkspaceIdentitySnapshot: () => ({
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
    text: input.text || 'preparar release installer rollback path',
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
        rollbackAvailable: true,
      },
      publicReleaseBundle: {
        stage: '51',
        surface: 'release-bundle',
        generatedAt: '2026-05-04T02:48:00.000Z',
        status: 'ready',
        websiteRoot: '<website>',
        summary: { ok: true, passed: 10, warnings: 0, failed: 0 },
        route: '/release',
        fixturePath: 'data/release-bundle.ts',
        requiredCommands: [
          'release:status:fast',
          'doctor:fast',
          'release:changelog',
          'release:rollback-preview',
        ],
        screenshots: [],
        checks: [],
        nextRecommendedGate: {
          stage: '52',
          title: 'Feedback, Telemetry Opt-In And Product Loop',
          reason: 'after do release path, abrir loop de produto without canary real.',
        },
      },
    },
  });
  return buildReleaseInstallerRollbackSnapshotFromRun(run);
}

export function buildReleaseInstallerRollbackSnapshotFromRun(
  run: UniversalAgentRun,
): ReleaseInstallerRollbackPathSnapshot {
  return new ReleaseInstallerRollbackPathService().buildSnapshot({
    run,
    generatedAt: run.updatedAt,
  });
}

export function formatReleaseInstallerRollbackSnapshot(
  snapshot: ReleaseInstallerRollbackPathSnapshot,
): string {
  const lines = [
    'Release / Installer / Rollback Path - Channel mesh8',
    `- contract: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- session: ${snapshot.identifiers.sessionId}`,
    `- status: ${snapshot.status}`,
    `- channel: ${snapshot.release.channel}`,
    `- public bundle: ${snapshot.release.releaseBundleStatus}`,
    `- installer preview: ${snapshot.installer.previewAvailable ? 'ready' : 'pending'}`,
    `- rollback: ${snapshot.rollback.rollbackAvailable ? 'ready' : 'pending'}`,
    `- canary: ${snapshot.readiness.canStartCanary ? 'released' : 'dormant'}`,
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
    lines.push(`- ${surface.status}: ${surface.label} (${surface.commandOrPath}) - ${surface.detail}`);
  }

  lines.push('', 'Readiness');
  lines.push(`- product entry linked: ${String(snapshot.readiness.productEntryRuntimeLinked)}`);
  lines.push(`- productization evidence linked: ${String(snapshot.readiness.productizationEvidenceLinked)}`);
  lines.push(`- release bundle ready: ${String(snapshot.readiness.releaseBundleReady)}`);
  lines.push(`- can publish stable: ${String(snapshot.readiness.canPublishStable)}`);
  lines.push(`- can start canary: ${String(snapshot.readiness.canStartCanary)}`);

  lines.push('', 'Politica');
  lines.push('- release was not published');
  lines.push('- installer was not executed');
  lines.push('- rollback was not executed');
  lines.push('- stable/latest tags were not moved');
  lines.push('- rollback requires an explicit command');
  lines.push('- secrets were not serialized');

  lines.push('', 'surfaces de consumption');
  lines.push(`- ZavorthControl: ${snapshot.surface.zavorthControlPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);
  lines.push(`- Public release: ${snapshot.surface.publicReleaseRoute}`);
  lines.push(`- Installer dry-run: ${snapshot.surface.dryRunCommand}`);
  lines.push(`- Rollback dry-run: ${snapshot.surface.rollbackCommand}`);

  return lines.join('\n');
}
