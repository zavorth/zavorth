import { ZavorthWatchModeControlPlaneService } from '../../src/services/ZavorthWatchModeControlPlaneService.js';

describe('ZavorthWatchModeControlPlaneService', () => {
  it('treats cold start as healthy and renders a consolidated watch mode report', () => {
    const service = new ZavorthWatchModeControlPlaneService({
      now: () => new Date('2026-04-12T23:15:00.000Z'),
      workspaceRoot: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      policyFileService: {
        readPolicy: jest.fn(() => ({
          version: 1,
          updatedAt: '2026-04-12T23:10:00.000Z',
          strictApprovalDefault: true,
          allowedApps: ['chrome'],
          allowedSites: ['docs.example.com'],
          screenshotTtlMs: 86_400_000,
          maxScreenshotBytes: 262_144_000,
          screenshotRedactionMode: 'redacted',
          sensitiveScreenPolicy: 'pause',
          defaultBudget: {
            maxIterations: 8,
            maxDurationMs: 600_000,
            maxScreenshots: 24,
            maxMemoryMb: 512,
            idleTtlMs: 120_000,
            delayBetweenActionsMs: 1200,
            screenshotTtlMs: 86_400_000,
            maxScreenshotBytes: 262_144_000,
            screenshotRedactionMode: 'redacted',
            sensitiveScreenPolicy: 'pause',
          },
        })),
      } as any,
      stateFileService: {
        readSnapshot: jest.fn(() => null),
      } as any,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.generatedAt).toBe('2026-04-12T23:15:00.000Z');
    expect(snapshot.summary.posture).toBe('healthy');
    expect(snapshot.summary.allowedApps).toBe(1);
    expect(snapshot.summary.allowedSites).toBe(1);
    expect(snapshot.summary.artifactEntries).toBe(0);
    expect(snapshot.summary.throttledScreenshots).toBe(0);
    expect(snapshot.summary.activeVisualHandles).toBe(0);
    expect(snapshot.summary.maxIterations).toBe(8);
    expect(snapshot.summary.screenshotRedactionMode).toBe('redacted');
    expect(snapshot.cost).toEqual(expect.objectContaining({ level: 'low', score: 0 }));
    expect(snapshot.actions[0]).toEqual(expect.objectContaining({ id: 'review-status' }));
    expect(service.renderReport()).toContain('Wave C: Watch Mode supervisionado');
  });

  it('raises attention when approvals are pending and suggests allowlist actions', () => {
    const service = new ZavorthWatchModeControlPlaneService({
      watchModeService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-12T23:20:00.000Z',
          summary: {
            totalRuns: 1,
            runningRuns: 0,
            pausedRuns: 0,
            waitingApprovalRuns: 1,
            pendingApprovals: 1,
            lastStatus: 'waiting_approval',
          },
          policy: {
            strictApprovalDefault: true,
            allowedApps: [],
            allowedSites: [],
          },
          activeRun: {
            runId: 'watch-1',
            status: 'waiting_approval',
            targetWindow: 'Chrome',
            objective: 'Revisar dashboard',
            siteUrl: 'docs.example.com',
            strictApproval: true,
            allowlist: {
              appConfigured: false,
              appMatched: false,
              siteConfigured: false,
              siteMatched: false,
              mode: 'guarded',
            },
            startedAt: '2026-04-12T23:18:00.000Z',
            finishedAt: null,
            updatedAt: '2026-04-12T23:20:00.000Z',
            latestScreenshotPath: null,
            pendingApprovalId: 'approval-1',
            pendingApprovalCount: 1,
            nextOperatorStep: 'Decida o approval.',
            lastError: null,
            buffers: {
              timelineEntries: 0,
              timelineLimit: 40,
              artifactEntries: 2,
              artifactLimit: 8,
              screenshotThrottleMs: 1200,
              throttledScreenshots: 3,
              droppedTimelineEntries: 1,
              persistedArtifacts: 4,
              approvalDecisions: 1,
            averageApprovalLatencyMs: 4200,
            expiredArtifacts: 0,
            deletedScreenshotBytes: 0,
            activeVisualHandles: 1,
          },
            agent: null,
            approvals: [],
            timeline: [],
            artifacts: [],
          },
          runs: [],
        })),
      } as any,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.posture).toBe('attention');
    expect(snapshot.summary.artifactEntries).toBe(2);
    expect(snapshot.summary.throttledScreenshots).toBe(3);
    expect(snapshot.summary.activeVisualHandles).toBe(1);
    expect(snapshot.cost).toEqual(expect.objectContaining({ level: 'high', score: 76 }));
    expect(snapshot.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'review-approvals' }),
        expect.objectContaining({ id: 'allow-current-app' }),
        expect.objectContaining({ id: 'allow-current-site' }),
      ]),
    );
  });
});
