import { MultiAgentWorkflowPlannerService } from '../../src/domain/execution/infrastructure/multi-agent-pipeline/MultiAgentWorkflowPlannerService';

describe('MultiAgentWorkflowPlannerService', () => {
  it('builds the default ship stages with codex maker and external_executor reviewer', () => {
    const planner = new MultiAgentWorkflowPlannerService();

    const stages = planner.buildWorkflowStages('ship');

    expect(stages).toHaveLength(2);
    expect(stages[0]).toEqual(
      expect.objectContaining({
        id: 'maker',
        executor: 'codex',
      }),
    );
    expect(stages[1]).toEqual(
      expect.objectContaining({
        id: 'reviewer',
        executor: 'external_executor',
      }),
    );
  });

  it('avoids a friction-heavy synthesizer executor when workspace memory points to a safer option', () => {
    const planner = new MultiAgentWorkflowPlannerService();

    const stages = planner.buildWorkflowStages('research', {
      profile_summary: 'Workspace Zavorth com foco em briefing final',
      operational_summary: 'A final synthesis trava quando insiste no mesmo executor.',
      profile_notes: [],
      operational_notes: [],
      active_focus: {
        summary: 'Consolidar o briefing final',
        executor: 'external_executor',
        status: 'approval_pending',
      },
      recent_artifact: {
        name: 'briefing-final.md',
        kind: 'doc',
        summary: 'Latest delivery in progress',
      },
      continuity_recommendation: {
        label: 'Retomar briefing final',
        reason: 'Ja existe um briefing recente waiting for consolidaction.',
        executor: 'external_executor',
      },
      workflow_executor_recommendations: [
        {
          workflow: 'research',
          executor: 'external_executor',
          success_count: 6,
          pending_count: 2,
          failed_count: 1,
          confidence: 'high',
          rationale: 'ExternalExecutor costuma sintetizar bem quando o fluxo not pausa.',
        },
        {
          workflow: 'research',
          executor: 'codex',
          success_count: 3,
          pending_count: 0,
          failed_count: 0,
          confidence: 'medium',
          rationale: 'Codex performs better when synthesis needs a more stable route.',
        },
      ],
      workflow_friction_recommendations: [
        {
          workflow: 'research',
          approval_pending_count: 2,
          blocked_count: 1,
          failed_count: 0,
          last_resume_stage_label: 'ExternalExecutor Synthesizer',
          confidence: 'high',
          rationale: 'Recent synthesis often pauses for approval at this stage.',
        },
      ],
      approval_friction_recommendations: [
        {
          executor: 'external_executor',
          kind: 'research',
          subtype: 'briefing',
          pending_count: 2,
          rejected_count: 0,
          high_risk_count: 0,
          permission_count: 1,
          confidence: 'high',
          rationale: 'ExternalExecutor encontrou gates extras na consolidaction final.',
        },
        {
          executor: 'codex',
          kind: 'research',
          subtype: 'briefing',
          pending_count: 0,
          rejected_count: 0,
          high_risk_count: 0,
          permission_count: 0,
          confidence: 'medium',
          rationale: 'Codex continues without recent gates at this stage.',
        },
      ],
    });

    expect(stages[1]).toEqual(
      expect.objectContaining({
        id: 'synthesizer',
        executor: 'codex',
        strategy_note: expect.stringContaining('Workflow recente travou em ExternalExecutor Synthesizer'),
      }),
    );
  });
});
