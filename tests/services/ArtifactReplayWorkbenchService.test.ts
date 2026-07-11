import { ArtifactReplayWorkbenchService } from '../../src/services/ArtifactReplayWorkbenchService';
import { buildRuntimeShellHtml } from '../../src/domain/surface/presentation/web-console/WebConsoleRuntimeShellHtml';

describe('ArtifactReplayWorkbenchService', () => {
  it('passes against the current repository artifact/replay workbench contract', async () => {
    const service = new ArtifactReplayWorkbenchService();

    const snapshot = await service.buildSnapshot({ limit: 12 });

    expect(snapshot.gate).toBe('artifact-replay');
    expect(snapshot.surface).toBe('artifact-replay-workbench');
    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.summary.heavyRuntimesStarted).toBe(false);
    expect(snapshot.nextRecommendedGate).toEqual(expect.objectContaining({
      gate: 'release-ux-wizard',
      title: 'Release UX',
    }));
  });

  it('builds artifact index, compare entries, learning marks and controlled evidence exports', async () => {
    const service = new ArtifactReplayWorkbenchService({
      packageJson: packageJsonFixture(),
      html: buildRuntimeShellHtml('/zavorthControl'),
      controlPlaneSnapshot: controlPlaneFixture(),
      replayLearningSnapshot: replayLearningFixture(),
      existsSync: () => true,
      readFileSync: () => '',
      now: () => new Date('2026-04-24T00:00:00.000Z'),
    });

    const snapshot = await service.buildSnapshot({ limit: 12 });

    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.workbench.artifactIndex).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'artifact-a',
        sourceRunId: 'workflow-a',
        reusable: true,
      }),
    ]));
    expect(snapshot.workbench.compare).toEqual(expect.arrayContaining([
      expect.objectContaining({
        leftRunId: 'workflow-a',
        rightRunId: 'workflow-b',
        ready: true,
      }),
    ]));
    expect(snapshot.workbench.learningMarks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'candidate-a',
        score: 0.91,
      }),
    ]));
    expect(snapshot.workbench.evidenceExports.every((entry) => entry.payloadIncluded === false)).toBe(true);
  });

  it('fails when replay learning redaction policy becomes unsafe', async () => {
    const service = new ArtifactReplayWorkbenchService({
      packageJson: packageJsonFixture(),
      html: buildRuntimeShellHtml('/zavorthControl'),
      controlPlaneSnapshot: controlPlaneFixture(),
      replayLearningSnapshot: replayLearningFixture({
        policy: {
          suggestOnlyDefault: true,
          rawReplayPersisted: true,
          secretsPersisted: false,
          approvalRequiredForProfile: true,
          retentionTtlMs: 1000,
        },
      }),
      existsSync: () => true,
      readFileSync: () => '',
    });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'policy:redaction',
        status: 'fail',
      }),
    ]));
  });

  it('fails when package scripts for the workbench are missing', async () => {
    const service = new ArtifactReplayWorkbenchService({
      packageJson: packageJsonFixture({
        'artifact:workbench': '',
        'qa:artifact-replay': '',
      }),
      html: buildRuntimeShellHtml('/zavorthControl'),
      controlPlaneSnapshot: controlPlaneFixture(),
      replayLearningSnapshot: replayLearningFixture(),
      existsSync: () => true,
      readFileSync: () => '',
    });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'package:artifact:workbench', status: 'fail' }),
      expect.objectContaining({ id: 'package:qa:artifact-replay', status: 'fail' }),
    ]));
  });

  it('fails when the Dashboard workbench card disappears', async () => {
    const service = new ArtifactReplayWorkbenchService({
      packageJson: packageJsonFixture(),
      html: buildRuntimeShellHtml('/zavorthControl').replace('id="artifact-replay-workbench-card"', 'id="artifact-workbench-missing"'),
      controlPlaneSnapshot: controlPlaneFixture(),
      replayLearningSnapshot: replayLearningFixture(),
      existsSync: () => true,
      readFileSync: () => '',
    });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'web:artifact-workbench-card',
        status: 'fail',
      }),
    ]));
  });

  it('renders a human report with the next gate recommendation', async () => {
    const service = new ArtifactReplayWorkbenchService({
      packageJson: packageJsonFixture(),
      html: buildRuntimeShellHtml('/zavorthControl'),
      controlPlaneSnapshot: controlPlaneFixture(),
      replayLearningSnapshot: replayLearningFixture(),
      existsSync: () => true,
      readFileSync: () => '',
      now: () => new Date('2026-04-24T00:00:00.000Z'),
    });

    await expect(service.renderReport({ limit: 12 })).resolves.toContain('proximo passo recomendada: release-ux-wizard - Release UX');
  });
});

function packageJsonFixture(overrides: Record<string, string> = {}) {
  return {
    scripts: {
      'ops:replay-learning': 'npx tsx scripts/zavorth-replay-learning.ts',
      'ops:replay-learning:json': 'npx tsx scripts/zavorth-replay-learning.ts --json',
      'artifact:workbench': 'npx tsx scripts/artifact-replay-workbench.ts',
      'qa:artifact-workbench': 'npx tsx scripts/artifact-replay-workbench.ts --require-pass',
      'qa:artifact-replay': 'node scripts/capability-suite-market-check.mjs --gate=artifact-replay',
      ...overrides,
    },
  };
}

