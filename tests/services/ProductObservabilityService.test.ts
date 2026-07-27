import { ProductObservabilityService } from '../../src/services/ProductObservabilityService.js';
import type { Task } from '../../src/contracts/TaskContract.js';
import type { PermissionRequest } from '../../src/contracts/PermissionRequest.js';
import type { WorkflowRunSnapshot } from '../../src/services/WorkflowRunService.js';

function makeTask(overrides: Partial<Task>): Task {
  return {
    task_id: overrides.task_id || 'task-1',
    created_at: overrides.created_at || '2026-04-02T10:00:00.000Z',
    updated_at: overrides.updated_at || '2026-04-02T10:05:00.000Z',
    source: overrides.source || 'telegram',
    chat_id: overrides.chat_id || 'chat-1',
    user_id: overrides.user_id || 'user-1',
    raw_message: overrides.raw_message || '/task fazer algo',
    normalized_message: overrides.normalized_message || 'fazer algo',
    command_type: overrides.command_type || '/task',
    intent: overrides.intent || 'execute',
    target: overrides.target || null,
    workspace: overrides.workspace || 'C:/repo',
    risk_level: overrides.risk_level || 0,
    status: overrides.status || 'completed',
    requires_planning: overrides.requires_planning || false,
    requires_approval: overrides.requires_approval || false,
    approval_status: overrides.approval_status || 'not_required',
    planner_used: overrides.planner_used || null,
    executor_used: overrides.executor_used || null,
    fallback_used: overrides.fallback_used || false,
    parent_task_id: overrides.parent_task_id || null,
    actions_planned: overrides.actions_planned || [],
    actions_executed: overrides.actions_executed || [],
    target_files: overrides.target_files || [],
    artifacts: overrides.artifacts || [],
    stdout_summary: overrides.stdout_summary || null,
    stderr_summary: overrides.stderr_summary || null,
    diff_summary: overrides.diff_summary || null,
    result_summary: overrides.result_summary || null,
    error_summary: overrides.error_summary || null,
    rollback_available: overrides.rollback_available || false,
    metadata: overrides.metadata || {},
  };
}

function makePermission(overrides: Partial<PermissionRequest>): PermissionRequest {
  return {
    permission_id: overrides.permission_id || 'perm-1',
    created_at: overrides.created_at || '2026-04-02T10:01:00.000Z',
    updated_at: overrides.updated_at || '2026-04-02T10:06:00.000Z',
    task_id: overrides.task_id || 'task-1',
    executor: overrides.executor || 'external_executor',
    kind: overrides.kind || 'workspace_access',
    status: overrides.status || 'pending',
    scope: overrides.scope || 'once',
    workspace: overrides.workspace || 'C:/repo',
    requested_value: overrides.requested_value || 'artifacts/out.md',
    resolved_value: overrides.resolved_value || 'artifacts/out.md',
    reason: overrides.reason || 'Salvar entrega',
    requested_by: overrides.requested_by || 'user-1',
    decided_by: overrides.decided_by || null,
    decision_note: overrides.decision_note || null,
    metadata: overrides.metadata || {},
  };
}

