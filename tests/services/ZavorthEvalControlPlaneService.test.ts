import { ZavorthEvalControlPlaneService } from '../../src/services/ZavorthEvalControlPlaneService.js';
import { buildEvalScorecards } from '../../src/services/eval-control-plane/ZavorthEvalControlPlaneKit.js';

describe('ZavorthEvalControlPlaneService', () => {
  it('builds scorecards, datasets and regressions from product observability', async () => {
    const productObservabilityService = {
      buildSnapshot: jest.fn(async () => ({
        generatedAt: '2026-04-12T12:00:00.000Z',
        windowHours: 168,
        scope: {
          workspace: null,
          sourceSurface: null,
          executor: null,
          workflow: null,
          scoped: false,
        },
        totals: {
          tasks: 18,
          completed: 11,
          failed: 4,
          waitingApproval: 3,
          workflowRuns: 5,
          resumableWorkflowRuns: 2,
          artifacts: 4,
          approvals: 7,
        },
        routes: {
          strategies: [],
          taskKinds: [],
          taskSubtypes: [],
        },
        workspaces: {
          top: [],
        },
        surfaces: {
          sources: [
            { label: 'web', count: 10, last_seen_at: '2026-04-12T12:00:00.000Z' },
            { label: 'telegram', count: 4, last_seen_at: '2026-04-12T11:00:00.000Z' },
          ],
        },
        workflows: {
          active: 1,
          resumable: 2,
          completed: 3,
          failed: 1,
          recent: [
            {
              workflow_run_id: 'wf-1',
              workflow: 'channel-setup',
              status: 'failed',
              operator_state: 'active',
              operator_close_reason: null,
              completed_stages: 2,
              total_stages: 4,
              resume_stage_id: 'stage-3',
              resume_stage_label: 'doctor',
              recovered_from_interruption: false,
              last_interrupted_stage_label: 'doctor',
              primary_artifact_name: 'channel-report.json',
              updated_at: '2026-04-12T12:00:00.000Z',
            },
          ],
        },
        executors: {
          top: [
            {
              executor: 'web',
              total: 9,
              completed: 7,
              failed: 1,
              waiting_approval: 1,
              approval_friction: 2,
              success_rate: 0.777,
              last_seen_at: '2026-04-12T12:00:00.000Z',
            },
          ],
          friction: [],
        },
        approvals: {
          pending: 3,
          approved: 4,
          rejected: 0,
          highRisk: 1,
          permissionPending: 0,
          permissionRejected: 0,
        },
        operatorCost: {
          averageApprovalWaitMs: 62000,
          averageRecoveryMs: 140000,
          averageArtifactDeliveryMs: 12000,
          heaviestRoute: null,
        },
        artifacts: {
          topKinds: [],
          recent: [
            {
              name: 'channel-report.json',
              kind: 'report',
              type: 'json',
              task_id: 'task-1',
              created_at: '2026-04-12T12:00:00.000Z',
            },
          ],
        },
        learning: {
          routes: {
            topSuccessful: [
              {
                executor: 'web',
                source: 'runtime',
                source_surface: 'web',
                strategy: 'guided',
                workflow: 'channel-setup',
                kind: 'channel',
                subtype: 'doctor',
                total: 6,
                completed: 5,
                failed: 1,
                waitingApproval: 0,
                waitingPermission: 0,
                rejected: 0,
                approvalGranted: 2,
                permissionGranted: 0,
                highRisk: 0,
                artifactful: 3,
                gatedCompletion: 1,
                gatedArtifactful: 1,
                workflowRecovered: 1,
                workflowRecoverySuccess: 1,
                workflowRecoveryArtifactful: 1,
                average_duration_ms: 2000,
                average_approval_wait_ms: 0,
                average_post_approval_recovery_ms: 0,
                average_artifact_delivery_after_approval_ms: 0,
                operator_cost_score: 20,
                success_rate: 0.833,
                friction_rate: 0.05,
                last_seen_at: '2026-04-12T12:00:00.000Z',
                rationale: 'Fluxo principal estavel.',
              },
            ],
            highestFriction: [
              {
                executor: 'telegram',
                source: 'runtime',
                source_surface: 'telegram',
                strategy: 'guided',
                workflow: 'watch-mode',
                kind: 'watch',
                subtype: 'approval',
                total: 5,
                completed: 2,
                failed: 2,
                waitingApproval: 2,
                waitingPermission: 0,
                rejected: 1,
                approvalGranted: 1,
                permissionGranted: 0,
                highRisk: 1,
                artifactful: 0,
                gatedCompletion: 0,
                gatedArtifactful: 0,
                workflowRecovered: 0,
                workflowRecoverySuccess: 0,
                workflowRecoveryArtifactful: 0,
                average_duration_ms: 3500,
                average_approval_wait_ms: 45000,
                average_post_approval_recovery_ms: 12000,
                average_artifact_delivery_after_approval_ms: 0,
                operator_cost_score: 74,
                success_rate: 0.4,
                friction_rate: 0.42,
                last_seen_at: '2026-04-12T12:00:00.000Z',
                rationale: 'Approvals mutaveis segurando o fluxo.',
              },
            ],
            highestOperatorCost: [],
          },
          approvedPolicies: [],
          workflowResumeStages: [
            {
              workflow: 'channel-setup',
              stage_label: 'doctor',
              count: 2,
              approval_pending: 1,
              blocked: 1,
              failed: 1,
              last_seen_at: '2026-04-12T12:00:00.000Z',
              rationale: 'Doctor travando configuracao.',
            },
          ],
        },
        insights: ['A fila de approvals do watch mode subiu acima do baseline.'],
      })),
    };

    const service = new ZavorthEvalControlPlaneService(
      {
        productObservabilityService: productObservabilityService as any,
        telemetryLedgerService: {
          buildSnapshot: jest.fn(() => ({
            generatedAt: '2026-04-12T12:30:00.000Z',
            file: 'telemetry-events.jsonl',
            windowHours: 168,
            available: true,
            status: 'active',
            totalEvents: 12,
            traceCount: 3,
            failureEvents: 1,
            blockedEvents: 1,
            lastEventAt: '2026-04-12T12:25:00.000Z',
            topSources: [{ label: 'telegram', count: 4 }],
            topEventTypes: [{ label: 'tool.completed', count: 3 }],
            traces: [
              {
                traceId: 'trace-1',
                source: 'telegram',
                status: 'blocked',
                eventCount: 4,
                failureCount: 0,
                lastEventType: 'execution.blocked',
                startedAt: '2026-04-12T12:10:00.000Z',
                lastSeenAt: '2026-04-12T12:25:00.000Z',
              },
            ],
            sinks: {
              localJsonl: true,
              langfuseConfigured: false,
              otelExporterConfigured: false,
              otelReady: false,
              externalRequired: false,
            },
            retention: {
              windowHours: 168,
              maxEvents: 5000,
              maxTraces: 8,
              maxTopEntries: 5,
              scannedEvents: 12,
              retainedEvents: 12,
              truncated: false,
            },
            redaction: {
              mode: 'hashed-references',
              traceIdsHashed: true,
              payloadsIncluded: false,
              notes: ['mock redigido'],
            },
            recommendation: 'Cruzar traces com scorecards.',
          })),
        } as any,
        evalHistoryService: {
          capture: jest.fn(() => ({
            file: 'eval-history.json',
            available: true,
            entries: 2,
            lastCapturedAt: '2026-04-12T12:30:00.000Z',
            latestPosture: 'critical',
            delta: {
              scorecards: 1,
              datasets: 1,
              regressions: 2,
              telemetrySignals: 1,
              traceCount: 1,
              failureEvents: 1,
            },
            trend: [
              {
                generatedAt: '2026-04-12T12:00:00.000Z',
                posture: 'attention',
                scorecards: 3,
                datasets: 2,
                regressions: 1,
                telemetrySignals: 4,
                traceCount: 2,
                failureEvents: 0,
                headline: 'Channel mesh com pontos de atencao',
                windowHours: 168,
                manifestHash: 'baseline-a',
              },
              {
                generatedAt: '2026-04-12T12:30:00.000Z',
                posture: 'critical',
                scorecards: 4,
                datasets: 3,
                regressions: 3,
                telemetrySignals: 5,
                traceCount: 3,
                failureEvents: 1,
                headline: 'Channel mesh em modo de recuperacao',
                windowHours: 168,
                manifestHash: 'baseline-b',
              },
            ],
            baseline: {
              available: true,
              generatedAt: '2026-04-12T12:00:00.000Z',
              posture: 'attention',
              manifestHash: 'baseline-a',
              comparableWindows: 2,
              summary: '2 janelas comparaveis.',
            },
            retention: {
              maxEntries: 120,
              trendWindow: 12,
              captureIntervalMs: 900000,
              compacted: false,
            },
            recommendation: 'Revisar regressions antes do rollout.',
          })),
        } as any,
      },
      {
        now: () => new Date('2026-04-12T12:30:00.000Z'),
      },
    );

    const snapshot = await service.buildSnapshot();

    expect(snapshot.summary.posture).toBe('critical');
    expect(snapshot.summary.scorecards).toBeGreaterThan(0);
    expect(snapshot.summary.datasets).toBeGreaterThan(0);
    expect(snapshot.summary.regressions).toBeGreaterThan(0);
    expect(snapshot.scorecards.some((entry) => entry.category === 'watch-mode')).toBe(true);
    expect(snapshot.datasets.some((entry) => entry.kind === 'resume-pressure')).toBe(true);
    expect(snapshot.datasets.every((entry) => entry.manifest.reproducible)).toBe(true);
    expect(snapshot.datasets[0].manifest.redaction.payloadsIncluded).toBe(false);
    expect(snapshot.regressions[0]).toEqual(expect.objectContaining({
      severity: expect.stringMatching(/critical|high/),
    }));
    expect(snapshot.regressionGate.rolloutBlocked).toBe(true);
    expect(snapshot.regressionGate.rolloutScopes.production).toBe(false);
    expect(snapshot.selfmod.status).toBe('blocked');
    expect(snapshot.coverage.taskSignal).toContain('task');
    expect(snapshot.telemetry).toEqual(expect.objectContaining({
      status: 'active',
      traceCount: 3,
      failureEvents: 1,
    }));
    expect(snapshot.history).toEqual(expect.objectContaining({
      entries: 2,
      latestPosture: 'critical',
    }));
    expect(snapshot.narrative.operatorSummary).toContain('Datasets ativos');
  });

  it('treats routes without enough terminal evidence as insufficient data instead of critical regression', async () => {
    const productObservabilityService = {
      buildSnapshot: jest.fn(async () => ({
        generatedAt: '2026-04-13T18:00:00.000Z',
        windowHours: 168,
        scope: {
          workspace: null,
          sourceSurface: null,
          executor: null,
          workflow: null,
          scoped: false,
        },
        totals: {
          tasks: 6,
          completed: 0,
          failed: 0,
          waitingApproval: 0,
          workflowRuns: 0,
          resumableWorkflowRuns: 0,
          artifacts: 0,
          approvals: 0,
        },
        routes: {
          strategies: [],
          taskKinds: [],
          taskSubtypes: [],
        },
        workspaces: { top: [] },
        surfaces: { sources: [] },
        workflows: { active: 0, resumable: 0, completed: 0, failed: 0, recent: [] },
        executors: { top: [], friction: [] },
        approvals: {
          pending: 0,
          approved: 0,
          rejected: 0,
          highRisk: 0,
          permissionPending: 0,
          permissionRejected: 0,
        },
        operatorCost: {
          averageApprovalWaitMs: 0,
          averageRecoveryMs: 0,
          averageArtifactDeliveryMs: 0,
          heaviestRoute: null,
        },
        artifacts: { topKinds: [], recent: [] },
        learning: {
          routes: {
            topSuccessful: [
              {
                executor: '/task',
                source: 'none',
                source_surface: 'telegram',
                strategy: 'conversation',
                workflow: null,
                kind: 'unknown',
                subtype: 'unknown',
                total: 6,
                completed: 0,
                failed: 0,
                waitingApproval: 0,
                waitingPermission: 0,
                rejected: 0,
                approvalGranted: 0,
                permissionGranted: 0,
                highRisk: 0,
                artifactful: 0,
                gatedCompletion: 0,
                gatedArtifactful: 0,
                workflowRecovered: 0,
                workflowRecoverySuccess: 0,
                workflowRecoveryArtifactful: 0,
                average_duration_ms: 10,
                average_approval_wait_ms: 0,
                average_post_approval_recovery_ms: 0,
                average_artifact_delivery_after_approval_ms: 0,
                operator_cost_score: 0,
                evaluable_total: 0,
                success_rate: 0,
                friction_rate: 0,
                last_seen_at: '2026-04-13T18:00:00.000Z',
                rationale: 'Sem conclusoes terminais ainda.',
              },
            ],
            highestFriction: [],
            highestOperatorCost: [],
          },
          approvedPolicies: [],
          workflowResumeStages: [],
        },
        insights: [],
      })),
    };

    const service = new ZavorthEvalControlPlaneService({
      productObservabilityService: productObservabilityService as any,
      telemetryLedgerService: {
        buildSnapshot: jest.fn(() => null),
      } as any,
      evalHistoryService: {
        capture: jest.fn(() => null),
      } as any,
    });

    const snapshot = await service.buildSnapshot();
    const routeCard = snapshot.scorecards.find((entry) => entry.id.includes('/task'));

    expect(routeCard).toBeTruthy();
    expect(routeCard?.status).toBe('insufficient_data');
    expect(snapshot.regressions.some((entry) => entry.id === `regression:${routeCard?.id}`)).toBe(false);
  });

  it('downgrades a failed legacy echo route when a newer healthy channel route supersedes it', () => {
    const baseRoute = {
      source: 'runtime',
      source_surface: 'telegram',
      strategy: 'conversation',
      workflow: null,
      kind: 'unknown',
      subtype: 'unknown',
      waitingApproval: 0,
      waitingPermission: 0,
      rejected: 0,
      approvalGranted: 0,
      permissionGranted: 0,
      highRisk: 0,
      artifactful: 0,
      gatedCompletion: 0,
      gatedArtifactful: 0,
      workflowRecovered: 0,
      workflowRecoverySuccess: 0,
      workflowRecoveryArtifactful: 0,
      average_duration_ms: 0,
      average_approval_wait_ms: 0,
      average_post_approval_recovery_ms: 0,
      average_artifact_delivery_after_approval_ms: 0,
      operator_cost_score: 0,
      rationale: 'mock route',
    };
    const scorecards = buildEvalScorecards({
      generatedAt: '2026-04-25T12:00:00.000Z',
      learning: {
        routes: {
          highestFriction: [
            {
              ...baseRoute,
              executor: 'echo',
              total: 2,
              completed: 0,
              failed: 2,
              evaluable_total: 2,
              success_rate: 0,
              friction_rate: 1,
              last_seen_at: '2026-04-19 06:54:32',
            },
          ],
          highestOperatorCost: [],
          topSuccessful: [
            {
              ...baseRoute,
              executor: '/task',
              total: 16,
              completed: 9,
              failed: 0,
              evaluable_total: 9,
              success_rate: 1,
              friction_rate: 0,
              last_seen_at: '2026-04-19 22:24:46',
            },
          ],
        },
      },
    } as any, 8);

    const legacyCard = scorecards.find((entry) => entry.executor === 'echo');

    expect(legacyCard?.status).toBe('attention');
    expect(legacyCard?.recommendation).toContain('rota legada');
  });
});