function controlPlaneFixture(overrides: Record<string, any> = {}) {
  return {
    generatedAt: '2026-04-24T00:00:00.000Z',
    workspaceRoot: 'C:/repo',
    summary: {
      posture: 'healthy',
      timelineEvents: 3,
      compareReady: true,
      resumeReady: true,
      restoreReady: true,
      recentArtifacts: 1,
      reusableArtifacts: 1,
      workflowRuns: 2,
      resumableWorkflowRuns: 1,
      lifecycleEvents: 2,
      lifecycleRuns: 2,
      lifecycleApprovals: 0,
      lifecycleArtifacts: 1,
      lifecycleAttention: 0,
      learningCandidates: 1,
      pendingLearning: 1,
      promotedLearning: 0,
      highConfidenceLearning: 1,
      memoryEntries: 4,
      proceduralEntries: 2,
      memoryPressure: 'ok',
    },
    cards: ['replay', 'artifacts', 'lifecycle', 'learning', 'memory', 'workspace'].map((id) => ({
      id,
      label: id,
      posture: 'healthy',
      summary: `${id} ok`,
      nextAction: 'inspect',
      command: '/memoryplane',
    })),
    artifacts: [
      {
        id: 'artifact-a',
        label: 'release-log.txt',
        kind: 'log',
        source: 'workflow:ship',
        sourceRunId: 'workflow-a',
        path: 'artifacts/release-log.txt',
        url: null,
        createdAt: '2026-04-24T00:00:00.000Z',
        summary: 'Log reutilizavel.',
        reusable: true,
        resumePrompt: 'Retome a partir do release-log.txt.',
      },
    ],
    timeline: [
      {
        id: 'event-a',
        label: 'Run A',
        kind: 'workflow',
        status: 'completed',
        happenedAt: '2026-04-24T00:00:00.000Z',
        summary: 'Run A passou.',
      },
      {
        id: 'event-b',
        label: 'Run B',
        kind: 'workflow',
        status: 'paused',
        happenedAt: '2026-04-23T00:00:00.000Z',
        summary: 'Run B pausou.',
      },
    ],
    lifecycle: {
      generatedAt: '2026-04-24T00:00:00.000Z',
      summary: {
        recent: 1,
        runs: 1,
        approvals: 0,
        artifacts: 1,
        approvalRequired: 0,
        blocked: 0,
        failed: 0,
      },
      latest: [
        {
          id: 'lifecycle-a',
          kind: 'artifact',
          runId: 'workflow-a',
          traceId: 'trace-a',
          summary: 'Artifact ligado ao workflow.',
        },
      ],
      narrative: {
        nextAction: 'Continuar.',
      },
    },
    learningCandidates: [
      {
        id: 'candidate-a',
        title: 'Promover playbook de release',
        kind: 'playbook',
        score: 0.91,
        reviewState: 'pending',
        lifecycle: 'learned_draft',
        sourceWorkflow: 'ship',
        actionHint: '/learning approve candidate-a',
      },
    ],
    actions: [],
    sourceSnapshots: {
      workflowRuns: [
        {
          workflow_run_id: 'workflow-a',
          workflow_name: 'ship',
          status: 'completed',
          objective: 'Ship A',
          updated_at: '2026-04-24T00:00:00.000Z',
          artifacts: [],
        },
        {
          workflow_run_id: 'workflow-b',
          workflow_name: 'ship',
          status: 'paused',
          objective: 'Ship B',
          updated_at: '2026-04-23T00:00:00.000Z',
          artifacts: [],
        },
      ],
    },
    narrative: {
      headline: 'Replay ok',
      operatorSummary: 'Replay pronto.',
      nextAction: 'Comparar runs.',
    },
    ...overrides,
  } as any;
}

function replayLearningFixture(overrides: Record<string, any> = {}) {
  return {
    generatedAt: '2026-04-24T00:00:00.000Z',
    summary: {
      posture: 'healthy',
      timelineEvents: 1,
      compareReady: true,
      resumeReady: true,
      recentArtifacts: 1,
      reusableArtifacts: 1,
      learningCandidates: 1,
      pendingLearning: 1,
      promotedLearning: 0,
      memoryEntries: 1,
      proceduralEntries: 0,
      memoryPressure: 'low',
      approvedProfileEntries: 0,
      revokedEntries: 0,
      heavyRuntimesStarted: false,
    },
    narrative: {
      headline: 'Replay learning',
      operatorSummary: '1 aprendizado.',
      nextAction: 'Revisar.',
    },
    profile: {
      version: 1,
      mode: 'suggest-only',
      updatedAt: null,
      localOnly: true,
      exportable: true,
      expiresAt: null,
      approvedRecordIds: [],
      revokedRecordIds: [],
      preferences: [],
      procedures: [],
      debugPatterns: [],
      codingStyle: [],
      skillCandidates: [],
      notes: [],
    },
    records: [],
    actions: [],
    policy: {
      suggestOnlyDefault: true,
      rawReplayPersisted: false,
      secretsPersisted: false,
      approvalRequiredForProfile: true,
      retentionTtlMs: 1000,
    },
    ...overrides,
  } as any;
}