function makeWorkflowRun(overrides: Partial<WorkflowRunSnapshot>): WorkflowRunSnapshot {
  const hasResumeStage = Object.prototype.hasOwnProperty.call(overrides, 'resume_stage');
  return {
    workflow_run_id: overrides.workflow_run_id || 'wf-1',
    workflow_name: overrides.workflow_name || 'ship',
    objective: overrides.objective || 'Entregar briefing final',
    workspace: overrides.workspace || 'C:/repo',
    workspace_context: overrides.workspace_context || null,
    created_at: overrides.created_at || '2026-04-02T10:00:00.000Z',
    updated_at: overrides.updated_at || '2026-04-02T10:06:00.000Z',
    status: overrides.status || 'approval_pending',
    operator_state: overrides.operator_state || 'active',
    operator_close_reason: overrides.operator_close_reason || null,
    stages: overrides.stages || [
      {
        id: 'stage-1',
        label: 'Codex maker',
        executor: 'codex',
        role: 'maker',
        index: 0,
        status: 'completed',
        task_id: 'task-1',
        attempt_count: 1,
        objective: 'Prepare briefing',
        handoff_summary: 'Base ready',
        started_at: '2026-04-02T10:00:00.000Z',
        finished_at: '2026-04-02T10:02:00.000Z',
        result_summary: 'Briefing base ready',
        artifact_count: 1,
      },
      {
        id: 'stage-2',
        label: 'ExternalExecutor review',
        executor: 'external_executor',
        role: 'reviewer',
        index: 1,
        status: 'approval_pending',
        task_id: 'task-2',
        attempt_count: 1,
        objective: 'Revisar entrega',
        handoff_summary: 'Waiting for approval',
        started_at: '2026-04-02T10:03:00.000Z',
        finished_at: '2026-04-02T10:06:00.000Z',
        result_summary: 'Precisa de approval',
        artifact_count: 0,
      },
    ],
    resume_stage: hasResumeStage ? (overrides.resume_stage ?? null) : {
      id: 'stage-2',
      label: 'ExternalExecutor review',
      executor: 'external_executor',
      status: 'approval_pending',
      index: 1,
      attempt_count: 1,
      task_id: 'task-2',
      objective: 'Revisar entrega',
      handoff_summary: 'Waiting for approval',
      result_summary: 'Precisa de approval',
      reason: 'waits for your confirmation before continuing',
    },
    resume_prompt: overrides.resume_prompt || 'Resume o workflow ship no run wf-1 at stage ExternalExecutor review.',
    artifacts: overrides.artifacts || [],
    artifacts_manifest: overrides.artifacts_manifest || {
      primary_artifact_name: 'briefing-final.md',
    },
    externalized_state: overrides.externalized_state || null,
  };
}

