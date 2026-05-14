import type { SkillMetadata } from '../../src/skills/SkillLoader';
import { ComposerCatalogService } from '../../src/services/ComposerCatalogService';

describe('ComposerCatalogService', () => {
  it('builds a semantically useful catalog for the current web session', async () => {
    const taskManager = {
      getRecentTasksByChat: jest.fn().mockReturnValue([
        {
          task_id: 'task-123456789',
          status: 'running',
          raw_message: '/plan revisar o repo',
          normalized_message: '/plan revisar o repo',
          command_type: '/plan',
          executor_used: 'codex',
          workspace: 'C:/repo',
          metadata: {
            workflow_run_id: 'wf-ship-demo-001',
            workflow_trigger_feature_id: null,
          },
          target_files: ['C:/repo/src/index.ts'],
          artifacts: [
            {
              id: 'artifact-123',
              key: 'build-log',
              type: 'document',
              kind: 'report',
              name: 'build.log',
              source: 'local',
              path: 'C:/repo/output/build.log',
              url: null,
              mimeType: 'text/plain',
              summary: 'Log principal do build.',
              description: null,
              previewText: null,
              sizeBytes: 2048,
              exists: true,
              deliveryChannel: 'document',
              createdAt: '2026-03-29T00:00:00.000Z',
            },
          ],
        },
      ]),
    };
    const permissionService = {
      listRequests: jest.fn().mockResolvedValue([
        {
          permission_id: 'perm-123456789',
          task_id: 'task-123456789',
          executor: 'zavorthBridge',
          kind: 'ui_permission',
          scope: 'session',
          status: 'pending',
          reason: 'Abrir a UI remota para continuar a tarefa',
          requested_value: null,
          resolved_value: null,
          workspace: null,
          created_at: '2026-03-29T00:00:00.000Z',
          updated_at: '2026-03-29T00:00:00.000Z',
          requested_by: null,
          decided_by: null,
          decision_note: null,
          metadata: {},
        },
      ]),
    };
    const loadSkills = () =>
      [
        {
          name: 'debugging',
          description: 'Ajuda a investigar bugs e falhas.',
          dirPath: 'C:/skills/debugging',
          skillFilePath: 'C:/skills/debugging/SKILL.md',
          supportFilePaths: [],
        },
      ] as SkillMetadata[];
    const workflowRunService = {
      getRun: jest.fn().mockReturnValue({
        workflow_run_id: 'wf-ship-demo-001',
        workflow_name: 'ship',
        objective: 'Fechar entrega final.',
        workspace: 'C:/repo',
        workspace_context: null,
        created_at: '2026-03-29T00:00:00.000Z',
        updated_at: '2026-03-29T00:00:00.000Z',
        status: 'approval_pending',
        stages: [
          {
            id: 'maker',
            label: 'Codex Maker',
            executor: 'codex',
            role: 'maker',
            strategy_note: 'Implementacao inicial ja foi concluida.',
            index: 0,
            status: 'completed',
            task_id: 'task-123456789',
            attempt_count: 1,
            objective: 'Implementar a entrega final.',
            handoff_summary: 'Implementacao concluida e pronta para revisao.',
            started_at: '2026-03-29T00:00:00.000Z',
            finished_at: '2026-03-29T00:01:00.000Z',
            result_summary: 'Implementacao concluida.',
            artifact_count: 1,
          },
          {
            id: 'review',
            label: 'Revisao final',
            executor: 'external_executor',
            role: 'reviewer',
            strategy_note: 'Revisar com outro executor antes de publicar.',
            index: 1,
            status: 'approval_pending',
            task_id: 'task-123456789',
            attempt_count: 1,
            objective: 'Revisar a entrega final.',
            handoff_summary: 'Validar antes de publicar.',
            started_at: '2026-03-29T00:01:00.000Z',
            finished_at: null,
            result_summary: 'Aguardando confirmacao.',
            artifact_count: 0,
          },
        ],
        resume_stage: {
          id: 'review',
          label: 'Revisao final',
          executor: 'external_executor',
          strategy_note: 'Revisar com outro executor antes de publicar.',
          status: 'approval_pending',
          index: 1,
          attempt_count: 1,
          task_id: 'task-123456789',
          objective: 'Revisar a entrega final.',
          handoff_summary: 'Validar antes de publicar.',
          result_summary: 'Aguardando confirmacao.',
          reason: 'aguarda sua confirmacao para seguir',
        },
        resume_prompt: 'Retome o workflow ship pela etapa Revisao final.',
        artifacts: [],
        artifacts_manifest: {},
      }),
    };

    const service = new ComposerCatalogService({
      taskManager: taskManager as any,
      permissionService: permissionService as any,
      commandCatalog: [
        {
          command: 'plan',
          description: 'Planeja antes de executar.',
          section: 'execution',
          usage: '<tarefa>',
        },
      ],
      commandAliases: {
        '/p': '/plan',
      },
      loadSkills,
      workflowRunService: workflowRunService as any,
    });

    const catalog = await service.getCatalog('web:session-1');

    expect(catalog.commands).toHaveLength(1);
    expect(catalog.commands[0]).toMatchObject({
      id: '/plan',
      label: '/plan',
      type: 'command',
      aliases: ['/p'],
    });

    expect(catalog.skills).toHaveLength(1);
    expect(catalog.skills[0]).toMatchObject({
      id: 'debugging',
      label: '@debugging',
      type: 'skill',
    });

    expect(catalog.recentTasks).toHaveLength(1);
    expect(catalog.recentTasks[0]).toMatchObject({
      id: 'task-123456789',
      label: '#task-123',
      type: 'task',
    });
    expect(catalog.recentTasks[0].payload).toMatchObject({
      taskId: 'task-123456789',
      shortId: 'task-123',
      workflowRunId: 'wf-ship-demo-001',
      workflowFeatureId: null,
    });

    expect(catalog.pendingPermissions).toHaveLength(1);
    expect(catalog.pendingPermissions[0]).toMatchObject({
      id: 'perm-123456789',
      label: '#perm:perm-123',
      type: 'permission',
    });

    expect(catalog.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'artifact',
          label: '#artifact:build-log',
        }),
      ]),
    );
    expect(catalog.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'file',
          label: '#file:index.ts',
        }),
      ]),
    );

    expect(catalog.suggestedActions.map((item) => item.type)).toEqual(
      expect.arrayContaining(['action']),
    );
    expect(catalog.suggestedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: expect.stringContaining('Revisao final'),
          payload: expect.objectContaining({
            action: 'resume_workflow',
            workflowRunId: 'wf-ship-demo-001',
            resumeStageLabel: 'Revisao final',
            resumeStageReason: 'aguarda sua confirmacao para seguir',
            resumePrompt: 'Retome o workflow ship pela etapa Revisao final.',
          }),
        }),
        expect.objectContaining({
          label: '#retomar-etapa:revisao-final',
          description: expect.stringContaining('diretamente pela etapa Revisao final'),
          payload: expect.objectContaining({
            action: 'resume_workflow',
            workflowRunId: 'wf-ship-demo-001',
            resumeStageId: 'review',
            resumeStageLabel: 'Revisao final',
          }),
        }),
        expect.objectContaining({
          label: '#reiniciar-etapa:codex-maker',
          description: 'Reexecutar o workflow a partir da etapa Codex Maker',
          payload: expect.objectContaining({
            action: 'restart_workflow_stage',
            workflowRunId: 'wf-ship-demo-001',
            resumeStageId: 'maker',
            resumeStageLabel: 'Codex Maker',
          }),
        }),
        expect.objectContaining({
          payload: expect.objectContaining({
            action: 'approve_permission',
            scope: 'once',
          }),
        }),
        expect.objectContaining({
          payload: expect.objectContaining({
            action: 'attach_artifact_context',
          }),
        }),
        expect.objectContaining({
          payload: expect.objectContaining({
            action: 'compose_followup',
            draftMessage: expect.stringContaining('use este artefato como contexto principal'),
            attachedMentions: expect.arrayContaining([
              expect.objectContaining({
                payload: expect.objectContaining({
                  action: 'attach_artifact_context',
                }),
              }),
            ]),
          }),
        }),
        expect.objectContaining({
          payload: expect.objectContaining({
            action: 'describe_artifact',
          }),
        }),
        expect.objectContaining({
          payload: expect.objectContaining({
            action: 'redeliver_artifact',
          }),
        }),
        expect.objectContaining({
          payload: expect.objectContaining({
            action: 'attach_file_context',
          }),
        }),
        expect.objectContaining({
          payload: expect.objectContaining({
            action: 'compose_followup',
            draftMessage: expect.stringContaining('revise este arquivo'),
            attachedMentions: expect.arrayContaining([
              expect.objectContaining({
                payload: expect.objectContaining({
                  action: 'attach_file_context',
                }),
              }),
            ]),
          }),
        }),
        expect.objectContaining({
          payload: expect.objectContaining({
            action: 'describe_file',
          }),
        }),
      ]),
    );
    expect(permissionService.listRequests).toHaveBeenCalledWith('pending', 50);
  });

  it('still returns commands and skills without chat context', async () => {
    const service = new ComposerCatalogService({
      commandCatalog: [
        {
          command: 'status',
          description: 'Mostra a saude do runtime.',
          section: 'monitoring',
        },
      ],
      loadSkills: () =>
        [
          {
            name: 'system-design',
            description: 'Ajuda com arquitetura.',
            dirPath: 'C:/skills/system-design',
            skillFilePath: 'C:/skills/system-design/SKILL.md',
            supportFilePaths: [],
          },
        ] as SkillMetadata[],
    });

    const catalog = await service.getCatalog();

    expect(catalog.commands).toHaveLength(1);
    expect(catalog.skills).toHaveLength(1);
    expect(catalog.recentTasks).toEqual([]);
    expect(catalog.pendingPermissions).toEqual([]);
    expect(catalog.artifacts).toEqual([]);
    expect(catalog.files).toEqual([]);
  });

  it('suggests a direct SDD workflow follow-up when the recent workflow targets a feature', async () => {
    const taskManager = {
      getRecentTasksByChat: jest.fn().mockReturnValue([
        {
          task_id: 'task-sdd-123456',
          status: 'completed',
          raw_message: '/workflow sdd multisurface/shared-command-contract',
          normalized_message: '/workflow sdd multisurface/shared-command-contract',
          command_type: '/workflow',
          executor_used: 'codex',
          workspace: 'C:/repo',
          metadata: {
            workflow_run_id: 'wf-sdd-demo-001',
            workflow_trigger_feature_id: 'multisurface/shared-command-contract',
          },
          target_files: [],
          artifacts: [],
        },
      ]),
    };
    const workflowRunService = {
      getRun: jest.fn().mockReturnValue({
        workflow_run_id: 'wf-sdd-demo-001',
        workflow_name: 'sdd',
        objective: 'Executar o loop SDD da feature.',
        workspace: 'C:/repo',
        origin: {},
        trigger: {
          feature_id: 'multisurface/shared-command-contract',
        },
        workspace_context: null,
        created_at: '2026-04-03T00:00:00.000Z',
        updated_at: '2026-04-03T00:00:00.000Z',
        status: 'completed',
        stages: [],
        resume_stage: null,
        resume_prompt: null,
        artifacts: [],
        artifacts_manifest: {},
      }),
    };

    const service = new ComposerCatalogService({
      taskManager: taskManager as any,
      permissionService: {
        listRequests: jest.fn().mockResolvedValue([]),
      } as any,
      commandCatalog: [],
      loadSkills: () => [],
      workflowRunService: workflowRunService as any,
    });

    const catalog = await service.getCatalog('web:session-sdd');

    expect(catalog.recentTasks[0].payload).toMatchObject({
      workflowRunId: 'wf-sdd-demo-001',
      workflowFeatureId: 'multisurface/shared-command-contract',
    });
    expect(catalog.suggestedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: expect.stringContaining('#workflow-sdd:'),
          description: expect.stringContaining('loop SDD'),
          payload: expect.objectContaining({
            action: 'compose_followup',
            draftMessage: '/workflow sdd multisurface/shared-command-contract',
            workflowFeatureId: 'multisurface/shared-command-contract',
            attachedMentions: [],
          }),
        }),
      ]),
    );
  });

  it('offers close for blocked workflows and removes resume hints after operator close', async () => {
    const taskManager = {
      getRecentTasksByChat: jest.fn().mockReturnValue([
        {
          task_id: 'task-123456789',
          status: 'blocked',
          raw_message: '/workflow ship fechar entrega final',
          normalized_message: '/workflow ship fechar entrega final',
          command_type: '/workflow',
          executor_used: 'codex',
          workspace: 'C:/repo',
          metadata: {
            workflow_run_id: 'wf-ship-demo-002',
          },
          target_files: [],
          artifacts: [],
        },
      ]),
    };
    const permissionService = {
      listRequests: jest.fn().mockResolvedValue([]),
    };
    const workflowRunService = {
      getRun: jest.fn()
        .mockReturnValueOnce({
          workflow_run_id: 'wf-ship-demo-002',
          workflow_name: 'ship',
          status: 'blocked',
          operator_state: 'active',
          trigger: {},
          resume_stage: {
            id: 'delivery',
            label: 'Entrega final',
            reason: 'Bloqueado aguardando decisao do operador.',
          },
          resume_prompt: 'Retome o workflow ship pela etapa Entrega final.',
          stages: [],
        })
        .mockReturnValueOnce({
          workflow_run_id: 'wf-ship-demo-002',
          workflow_name: 'ship',
          status: 'blocked',
          operator_state: 'closed',
          trigger: {},
          resume_stage: null,
          resume_prompt: null,
          stages: [],
        }),
    };

    const service = new ComposerCatalogService({
      taskManager: taskManager as any,
      permissionService: permissionService as any,
      commandCatalog: [],
      commandAliases: {},
      loadSkills: () => [],
      workflowRunService: workflowRunService as any,
    });

    const blockedCatalog = await service.getCatalog('web:session-blocked');
    expect(blockedCatalog.suggestedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: '#encerrar-workflow:wf-ship-demo-002',
          payload: expect.objectContaining({
            action: 'close_workflow',
            workflowRunId: 'wf-ship-demo-002',
          }),
        }),
        expect.objectContaining({
          label: '#retomar-workflow:wf-ship-demo-002',
        }),
      ]),
    );

    const closedCatalog = await service.getCatalog('web:session-closed');
    expect(closedCatalog.suggestedActions.some((item) => item.label === '#retomar-workflow:wf-ship-demo-002')).toBe(false);
    expect(closedCatalog.suggestedActions.some((item) => item.label === '#encerrar-workflow:wf-ship-demo-002')).toBe(false);
  });
});
