import fs from 'fs';
import os from 'os';
import path from 'path';
import { MultiAgentPipeline } from '../../src/services/MultiAgentPipeline';
import { WorkflowRunService } from '../../src/services/WorkflowRunService';

describe('MultiAgentPipeline', () => {
  it('routes maker and reviewer through the execution gateway with explicit ExternalExecutor bindings', async () => {
    const submit = jest
      .fn()
      .mockResolvedValueOnce({
        requires_confirmation: false,
        allowed: true,
        reason: 'ok',
        execution_result: {
          success: true,
          stdout: 'maker stdout',
          stderr: '',
          artifacts: [
            {
              key: 'maker-report',
              name: 'maker-report.md',
              url: 'https://example.com/maker-report.md',
              kind: 'report',
              type: 'file',
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        requires_confirmation: false,
        allowed: true,
        reason: 'ok',
        execution_result: {
          success: true,
          stdout: 'reviewer stdout',
          stderr: '',
          artifacts: [
            {
              key: 'review-findings',
              name: 'review-findings.md',
              url: 'https://example.com/review-findings.md',
              kind: 'report',
              type: 'file',
            },
          ],
        },
      });

    const pipeline = new MultiAgentPipeline({ submit } as any);
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await pipeline.runReviewPipeline(ctx, 'Revisar modulo', 'C:/repo');

    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({
          workflow_run_id: expect.stringMatching(/^wf-review-/),
          external_executor_agent_id: 'maker',
          external_executor_agent_role: 'maker',
          target_agent: 'maker',
        }),
      }),
    );
    expect(submit.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        executor_recommendation: 'external_executor',
        steps: [
          expect.objectContaining({
            type: 'exec',
          }),
        ],
      }),
    );
    expect(submit.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({
          external_executor_agent_id: 'reviewer',
          external_executor_agent_role: 'reviewer',
          target_agent: 'reviewer',
        }),
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('O que vai acontecer:'),
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Workflow concluido com todas as etapas finalizadas.'),
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Entregas agregadas: 2'),
    );
  });

  it('runs the ship workflow with Codex first and ExternalExecutor reviewer second', async () => {
    const submit = jest
      .fn()
      .mockResolvedValueOnce({
        requires_confirmation: false,
        allowed: true,
        reason: 'ok',
        execution_result: {
          success: true,
          stdout: 'codex implementation result',
          stderr: '',
        },
      })
      .mockResolvedValueOnce({
        requires_confirmation: false,
        allowed: true,
        reason: 'ok',
        execution_result: {
          success: true,
          stdout: 'external_executor review result',
          stderr: '',
        },
      });

    const pipeline = new MultiAgentPipeline({ submit } as any);
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await pipeline.runWorkflow(ctx, 'ship', 'Implemente o fluxo de login', 'C:/repo');

    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        executor_recommendation: 'codex',
      }),
    );
    expect(submit.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        executor_recommendation: 'external_executor',
      }),
    );
    expect(submit.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({
          workflow_name: 'ship',
          external_executor_agent_role: 'reviewer',
        }),
      }),
    );
  });

  it('runs the research workflow with AI Studio followed by Codex synthesis', async () => {
    const submit = jest
      .fn()
      .mockResolvedValueOnce({
        requires_confirmation: false,
        allowed: true,
        reason: 'ok',
        execution_result: {
          success: true,
          stdout: 'pesquisa com tres pontos principais',
          stderr: '',
        },
      })
      .mockResolvedValueOnce({
        requires_confirmation: false,
        allowed: true,
        reason: 'ok',
        execution_result: {
          success: true,
          stdout: 'briefing final curto',
          stderr: '',
        },
      });

    const pipeline = new MultiAgentPipeline({ submit } as any);
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await pipeline.runWorkflow(ctx, 'research', 'Pesquise o mercado de IA local', 'C:/repo');

    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        executor_recommendation: 'aistudio',
      }),
    );
    expect(submit.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        executor_recommendation: 'codex',
      }),
    );
    expect(submit.mock.calls[1][1].objective).toContain('pesquisa com tres pontos principais');
  });

  it('runs an SDD loop as a native one-stage workflow and syncs the handoff back to the feature workspace', async () => {
    const submit = jest.fn().mockResolvedValue({
      requires_confirmation: false,
      allowed: true,
      reason: 'ok',
      execution_result: {
        success: true,
        stdout: 'task do contrato executada com sucesso',
        stderr: '',
      },
    });

    const inspect = jest.fn(() => ({
      featureId: 'multisurface/shared-command-contract',
      title: 'Contrato oficial de comandos compartilhados',
      lifecycle: 'active',
      nextRole: 'execution',
      currentTask: 'Integrar o core ao contrato',
      openTaskCount: 1,
      completedTaskCount: 6,
      paths: {
        featureId: 'multisurface/shared-command-contract',
        featureDir: 'C:/tmp/zavorth/specs/features/multisurface/shared-command-contract',
        specFile: 'C:/tmp/zavorth/specs/features/multisurface/shared-command-contract/spec.md',
        planFile: 'C:/tmp/zavorth/specs/features/multisurface/shared-command-contract/plan.md',
        tasksFile: 'C:/tmp/zavorth/specs/features/multisurface/shared-command-contract/tasks.md',
        runStateFile: 'C:/tmp/zavorth/specs/features/multisurface/shared-command-contract/run-state.json',
        handoffFile: 'C:/tmp/zavorth/specs/features/multisurface/shared-command-contract/handoff.md',
      },
      brief: {
        role: 'execution',
        label: 'Execution Agent',
        purpose: 'Implementar a task ativa.',
        writeScope: [
          'C:/tmp/zavorth/specs/features/multisurface/shared-command-contract/tasks.md',
          'C:\\workspace\\zavorth-core\\Zavorth\\src\\services\\SharedSurfaceCommandContract.ts',
        ],
        checklist: [
          'Executar a task ativa.',
          'Respeitar o spec e o plan.',
        ],
        prompt: 'Papel: Execution Agent\nTask ativa: Integrar o core ao contrato',
      },
      runState: {
        featureId: 'multisurface/shared-command-contract',
        title: 'Contrato oficial de comandos compartilhados',
        lifecycle: 'active',
        currentRole: 'execution',
        currentTask: 'Integrar o core ao contrato',
        updatedAt: '2026-04-03T05:00:00.000Z',
        startedAt: '2026-04-03T04:59:00.000Z',
        lastActor: 'system',
        note: 'Proxima execucao sugerida: Integrar o core ao contrato',
      },
    }));
    const handoff = jest.fn(() => ({
      featureId: 'multisurface/shared-command-contract',
      title: 'Contrato oficial de comandos compartilhados',
      lifecycle: 'in_review',
      nextRole: 'review',
      currentTask: null,
      openTaskCount: 0,
      completedTaskCount: 7,
      paths: {
        featureId: 'multisurface/shared-command-contract',
        featureDir: 'C:/tmp/zavorth/specs/features/multisurface/shared-command-contract',
        specFile: 'C:/tmp/zavorth/specs/features/multisurface/shared-command-contract/spec.md',
        planFile: 'C:/tmp/zavorth/specs/features/multisurface/shared-command-contract/plan.md',
        tasksFile: 'C:/tmp/zavorth/specs/features/multisurface/shared-command-contract/tasks.md',
        runStateFile: 'C:/tmp/zavorth/specs/features/multisurface/shared-command-contract/run-state.json',
        handoffFile: 'C:/tmp/zavorth/specs/features/multisurface/shared-command-contract/handoff.md',
      },
      brief: {
        role: 'review',
        label: 'Review Agent',
        purpose: 'Validar a feature.',
        writeScope: [],
        checklist: ['Validar spec, plan e tasks.'],
        prompt: 'Papel: Review Agent',
      },
      runState: {
        featureId: 'multisurface/shared-command-contract',
        title: 'Contrato oficial de comandos compartilhados',
        lifecycle: 'in_review',
        currentRole: 'review',
        currentTask: null,
        updatedAt: '2026-04-03T05:05:00.000Z',
        startedAt: '2026-04-03T04:59:00.000Z',
        lastActor: 'codex',
        note: 'task do contrato executada com sucesso',
      },
    }));

    const pipeline = new MultiAgentPipeline(
      { submit } as any,
      {
        workflowRuns: new WorkflowRunService({ persist: false }),
        sddOrchestrator: { inspect, handoff, isKnownFeature: jest.fn(() => true) } as any,
      },
    );
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await pipeline.runSddLoop(ctx, 'multisurface/shared-command-contract', 'C:/repo');

    expect(inspect).toHaveBeenCalledWith('multisurface/shared-command-contract');
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({
          workflow_name: 'sdd',
          workflow_trigger_feature_id: 'multisurface/shared-command-contract',
          workflow_trigger_task_kind: 'sdd_loop',
          workflow_trigger_task_subtype: 'execution',
          target_agent: 'execution',
          workflow_write_scope: [
            'C:/tmp/zavorth/specs/features/multisurface/shared-command-contract/tasks.md',
            'C:\\workspace\\zavorth-core\\Zavorth\\src\\services\\SharedSurfaceCommandContract.ts',
          ],
          workflow_write_scope_enforced: true,
          extra_allowed_paths: [
            'C:/tmp/zavorth/specs/features/multisurface/shared-command-contract/tasks.md',
            'C:\\workspace\\zavorth-core\\Zavorth\\src\\services\\SharedSurfaceCommandContract.ts',
          ],
          extra_allowed_path_policies: expect.arrayContaining([
            expect.objectContaining({
              path: 'C:/repo',
              access_level: 'read_only',
            }),
            expect.objectContaining({
              path: 'C:/tmp/zavorth/specs/features/multisurface/shared-command-contract/tasks.md',
              access_level: 'read_write',
            }),
            expect.objectContaining({
              path: 'C:\\workspace\\zavorth-core\\Zavorth\\src\\services\\SharedSurfaceCommandContract.ts',
              access_level: 'read_write',
            }),
          ]),
        }),
      }),
    );
    expect(submit.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        executor_recommendation: 'codex',
        objective: expect.stringContaining('Voce esta operando o loop SDD da feature multisurface/shared-command-contract.'),
        steps: [
          expect.objectContaining({
            file_targets: [
              'C:/tmp/zavorth/specs/features/multisurface/shared-command-contract/tasks.md',
              'C:\\workspace\\zavorth-core\\Zavorth\\src\\services\\SharedSurfaceCommandContract.ts',
            ],
          }),
        ],
        notes: expect.arrayContaining([
          'feature=multisurface/shared-command-contract',
          expect.stringContaining('write_scope='),
        ]),
      }),
    );
    expect(handoff).toHaveBeenCalledWith('multisurface/shared-command-contract', expect.objectContaining({
      role: 'execution',
      actor: 'codex',
      summary: 'task do contrato executada com sucesso',
    }));
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Workflow preparado: Loop SDD orientado por papeis'),
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('SDD atualizado para multisurface/shared-command-contract.'),
    );
  });

  it('blocks /workflow sdd when the feature is not scaffolded yet', async () => {
    const submit = jest.fn();
    const pipeline = new MultiAgentPipeline(
      { submit } as any,
      {
        workflowRuns: new WorkflowRunService({ persist: false }),
        sddOrchestrator: {
          isKnownFeature: jest.fn(() => false),
          inspect: jest.fn(),
          handoff: jest.fn(),
        } as any,
      },
    );
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await pipeline.runSddLoop(ctx, 'sandbox/ghost-feature', 'C:/repo');

    expect(submit).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('ainda nao existe no workspace SDD oficial'),
    );
  });

  it('surfaces gateway blocks before running the agent', async () => {
    const submit = jest.fn().mockResolvedValue({
      requires_confirmation: false,
      allowed: false,
      reason: "Executor 'external_executor' indisponivel neste host.",
      execution_result: null,
    });

    const pipeline = new MultiAgentPipeline({ submit } as any);
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await pipeline.runReviewPipeline(ctx, 'Revisar modulo', 'C:/repo');

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("A etapa ExternalExecutor Maker foi bloqueada antes de executar."),
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Workflow interrompido antes do fechamento completo.'),
    );
  });

  it('surfaces ExternalExecutor workspace mismatches from the gateway-backed execution', async () => {
    const submit = jest.fn().mockResolvedValue({
      requires_confirmation: false,
      allowed: true,
      reason: 'Execucao falhou',
      execution_result: {
        success: false,
        error_code: 'EXTERNAL_EXECUTOR_WORKSPACE_MISMATCH',
        error_message: 'O agente do ExternalExecutor esta preso a outro workspace.',
        stderr: '',
      },
    });

    const pipeline = new MultiAgentPipeline({ submit } as any);
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await pipeline.runReviewPipeline(ctx, 'Revisar modulo', 'C:/repo');

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('O agente do ExternalExecutor esta preso a outro workspace.'),
    );
  });

  it('threads workspace continuity context through workflow intro, stage objective and metadata', async () => {
    const submit = jest
      .fn()
      .mockResolvedValueOnce({
        requires_confirmation: false,
        allowed: true,
        reason: 'ok',
        execution_result: {
          success: true,
          stdout: 'pesquisa consolidada',
          stderr: '',
        },
      })
      .mockResolvedValueOnce({
        requires_confirmation: false,
        allowed: true,
        reason: 'ok',
        execution_result: {
          success: true,
          stdout: 'briefing final pronto',
          stderr: '',
        },
      });

    const pipeline = new MultiAgentPipeline({ submit } as any);
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await pipeline.runWorkflow(
      ctx,
      'research',
      'Pesquise o mercado local de IA',
      'C:/repo',
      {
        profile_summary: 'Workspace Zavorth com stack TypeScript e foco em runtime',
        operational_summary: 'Executor recente mais confiavel: codex',
        profile_notes: ['Perfis do workspace priorizam artefatos curtos.'],
        operational_notes: ['Memoria operacional sugere continuar o briefing aberto.'],
        active_focus: {
          summary: 'Concluir briefing de posicionamento',
          executor: 'codex',
          status: 'waiting_approval',
        },
        recent_artifact: {
          name: 'briefing-final.md',
          kind: 'doc',
          summary: 'Briefing em andamento',
        },
        continuity_recommendation: {
          label: 'Retomar briefing final',
          reason: 'Ja existe um briefing recente e uma aprovacao pendente.',
          executor: 'codex',
        },
      },
    );

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Contexto aproveitado:'),
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Foco ativo: Concluir briefing de posicionamento'),
    );
    expect(submit.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({
          workflow_workspace_context: expect.objectContaining({
            profile_summary: 'Workspace Zavorth com stack TypeScript e foco em runtime',
          }),
          workflow_workspace_context_summary: expect.stringContaining('foco Concluir briefing de posicionamento'),
        }),
      }),
    );
    expect(submit.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        context: expect.stringContaining('foco Concluir briefing de posicionamento'),
        objective: expect.stringContaining('Contexto do workspace:'),
        notes: expect.arrayContaining([
          expect.stringContaining('workspace_focus=Concluir briefing de posicionamento'),
          expect.stringContaining('workspace_recent_artifact=briefing-final.md'),
        ]),
      }),
    );
  });

  it('adapts workflow stages to the preferred workspace executor and recent artifact context', async () => {
    const submit = jest
      .fn()
      .mockResolvedValueOnce({
        requires_confirmation: false,
        allowed: true,
        reason: 'ok',
        execution_result: {
          success: true,
          stdout: 'implementacao concluida',
          stderr: '',
        },
      })
      .mockResolvedValueOnce({
        requires_confirmation: false,
        allowed: true,
        reason: 'ok',
        execution_result: {
          success: true,
          stdout: 'revisao concluida',
          stderr: '',
        },
      });

    const pipeline = new MultiAgentPipeline({ submit } as any);
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await pipeline.runWorkflow(
      ctx,
      'ship',
      'Feche a entrega final do pacote',
      'C:/repo',
      {
        profile_summary: 'Workspace Zavorth focado em entrega controlada',
        operational_summary: 'Ultimas entregas fecharam melhor com ExternalExecutor no papel de maker',
        profile_notes: [],
        operational_notes: [],
        active_focus: {
          summary: 'Concluir entrega final do pacote',
          executor: 'external_executor',
          status: 'running',
        },
        recent_artifact: {
          name: 'release-checklist.md',
          kind: 'doc',
          summary: 'Checklist final da entrega',
        },
        continuity_recommendation: {
          label: 'Fechar entrega final',
          reason: 'Ja existe checklist recente e um foco claro de conclusao.',
          executor: 'external_executor',
        },
      },
    );

    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        executor_recommendation: 'external_executor',
        objective: expect.stringContaining('Use release-checklist.md como base e preserve consistencia com a entrega recente.'),
      }),
    );
    expect(submit.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        executor_recommendation: 'codex',
        objective: expect.stringContaining('Confirme se o resultado continua coerente com release-checklist.md.'),
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('ExternalExecutor Maker'),
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Codex Reviewer'),
    );
  });

  it('resumes a persisted workflow from the interrupted stage and completes the remaining steps', async () => {
    const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-workflow-resume-'));
    const workflowRuns = new WorkflowRunService({
      storageDir,
      persist: true,
    });
    const submit = jest
      .fn()
      .mockResolvedValueOnce({
        requires_confirmation: false,
        allowed: true,
        reason: 'ok',
        execution_result: {
          success: true,
          stdout: 'implementacao pronta',
          stderr: '',
          artifacts: [],
        },
      })
      .mockResolvedValueOnce({
        requires_confirmation: false,
        allowed: false,
        reason: 'Reviewer aguardando liberacao de acesso.',
        execution_result: null,
      })
      .mockResolvedValueOnce({
        requires_confirmation: false,
        allowed: true,
        reason: 'ok',
        execution_result: {
          success: true,
          stdout: 'revisao final concluida',
          stderr: '',
          artifacts: [],
        },
      });

    const pipeline = new MultiAgentPipeline({ submit } as any, { workflowRuns });
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await pipeline.runWorkflow(ctx, 'ship', 'Feche a entrega final', 'C:/repo');

    const workflowRunId = submit.mock.calls[0][0].metadata.workflow_run_id;
    expect(workflowRuns.getRun(workflowRunId)?.status).toBe('blocked');

    await pipeline.resumeWorkflow(ctx, workflowRunId);

    expect(submit).toHaveBeenCalledTimes(3);
    expect(submit.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({
          workflow_stage_id: 'reviewer',
        }),
      }),
    );
    expect(submit.mock.calls[2][0]).toEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({
          workflow_stage_id: 'reviewer',
        }),
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining(`Retomando workflow ${workflowRunId}.`),
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Workflow concluido com todas as etapas finalizadas.'),
    );
    expect(workflowRuns.getRun(workflowRunId)?.status).toBe('completed');
  });

  it('resumes a non-SDD workflow with the persisted executor plan even if workspace recommendations change later', async () => {
    const submit = jest
      .fn()
      .mockResolvedValueOnce({
        requires_confirmation: false,
        allowed: true,
        reason: 'ok',
        execution_result: {
          success: true,
          stdout: 'implementacao concluida',
          stderr: '',
          artifacts: [],
        },
      })
      .mockResolvedValueOnce({
        requires_confirmation: false,
        allowed: false,
        reason: 'Reviewer aguardando liberacao de acesso.',
        execution_result: null,
      })
      .mockResolvedValueOnce({
        requires_confirmation: false,
        allowed: true,
        reason: 'ok',
        execution_result: {
          success: true,
          stdout: 'revisao final concluida',
          stderr: '',
          artifacts: [],
        },
      });

    const workflowRuns = new WorkflowRunService({ persist: false });
    const pipeline = new MultiAgentPipeline({ submit } as any, { workflowRuns });
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await pipeline.runWorkflow(ctx, 'ship', 'Feche a entrega final', 'C:/repo');

    const workflowRunId = submit.mock.calls[0][0].metadata.workflow_run_id;
    expect(workflowRuns.getRun(workflowRunId)?.phases[1]).toEqual(
      expect.objectContaining({
        id: 'reviewer',
        executor: 'external_executor',
        strategy_note: 'Mantendo contraste entre etapas para revisar com outro executor.',
      }),
    );

    await pipeline.resumeWorkflow(ctx, workflowRunId, {
      workspaceContext: {
        profile_summary: 'Workspace mudou de contexto desde a primeira tentativa',
        operational_summary: 'Agora o workspace prefere Codex para revisao',
        profile_notes: [],
        operational_notes: [],
        active_focus: null,
        recent_artifact: null,
        continuity_recommendation: null,
        workflow_executor_recommendations: [
          {
            workflow: 'ship',
            executor: 'codex',
            success_count: 8,
            pending_count: 0,
            failed_count: 0,
            confidence: 'high',
            rationale: 'Codex fechou bem as ultimas entregas.',
          },
        ],
        workflow_stage_executor_recommendations: [
          {
            workflow: 'ship',
            role: 'reviewer',
            executor: 'codex',
            success_count: 7,
            pending_count: 0,
            failed_count: 0,
            confidence: 'high',
            rationale: 'Codex virou o revisor preferido neste workspace.',
          },
        ],
        workflow_friction_recommendations: [],
        approval_friction_recommendations: [],
      },
    });

    expect(submit).toHaveBeenCalledTimes(3);
    expect(submit.mock.calls[2][1]).toEqual(
      expect.objectContaining({
        executor_recommendation: 'external_executor',
      }),
    );
    expect(submit.mock.calls[2][0]).toEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({
          workflow_stage_id: 'reviewer',
          workflow_stage_strategy_note: 'Mantendo contraste entre etapas para revisar com outro executor.',
        }),
      }),
    );
    expect(workflowRuns.getRun(workflowRunId)?.status).toBe('completed');
  });

  it('avoids a friction-heavy synthesizer executor when research workflows keep stalling on synthesis', async () => {
    const submit = jest
      .fn()
      .mockResolvedValueOnce({
        requires_confirmation: false,
        allowed: true,
        reason: 'ok',
        execution_result: {
          success: true,
          stdout: 'pesquisa base pronta',
          stderr: '',
        },
      })
      .mockResolvedValueOnce({
        requires_confirmation: false,
        allowed: true,
        reason: 'ok',
        execution_result: {
          success: true,
          stdout: 'briefing final consolidado',
          stderr: '',
        },
      });

    const pipeline = new MultiAgentPipeline({ submit } as any);
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await pipeline.runWorkflow(
      ctx,
      'research',
      'Pesquise o posicionamento do Zavorth e entregue um briefing final',
      'C:/repo',
      {
        profile_summary: 'Workspace Zavorth orientado a briefing executivo',
        operational_summary: 'A sintese final costuma travar quando o fluxo fica preso no mesmo executor.',
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
          summary: 'Ultima entrega em andamento',
        },
        continuity_recommendation: {
          label: 'Retomar briefing final',
          reason: 'Ja existe um briefing recente aguardando consolidacao.',
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
            rationale: 'ExternalExecutor costuma sintetizar bem quando o fluxo nao pausa.',
          },
          {
            workflow: 'research',
            executor: 'codex',
            success_count: 3,
            pending_count: 0,
            failed_count: 0,
            confidence: 'medium',
            rationale: 'Codex fecha melhor quando a sintese precisa de uma rota mais estavel.',
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
            rationale: 'A sintese recente costuma pausar por aprovacao nessa etapa.',
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
            rationale: 'ExternalExecutor encontrou gates extras na consolidacao final.',
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
            rationale: 'Codex segue sem gates recentes nessa etapa.',
          },
        ],
      },
    );

    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        executor_recommendation: 'codex',
      }),
    );
    expect(submit.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({
          workflow_stage_strategy_note: expect.stringContaining('Workflow recente travou em ExternalExecutor Synthesizer'),
        }),
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Estrategia: Workflow recente travou em ExternalExecutor Synthesizer'),
    );
  });

  it('prefers a safer maker executor when workflow memory shows repeated friction for the recent favorite', async () => {
    const submit = jest
      .fn()
      .mockResolvedValueOnce({
        requires_confirmation: false,
        allowed: true,
        reason: 'ok',
        execution_result: {
          success: true,
          stdout: 'entrega estabilizada',
          stderr: '',
        },
      })
      .mockResolvedValueOnce({
        requires_confirmation: false,
        allowed: true,
        reason: 'ok',
        execution_result: {
          success: true,
          stdout: 'revisao concluida',
          stderr: '',
        },
      });

    const pipeline = new MultiAgentPipeline({ submit } as any);
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await pipeline.runWorkflow(
      ctx,
      'ship',
      'Feche a entrega final do runtime e deixe pronto para publicar',
      'C:/repo',
      {
        profile_summary: 'Workspace Zavorth com foco em entrega segura',
        operational_summary: 'O maker recente favorito passou a travar com gates demais.',
        profile_notes: [],
        operational_notes: [],
        active_focus: {
          summary: 'Concluir a entrega do runtime',
          executor: 'codex',
          status: 'running',
        },
        recent_artifact: {
          name: 'release-checklist.md',
          kind: 'doc',
          summary: 'Checklist final da entrega',
        },
        continuity_recommendation: {
          label: 'Seguir com a entrega do runtime',
          reason: 'O workspace ainda esta no mesmo ciclo de entrega.',
          executor: 'codex',
        },
        workflow_executor_recommendations: [
          {
            workflow: 'ship',
            executor: 'codex',
            success_count: 1,
            pending_count: 2,
            failed_count: 2,
            confidence: 'high',
            rationale: 'Codex vinha sendo o favorito recente, mas passou a travar a entrega.',
          },
          {
            workflow: 'ship',
            executor: 'external_executor',
            success_count: 4,
            pending_count: 0,
            failed_count: 0,
            confidence: 'high',
            rationale: 'ExternalExecutor fecha melhor quando a entrega precisa de menos friccao.',
          },
        ],
        workflow_friction_recommendations: [
          {
            workflow: 'ship',
            approval_pending_count: 1,
            blocked_count: 1,
            failed_count: 1,
            last_resume_stage_label: 'Codex Maker',
            confidence: 'medium',
            rationale: 'A maker stage recente precisou de retomada manual.',
          },
        ],
        approval_friction_recommendations: [
          {
            executor: 'codex',
            kind: 'delivery',
            subtype: 'shipping',
            pending_count: 2,
            rejected_count: 1,
            high_risk_count: 1,
            permission_count: 2,
            confidence: 'high',
            rationale: 'Codex acumulou mais checkpoints recentes nesta entrega.',
          },
          {
            executor: 'external_executor',
            kind: 'delivery',
            subtype: 'shipping',
            pending_count: 0,
            rejected_count: 0,
            high_risk_count: 0,
            permission_count: 0,
            confidence: 'medium',
            rationale: 'ExternalExecutor executou com fluxo mais limpo.',
          },
        ],
      },
    );

    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        executor_recommendation: 'external_executor',
      }),
    );
    expect(submit.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        executor_used: 'external_executor',
        metadata: expect.objectContaining({
          workflow_stage_strategy_note: expect.stringContaining('Workflow recente travou em Codex Maker'),
        }),
      }),
    );
  });

  it('uses stage-specific workflow memory when a synthesizer stage learned a better executor than the workflow average', async () => {
    const submit = jest
      .fn()
      .mockResolvedValueOnce({
        requires_confirmation: false,
        allowed: true,
        reason: 'ok',
        execution_result: {
          success: true,
          stdout: 'pesquisa exploratoria pronta',
          stderr: '',
        },
      })
      .mockResolvedValueOnce({
        requires_confirmation: false,
        allowed: true,
        reason: 'ok',
        execution_result: {
          success: true,
          stdout: 'briefing final entregue',
          stderr: '',
        },
      });

    const pipeline = new MultiAgentPipeline({ submit } as any);
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await pipeline.runWorkflow(
      ctx,
      'research',
      'Pesquise e sintetize o posicionamento do Zavorth',
      'C:/repo',
      {
        profile_summary: 'Workspace Zavorth com foco em briefing final',
        operational_summary: 'A sintese final vai melhor com um executor diferente do fluxo medio.',
        profile_notes: [],
        operational_notes: [],
        active_focus: null,
        recent_artifact: null,
        continuity_recommendation: null,
        workflow_executor_recommendations: [
          {
            workflow: 'research',
            executor: 'external_executor',
            success_count: 5,
            pending_count: 0,
            failed_count: 0,
            confidence: 'high',
            rationale: 'ExternalExecutor costuma performar bem no workflow research como um todo.',
          },
        ],
        workflow_stage_executor_recommendations: [
          {
            workflow: 'research',
            role: 'synthesizer',
            executor: 'codex',
            success_count: 3,
            pending_count: 0,
            failed_count: 0,
            confidence: 'high',
            rationale: 'Codex fecha melhor a etapa de sintese final.',
          },
        ],
        workflow_friction_recommendations: [],
        approval_friction_recommendations: [],
      },
    );

    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        executor_recommendation: 'codex',
      }),
    );
    expect(submit.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({
          workflow_stage_strategy_note: expect.stringContaining('Historico desta etapa favorece Codex para synthesizer'),
        }),
      }),
    );
  });
});
