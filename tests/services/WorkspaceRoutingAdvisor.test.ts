import { WorkspaceRoutingAdvisor } from '../../src/runtime/context/WorkspaceRoutingAdvisor.js';

describe('WorkspaceRoutingAdvisor', () => {
  const advisor = new WorkspaceRoutingAdvisor();

  it('prefers subtype memory over broader signals and carries response style + llm recommendation', () => {
    const advice = advisor.recommend({
      parsed: {
        command_type: '/auto',
        command_args: 'review the current code thoroughly',
        normalized_message: '/auto review the current code thoroughly',
        explicit_executor: null,
        references_last_task: false,
      },
      route: {
        intent: 'hybrid_task',
        target: null,
        workspace_hint: 'core',
        requires_planning: false,
        executor_preference: null,
        dispatch_mode: 'conversation',
        routing_reason: 'Pedido ainda ambiguo na rota base.',
        routing_confidence: 0.4,
      },
      workspaceProfile: {
        workspace: 'core',
        workspace_name: 'core',
        slug: 'core',
        detected_stacks: ['nodejs'],
        frameworks: ['typescript'],
        languages: ['typescript'],
        package_manager: 'npm',
        scripts: {},
        important_paths: [],
        instruction_file: null,
        instruction_summary: '',
        instruction_notes: [],
        workspace_hooks: [],
        workspace_commands: [],
        preferred_executors: {
          code_editing: 'codex',
          code_review: 'external_executor',
          research: 'aistudio',
          design: 'stitch',
          automation: 'zavorthBridge',
        },
        summary: 'Workspace core',
        last_refreshed: new Date().toISOString(),
      },
      workspaceOperationalMemory: {
        workspace: 'core',
        workspace_name: 'core',
        slug: 'core',
        last_refreshed: new Date().toISOString(),
        successful_executors: [{ executor: 'codex', count: 5, last_seen_at: new Date().toISOString() }],
        repeated_failures: [],
        task_kind_recommendations: [
          {
            kind: 'code',
            preferred_executor: 'codex',
            success_count: 5,
            repeated_failure_executor: null,
            repeated_failure_summary: null,
            repeated_failure_count: 0,
            last_seen_at: new Date().toISOString(),
          },
        ],
        task_subtype_recommendations: [
          {
            kind: 'code',
            subtype: 'review',
            preferred_executor: 'external_executor',
            success_count: 3,
            repeated_failure_executor: null,
            repeated_failure_summary: null,
            repeated_failure_count: 0,
            last_seen_at: new Date().toISOString(),
          },
        ],
        task_kind_llm_recommendations: [],
        task_subtype_llm_recommendations: [
          {
            kind: 'code',
            subtype: 'review',
            preferred_provider: 'aistudio',
            preferred_model: 'gemini-2.5-pro',
            success_count: 2,
            last_seen_at: new Date().toISOString(),
            confidence: 'high',
            rationale: 'Modelos longos ajudam under review profundo.',
          },
        ],
        approved_paths: [],
        active_focuses: [],
        recent_artifacts: [],
        continuity_recommendations: [],
        autonomous_outcomes: [],
        autonomous_mode_recommendations: [],
        direct_response_style_recommendations: [
          {
            kind: 'code',
            subtype: 'review',
            preferred_style: 'findings_first',
            success_count: 3,
            last_seen_at: new Date().toISOString(),
            confidence: 'high',
            rationale: 'Reviews ficam melhores quando priorizam findings.',
          },
        ],
        last_successful_task: null,
        summary: 'Workspace core',
      },
    });

    expect(advice.executor).toBe('external_executor');
    expect(advice.source).toBe('subtype_memory');
    expect(advice.task_kind).toBe('code');
    expect(advice.task_subtype).toBe('review');
    expect(advice.response_style).toBe('findings_first');
    expect(advice.workflow_recommendation).toEqual(
      expect.objectContaining({
        workflow: 'review',
      }),
    );
    expect(advice.llm_recommendation).toEqual(
      expect.objectContaining({
        provider: 'aistudio',
        model: 'gemini-2.5-pro',
        source: 'subtype_memory',
      }),
    );
  });

  it('blocks executors with repeated failures and falls back to profile defaults', () => {
    const advice = advisor.recommend({
      parsed: {
        command_type: '/auto',
        command_args: 'compare concorrentes e resuma o mercado',
        normalized_message: '/auto compare concorrentes e resuma o mercado',
        explicit_executor: null,
        references_last_task: false,
      },
      route: {
        intent: 'hybrid_task',
        target: null,
        workspace_hint: 'core',
        requires_planning: false,
        executor_preference: null,
        dispatch_mode: 'conversation',
        routing_reason: 'Pedido ainda ambiguo na rota base.',
        routing_confidence: 0.4,
      },
      workspaceProfile: {
        workspace: 'core',
        workspace_name: 'core',
        slug: 'core',
        detected_stacks: ['nodejs'],
        frameworks: ['typescript'],
        languages: ['typescript'],
        package_manager: 'npm',
        scripts: {},
        important_paths: [],
        instruction_file: null,
        instruction_summary: '',
        instruction_notes: [],
        workspace_hooks: [],
        workspace_commands: [],
        preferred_executors: {
          code_editing: 'codex',
          code_review: 'external_executor',
          research: 'aistudio',
          design: 'stitch',
          automation: 'zavorthBridge',
        },
        summary: 'Workspace core',
        last_refreshed: new Date().toISOString(),
      },
      workspaceOperationalMemory: {
        workspace: 'core',
        workspace_name: 'core',
        slug: 'core',
        last_refreshed: new Date().toISOString(),
        successful_executors: [],
        repeated_failures: [{ executor: 'web_research', summary: 'timeout', count: 2, last_seen_at: new Date().toISOString() }],
        task_kind_recommendations: [
          {
            kind: 'research',
            preferred_executor: 'web_research',
            success_count: 0,
            repeated_failure_executor: 'web_research',
            repeated_failure_summary: 'timeout',
            repeated_failure_count: 2,
            last_seen_at: new Date().toISOString(),
          },
        ],
        task_subtype_recommendations: [],
        task_kind_llm_recommendations: [],
        task_subtype_llm_recommendations: [],
        approved_paths: [],
        active_focuses: [],
        recent_artifacts: [],
        continuity_recommendations: [],
        autonomous_outcomes: [],
        autonomous_mode_recommendations: [],
        direct_response_style_recommendations: [],
        last_successful_task: null,
        summary: 'Workspace core',
      },
    });

    expect(advice.executor).toBe('aistudio');
    expect(advice.source).toBe('profile_default');
    expect(advice.blocked_executors).toContain('web_research');
  });

  it('uses active workspace focus to preserve continuity when there is a similar task in flight', () => {
    const advice = advisor.recommend({
      parsed: {
        command_type: '/task',
        command_args: 'continue o review do modulo de autenticaction',
        normalized_message: '/task continue o review do modulo de autenticaction',
        explicit_executor: null,
        references_last_task: false,
      },
      route: {
        intent: 'hybrid_task',
        target: null,
        workspace_hint: 'core',
        requires_planning: false,
        executor_preference: null,
        dispatch_mode: 'conversation',
        routing_reason: 'Pedido de continuidade.',
        routing_confidence: 0.45,
      },
      workspaceProfile: null,
      workspaceOperationalMemory: {
        workspace: 'core',
        workspace_name: 'core',
        slug: 'core',
        last_refreshed: new Date().toISOString(),
        successful_executors: [{ executor: 'codex', count: 5, last_seen_at: new Date().toISOString() }],
        repeated_failures: [],
        task_kind_recommendations: [],
        task_subtype_recommendations: [],
        task_kind_llm_recommendations: [],
        task_subtype_llm_recommendations: [],
        approved_paths: [],
        active_focuses: [
          {
            task_id: 'task-active-1',
            short_id: 'task-act',
            status: 'running',
            approval_status: 'not_required',
            executor: 'external_executor',
            kind: 'code',
            subtype: 'review',
            summary: 'Review do modulo de autenticaction em andamento.',
            updated_at: new Date().toISOString(),
          },
        ],
        recent_artifacts: [],
        continuity_recommendations: [],
        autonomous_outcomes: [],
        autonomous_mode_recommendations: [],
        direct_response_style_recommendations: [],
        last_successful_task: null,
        summary: 'Workspace core',
      },
    });

    expect(advice.executor).toBe('external_executor');
    expect(advice.source).toBe('active_focus');
    expect(advice.workflow_recommendation).toEqual(
      expect.objectContaining({
        workflow: 'review',
      }),
    );
    expect(advice.rationale.join(' ')).toContain('similar active focus');
  });

  it('uses workflow stage memory to prefer the best executor for the current step', () => {
    const advice = advisor.recommend({
      parsed: {
        command_type: '/auto',
        command_args: 'review the final delivery before publishing',
        normalized_message: '/auto review the final delivery before publishing',
        explicit_executor: null,
        references_last_task: false,
      },
      route: {
        intent: 'hybrid_task',
        target: null,
        workspace_hint: 'core',
        requires_planning: false,
        executor_preference: null,
        dispatch_mode: 'conversation',
        routing_reason: 'Pedido de review final.',
        routing_confidence: 0.5,
      },
      workspaceProfile: null,
      workspaceOperationalMemory: {
        workspace: 'core',
        workspace_name: 'core',
        slug: 'core',
        last_refreshed: new Date().toISOString(),
        successful_executors: [{ executor: 'codex', count: 8, last_seen_at: new Date().toISOString() }],
        repeated_failures: [],
        task_kind_recommendations: [],
        task_subtype_recommendations: [],
        task_kind_llm_recommendations: [],
        task_subtype_llm_recommendations: [],
        approved_paths: [],
        active_focuses: [],
        recent_artifacts: [
          {
            task_id: 'task-ship-1',
            artifact_id: 'artifact-ship-1',
            name: 'release-notes.md',
            kind: 'doc',
            type: 'file',
            path: null,
            url: null,
            summary: 'Entrega pronta para review.',
            created_at: new Date().toISOString(),
            executor: 'codex',
          },
        ],
        recent_workflow_runs: [
          {
            workflow_run_id: 'wf-review-1',
            workflow_name: 'review',
            status: 'completed',
            completed_stages: 2,
            total_stages: 2,
            primary_artifact_name: 'release-notes.md',
            updated_at: new Date().toISOString(),
          },
        ],
        workflow_recommendations: [
          {
            workflow: 'review',
            success_count: 2,
            pending_count: 0,
            failed_count: 0,
            last_seen_at: new Date().toISOString(),
            confidence: 'high',
            rationale: 'Workflows de review closeam melhor neste workspace.',
          },
        ],
        workflow_executor_recommendations: [],
        workflow_stage_executor_recommendations: [
          {
            workflow: 'review',
            role: 'reviewer',
            executor: 'external_executor',
            success_count: 4,
            pending_count: 0,
            failed_count: 0,
            last_seen_at: new Date().toISOString(),
            confidence: 'high',
            rationale: 'At the reviewer stage, external_executor fechou melhor as revisoes finais.',
          },
        ],
        workflow_friction_recommendations: [],
        approval_friction_recommendations: [],
        continuity_recommendations: [
          {
            kind: 'continue_from_success',
            label: 'Retomar review final',
            reason: 'The delivery is ready for the review stage.',
            task_id: 'task-ship-1',
            artifact_name: 'release-notes.md',
            executor: 'external_executor',
          },
        ],
        autonomous_outcomes: [],
        autonomous_mode_recommendations: [],
        direct_response_style_recommendations: [],
        last_successful_task: null,
        summary: 'Workspace core',
      },
    });

    expect(advice.executor).toBe('external_executor');
    expect(advice.source).toBe('workflow_stage_memory');
    expect(advice.workflow_recommendation).toEqual(
      expect.objectContaining({
        workflow: 'review',
      }),
    );
    expect(advice.rationale.join(' ')).toContain('reviewer stage');
  });

  it('boosts workflow stage memory when the same stage already recovered after an interruption', () => {
    const advice = advisor.recommend({
      parsed: {
        command_type: '/auto',
        command_args: 'review the final briefing before publishing',
        normalized_message: '/auto review the final briefing before publishing',
        explicit_executor: null,
        references_last_task: false,
      },
      route: {
        intent: 'hybrid_task',
        target: null,
        workspace_hint: 'core',
        requires_planning: false,
        executor_preference: null,
        dispatch_mode: 'conversation',
        routing_reason: 'Pedido de resumption final.',
        routing_confidence: 0.46,
      },
      workspaceProfile: null,
      workspaceOperationalMemory: {
        workspace: 'core',
        workspace_name: 'core',
        slug: 'core',
        last_refreshed: new Date().toISOString(),
        successful_executors: [],
        repeated_failures: [],
        task_kind_recommendations: [],
        task_subtype_recommendations: [],
        task_kind_llm_recommendations: [],
        task_subtype_llm_recommendations: [],
        approved_paths: [],
        active_focuses: [],
        recent_artifacts: [
          {
            task_id: 'task-ship-recovered',
            artifact_id: 'artifact-ship-recovered',
            name: 'briefing-final.md',
            kind: 'doc',
            type: 'file',
            path: null,
            url: null,
            summary: 'Final delivery ready to publish.',
            created_at: new Date().toISOString(),
            executor: 'external_executor',
          },
        ],
        recent_workflow_runs: [
          {
            workflow_run_id: 'wf-ship-recovered',
            workflow_name: 'review',
            status: 'completed',
            completed_stages: 2,
            total_stages: 2,
            primary_artifact_name: 'briefing-final.md',
            recovered_from_interruption: true,
            last_interrupted_stage_label: 'ExternalExecutor Reviewer',
            updated_at: new Date().toISOString(),
          },
        ],
        workflow_recommendations: [
          {
            workflow: 'review',
            success_count: 1,
            pending_count: 0,
            failed_count: 0,
            recovered_count: 1,
            last_recovered_stage_label: 'ExternalExecutor Reviewer',
            last_seen_at: new Date().toISOString(),
            confidence: 'medium',
            rationale: '1 run recente deste workflow concluiu bem neste workspace. 1 recuperaction(oes) recente(s) closeam bem depois de ExternalExecutor Reviewer.',
          },
        ],
        workflow_executor_recommendations: [],
        workflow_stage_executor_recommendations: [
          {
            workflow: 'review',
            role: 'reviewer',
            executor: 'external_executor',
            success_count: 2,
            recovered_count: 1,
            pending_count: 0,
            failed_count: 0,
            last_seen_at: new Date().toISOString(),
            confidence: 'high',
            rationale: 'external_executor completed 2 recent stage(s) de ship/reviewer neste workspace. 1 resumption(s) also closed successfully in this stage.',
          },
        ],
        workflow_friction_recommendations: [],
        approval_friction_recommendations: [],
        continuity_recommendations: [
          {
            kind: 'continue_from_success',
            label: 'Continuar after review em ExternalExecutor Reviewer',
            reason: 'O workflow review acabou de concluir uma resumption com sucesso e entregou briefing-final.md.',
            task_id: null,
            artifact_name: 'briefing-final.md',
            executor: null,
          },
        ],
        autonomous_outcomes: [],
        autonomous_mode_recommendations: [],
        direct_response_style_recommendations: [],
        last_successful_task: null,
        summary: 'Workspace core',
      },
    });

    expect(advice.executor).toBe('external_executor');
    expect(advice.source).toBe('workflow_stage_memory');
    expect(advice.workflow_recommendation).toEqual(
      expect.objectContaining({
        workflow: 'review',
      }),
    );
    expect(advice.rationale.join(' ')).toContain('resumption(s) also closed successfully in this stage');
  });

  it('recommends a ship workflow when code delivery has continuity signals from the workspace', () => {
    const advice = advisor.recommend({
      parsed: {
        command_type: '/auto',
        command_args: 'fix the tests and deliver the final version',
        normalized_message: '/auto fix the tests and deliver the final version',
        explicit_executor: null,
        references_last_task: false,
      },
      route: {
        intent: 'hybrid_task',
        target: null,
        workspace_hint: 'core',
        requires_planning: false,
        executor_preference: null,
        dispatch_mode: 'conversation',
        routing_reason: 'Pedido ainda ambiguo.',
        routing_confidence: 0.35,
      },
      workspaceProfile: null,
      workspaceOperationalMemory: {
        workspace: 'core',
        workspace_name: 'core',
        slug: 'core',
        last_refreshed: new Date().toISOString(),
        successful_executors: [{ executor: 'codex', count: 5, last_seen_at: new Date().toISOString() }],
        repeated_failures: [],
        task_kind_recommendations: [
          {
            kind: 'code',
            preferred_executor: 'codex',
            success_count: 5,
            repeated_failure_executor: null,
            repeated_failure_summary: null,
            repeated_failure_count: 0,
            last_seen_at: new Date().toISOString(),
          },
        ],
        task_subtype_recommendations: [],
        task_kind_llm_recommendations: [],
        task_subtype_llm_recommendations: [],
        approved_paths: [],
        active_focuses: [],
        recent_artifacts: [
          {
            task_id: 'task-1',
            artifact_id: 'artifact-1',
            name: 'briefing-final.md',
            kind: 'doc',
            type: 'file',
            path: null,
            url: null,
            summary: 'Briefing recente',
            created_at: new Date().toISOString(),
            executor: 'codex',
          },
        ],
        recent_workflow_runs: [
          {
            workflow_run_id: 'wf-ship-1',
            workflow_name: 'ship',
            status: 'approval_pending',
            completed_stages: 1,
            total_stages: 2,
            primary_artifact_name: 'briefing-final.md',
            updated_at: new Date().toISOString(),
          },
        ],
        workflow_recommendations: [
          {
            workflow: 'ship',
            success_count: 0,
            pending_count: 1,
            failed_count: 0,
            last_seen_at: new Date().toISOString(),
            confidence: 'medium',
            rationale: '1 run recente deste workflow ainda is still open.',
          },
        ],
        continuity_recommendations: [
          {
            kind: 'continue_from_success',
            label: 'Continuar a entrega final',
            reason: 'Ja existe um briefing recente ready para consolidar.',
            task_id: 'task-1',
            artifact_name: 'briefing-final.md',
            executor: 'codex',
          },
        ],
        autonomous_outcomes: [],
        autonomous_mode_recommendations: [],
        direct_response_style_recommendations: [],
        last_successful_task: null,
        summary: 'Workspace core',
      },
    });

    expect(advice.workflow_recommendation).toEqual(
      expect.objectContaining({
        workflow: 'ship',
        rationale: '1 run recente deste workflow ainda is still open.',
      }),
    );
  });

  it('uses workflow executor history when a workflow continuation is clearly the next step', () => {
    const advice = advisor.recommend({
      parsed: {
        command_type: '/auto',
        command_args: 'fix the tests and deliver the final version do pacote',
        normalized_message: '/auto fix the tests and deliver the final version do pacote',
        explicit_executor: null,
        references_last_task: false,
      },
      route: {
        intent: 'hybrid_task',
        target: null,
        workspace_hint: 'core',
        requires_planning: false,
        executor_preference: null,
        dispatch_mode: 'conversation',
        routing_reason: 'Pedido de continuidade para entrega.',
        routing_confidence: 0.4,
      },
      workspaceProfile: null,
      workspaceOperationalMemory: {
        workspace: 'core',
        workspace_name: 'core',
        slug: 'core',
        last_refreshed: new Date().toISOString(),
        successful_executors: [],
        repeated_failures: [],
        task_kind_recommendations: [],
        task_subtype_recommendations: [],
        task_kind_llm_recommendations: [],
        task_subtype_llm_recommendations: [],
        approved_paths: [],
        active_focuses: [],
        recent_artifacts: [
          {
            task_id: 'task-1',
            artifact_id: 'artifact-1',
            name: 'release-checklist.md',
            kind: 'doc',
            type: 'file',
            path: null,
            url: null,
            summary: 'Checklist final da entrega',
            created_at: new Date().toISOString(),
            executor: 'external_executor',
          },
        ],
        recent_workflow_runs: [
          {
            workflow_run_id: 'wf-ship-1',
            workflow_name: 'ship',
            status: 'completed',
            completed_stages: 2,
            total_stages: 2,
            primary_artifact_name: 'release-checklist.md',
            updated_at: new Date().toISOString(),
            stage_executors: [
              { executor: 'external_executor', status: 'completed', attempt_count: 1 },
              { executor: 'codex', status: 'completed', attempt_count: 1 },
            ],
          },
        ],
        workflow_recommendations: [
          {
            workflow: 'ship',
            success_count: 1,
            pending_count: 0,
            failed_count: 0,
            last_seen_at: new Date().toISOString(),
            confidence: 'low',
            rationale: '1 run recente deste workflow concluiu bem neste workspace.',
          },
        ],
        workflow_executor_recommendations: [
          {
            workflow: 'ship',
            executor: 'external_executor',
            success_count: 2,
            pending_count: 0,
            failed_count: 0,
            last_seen_at: new Date().toISOString(),
            confidence: 'medium',
            rationale: 'external_executor completed 2 recent stage(s) de ship neste workspace.',
          },
        ],
        continuity_recommendations: [
          {
            kind: 'resume_workflow',
            label: 'Retomar entrega final',
            reason: 'The next useful step is to continue the delivery workflow.',
            task_id: null,
            artifact_name: 'release-checklist.md',
            executor: 'external_executor',
          },
        ],
        autonomous_outcomes: [],
        autonomous_mode_recommendations: [],
        direct_response_style_recommendations: [],
        last_successful_task: null,
        summary: 'Workspace core',
      },
    });

    expect(advice.executor).toBe('external_executor');
    expect(advice.source).toBe('workflow_memory');
    expect(advice.workflow_recommendation).toEqual(
      expect.objectContaining({
        workflow: 'ship',
      }),
    );
    expect(advice.rationale.join(' ')).toContain('external_executor completed 2 recent stage(s) de ship');
  });

  it('reduces confidence for routes with heavy approval friction and prefers a safer executor', () => {
    const advice = advisor.recommend({
      parsed: {
        command_type: '/auto',
        command_args: 'revise o modulo de security e prepare a entrega final',
        normalized_message: '/auto revise o modulo de security e prepare a entrega final',
        explicit_executor: null,
        references_last_task: false,
      },
      route: {
        intent: 'hybrid_task',
        target: null,
        workspace_hint: 'core',
        requires_planning: false,
        executor_preference: null,
        dispatch_mode: 'conversation',
        routing_reason: 'Pedido ambiguo com review e entrega.',
        routing_confidence: 0.4,
      },
      workspaceProfile: {
        workspace: 'core',
        workspace_name: 'core',
        slug: 'core',
        detected_stacks: ['nodejs'],
        frameworks: ['typescript'],
        languages: ['typescript'],
        package_manager: 'npm',
        scripts: {},
        important_paths: [],
        instruction_file: null,
        instruction_summary: '',
        instruction_notes: [],
        workspace_hooks: [],
        workspace_commands: [],
        preferred_executors: {
          code_editing: 'codex',
          code_review: 'external_executor',
          research: 'aistudio',
          design: 'stitch',
          automation: 'zavorthBridge',
        },
        summary: 'Workspace core',
        last_refreshed: new Date().toISOString(),
      },
      workspaceOperationalMemory: {
        workspace: 'core',
        workspace_name: 'core',
        slug: 'core',
        last_refreshed: new Date().toISOString(),
        successful_executors: [{ executor: 'codex', count: 4, last_seen_at: new Date().toISOString() }],
        repeated_failures: [],
        task_kind_recommendations: [
          {
            kind: 'code',
            preferred_executor: 'codex',
            success_count: 4,
            repeated_failure_executor: null,
            repeated_failure_summary: null,
            repeated_failure_count: 0,
            last_seen_at: new Date().toISOString(),
          },
        ],
        task_subtype_recommendations: [
          {
            kind: 'code',
            subtype: 'review',
            preferred_executor: 'external_executor',
            success_count: 3,
            repeated_failure_executor: null,
            repeated_failure_summary: null,
            repeated_failure_count: 0,
            last_seen_at: new Date().toISOString(),
          },
        ],
        task_kind_llm_recommendations: [],
        task_subtype_llm_recommendations: [],
        approved_paths: [],
        active_focuses: [],
        recent_artifacts: [],
        recent_workflow_runs: [],
        workflow_recommendations: [],
        workflow_executor_recommendations: [],
        approval_friction_recommendations: [
          {
            executor: 'external_executor',
            kind: 'code',
            subtype: 'review',
            pending_count: 1,
            rejected_count: 2,
            high_risk_count: 1,
            permission_count: 2,
            last_seen_at: new Date().toISOString(),
            confidence: 'high',
            rationale: '2 rejection(s), 1 gate(s) de high risk, 2 permission request(s)',
          },
        ],
        continuity_recommendations: [],
        autonomous_outcomes: [],
        autonomous_mode_recommendations: [],
        direct_response_style_recommendations: [],
        last_successful_task: null,
        summary: 'Workspace core',
      },
    });

    expect(advice.executor).toBe('codex');
    expect(advice.source).toBe('kind_memory');
    expect(advice.blocked_executors).toContain('external_executor');
    expect(advice.rationale.join(' ')).toContain('operational friction recente com external_executor');
  });

  it('switches to checkpointed responses when the chosen route still has approval friction', () => {
    const advice = advisor.recommend({
      parsed: {
        command_type: '/auto',
        command_args: 'continue a review sensitive do modulo de security',
        normalized_message: '/auto continue a review sensitive do modulo de security',
        explicit_executor: null,
        references_last_task: false,
      },
      route: {
        intent: 'hybrid_task',
        target: null,
        workspace_hint: 'core',
        requires_planning: false,
        executor_preference: null,
        dispatch_mode: 'conversation',
        routing_reason: 'Pedido de continuidade para review sensitive.',
        routing_confidence: 0.4,
      },
      workspaceProfile: null,
      workspaceOperationalMemory: {
        workspace: 'core',
        workspace_name: 'core',
        slug: 'core',
        last_refreshed: new Date().toISOString(),
        successful_executors: [],
        repeated_failures: [],
        task_kind_recommendations: [],
        task_subtype_recommendations: [
          {
            kind: 'code',
            subtype: 'review',
            preferred_executor: 'external_executor',
            success_count: 2,
            repeated_failure_executor: null,
            repeated_failure_summary: null,
            repeated_failure_count: 0,
            last_seen_at: new Date().toISOString(),
          },
        ],
        task_kind_llm_recommendations: [],
        task_subtype_llm_recommendations: [],
        approved_paths: [],
        active_focuses: [],
        recent_artifacts: [],
        recent_workflow_runs: [],
        workflow_recommendations: [],
        workflow_executor_recommendations: [],
        approval_friction_recommendations: [
          {
            executor: 'external_executor',
            kind: 'code',
            subtype: 'review',
            pending_count: 1,
            rejected_count: 1,
            high_risk_count: 1,
            permission_count: 1,
            last_seen_at: new Date().toISOString(),
            confidence: 'high',
            rationale: '1 rejection(s), 1 gate(s) de high risk, 1 permission request(s)',
          },
        ],
        continuity_recommendations: [],
        autonomous_outcomes: [],
        autonomous_mode_recommendations: [],
        direct_response_style_recommendations: [],
        last_successful_task: null,
        summary: 'Workspace core',
      },
    });

    expect(advice.executor).toBe('external_executor');
    expect(advice.source).toBe('subtype_memory');
    expect(advice.response_style).toBe('checkpointed');
    expect(advice.rationale.join(' ')).toContain('checkpointed');
  });

  it('keeps a route viable when approvals usually end in delivery', () => {
    const advice = advisor.recommend({
      parsed: {
        command_type: '/auto',
        command_args: 'continue o review final do briefing',
        normalized_message: '/auto continue o review final do briefing',
        explicit_executor: null,
        references_last_task: false,
      },
      route: {
        intent: 'hybrid_task',
        target: null,
        workspace_hint: 'core',
        requires_planning: false,
        executor_preference: null,
        dispatch_mode: 'conversation',
        routing_reason: 'Pedido de continuidade com entrega.',
        routing_confidence: 0.45,
      },
      workspaceProfile: null,
      workspaceOperationalMemory: {
        workspace: 'core',
        workspace_name: 'core',
        slug: 'core',
        last_refreshed: new Date().toISOString(),
        successful_executors: [],
        repeated_failures: [],
        task_kind_recommendations: [],
        task_subtype_recommendations: [
          {
            kind: 'code',
            subtype: 'review',
            preferred_executor: 'external_executor',
            success_count: 3,
            repeated_failure_executor: null,
            repeated_failure_summary: null,
            repeated_failure_count: 0,
            last_seen_at: new Date().toISOString(),
          },
        ],
        task_kind_llm_recommendations: [],
        task_subtype_llm_recommendations: [],
        approved_paths: [],
        active_focuses: [],
        recent_artifacts: [],
        recent_workflow_runs: [],
        workflow_recommendations: [],
        workflow_executor_recommendations: [],
        approval_friction_recommendations: [
          {
            executor: 'external_executor',
            kind: 'code',
            subtype: 'review',
            pending_count: 1,
            rejected_count: 1,
            high_risk_count: 0,
            permission_count: 1,
            granted_count: 4,
            delivered_after_approval_count: 2,
            last_seen_at: new Date().toISOString(),
            confidence: 'medium',
            rationale: '1 rejection(s), 1 espera de confirmation, 1 pedido de permission, 4 liberactions concluidas, 2 entregas after approval',
          },
        ],
        continuity_recommendations: [],
        autonomous_outcomes: [],
        autonomous_mode_recommendations: [],
        direct_response_style_recommendations: [],
        last_successful_task: null,
        summary: 'Workspace core',
      },
    });

    expect(advice.executor).toBe('external_executor');
    expect(advice.source).toBe('subtype_memory');
    expect(advice.blocked_executors).not.toContain('external_executor');
    expect(advice.response_style).not.toBe('checkpointed');
    expect(advice.rationale.join(' ')).toContain('delivery item(s) after approval');
  });

  it('uses workflow friction to keep resumable workflows in checkpointed mode', () => {
    const advice = advisor.recommend({
      parsed: {
        command_type: '/auto',
        command_args: 'fix the tests and deliver the final version do pacote',
        normalized_message: '/auto fix the tests and deliver the final version do pacote',
        explicit_executor: null,
        references_last_task: false,
      },
      route: {
        intent: 'hybrid_task',
        target: null,
        workspace_hint: 'core',
        requires_planning: false,
        executor_preference: null,
        dispatch_mode: 'conversation',
        routing_reason: 'Pedido claro de continuidade.',
        routing_confidence: 0.45,
      },
      workspaceProfile: null,
      workspaceOperationalMemory: {
        workspace: 'core',
        workspace_name: 'core',
        slug: 'core',
        last_refreshed: new Date().toISOString(),
        successful_executors: [],
        repeated_failures: [],
        task_kind_recommendations: [
          {
            kind: 'code',
            preferred_executor: 'codex',
            success_count: 2,
            repeated_failure_executor: null,
            repeated_failure_summary: null,
            repeated_failure_count: 0,
            last_seen_at: new Date().toISOString(),
          },
        ],
        task_subtype_recommendations: [],
        task_kind_llm_recommendations: [],
        task_subtype_llm_recommendations: [],
        approved_paths: [],
        active_focuses: [],
        recent_artifacts: [
          {
            task_id: 'task-ship-1',
            artifact_id: 'artifact-ship-1',
            name: 'release-checklist.md',
            kind: 'doc',
            type: 'file',
            path: null,
            url: null,
            summary: 'Checklist final da entrega',
            created_at: new Date().toISOString(),
            executor: 'codex',
          },
        ],
        recent_workflow_runs: [
          {
            workflow_run_id: 'wf-ship-1',
            workflow_name: 'ship',
            status: 'approval_pending',
            completed_stages: 1,
            total_stages: 2,
            primary_artifact_name: 'release-checklist.md',
            resume_stage_label: 'ExternalExecutor Reviewer',
            resume_stage_status: 'approval_pending',
            resume_stage_reason: 'waits for your confirmation before continuing',
            updated_at: new Date().toISOString(),
            stage_executors: [
              { executor: 'codex', status: 'completed', attempt_count: 1 },
              { executor: 'external_executor', status: 'approval_pending', attempt_count: 1 },
            ],
          },
        ],
        workflow_recommendations: [
          {
            workflow: 'ship',
            success_count: 0,
            pending_count: 1,
            failed_count: 0,
            last_seen_at: new Date().toISOString(),
            confidence: 'medium',
            rationale: '1 run recente deste workflow ainda is still open. Most sensitive stage now: ExternalExecutor Reviewer.',
          },
        ],
        workflow_executor_recommendations: [],
        workflow_friction_recommendations: [
          {
            workflow: 'ship',
            approval_pending_count: 1,
            blocked_count: 0,
            failed_count: 0,
            last_resume_stage_label: 'ExternalExecutor Reviewer',
            last_seen_at: new Date().toISOString(),
            confidence: 'medium',
            rationale: '1 pause(s) waiting for confirmation, critical stage ExternalExecutor Reviewer',
          },
        ],
        approval_friction_recommendations: [],
        continuity_recommendations: [
          {
            kind: 'resume_workflow',
            label: 'Retomar workflow ship em ExternalExecutor Reviewer',
            reason: 'Existe um workflow ship ainda aberto e a resumption mais util agora e ExternalExecutor Reviewer.',
            task_id: null,
            artifact_name: 'release-checklist.md',
            executor: null,
          },
        ],
        autonomous_outcomes: [],
        autonomous_mode_recommendations: [],
        direct_response_style_recommendations: [],
        last_successful_task: null,
        summary: 'Workspace core',
      },
    });

    expect(advice.workflow_recommendation).toEqual(
      expect.objectContaining({
        workflow: 'ship',
      }),
    );
    expect(advice.response_style).toBe('checkpointed');
    expect(advice.rationale.join(' ')).toContain('Workflow ship pede mais controle');
  });

  it('keeps a workflow recommendation more direct when recent interruptions were recovered successfully', () => {
    const advice = advisor.recommend({
      parsed: {
        command_type: '/auto',
        command_args: 'fix the tests and deliver the final version usando o briefing approved',
        normalized_message: '/auto fix the tests and deliver the final version usando o briefing approved',
        explicit_executor: null,
        references_last_task: false,
      },
      route: {
        intent: 'hybrid_task',
        target: null,
        workspace_hint: 'core',
        requires_planning: false,
        executor_preference: null,
        dispatch_mode: 'conversation',
        routing_reason: 'Pedido de continuidade para entrega.',
        routing_confidence: 0.45,
      },
      workspaceProfile: null,
      workspaceOperationalMemory: {
        workspace: 'core',
        workspace_name: 'core',
        slug: 'core',
        last_refreshed: new Date().toISOString(),
        successful_executors: [],
        repeated_failures: [],
        task_kind_recommendations: [
          {
            kind: 'code',
            preferred_executor: 'codex',
            success_count: 3,
            repeated_failure_executor: null,
            repeated_failure_summary: null,
            repeated_failure_count: 0,
            last_seen_at: new Date().toISOString(),
          },
        ],
        task_subtype_recommendations: [],
        task_kind_llm_recommendations: [],
        task_subtype_llm_recommendations: [],
        approved_paths: [],
        active_focuses: [],
        recent_artifacts: [
          {
            task_id: 'task-ship-final',
            artifact_id: 'artifact-ship-final',
            name: 'briefing-final.md',
            kind: 'doc',
            type: 'file',
            path: null,
            url: null,
            summary: 'Entrega final approved.',
            created_at: new Date().toISOString(),
            executor: 'codex',
          },
        ],
        recent_workflow_runs: [
          {
            workflow_run_id: 'wf-ship-recovered-1',
            workflow_name: 'ship',
            status: 'completed',
            completed_stages: 2,
            total_stages: 2,
            primary_artifact_name: 'briefing-final.md',
            interruption_count: 1,
            recovered_from_interruption: true,
            last_interrupted_stage_label: 'ExternalExecutor Reviewer',
            updated_at: new Date().toISOString(),
          },
        ],
        workflow_recommendations: [
          {
            workflow: 'ship',
            success_count: 2,
            pending_count: 1,
            failed_count: 0,
            recovered_count: 2,
            last_recovered_stage_label: 'ExternalExecutor Reviewer',
            last_seen_at: new Date().toISOString(),
            confidence: 'high',
            rationale: '2 run(s) recente(s) deste workflow concluiram bem neste workspace. 2 recuperaction(oes) recente(s) closeam bem depois de ExternalExecutor Reviewer.',
          },
        ],
        workflow_executor_recommendations: [],
        workflow_friction_recommendations: [
          {
            workflow: 'ship',
            approval_pending_count: 1,
            blocked_count: 0,
            failed_count: 0,
            recovered_count: 2,
            last_resume_stage_label: 'ExternalExecutor Reviewer',
            last_recovered_stage_label: 'ExternalExecutor Reviewer',
            last_seen_at: new Date().toISOString(),
            confidence: 'medium',
            rationale: '1 pause(s) waiting for confirmation, critical stage ExternalExecutor Reviewer, 2 completed recovery event(s) via ExternalExecutor Reviewer',
          },
        ],
        approval_friction_recommendations: [],
        continuity_recommendations: [
          {
            kind: 'continue_from_success',
            label: 'Continuar after ship em ExternalExecutor Reviewer',
            reason: 'O workflow ship acabou de concluir uma resumption com sucesso e entregou briefing-final.md.',
            task_id: null,
            artifact_name: 'briefing-final.md',
            executor: null,
          },
        ],
        autonomous_outcomes: [],
        autonomous_mode_recommendations: [],
        direct_response_style_recommendations: [],
        last_successful_task: null,
        summary: 'Workspace core',
      },
    });

    expect(advice.workflow_recommendation).toEqual(
      expect.objectContaining({
        workflow: 'ship',
      }),
    );
    expect(advice.response_style).not.toBe('checkpointed');
    expect(advice.rationale.join(' ')).toContain('ja se recuperou 2 vez(es)');
  });

  it('keeps a route viable when repeated recoveries still deliver the final artifact', () => {
    const advice = advisor.recommend({
      parsed: {
        command_type: '/auto',
        command_args: 'resume final review and deliver the version ready to publish',
        normalized_message: '/auto resume final review and deliver the version ready to publish',
        explicit_executor: null,
        references_last_task: false,
      },
      route: {
        intent: 'hybrid_task',
        target: null,
        workspace_hint: 'core',
        requires_planning: false,
        executor_preference: null,
        dispatch_mode: 'conversation',
        routing_reason: 'Pedido de resumption com entrega final.',
        routing_confidence: 0.42,
      },
      workspaceProfile: null,
      workspaceOperationalMemory: {
        workspace: 'core',
        workspace_name: 'core',
        slug: 'core',
        last_refreshed: new Date().toISOString(),
        successful_executors: [{ executor: 'codex', count: 4, last_seen_at: new Date().toISOString() }],
        repeated_failures: [],
        task_kind_recommendations: [
          {
            kind: 'code',
            preferred_executor: 'external_executor',
            success_count: 3,
            repeated_failure_executor: null,
            repeated_failure_summary: null,
            repeated_failure_count: 0,
            last_seen_at: new Date().toISOString(),
          },
        ],
        task_subtype_recommendations: [
          {
            kind: 'code',
            subtype: 'review',
            preferred_executor: 'external_executor',
            success_count: 3,
            repeated_failure_executor: null,
            repeated_failure_summary: null,
            repeated_failure_count: 0,
            last_seen_at: new Date().toISOString(),
          },
        ],
        task_kind_llm_recommendations: [],
        task_subtype_llm_recommendations: [],
        approved_paths: [],
        active_focuses: [],
        recent_artifacts: [
          {
            task_id: 'task-ship-route-1',
            artifact_id: 'artifact-ship-route-1',
            name: 'briefing-final.md',
            kind: 'doc',
            type: 'file',
            path: null,
            url: null,
            summary: 'Entrega final approved.',
            created_at: new Date().toISOString(),
            executor: 'external_executor',
          },
        ],
        recent_workflow_runs: [
          {
            workflow_run_id: 'wf-ship-route-1',
            workflow_name: 'ship',
            status: 'completed',
            completed_stages: 2,
            total_stages: 2,
            primary_artifact_name: 'briefing-final.md',
            recovered_from_interruption: true,
            last_interrupted_stage_label: 'ExternalExecutor Reviewer',
            updated_at: new Date().toISOString(),
          },
        ],
        workflow_recommendations: [
          {
            workflow: 'ship',
            success_count: 1,
            pending_count: 0,
            failed_count: 0,
            recovered_count: 1,
            last_recovered_stage_label: 'ExternalExecutor Reviewer',
            last_seen_at: new Date().toISOString(),
            confidence: 'medium',
            rationale: '1 run recente deste workflow concluiu bem neste workspace. 1 recuperaction(oes) recente(s) closeam bem depois de ExternalExecutor Reviewer.',
          },
        ],
        workflow_executor_recommendations: [],
        workflow_friction_recommendations: [],
        approval_friction_recommendations: [],
        route_outcomes: [
          {
            executor: 'external_executor',
            source: 'workflow_memory',
            source_surface: 'telegram',
            strategy: 'workflow_resume',
            workflow_name: 'ship',
            task_kind: 'code',
            task_subtype: 'review',
            total_count: 3,
            completed_count: 1,
            failed_count: 1,
            approval_pending_count: 1,
            approval_granted_count: 0,
            approval_rejected_count: 1,
            permission_pending_count: 0,
            permission_granted_count: 0,
            permission_rejected_count: 0,
            gated_completion_count: 2,
            gated_artifactful_count: 2,
            rejected_count: 2,
            high_risk_count: 1,
            artifactful_count: 0,
            workflow_recovered_count: 2,
            workflow_recovery_success_count: 2,
            workflow_recovery_artifactful_count: 2,
            average_duration_ms: 420000,
            success_rate: 0.333,
            friction_rate: 0.667,
            last_seen_at: new Date().toISOString(),
            confidence: 'medium',
            rationale: '1 concluida, 1 failure, 2 rejeicoes, 1 waiting for approval, 2 resumptions concluidas com 2 entregas finais.',
          },
        ],
        continuity_recommendations: [
          {
            kind: 'resume_workflow',
            label: 'Retomar workflow ship em ExternalExecutor Reviewer',
            reason: 'A rota do reviewer ja voltou bem e ainda entregou o briefing final.',
            task_id: null,
            artifact_name: 'briefing-final.md',
            executor: 'external_executor',
          },
        ],
        autonomous_outcomes: [],
        autonomous_mode_recommendations: [],
        direct_response_style_recommendations: [],
        last_successful_task: null,
        summary: 'Workspace core',
      },
    });

    expect(advice.executor).toBe('external_executor');
    expect(advice.blocked_executors).not.toContain('external_executor');
    expect(advice.rationale.join(' ')).toContain('recuperou interrupcoes recentes');
    expect(advice.rationale.join(' ')).toContain('artifact(s) final(is)');
    expect(advice.rationale.join(' ')).toContain('gate humano');
  });

  it('backs off a workflow recommendation when friction stays high and the route keeps failing without approved policies', () => {
    const advice = advisor.recommend({
      parsed: {
        command_type: '/auto',
        command_args: 'continue a implementaction final e entregue o pacote',
        normalized_message: '/auto continue a implementaction final e entregue o pacote',
        explicit_executor: null,
        references_last_task: false,
      },
      route: {
        intent: 'hybrid_task',
        target: null,
        workspace_hint: 'core',
        requires_planning: false,
        executor_preference: null,
        dispatch_mode: 'conversation',
        routing_reason: 'Pedido de continuidade com entrega.',
        routing_confidence: 0.5,
      },
      workspaceProfile: null,
      workspaceOperationalMemory: {
        workspace: 'core',
        workspace_name: 'core',
        slug: 'core',
        last_refreshed: new Date().toISOString(),
        successful_executors: [],
        repeated_failures: [],
        task_kind_recommendations: [],
        task_subtype_recommendations: [
          {
            kind: 'code',
            subtype: 'implementation',
            preferred_executor: 'external_executor',
            success_count: 2,
            repeated_failure_executor: null,
            repeated_failure_summary: null,
            repeated_failure_count: 0,
            last_seen_at: new Date().toISOString(),
          },
        ],
        task_kind_llm_recommendations: [],
        task_subtype_llm_recommendations: [],
        approved_paths: [],
        approved_policies: [],
        active_focuses: [],
        recent_artifacts: [
          {
            task_id: 'task-ship-2',
            artifact_id: 'artifact-ship-2',
            name: 'release-plan.md',
            kind: 'doc',
            type: 'file',
            path: null,
            url: null,
            summary: 'Plan de release atual',
            created_at: new Date().toISOString(),
            executor: 'external_executor',
          },
        ],
        recent_workflow_runs: [],
        workflow_recommendations: [
          {
            workflow: 'ship',
            success_count: 1,
            pending_count: 2,
            failed_count: 1,
            last_seen_at: new Date().toISOString(),
            confidence: 'high',
            rationale: 'The workspace still insists on ship, but the last stage often stalls.',
          },
        ],
        workflow_executor_recommendations: [],
        workflow_friction_recommendations: [
          {
            workflow: 'ship',
            approval_pending_count: 1,
            blocked_count: 1,
            failed_count: 1,
            last_resume_stage_label: 'ExternalExecutor Reviewer',
            last_seen_at: new Date().toISOString(),
            confidence: 'high',
            rationale: '1 failure(s), 1 block(s), 1 pause(s) waiting for confirmation, critical stage ExternalExecutor Reviewer',
          },
        ],
        approval_friction_recommendations: [],
        route_outcomes: [
          {
            executor: 'external_executor',
            source: 'workflow_memory',
            strategy: 'workflow_resume',
            workflow_name: 'ship',
            task_kind: 'code',
            task_subtype: 'implementation',
            total_count: 3,
            completed_count: 0,
            failed_count: 2,
            approval_pending_count: 1,
            approval_granted_count: 0,
            approval_rejected_count: 0,
            permission_pending_count: 0,
            permission_granted_count: 0,
            permission_rejected_count: 0,
            gated_completion_count: 0,
            gated_artifactful_count: 0,
            rejected_count: 0,
            high_risk_count: 0,
            artifactful_count: 0,
            average_duration_ms: 0,
            success_rate: 0,
            friction_rate: 1,
            last_seen_at: new Date().toISOString(),
            confidence: 'high',
            rationale: '0 concluida(s), 2 failure(s), 1 waiting for approval.',
          },
        ],
        continuity_recommendations: [
          {
            kind: 'resume_workflow',
            label: 'Retomar workflow ship',
            reason: 'O workflow ship ficou preso na review final.',
            task_id: null,
            artifact_name: 'release-plan.md',
            executor: 'external_executor',
          },
        ],
        autonomous_outcomes: [],
        autonomous_mode_recommendations: [],
        direct_response_style_recommendations: [],
        last_successful_task: null,
        summary: 'Workspace core',
      },
    });

    expect(advice.executor).toBe('external_executor');
    expect(advice.workflow_recommendation).toBeNull();
    expect(advice.rationale.join(' ')).toContain('Evitei o workflow ship');
  });

  it('penalizes route memories with repeated rejections even when the executor has completions', () => {
    const advice = advisor.recommend({
      parsed: {
        command_type: '/auto',
        command_args: 'fix the final payment module implementation and deliver the final version',
        normalized_message: '/auto fix the final payment module implementation and deliver the final version',
        explicit_executor: null,
        references_last_task: false,
      },
      route: {
        intent: 'hybrid_task',
        executor_preference: null,
      } as any,
      workspaceProfile: {
        preferred_executors: {
          code_editing: 'external_executor',
        },
      } as any,
      workspaceOperationalMemory: {
        repeated_failures: [],
        successful_executors: [
          {
            executor: 'codex',
            count: 2,
            last_seen_at: new Date().toISOString(),
          },
        ],
        task_kind_recommendations: [
          {
            kind: 'code',
            preferred_executor: 'external_executor',
            success_count: 4,
            repeated_failure_executor: null,
            repeated_failure_summary: null,
            repeated_failure_count: 0,
            last_seen_at: new Date().toISOString(),
          },
        ],
        task_subtype_recommendations: [
          {
            kind: 'code',
            subtype: 'implementation',
            preferred_executor: 'external_executor',
            success_count: 3,
            repeated_failure_executor: null,
            repeated_failure_summary: null,
            repeated_failure_count: 0,
            last_seen_at: new Date().toISOString(),
          },
          {
            kind: 'code',
            subtype: 'implementation',
            preferred_executor: 'codex',
            success_count: 2,
            repeated_failure_executor: null,
            repeated_failure_summary: null,
            repeated_failure_count: 0,
            last_seen_at: new Date().toISOString(),
          },
        ],
        task_kind_llm_recommendations: [],
        task_subtype_llm_recommendations: [],
        approved_paths: [],
        approved_policies: [],
        active_focuses: [],
        recent_artifacts: [],
        recent_workflow_runs: [],
        workflow_recommendations: [],
        workflow_executor_recommendations: [],
        workflow_stage_executor_recommendations: [],
        workflow_friction_recommendations: [],
        approval_friction_recommendations: [],
        route_outcomes: [
          {
            executor: 'external_executor',
            source: 'subtype_memory',
            source_surface: 'telegram',
            strategy: 'auto',
            workflow_name: null,
            task_kind: 'code',
            task_subtype: 'implementation',
            total_count: 4,
            completed_count: 3,
            failed_count: 0,
            approval_pending_count: 0,
            approval_granted_count: 0,
            approval_rejected_count: 2,
            permission_pending_count: 0,
            permission_granted_count: 0,
            permission_rejected_count: 0,
            gated_completion_count: 0,
            gated_artifactful_count: 0,
            rejected_count: 2,
            high_risk_count: 1,
            artifactful_count: 2,
            average_duration_ms: 120000,
            success_rate: 0.75,
            friction_rate: 0.5,
            last_seen_at: new Date().toISOString(),
            confidence: 'medium',
            rationale: '3 concluida(s), 0 failure(s), 2 rejection(s), 0 waiting for approval via telegram.',
          },
          {
            executor: 'codex',
            source: 'kind_memory',
            source_surface: 'telegram',
            strategy: 'auto',
            workflow_name: null,
            task_kind: 'code',
            task_subtype: 'implementation',
            total_count: 2,
            completed_count: 2,
            failed_count: 0,
            approval_pending_count: 0,
            approval_granted_count: 1,
            approval_rejected_count: 0,
            permission_pending_count: 0,
            permission_granted_count: 0,
            permission_rejected_count: 0,
            gated_completion_count: 1,
            gated_artifactful_count: 1,
            rejected_count: 0,
            high_risk_count: 0,
            artifactful_count: 1,
            average_duration_ms: 90000,
            success_rate: 1,
            friction_rate: 0,
            last_seen_at: new Date().toISOString(),
            confidence: 'high',
            rationale: '2 concluida(s), 0 failure(s), 0 rejection(s), 0 waiting for approval via telegram.',
          },
        ],
        continuity_recommendations: [],
        autonomous_outcomes: [],
        autonomous_mode_recommendations: [],
        direct_response_style_recommendations: [],
        last_successful_task: null,
        summary: 'Workspace pagamentos',
      } as any,
    });

    expect(advice.executor).toBe('codex');
    expect(advice.blocked_executors).toContain('external_executor');
    expect(advice.rationale.join(' ')).toContain('rejeicoes recentes');
  });

  it('prefers the route that clears approvals faster and recovers with delivery', () => {
    const advice = advisor.recommend({
      parsed: {
        command_type: '/auto',
        command_args: 'finalize a implementaction final e entregue o pacote',
        normalized_message: '/auto finalize a implementaction final e entregue o pacote',
        explicit_executor: null,
        references_last_task: false,
      },
      route: {
        intent: 'hybrid_task',
        executor_preference: null,
      } as any,
      workspaceProfile: null,
      workspaceOperationalMemory: {
        repeated_failures: [],
        successful_executors: [],
        task_kind_recommendations: [],
        task_subtype_recommendations: [
          {
            kind: 'code',
            subtype: 'implementation',
            preferred_executor: 'external_executor',
            success_count: 3,
            repeated_failure_executor: null,
            repeated_failure_summary: null,
            repeated_failure_count: 0,
            last_seen_at: new Date().toISOString(),
          },
          {
            kind: 'code',
            subtype: 'implementation',
            preferred_executor: 'codex',
            success_count: 2,
            repeated_failure_executor: null,
            repeated_failure_summary: null,
            repeated_failure_count: 0,
            last_seen_at: new Date().toISOString(),
          },
        ],
        task_kind_llm_recommendations: [],
        task_subtype_llm_recommendations: [],
        approved_paths: [],
        approved_policies: [],
        active_focuses: [],
        recent_artifacts: [],
        recent_workflow_runs: [],
        workflow_recommendations: [],
        workflow_executor_recommendations: [],
        workflow_stage_executor_recommendations: [],
        workflow_friction_recommendations: [],
        approval_friction_recommendations: [],
        route_outcomes: [
          {
            executor: 'external_executor',
            source: 'workflow_memory',
            source_surface: 'telegram',
            strategy: 'workflow_resume',
            workflow_name: 'ship',
            task_kind: 'code',
            task_subtype: 'implementation',
            total_count: 3,
            completed_count: 3,
            failed_count: 0,
            approval_pending_count: 0,
            approval_granted_count: 2,
            approval_rejected_count: 0,
            permission_pending_count: 0,
            permission_granted_count: 1,
            permission_rejected_count: 0,
            gated_completion_count: 2,
            gated_artifactful_count: 2,
            rejected_count: 0,
            high_risk_count: 0,
            artifactful_count: 3,
            workflow_recovered_count: 1,
            workflow_recovery_success_count: 1,
            workflow_recovery_artifactful_count: 1,
            average_duration_ms: 180000,
            average_approval_wait_ms: 8 * 60 * 1000,
            average_post_approval_recovery_ms: 10 * 60 * 1000,
            average_artifact_delivery_after_approval_ms: 12 * 60 * 1000,
            operator_cost_score: 30 * 60 * 1000,
            success_rate: 1,
            friction_rate: 0,
            last_seen_at: new Date().toISOString(),
            confidence: 'high',
            rationale: 'Closes quickly after approval and usually delivers in the same window.',
          },
          {
            executor: 'codex',
            source: 'workflow_memory',
            source_surface: 'telegram',
            strategy: 'workflow_resume',
            workflow_name: 'ship',
            task_kind: 'code',
            task_subtype: 'implementation',
            total_count: 2,
            completed_count: 2,
            failed_count: 0,
            approval_pending_count: 0,
            approval_granted_count: 2,
            approval_rejected_count: 0,
            permission_pending_count: 0,
            permission_granted_count: 0,
            permission_rejected_count: 0,
            gated_completion_count: 2,
            gated_artifactful_count: 1,
            rejected_count: 0,
            high_risk_count: 0,
            artifactful_count: 2,
            workflow_recovered_count: 0,
            workflow_recovery_success_count: 0,
            workflow_recovery_artifactful_count: 0,
            average_duration_ms: 180000,
            average_approval_wait_ms: 6 * 60 * 60 * 1000,
            average_post_approval_recovery_ms: 2 * 60 * 60 * 1000,
            average_artifact_delivery_after_approval_ms: 3 * 60 * 60 * 1000,
            operator_cost_score: 11 * 60 * 60 * 1000,
            success_rate: 1,
            friction_rate: 0,
            last_seen_at: new Date().toISOString(),
            confidence: 'medium',
            rationale: 'Conclui, mas ainda custa horas do operador depois do gate.',
          },
        ],
        continuity_recommendations: [],
        autonomous_outcomes: [],
        autonomous_mode_recommendations: [],
        direct_response_style_recommendations: [],
        last_successful_task: null,
        summary: 'Workspace entrega',
      } as any,
    });

    expect(advice.executor).toBe('external_executor');
    expect(advice.rationale.join(' ')).toContain('gate humano');
    expect(advice.rationale.join(' ')).toContain('recuperou interrupcoes recentes');
  });
});
