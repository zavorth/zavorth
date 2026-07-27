import type { Task } from '../../../src/contracts/TaskContract';
import type { RouteIntent } from '../../../src/orchestrator/IntentRouter';
import type { WorkspaceRoutingAdvice } from '../../../src/services/WorkspaceRoutingAdvisor';
import { TelegramTaskWorkflowRoutingService } from '../../../src/telegram/controllers/TelegramTaskWorkflowRoutingService';

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    task_id: 'task-12345678',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source: 'telegram',
    chat_id: '42',
    user_id: '42',
    raw_message: '/auto generate the plan',
    normalized_message: '/auto generate the plan',
    command_type: '/auto',
    intent: 'unknown',
    target: null,
    workspace: null,
    risk_level: 0,
    status: 'pending',
    requires_planning: false,
    requires_approval: false,
    approval_status: 'not_required',
    planner_used: null,
    executor_used: null,
    fallback_used: false,
    parent_task_id: null,
    actions_planned: [],
    actions_executed: [],
    target_files: [],
    artifacts: [],
    stdout_summary: null,
    stderr_summary: null,
    diff_summary: null,
    result_summary: null,
    error_summary: null,
    rollback_available: false,
    metadata: {},
    ...overrides,
  };
}

describe('TelegramTaskWorkflowRoutingService', () => {
  it('normalizes workflow workspace context recommendations and drops invalid entries', () => {
    const service = new TelegramTaskWorkflowRoutingService();
    const task = createTask({
      metadata: {
        workspace_profile_summary: 'Workspace core',
        workspace_operational_memory_summary: 'Fluxos recentes',
        workspace_profile_notes: ['Node', 'TypeScript'],
        workspace_operational_notes: ['Continuar pelo review'],
        workspace_operational_memory: {
          active_focuses: [
            { short_id: 'focus-1', executor: 'codex', status: 'running' },
          ],
          recent_artifacts: [
            { name: 'release-notes.md', kind: 'document', summary: 'Notas finais' },
          ],
          continuity_recommendations: [
            { label: 'Continuar review', reason: 'Existe trilthere is ativa', executor: 'external_executor' },
          ],
          workflow_executor_recommendations: [
            {
              workflow: 'review',
              executor: ' CODEX ',
              success_count: 3,
              pending_count: 1,
              failed_count: 0,
              confidence: 'high',
              rationale: 'Best history',
            },
            {
              workflow: 'unknown',
              executor: 'codex',
            },
          ],
          workflow_stage_executor_recommendations: [
            {
              workflow: 'ship',
              role: ' Implement ',
              executor: ' ExternalExecutor ',
              success_count: 2,
              pending_count: 0,
              failed_count: 1,
              confidence: 'medium',
              rationale: 'Good value',
            },
            {
              workflow: 'ship',
              role: '',
              executor: 'codex',
            },
          ],
          workflow_friction_recommendations: [
            {
              workflow: 'research',
              approval_pending_count: 2,
              blocked_count: 1,
              failed_count: 0,
              last_resume_stage_label: ' Esperando validaction ',
              confidence: 'medium',
              rationale: 'Slow approvals',
            },
            {
              workflow: 'invalid',
            },
          ],
          approval_friction_recommendations: [
            {
              executor: ' AIStudio ',
              kind: 'tool',
              subtype: 'web',
              pending_count: 3,
              rejected_count: 1,
              high_risk_count: 2,
              permission_count: 4,
              confidence: 'high',
              rationale: 'Precisa de mais approvescoes',
            },
            {
              executor: '',
            },
          ],
        },
      } as any,
    });

    const context = service.buildWorkflowWorkspaceContext(task);

    expect(context).toEqual({
      profile_summary: 'Workspace core',
      operational_summary: 'Fluxos recentes',
      profile_notes: ['Node', 'TypeScript'],
      operational_notes: ['Continuar pelo review'],
      active_focus: {
        summary: 'focus-1',
        executor: 'codex',
        status: 'running',
      },
      recent_artifact: {
        name: 'release-notes.md',
        kind: 'document',
        summary: 'Notas finais',
      },
      continuity_recommendation: {
        label: 'Continuar review',
        reason: 'Existe trilthere is ativa',
        executor: 'external_executor',
      },
      workflow_executor_recommendations: [
        {
          workflow: 'review',
          executor: 'codex',
          success_count: 3,
          pending_count: 1,
          failed_count: 0,
          confidence: 'high',
          rationale: 'Best history',
        },
      ],
      workflow_stage_executor_recommendations: [
        {
          workflow: 'ship',
          role: 'implement',
          executor: 'externalexecutor',
          success_count: 2,
          pending_count: 0,
          failed_count: 1,
          confidence: 'medium',
          rationale: 'Good value',
        },
      ],
      workflow_friction_recommendations: [
        {
          workflow: 'research',
          approval_pending_count: 2,
          blocked_count: 1,
          failed_count: 0,
          last_resume_stage_label: 'Esperando validaction',
          confidence: 'medium',
          rationale: 'Slow approvals',
        },
      ],
      approval_friction_recommendations: [
        {
          executor: 'aistudio',
          kind: 'tool',
          subtype: 'web',
          pending_count: 3,
          rejected_count: 1,
          high_risk_count: 2,
          permission_count: 4,
          confidence: 'high',
          rationale: 'Precisa de mais approvescoes',
        },
      ],
    });
  });

  it('returns null when there is no meaningful workspace signal', () => {
    const service = new TelegramTaskWorkflowRoutingService();
    const task = createTask({
      metadata: {
        workspace_profile_notes: [],
        workspace_operational_notes: [],
        workspace_operational_memory: {
          workflow_executor_recommendations: [{ workflow: 'unknown', executor: '' }],
        },
      } as any,
    });

    expect(service.buildWorkflowWorkspaceContext(task)).toBeNull();
  });

  it('builds workspace route outcome from task, route and learned workflow route', () => {
    const service = new TelegramTaskWorkflowRoutingService();
    const task = createTask({
      source: 'telegram',
      status: 'completed',
      requires_approval: true,
      executor_used: 'codex',
      metadata: {
        surface_platform: 'telegram',
        tenant_id: 'tenant-1',
        auto_route_source: 'workspace_learning',
        auto_route_strategy: 'workflow_recommendation',
        workspace_route_outcome: {
          existing_flag: true,
        },
      } as any,
    });
    const route: RouteIntent = {
      intent: 'hybrid_task',
      target: null,
      workspace_hint: 'core',
      requires_planning: false,
      executor_preference: null,
      dispatch_mode: 'execution',
      routing_reason: 'Workspace learning apontou workflow.',
      routing_confidence: 0.74,
    };
    const advice: WorkspaceRoutingAdvice = {
      executor: null,
      source: 'subtype_memory',
      confidence: 0.63,
      rationale: ['Recent review converged to workflow.'],
      task_kind: 'code',
      task_subtype: 'review',
      workflow_recommendation: {
        workflow: 'review',
        confidence: 0.88,
        rationale: 'Workflow de review tem melhor continuidade.',
      },
    } as any;

    const outcome = service.buildWorkspaceRouteOutcome(
      task,
      route,
      advice,
      {
        executor: 'workflow:review',
        reason: 'Workflow de review recomendado.',
        source: 'workspace_learning',
        strategy: 'workflow_recommendation',
        dispatchMode: 'execution',
        confidence: 0.88,
      },
    );

    expect(outcome).toEqual({
      existing_flag: true,
      selected_executor: 'workflow:review',
      final_executor: 'codex',
      source: 'workspace_learning',
      strategy: 'workflow_recommendation',
      confidence: 0.88,
      workflow_name: 'review',
      task_kind: 'code',
      task_subtype: 'review',
      source_surface: 'telegram',
      tenant_id: 'tenant-1',
      final_status: 'completed',
      approval_needed: true,
      permission_needed: false,
    });
  });
}
