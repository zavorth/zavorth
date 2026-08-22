import { TelegramCapabilityController } from '../../../src/telegram/controllers/TelegramCapabilityController';
import type { Context } from 'grammy';

describe('TelegramCapabilityController', () => {
  function createController() {
    const deps = {
      researchController: {
        handleResearch: jest.fn().mockResolvedValue(undefined),
        handleDeepResearch: jest.fn().mockResolvedValue(undefined),
      },
      pipelineController: {
        handleWorkflow: jest.fn().mockResolvedValue(undefined),
        handleNamedWorkflow: jest.fn().mockResolvedValue(undefined),
      },
      inspectionController: {
        handleTasks: jest.fn().mockResolvedValue(undefined),
        handleLogs: jest.fn().mockResolvedValue(undefined),
        handleTaskFiles: jest.fn().mockResolvedValue(undefined),
        handleTaskDiff: jest.fn().mockResolvedValue(undefined),
      },
      fileDeliveryController: {
        handleCommand: jest.fn().mockResolvedValue(undefined),
      },
      opsController: {
        handleCapabilities: jest.fn().mockResolvedValue(undefined),
        handleDashboard: jest.fn().mockResolvedValue(undefined),
      },
    } as unknown as ConstructorParameters<typeof TelegramCapabilityController>[0];

    return {
      controller: new TelegramCapabilityController(deps),
      deps,
    };
  }

  it('dispatches research queue commands by mode', async () => {
    const { controller, deps } = createController();
    const ctx = {} as Context;

    const handledResearch = await controller.handleCommand(
      ctx,
      {
        id: 'command-research',
        label: 'Search',
        type: 'research',
        description: '',
        intent: 'research',
        executor_preference: null,
        dispatch_mode: 'execution',
        command: {
          command: '/research',
          description: '',
          handler_action: 'research_queue',
          handler_config: { mode: 'research' },
        },
      },
      'ultimas noticias',
      '7',
    );

    const handledDeepResearch = await controller.handleCommand(
      ctx,
      {
        id: 'command-deepresearch',
        label: 'Deep Research',
        type: 'research',
        description: '',
        intent: 'deep_research',
        executor_preference: null,
        dispatch_mode: 'execution',
        command: {
          command: '/deepresearch',
          description: '',
          handler_action: 'research_queue',
          handler_config: { mode: 'deepresearch' },
        },
      },
      'mercado de IA',
      '7',
    );

    expect(handledResearch).toBe(true);
    expect(handledDeepResearch).toBe(true);
    expect(deps.researchController.handleResearch).toHaveBeenCalledWith(ctx, 'ultimas noticias');
    expect(deps.researchController.handleDeepResearch).toHaveBeenCalledWith(ctx, 'mercado de IA');
  });

  it('dispatches workflow and file handlers', async () => {
    const { controller, deps } = createController();
    const ctx = {} as Context;

    await controller.handleCommand(
      ctx,
      {
        id: 'command-external-review',
        label: 'ExternalExecutor Review',
        type: 'workflow',
        description: '',
        intent: 'workflow_execution',
        executor_preference: 'workflow:review',
        dispatch_mode: 'execution',
        command: {
          command: '/external_review',
          description: '',
          handler_action: 'workflow_named',
          handler_config: { workflow: 'review' },
        },
      },
      'revise este modulo',
      '7',
    );

    await controller.handleCommand(
      ctx,
      {
        id: 'command-workflow',
        label: 'Workflow',
        type: 'workflow',
        description: '',
        intent: 'workflow_execution',
        executor_preference: null,
        dispatch_mode: 'execution',
        command: {
          command: '/workflow',
          description: '',
          handler_action: 'workflow_dynamic',
        },
      },
      'ship implemente a tela inicial',
      '7',
    );

    await controller.handleCommand(
      ctx,
      {
        id: 'command-file-delivery',
        label: 'Arquivo',
        type: 'integration',
        description: '',
        intent: 'file_delivery',
        executor_preference: null,
        dispatch_mode: 'execution',
        command: {
          command: '/arquivo',
          description: '',
          handler_action: 'file_delivery',
        },
      },
      'index.html',
      '7',
    );

    await controller.handleCommand(
      ctx,
      {
        id: 'command-tasks',
        label: 'Tasks',
        type: 'integration',
        description: '',
        intent: 'task_inspection',
        executor_preference: null,
        dispatch_mode: 'execution',
        command: {
          command: '/tasks',
          description: '',
          handler_action: 'inspection_tasks',
        },
      },
      'active',
      '7',
    );

    await controller.handleCommand(
      ctx,
      {
        id: 'command-logs',
        label: 'Logs',
        type: 'integration',
        description: '',
        intent: 'log_inspection',
        executor_preference: null,
        dispatch_mode: 'execution',
        command: {
          command: '/logs',
          description: '',
          handler_action: 'inspection_logs',
        },
      },
      '10',
      '7',
    );

    await controller.handleCommand(
      ctx,
      {
        id: 'command-task-files',
        label: 'Files',
        type: 'integration',
        description: '',
        intent: 'file_inspection',
        executor_preference: null,
        dispatch_mode: 'execution',
        command: {
          command: '/files',
          description: '',
          handler_action: 'inspection_files',
        },
      },
      'active',
      '7',
    );

    await controller.handleCommand(
      ctx,
      {
        id: 'command-task-diff',
        label: 'Diff',
        type: 'integration',
        description: '',
        intent: 'file_diff',
        executor_preference: null,
        dispatch_mode: 'execution',
        command: {
          command: '/diff',
          description: '',
          handler_action: 'inspection_diff',
        },
      },
      'abcd1234',
      '7',
    );

    expect(deps.pipelineController.handleNamedWorkflow).toHaveBeenCalledWith(
      ctx,
      'review',
      'revise este modulo',
    );
    expect(deps.pipelineController.handleWorkflow).toHaveBeenCalledWith(ctx, 'ship implemente a tela inicial');
    expect(deps.fileDeliveryController.handleCommand).toHaveBeenCalledWith(ctx, 'index.html', '7');
    expect(deps.inspectionController.handleTasks).toHaveBeenCalledWith(ctx, 'active', '7');
    expect(deps.inspectionController.handleLogs).toHaveBeenCalledWith(ctx, '10');
    expect(deps.inspectionController.handleTaskFiles).toHaveBeenCalledWith(ctx, 'active', '7');
    expect(deps.inspectionController.handleTaskDiff).toHaveBeenCalledWith(ctx, 'abcd1234', '7');
  });

  it('dispatches ops handlers', async () => {
    const { controller, deps } = createController();
    const ctx = {} as Context;

    await controller.handleCommand(
      ctx,
      {
        id: 'command-capabilities',
        label: 'Capabilities',
        type: 'integration',
        description: '',
        intent: 'capability_inspection',
        executor_preference: null,
        dispatch_mode: 'execution',
        command: {
          command: '/capabilities',
          description: '',
          handler_action: 'ops_capabilities',
        },
      },
      '',
      '7',
    );

    await controller.handleCommand(
      ctx,
      {
        id: 'command-dashboard',
        label: 'Dashboard',
        type: 'integration',
        description: '',
        intent: 'dashboard_access',
        executor_preference: null,
        dispatch_mode: 'execution',
        command: {
          command: '/zavorthControl',
          description: '',
          handler_action: 'ops_dashboard',
        },
      },
      '',
      '7',
    );

    expect(deps.opsController.handleCapabilities).toHaveBeenCalledWith(ctx);
    expect(deps.opsController.handleDashboard).toHaveBeenCalledWith(ctx);
  });

  it('returns false for unsupported actions', async () => {
    const { controller } = createController();
    const handled = await controller.handleCommand(
      {} as Context,
      {
        id: 'noop',
        label: 'Noop',
        type: 'integration',
        description: '',
        intent: 'noop',
        executor_preference: null,
        dispatch_mode: 'execution',
        command: {
          command: '/noop',
          description: '',
          handler_action: 'nao-suportado',
        },
      },
      '',
      '7',
    );

    expect(handled).toBe(false);
  });
});