describe('ProductObservabilityService', () => {
  it('summarizes routes, workflows, executors, approvals and artifacts in one snapshot', async () => {
    const tasks = [
      makeTask({
        task_id: 'task-1',
        executor_used: 'codex',
        status: 'completed',
        approval_status: 'approved',
        artifacts: [
          {
            artifact_id: 'artifact-1',
            name: 'briefing-final.md',
            kind: 'doc',
            type: 'markdown',
            created_at: '2026-04-02T10:05:00.000Z',
          } as any,
        ],
        metadata: {
          auto_route_strategy: 'workflow_memory',
          route_task_kind: 'research',
          route_task_subtype: 'competitive_analysis',
          security_posture: {
            high_risk_confirmation_required: true,
          },
          approval_history: [{ action: 'approve', at: '2026-04-02T10:02:00.000Z', required_high_risk_pin: true }],
        },
      }),
      makeTask({
        task_id: 'task-2',
        executor_used: 'external_executor',
        status: 'waiting_approval',
        approval_status: 'pending',
        metadata: {
          auto_route_strategy: 'active_focus',
          route_task_kind: 'automation',
          route_task_subtype: 'delivery',
          approval_history: [{ action: 'reject' }],
          permission_history: [{ action: 'grant' }],
        },
      }),
      makeTask({
        task_id: 'task-3',
        executor_used: 'external_executor',
        status: 'failed',
        approval_status: 'rejected',
        metadata: {
          auto_route_strategy: 'workflow_memory',
          route_task_kind: 'automation',
          route_task_subtype: 'delivery',
          approval_history: [{ action: 'reject' }],
        },
      }),
    ];
    const permissions = [
      makePermission({ permission_id: 'perm-1', status: 'pending', executor: 'external_executor' }),
      makePermission({ permission_id: 'perm-2', status: 'rejected', executor: 'external_executor' }),
      makePermission({ permission_id: 'perm-3', status: 'approved', executor: 'external_executor' }),
    ];
    const workflows = [
      makeWorkflowRun({ workflow_run_id: 'wf-1', workflow_name: 'ship', status: 'approval_pending' }),
      makeWorkflowRun({
        workflow_run_id: 'wf-2',
        workflow_name: 'research',
        status: 'completed',
        resume_stage: null,
        updated_at: '2026-04-02T09:59:00.000Z',
        stages: [
          {
            id: 'stage-r1',
            label: 'Researcher',
            executor: 'aistudio',
            role: 'researcher',
            index: 0,
            status: 'completed',
            task_id: 'task-r1',
            attempt_count: 1,
            objective: 'Collect data',
            handoff_summary: 'Base ready',
            started_at: '2026-04-02T09:30:00.000Z',
            finished_at: '2026-04-02T09:40:00.000Z',
            result_summary: 'Collection ready',
            artifact_count: 1,
          },
          {
            id: 'stage-r2',
            label: 'Synthesizer',
            executor: 'aistudio',
            role: 'synthesizer',
            index: 1,
            status: 'completed',
            task_id: 'task-r2',
            attempt_count: 2,
            objective: 'Sintetizar findings',
            handoff_summary: 'Collection ready',
            started_at: '2026-04-02T09:45:00.000Z',
            finished_at: '2026-04-02T09:59:00.000Z',
            result_summary: 'Pesquisa consolidada',
            artifact_count: 1,
          },
        ],
        externalized_state: {
          checkpoint_count: 3,
          last_event: 'stage_completed',
          latest_chain_hash: 'wf-2-hash',
          recent_checkpoints: [
            {
              checkpoint_id: 'wf-2-c3',
              sequence: 3,
              event: 'stage_completed',
              status: 'completed',
              updated_at: '2026-04-02T09:59:00.000Z',
              resume_stage_id: null,
              chain_hash: 'wf-2-hash',
              previous_chain_hash: 'wf-2-hash-2',
            },
            {
              checkpoint_id: 'wf-2-c2',
              sequence: 2,
              event: 'stage_interrupted',
              status: 'blocked',
              updated_at: '2026-04-02T09:48:00.000Z',
              resume_stage_id: 'stage-r2',
              chain_hash: 'wf-2-hash-2',
              previous_chain_hash: 'wf-2-hash-1',
            },
          ],
        } as any,
      }),
    ];

    const service = new ProductObservabilityService(
      {
        getRecentTasks: jest.fn(() => tasks),
      },
      {
        listRequests: jest.fn().mockResolvedValue(permissions),
      },
      {
        now: () => new Date('2026-04-02T10:10:00.000Z'),
        workflowRunService: {
          listRuns: jest.fn(() => workflows),
        },
      },
    );

    const snapshot = await service.buildSnapshot();

    expect(snapshot.scope).toEqual({
      workspace: null,
      sourceSurface: null,
      executor: null,
      workflow: null,
      scoped: false,
    });
    expect(snapshot.totals).toMatchObject({
      tasks: 3,
      completed: 1,
      failed: 1,
      waitingApproval: 1,
      workflowRuns: 2,
      resumableWorkflowRuns: 1,
      artifacts: 1,
      approvals: 3,
    });
    expect(snapshot.routes.strategies[0]).toMatchObject({
      label: 'workflow_memory',
      count: 2,
    });
    expect(snapshot.workspaces.top[0]).toMatchObject({
      label: 'c:/repo',
      count: expect.any(Number),
    });
    expect(snapshot.surfaces.sources[0]).toMatchObject({
      label: 'telegram',
      count: 3,
    });
    expect(snapshot.routes.taskSubtypes[0]).toMatchObject({
      kind: 'automation',
      label: 'delivery',
      count: 2,
    });
    expect(snapshot.workflows.recent[0]).toMatchObject({
      workflow: 'ship',
      resume_stage_id: 'stage-2',
      resume_stage_label: 'ExternalExecutor review',
    });
    expect(snapshot.workflows.recent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workflow: 'research',
          recovered_from_interruption: true,
          last_interrupted_stage_label: 'Synthesizer',
        }),
      ]),
    );
    expect(snapshot.executors.top[0]).toMatchObject({
      executor: 'codex',
      completed: 1,
    });
    expect(snapshot.executors.friction[0]).toMatchObject({
      executor: 'external_executor',
      pending: 1,
      rejected: 2,
    });
    expect(snapshot.approvals).toMatchObject({
      pending: 1,
      approved: 1,
      rejected: 1,
      highRisk: 1,
      permissionPending: 1,
      permissionRejected: 1,
    });
    expect(snapshot.operatorCost).toMatchObject({
      averageApprovalWaitMs: expect.any(Number),
      averageRecoveryMs: expect.any(Number),
      averageArtifactDeliveryMs: expect.any(Number),
      heaviestRoute: expect.objectContaining({
        executor: 'codex',
      }),
    });
    expect(snapshot.artifacts.topKinds[0]).toMatchObject({
      label: 'doc',
      type: 'markdown',
      count: 1,
    });
    expect(snapshot.learning.routes.topSuccessful[0]).toMatchObject({
      executor: 'codex',
      source_surface: 'telegram',
      kind: 'research',
      subtype: 'competitive_analysis',
      completed: 1,
      total: 1,
    });
    expect(snapshot.learning.routes.highestFriction[0]).toMatchObject({
      executor: 'external_executor',
      source_surface: 'telegram',
      kind: 'automation',
      subtype: 'delivery',
      friction_rate: expect.any(Number),
    });
    expect(snapshot.learning.routes.highestOperatorCost[0]).toMatchObject({
      executor: 'codex',
      average_approval_wait_ms: expect.any(Number),
      average_post_approval_recovery_ms: expect.any(Number),
      average_artifact_delivery_after_approval_ms: expect.any(Number),
      operator_cost_score: expect.any(Number),
    });
    expect(
      snapshot.learning.routes.highestFriction.some((entry) =>
        entry.executor === 'external_executor'
        && entry.kind === 'automation'
        && entry.subtype === 'delivery'
        && (entry.failed > 0 || entry.waitingApproval > 0),
      ),
    ).toBe(true);
    expect(snapshot.learning.approvedPolicies[0]).toMatchObject({
      executor: 'external_executor',
      kind: 'workspace_access',
      scope: 'once',
      count: 1,
    });
    expect(snapshot.learning.workflowResumeStages[0]).toMatchObject({
      workflow: 'ship',
      stage_label: 'ExternalExecutor review',
      approval_pending: 1,
    });
    expect(snapshot.insights).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Rota dominante da janela'),
        expect.stringContaining('Workflow with resume ready'),
        expect.stringContaining('Workflow resumed com sucesso recentemente'),
        expect.stringContaining('Melhor rota recente'),
        expect.stringContaining('Highest recent operational cost'),
        expect.stringContaining('Custo medio para o operador na janela'),
        expect.stringContaining('Executor mais efetivo recente'),
        expect.stringContaining('Politica mais liberada recentemente'),
      ]),
    );
  });

  it('credits route learning when a recovered workflow still delivers the final artifact', async () => {
    const tasks = [
      makeTask({
        task_id: 'task-route-recovery-1',
        source: 'telegram',
        executor_used: 'external_executor',
        status: 'completed',
        metadata: {
          workflow_run_id: 'wf-route-recovery-1',
          auto_route_strategy: 'workflow_resume',
          route_task_kind: 'code',
          route_task_subtype: 'review',
          workspace_route_outcome: {
            final_executor: 'external_executor',
            source_surface: 'telegram',
            source: 'workflow_memory',
            strategy: 'workflow_resume',
            workflow_name: 'ship',
            task_kind: 'code',
            task_subtype: 'review',
            approval_granted_count: 1,
            permission_granted_count: 1,
            gated_completion_count: 1,
            gated_artifactful_count: 1,
          },
        },
      }),
    ];
    const workflows = [
      makeWorkflowRun({
        workflow_run_id: 'wf-route-recovery-1',
        workflow_name: 'ship',
        status: 'completed',
        updated_at: '2026-04-02T10:08:00.000Z',
        resume_stage: null,
        artifacts_manifest: {
          primary_artifact_name: 'briefing-final.md',
        },
        externalized_state: {
          checkpoint_count: 3,
          last_event: 'stage_completed',
          latest_chain_hash: 'wf-route-recovery-hash',
          recent_checkpoints: [
            {
              checkpoint_id: 'wf-route-recovery-c3',
              sequence: 3,
              event: 'stage_completed',
              status: 'completed',
              updated_at: '2026-04-02T10:08:00.000Z',
              resume_stage_id: null,
              chain_hash: 'wf-route-recovery-hash',
              previous_chain_hash: 'wf-route-recovery-hash-2',
            },
            {
              checkpoint_id: 'wf-route-recovery-c2',
              sequence: 2,
              event: 'stage_interrupted',
              status: 'approval_pending',
              updated_at: '2026-04-02T10:00:00.000Z',
              resume_stage_id: 'stage-review',
              chain_hash: 'wf-route-recovery-hash-2',
              previous_chain_hash: 'wf-route-recovery-hash-1',
            },
          ],
        } as any,
      }),
    ];

    const service = new ProductObservabilityService(
      {
        getRecentTasks: jest.fn(() => tasks),
      },
      {
        listRequests: jest.fn().mockResolvedValue([]),
      },
      {
        now: () => new Date('2026-04-02T10:10:00.000Z'),
        workflowRunService: {
          listRuns: jest.fn(() => workflows),
        },
      },
    );

    const snapshot = await service.buildSnapshot();

    expect(snapshot.learning.routes.topSuccessful).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          executor: 'external_executor',
          workflow: 'ship',
          kind: 'code',
          subtype: 'review',
          gatedCompletion: 1,
          gatedArtifactful: 1,
          workflowRecovered: 1,
          workflowRecoverySuccess: 1,
          workflowRecoveryArtifactful: 1,
        }),
      ]),
    );
    expect(snapshot.insights).toEqual(
      expect.arrayContaining([
        expect.stringContaining('resumption(s) entregue(s)'),
        expect.stringContaining('delivery item(s) after approval'),
      ]),
    );
  });

  it('can scope observability by workspace, surface, executor and workflow', async () => {
    const tasks = [
      makeTask({
        task_id: 'task-ship-web',
        workspace: 'C:/repo-a',
        source: 'web',
        executor_used: 'codex',
        status: 'completed',
        metadata: {
          route_task_kind: 'code',
          route_task_subtype: 'implementation',
          workspace_route_outcome: {
            final_executor: 'codex',
            source_surface: 'web',
            workflow_name: 'ship',
            task_kind: 'code',
            task_subtype: 'implementation',
          },
        },
      }),
      makeTask({
        task_id: 'task-ship-telegram',
        workspace: 'C:/repo-a',
        source: 'telegram',
        executor_used: 'external_executor',
        status: 'waiting_approval',
        approval_status: 'pending',
        metadata: {
          workspace_route_outcome: {
            final_executor: 'external_executor',
            source_surface: 'telegram',
            workflow_name: 'ship',
            task_kind: 'code',
            task_subtype: 'implementation',
          },
        },
      }),
      makeTask({
        task_id: 'task-research-web',
        workspace: 'C:/repo-b',
        source: 'web',
        executor_used: 'aistudio',
        status: 'completed',
        metadata: {
          workspace_route_outcome: {
            final_executor: 'aistudio',
            source_surface: 'web',
            workflow_name: 'research',
            task_kind: 'research',
            task_subtype: 'competitive_analysis',
          },
        },
      }),
    ];
    const workflows = [
      makeWorkflowRun({
        workflow_run_id: 'wf-ship-web',
        workflow_name: 'ship',
        workspace: 'C:/repo-a',
        status: 'running',
        resume_stage: null,
      }),
      makeWorkflowRun({
        workflow_run_id: 'wf-research-web',
        workflow_name: 'research',
        workspace: 'C:/repo-b',
        status: 'completed',
        resume_stage: null,
      }),
    ];

    const service = new ProductObservabilityService(
      {
        getRecentTasks: jest.fn(() => tasks),
      },
      {
        listRequests: jest.fn().mockResolvedValue([]),
      },
      {
        now: () => new Date('2026-04-02T10:10:00.000Z'),
        workflowRunService: {
          listRuns: jest.fn(() => workflows),
        },
      },
    );

    const snapshot = await service.buildSnapshot({
      workspace: 'c:/repo-a',
      sourceSurface: 'web',
      executor: 'codex',
      workflow: 'ship',
    });

    expect(snapshot.scope).toEqual({
      workspace: 'c:/repo-a',
      sourceSurface: 'web',
      executor: 'codex',
      workflow: 'ship',
      scoped: true,
    });
    expect(snapshot.totals).toMatchObject({
      tasks: 1,
      completed: 1,
      workflowRuns: 1,
    });
    expect(snapshot.routes.taskKinds[0]).toMatchObject({
      label: 'code',
      count: 1,
    });
    expect(snapshot.surfaces.sources).toEqual([
      expect.objectContaining({
        label: 'web',
        count: 1,
      }),
    ]);
    expect(snapshot.executors.top[0]).toMatchObject({
      executor: 'codex',
      total: 1,
    });
    expect(snapshot.workflows.recent[0]).toMatchObject({
      workflow: 'ship',
      workflow_run_id: 'wf-ship-web',
    });
    expect(snapshot.insights[0]).toContain('Leitura filtrada');
  });

  it('keeps operator closed workflow context in recent workflow observability', async () => {
    const service = new ProductObservabilityService(
      {
        getRecentTasks: jest.fn(() => []),
      },
      {
        listRequests: jest.fn().mockResolvedValue([]),
      },
      {
        now: () => new Date('2026-04-02T10:10:00.000Z'),
        workflowRunService: {
          listRuns: jest.fn(() => [
            makeWorkflowRun({
              workflow_run_id: 'wf-closed-1',
              workflow_name: 'ship',
              status: 'blocked',
              operator_state: 'closed',
              operator_close_reason: 'operador encerrou depois da review final',
              resume_stage: null,
              updated_at: '2026-04-02T10:09:00.000Z',
            }),
          ]),
        },
      },
    );

    const snapshot = await service.buildSnapshot(new Date('2026-04-02T10:10:00.000Z'));

    expect(snapshot.workflows.recent[0]).toMatchObject({
      workflow_run_id: 'wf-closed-1',
      workflow: 'ship',
      operator_state: 'closed',
      operator_close_reason: 'operador encerrou depois da review final',
    });
  });

  it('counts direct conversational replies as completed route evidence', async () => {
    const tasks = [
      makeTask({
        task_id: 'task-direct-1',
        source: 'telegram',
        command_type: '/task',
        status: 'parsed',
        result_summary: 'Short response delivered to the operator.',
        metadata: {
          direct_response_last_run: {
            finishedAt: '2026-04-02T10:03:00.000Z',
            providerName: 'gemini',
          },
          workspace_route_outcome: {
            final_executor: null,
            source_surface: 'telegram',
            source: 'none',
            strategy: 'conversation',
            workflow_name: null,
            task_kind: 'unknown',
            task_subtype: 'unknown',
          },
        },
      }),
      makeTask({
        task_id: 'task-direct-2',
        source: 'telegram',
        command_type: '/task',
        status: 'parsed',
        result_summary: 'Segunda resposta direta entregue ao operador.',
        metadata: {
          direct_response_last_run: {
            finishedAt: '2026-04-02T10:04:00.000Z',
            providerName: 'gemini',
          },
          workspace_route_outcome: {
            final_executor: null,
            source_surface: 'telegram',
            source: 'none',
            strategy: 'conversation',
            workflow_name: null,
            task_kind: 'unknown',
            task_subtype: 'unknown',
          },
        },
      }),
    ];

    const service = new ProductObservabilityService(
      {
        getRecentTasks: jest.fn(() => tasks),
      },
      {
        listRequests: jest.fn().mockResolvedValue([]),
      },
      {
        now: () => new Date('2026-04-02T10:10:00.000Z'),
        workflowRunService: {
          listRuns: jest.fn(() => []),
        },
      },
    );

    const snapshot = await service.buildSnapshot();
    const route = snapshot.learning.routes.topSuccessful.find((entry) =>
      entry.executor === '/task'
      && entry.source_surface === 'telegram'
      && entry.strategy === 'conversation',
    );

    expect(route).toBeTruthy();
    expect(route).toMatchObject({
      completed: 2,
      total: 2,
      evaluable_total: 2,
      success_rate: 1,
      friction_rate: 0,
    });
  });
});
