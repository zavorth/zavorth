import { ComposerActionService } from '../../src/services/ComposerActionService';

describe('ComposerActionService', () => {
  it('approves a permission action through the permission controller', async () => {
    const permissionController = {
      resolvePermissionReference: jest.fn().mockResolvedValue({
        permission_id: 'perm-123456789',
        task_id: 'task-123456789',
      }),
      shortPermissionId: jest.fn(() => 'perm-123'),
      handlePermissionCallback: jest.fn(async () => undefined),
    };
    const realtime = {
      captureBaseline: jest.fn(async () => undefined),
      getResolvedSnapshot: jest.fn(async () => ({ messages: [] })),
      recordAssistantMessage: jest.fn(),
    };
    const service = new ComposerActionService({
      permissionController: permissionController as any,
      taskManager: { getTask: jest.fn() } as any,
      realtime: realtime as any,
    });

    const result = await service.maybeHandle({
      sessionId: 'session-1',
      webContext: { reply: jest.fn(async () => ({})) },
      mentions: [
        {
          id: 'action:approve:perm-123456789',
          type: 'action',
          label: '#aprovar:perm-123',
          payload: {
            action: 'approve_permission',
            permissionId: 'perm-123456789',
            scope: 'once',
          },
        },
      ] as any,
    });

    expect(result).toMatchObject({
      handled: true,
      taskId: 'task-123456789',
    });
    expect(permissionController.resolvePermissionReference).toHaveBeenCalledWith('perm-123456789');
    expect(permissionController.handlePermissionCallback).toHaveBeenCalledWith(
      expect.any(Object),
      'perm:approve:perm-123:once',
    );
    expect(realtime.captureBaseline).toHaveBeenCalledWith('session-1');
  });

  it('returns a task summary when resuming a task action', async () => {
    const realtime = {
      captureBaseline: jest.fn(async () => undefined),
      getResolvedSnapshot: jest.fn(async () => ({ messages: [] })),
      recordAssistantMessage: jest.fn(),
    };
    const service = new ComposerActionService({
      permissionController: {
        resolvePermissionReference: jest.fn(),
        shortPermissionId: jest.fn(),
        handlePermissionCallback: jest.fn(),
      } as any,
      taskManager: {
        getTask: jest.fn(() => ({
          task_id: 'task-123456789',
          status: 'completed',
          raw_message: '/plan revisar o repo',
          normalized_message: '/plan revisar o repo',
          result_summary: 'Planejamento pronto.',
          error_summary: null,
          metadata: {},
        })),
      } as any,
      realtime: realtime as any,
    });

    const result = await service.maybeHandle({
      sessionId: 'session-2',
      webContext: {},
      mentions: [
        {
          id: 'action:resume:task-123456789',
          type: 'action',
          label: '#retomar:task-123',
          payload: {
            action: 'resume_task',
            taskId: 'task-123456789',
          },
        },
      ] as any,
    });

    expect(result).toMatchObject({
      handled: true,
      taskId: 'task-123456789',
    });
    expect(realtime.recordAssistantMessage).toHaveBeenCalledWith(
      'session-2',
      expect.stringContaining('A ultima tarefa ja terminou.'),
      'task-123456789',
      'task-status',
      [
        expect.objectContaining({
          id: 'action:resume:task-123456789',
          type: 'action',
        }),
      ],
    );
  });

  it('resumes a workflow action through the workflow controller', async () => {
    const realtime = {
      captureBaseline: jest.fn(async () => undefined),
      getResolvedSnapshot: jest.fn(async () => ({ messages: [] })),
      recordAssistantMessage: jest.fn(),
    };
    const workflowController = {
      handleWorkflow: jest.fn(async () => undefined),
    };
    const service = new ComposerActionService({
      permissionController: {
        resolvePermissionReference: jest.fn(),
        shortPermissionId: jest.fn(),
        handlePermissionCallback: jest.fn(),
      } as any,
      workflowController: workflowController as any,
      taskManager: { getTask: jest.fn() } as any,
      realtime: realtime as any,
    });

    const result = await service.maybeHandle({
      sessionId: 'session-workflow',
      webContext: { reply: jest.fn(async () => ({})) },
      mentions: [
        {
          id: 'action:resume-workflow:wf-ship-demo-001',
          type: 'action',
          label: '#retomar-workflow:wf-ship-demo-001',
          payload: {
            action: 'resume_workflow',
            workflowRunId: 'wf-ship-demo-001',
            taskId: 'task-123456789',
          },
        },
      ] as any,
    });

    expect(result).toMatchObject({
      handled: true,
      taskId: 'task-123456789',
    });
    expect(workflowController.handleWorkflow).toHaveBeenCalledWith(
      expect.any(Object),
      'resume wf-ship-demo-001',
    );
    expect(realtime.captureBaseline).toHaveBeenCalledWith('session-workflow');
  });

  it('resumes a workflow action from a specific stage through the workflow controller', async () => {
    const realtime = {
      captureBaseline: jest.fn(async () => undefined),
      getResolvedSnapshot: jest.fn(async () => ({ messages: [] })),
      recordAssistantMessage: jest.fn(),
    };
    const workflowController = {
      handleWorkflow: jest.fn(async () => undefined),
    };
    const service = new ComposerActionService({
      permissionController: {
        resolvePermissionReference: jest.fn(),
        shortPermissionId: jest.fn(),
        handlePermissionCallback: jest.fn(),
      } as any,
      workflowController: workflowController as any,
      taskManager: { getTask: jest.fn() } as any,
      realtime: realtime as any,
    });

    const result = await service.maybeHandle({
      sessionId: 'session-workflow-stage',
      webContext: { reply: jest.fn(async () => ({})) },
      mentions: [
        {
          id: 'action:resume-workflow-stage:wf-ship-demo-001:review',
          type: 'action',
          label: '#retomar-etapa:revisao-final',
          payload: {
            action: 'resume_workflow',
            workflowRunId: 'wf-ship-demo-001',
            resumeStageId: 'review',
            taskId: 'task-123456789',
          },
        },
      ] as any,
    });

    expect(result).toMatchObject({
      handled: true,
      taskId: 'task-123456789',
    });
    expect(workflowController.handleWorkflow).toHaveBeenCalledWith(
      expect.any(Object),
      'resume wf-ship-demo-001 review',
    );
    expect(realtime.captureBaseline).toHaveBeenCalledWith('session-workflow-stage');
  });

  it('restarts a completed workflow stage through the workflow controller', async () => {
    const realtime = {
      captureBaseline: jest.fn(async () => undefined),
      getResolvedSnapshot: jest.fn(async () => ({ messages: [] })),
      recordAssistantMessage: jest.fn(),
    };
    const workflowController = {
      handleWorkflow: jest.fn(async () => undefined),
    };
    const service = new ComposerActionService({
      permissionController: {
        resolvePermissionReference: jest.fn(),
        shortPermissionId: jest.fn(),
        handlePermissionCallback: jest.fn(),
      } as any,
      workflowController: workflowController as any,
      taskManager: { getTask: jest.fn() } as any,
      realtime: realtime as any,
    });

    const result = await service.maybeHandle({
      sessionId: 'session-workflow-restart',
      webContext: { reply: jest.fn(async () => ({})) },
      mentions: [
        {
          id: 'action:resume-workflow-stage:wf-ship-demo-001:maker:completed',
          type: 'action',
          label: '#reiniciar-etapa:codex-maker',
          payload: {
            action: 'restart_workflow_stage',
            workflowRunId: 'wf-ship-demo-001',
            resumeStageId: 'maker',
            taskId: 'task-123456789',
          },
        },
      ] as any,
    });

    expect(result).toMatchObject({
      handled: true,
      taskId: 'task-123456789',
    });
    expect(workflowController.handleWorkflow).toHaveBeenCalledWith(
      expect.any(Object),
      'restart-stage wf-ship-demo-001 maker',
    );
    expect(realtime.captureBaseline).toHaveBeenCalledWith('session-workflow-restart');
  });

  it('closes a blocked workflow through the workflow controller', async () => {
    const realtime = {
      captureBaseline: jest.fn(async () => undefined),
      getResolvedSnapshot: jest.fn(async () => ({ messages: [] })),
      recordAssistantMessage: jest.fn(),
    };
    const workflowController = {
      handleWorkflow: jest.fn(async () => undefined),
    };
    const service = new ComposerActionService({
      permissionController: {
        resolvePermissionReference: jest.fn(),
        shortPermissionId: jest.fn(),
        handlePermissionCallback: jest.fn(),
      } as any,
      workflowController: workflowController as any,
      taskManager: { getTask: jest.fn() } as any,
      realtime: realtime as any,
    });

    const result = await service.maybeHandle({
      sessionId: 'session-workflow-close',
      webContext: { reply: jest.fn(async () => ({})) },
      mentions: [
        {
          id: 'action:close-workflow:wf-ship-demo-001',
          type: 'action',
          label: '#encerrar-workflow:wf-ship-demo-001',
          payload: {
            action: 'close_workflow',
            workflowRunId: 'wf-ship-demo-001',
            taskId: 'task-123456789',
          },
        },
      ] as any,
    });

    expect(result).toMatchObject({
      handled: true,
      taskId: 'task-123456789',
    });
    expect(workflowController.handleWorkflow).toHaveBeenCalledWith(
      expect.any(Object),
      'close wf-ship-demo-001',
    );
    expect(realtime.captureBaseline).toHaveBeenCalledWith('session-workflow-close');
  });

  it('describes artifact and file actions directly in the session', async () => {
    const realtime = {
      captureBaseline: jest.fn(async () => undefined),
      getResolvedSnapshot: jest.fn(async () => ({ messages: [] })),
      recordAssistantMessage: jest.fn(),
    };
    const service = new ComposerActionService({
      permissionController: {
        resolvePermissionReference: jest.fn(),
        shortPermissionId: jest.fn(),
        handlePermissionCallback: jest.fn(),
      } as any,
      taskManager: {
        getTask: jest.fn(),
      } as any,
      realtime: realtime as any,
    });

    const artifactResult = await service.maybeHandle({
      sessionId: 'session-3',
      webContext: {},
      mentions: [
        {
          id: 'action:artifact:artifact-123',
          type: 'action',
          label: '#ver-artefato:build-log',
          payload: {
            action: 'describe_artifact',
            taskId: 'task-123456789',
            name: 'build.log',
            path: 'C:/repo/output/build.log',
            deliveryChannel: 'document',
          },
        },
      ] as any,
    });

    const fileResult = await service.maybeHandle({
      sessionId: 'session-4',
      webContext: {},
      mentions: [
        {
          id: 'action:file:file-123',
          type: 'action',
          label: '#ver-arquivo:index.ts',
          payload: {
            action: 'describe_file',
            taskId: 'task-123456789',
            fileName: 'index.ts',
            path: 'C:/repo/src/index.ts',
            workspace: 'C:/repo',
            status: 'completed',
          },
        },
      ] as any,
    });

    expect(artifactResult).toMatchObject({ handled: true, taskId: 'task-123456789' });
    expect(fileResult).toMatchObject({ handled: true, taskId: 'task-123456789' });
    expect(realtime.recordAssistantMessage).toHaveBeenCalledWith(
      'session-3',
      expect.stringContaining('Artefato referenciado nesta sessao.'),
      'task-123456789',
      'artifact-info',
      [expect.objectContaining({ type: 'action' })],
    );
    expect(realtime.recordAssistantMessage).toHaveBeenCalledWith(
      'session-4',
      expect.stringContaining('Arquivo referenciado nesta sessao.'),
      'task-123456789',
      'file-info',
      [expect.objectContaining({ type: 'action' })],
    );
  });

  it('redelivers an artifact reference directly in the session', async () => {
    const realtime = {
      captureBaseline: jest.fn(async () => undefined),
      getResolvedSnapshot: jest.fn(async () => ({ messages: [] })),
      recordAssistantMessage: jest.fn(),
    };
    const service = new ComposerActionService({
      permissionController: {
        resolvePermissionReference: jest.fn(),
        shortPermissionId: jest.fn(),
        handlePermissionCallback: jest.fn(),
      } as any,
      taskManager: { getTask: jest.fn() } as any,
      realtime: realtime as any,
    });

    const result = await service.maybeHandle({
      sessionId: 'session-5',
      webContext: {},
      mentions: [
        {
          id: 'action:redeliver:artifact-123',
          type: 'action',
          label: '#reentregar-artefato:build-log',
          payload: {
            action: 'redeliver_artifact',
            taskId: 'task-123456789',
            key: 'build-log',
            name: 'build.log',
            path: 'C:/repo/output/build.log',
            summary: 'Log principal do build.',
            kind: 'report',
            type: 'document',
            deliveryChannel: 'document',
          },
        },
      ] as any,
    });

    expect(result).toMatchObject({ handled: true, taskId: 'task-123456789' });
    expect(realtime.recordAssistantMessage).toHaveBeenCalledWith(
      'session-5',
      expect.stringContaining('Reentrega pronta para este artefato.'),
      'task-123456789',
      'artifact-redelivery',
      [expect.objectContaining({ type: 'action' })],
    );
  });
});
