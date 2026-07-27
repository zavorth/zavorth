import { TelegramOpsInsightPresentationService } from '../../../src/telegram/controllers/TelegramOpsInsightPresentationService';

describe('TelegramOpsInsightPresentationService', () => {
  it('includes product observability and surface consistency in the status reply', () => {
    const service = new TelegramOpsInsightPresentationService();

    const reply = service.formatSystemStatusReply(
      {
        process: {
          uptimeSeconds: 3600,
          rssMb: 128,
          heapMb: 64,
          platform: 'win32',
          cpuArch: 'x64',
        },
        runtime: {
          hostSupervisor: { pid: 1234, alive: true },
          telegramWorker: { pid: 5678, alive: true },
        },
        tasks: {
          activeCount: 2,
          byStatus: {
            running: 1,
            waiting_approval: 1,
          },
          recentFailures: [],
        },
      },
      {
        demoEnabled: false,
        operatorEnabled: true,
        presentationEnabled: false,
      },
      {
        generatedAt: '2026-04-05T10:00:00.000Z',
        windowHours: 24,
        scope: {
          workspace: 'zavorth',
          sourceSurface: 'telegram',
          executor: null,
          workflow: 'workflow:ship',
          scoped: true,
        },
        totals: {
          tasks: 12,
          completed: 8,
          failed: 1,
          waitingApproval: 2,
          workflowRuns: 3,
          resumableWorkflowRuns: 1,
          artifacts: 5,
          approvals: 3,
        },
        routes: {
          strategies: [{ label: 'workspace_learning', count: 6, last_seen_at: '2026-04-05T09:00:00.000Z' }],
          taskKinds: [{ label: 'research', count: 4, last_seen_at: '2026-04-05T09:00:00.000Z' }],
          taskSubtypes: [{
            label: 'competitive',
            kind: 'research',
            count: 4,
            last_seen_at: '2026-04-05T09:00:00.000Z',
          }],
        },
        workspaces: {
          top: [{ label: 'zavorth', count: 12, last_seen_at: '2026-04-05T09:00:00.000Z' }],
        },
        surfaces: {
          sources: [{ label: 'telegram', count: 7, last_seen_at: '2026-04-05T09:00:00.000Z' }],
        },
        workflows: {
          active: 1,
          resumable: 1,
          completed: 1,
          failed: 0,
          recent: [{
            workflow_run_id: 'run-1',
            workflow: 'workflow:ship',
            status: 'approval_pending',
            completed_stages: 2,
            total_stages: 4,
            resume_stage_label: 'approval_gate',
            primary_artifact_name: 'briefing-final.md',
            updated_at: '2026-04-05T09:00:00.000Z',
          }],
        },
        executors: {
          top: [{
            executor: 'external_executor',
            total: 6,
            completed: 5,
            failed: 0,
            waiting_approval: 1,
            approval_friction: 0,
            success_rate: 0.833,
            last_seen_at: '2026-04-05T09:00:00.000Z',
          }],
          friction: [{
            executor: 'zavorthBridge',
            pending: 1,
            rejected: 1,
            high_risk: 1,
            permissions: 2,
            last_seen_at: '2026-04-05T09:00:00.000Z',
          }],
        },
        approvals: {
          pending: 2,
          approved: 4,
          rejected: 1,
          highRisk: 1,
          permissionPending: 1,
          permissionRejected: 0,
        },
        artifacts: {
          topKinds: [{ label: 'markdown', type: 'doc', count: 3, last_seen_at: '2026-04-05T09:00:00.000Z' }],
          recent: [{
            name: 'briefing-final.md',
            kind: 'doc',
            type: 'markdown',
            task_id: 'task-1',
            created_at: '2026-04-05T09:00:00.000Z',
          }],
        },
        learning: {
          routes: {
            topSuccessful: [{
              executor: 'external_executor',
              source: 'workspace_learning',
              source_surface: 'telegram',
              strategy: 'workspace_learning',
              workflow: 'workflow:ship',
              kind: 'research',
              subtype: 'competitive',
              total: 6,
              completed: 5,
              failed: 0,
              waitingApproval: 1,
              waitingPermission: 0,
              rejected: 0,
              approvalGranted: 1,
              permissionGranted: 1,
              highRisk: 0,
              artifactful: 4,
              average_duration_ms: 1250,
              success_rate: 0.833,
              friction_rate: 0.167,
              last_seen_at: '2026-04-05T09:00:00.000Z',
              rationale: 'external_executor is currently better for research and competitive analysis in this workspace.',
            }],
            highestFriction: [{
              executor: 'zavorthBridge',
              source: 'workspace_learning',
              source_surface: 'telegram',
              strategy: 'workspace_learning',
              workflow: 'workflow:review',
              kind: 'review',
              subtype: 'patch',
              total: 3,
              completed: 1,
              failed: 1,
              waitingApproval: 1,
              waitingPermission: 0,
              rejected: 1,
              approvalGranted: 0,
              permissionGranted: 0,
              highRisk: 1,
              artifactful: 1,
              average_duration_ms: 2200,
              success_rate: 0.333,
              friction_rate: 0.667,
              last_seen_at: '2026-04-05T09:00:00.000Z',
              rationale: 'zavorthBridge esta pedindo mais checkpoints e approvals neste fluxo.',
            }],
          },
          approvedPolicies: [{
            executor: 'external_executor',
            kind: 'workspace_access',
            scope: 'workspace',
            count: 2,
            last_seen_at: '2026-04-05T09:00:00.000Z',
            rationale: 'workspace_access was reused successfully in recent deliveries.',
          }],
          workflowResumeStages: [{
            workflow: 'workflow:ship',
            stage_label: 'approval_gate',
            count: 2,
            approval_pending: 1,
            blocked: 0,
            failed: 0,
            last_seen_at: '2026-04-05T09:00:00.000Z',
            rationale: 'workflow:ship costuma parar no approval_gate antes da entrega final.',
          }],
        },
        insights: [
          'Filtered read for workspace zavorth | surface telegram | workflow workflow:ship.',
        ],
      },
    );

    expect(reply).toMatch(/Produto|Product/);
    expect(reply).toContain('Best recent route: external_executor in research/competitive');
    expect(reply).toMatch(/Workflow (to resume|to resume): workflow:ship - approval_gate/);
    expect(reply).toContain('/workflow resume run-1');
    expect(reply).toMatch(/Superficies|Surfaces/);
    expect(reply).toMatch(/Web: ready|Web: ready/);
    expect(reply).toMatch(/Telegram: pendente|Telegram: pending/);
    expect(reply).toContain('/task');
  });
});
