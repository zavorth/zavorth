import { TelegramSchedulerController } from '../../../src/telegram/controllers/TelegramSchedulerController';
import { ZavorthScheduledTaskSurfaceService } from '../../../src/services/ZavorthScheduledTaskSurfaceService';

interface MockSchedulerService {
  scheduleTask: jest.Mock;
}

interface MockAutomationActionService {
  execute: jest.Mock;
}

interface MockContext {
  from?: { id: number };
  reply: jest.Mock;
}

jest.mock('../../../src/services/ZavorthScheduledTaskSurfaceService');

describe('TelegramSchedulerController', () => {
  it('guards against scheduler access before initialization', async () => {
    const ctx: MockContext = {
      reply: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new TelegramSchedulerController(() => undefined);

    await controller.handleSchedule(ctx, 'every 1h /wsl status');

    expect(ctx.reply).toHaveBeenCalledWith('The scheduler is still starting...');
  });

  it('creates a report schedule through the scheduler service', async () => {
    const ctx: MockContext = {
      from: { id: 99 },
      reply: jest.fn().mockResolvedValue(undefined),
    };
    const schedulerService: MockSchedulerService = {
      scheduleTask: jest.fn().mockReturnValue({
        id: 'abcd1234-zz',
        command: '/deepresearch noticias de IA',
        schedule: 'every 6h',
        created_at: '2026-05-12T10:00:00.000Z',
        last_run: null,
        next_run: '2026-05-12T16:00:00.000Z',
        created_by: '99',
        status: 'active',
        last_status: 'idle',
        last_error: null,
        delivery: 'telegram',
        delivery_target: null,
        intent_text: 'Relatorio recorrente: noticias de IA',
        budget_json: '{}',
        guardrail_json: JSON.stringify({
          governedScheduledTask: {
            gate: 'persisted-scheduled-task-registration',
            approvalId: 'telegram-report-99',
            approvedScope: {
              intent: 'Relatorio recorrente: noticias de IA',
              command: '/deepresearch noticias de IA',
              workspace: __dirname,
              surface: 'telegram',
              createdBy: '99',
              allowedTools: ['scheduled_task_dispatch'],
            },
            approvedBudget: {},
          },
        }),
      }),
    } as unknown as MockSchedulerService;

    const mockRegister = jest.fn().mockResolvedValue({
      ok: true,
      task: { id: 'abcd1234-zz' },
      persistence: {
        task: { id: 'abcd1234-zz' },
        narrative: { operatorSummary: 'Recurring report scheduled' },
      },
    });
    const mockRender = jest.fn().mockReturnValue('Recurring report scheduled');
    (ZavorthScheduledTaskSurfaceService as jest.Mock).mockImplementation(() => ({
      register: mockRegister,
      render: mockRender,
    }));

    const controller = new TelegramSchedulerController(() => schedulerService);

    await controller.handleReport(ctx, 'every 6h noticias de IA', '99');

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Recurring report scheduled');
  });

  it('creates automations from natural language through the automation action service', async () => {
    const ctx: MockContext = {
      reply: jest.fn().mockResolvedValue(undefined),
    };
    const execute = jest.fn(async () => ({
      ok: true,
      actionId: 'create',
      summary: 'Automation created with in-app delivery.',
      details: ['Daily routine registered.'],
      snapshot: {
        narrative: {
          operatorSummary: 'One active automation.',
          nextAction: 'Wait for the first run.',
        },
      },
    }));
    const controller = new TelegramSchedulerController(() => ({
      scheduleTask: jest.fn(),
    } as unknown as MockSchedulerService));
    (controller as unknown as { automationActionService: MockAutomationActionService }).automationActionService = { execute };

    await controller.handleAutomations(ctx, 'todo dia as 9h verifique meus canais no app', '99');

    expect(execute).toHaveBeenCalledWith({
      actionId: 'create',
      intentText: 'todo dia as 9h verifique meus canais no app',
      requestedBy: '99',
      sourceSurface: 'telegram',
    });
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain(
      'Automation created with in-app delivery.',
    );
  });

  it('runs maintenance actions through the automation action service', async () => {
    const ctx: MockContext = {
      reply: jest.fn().mockResolvedValue(undefined),
    };
    const execute = jest.fn(async () => ({
      ok: true,
      actionId: 'maintenance-on',
      summary: 'Maintenance mode ativado.',
      details: ['Rotinas recorrentes vao respeitar a janela de manutencao.'],
      snapshot: {
        narrative: {
          operatorSummary: 'Maintenance mode ficou ligado.',
          nextAction: 'Acompanhar a proxima rodada.',
        },
      },
    }));
    const controller = new TelegramSchedulerController(() => ({
      scheduleTask: jest.fn(),
    } as unknown as MockSchedulerService));
    (controller as unknown as { automationActionService: MockAutomationActionService }).automationActionService = { execute };

    await controller.handleAutomations(ctx, 'maintenance on', '99');

    expect(execute).toHaveBeenCalledWith({
      actionId: 'maintenance-on',
      requestedBy: '99',
      sourceSurface: 'telegram',
    });
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Maintenance mode ativado.');
  });
});
