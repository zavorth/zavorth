import { TelegramSchedulerController } from '../../../src/telegram/controllers/TelegramSchedulerController';

describe('TelegramSchedulerController', () => {
  it('guards against scheduler access before initialization', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const controller = new TelegramSchedulerController(() => undefined);

    await controller.handleSchedule(ctx, 'every 1h /wsl status');

    expect(ctx.reply).toHaveBeenCalledWith('O agendador ainda esta iniciando. Tente novamente em alguns segundos.');
  });

  it('creates a report schedule through the scheduler service', async () => {
    const ctx = {
      from: { id: 99 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const schedulerService = {
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
            phase: 'phase-3-persisted-scheduled-task-registration',
            approvalId: 'telegram-report-99',
            approvedScope: {
              intent: 'Relatorio recorrente: noticias de IA',
              command: '/deepresearch noticias de IA',
              workspace: process.cwd(),
              surface: 'telegram',
              createdBy: '99',
              allowedTools: ['scheduled_task_dispatch'],
            },
            approvedBudget: {},
          },
        }),
      }),
    } as any;
    const controller = new TelegramSchedulerController(() => schedulerService);

    await controller.handleReport(ctx, 'every 6h noticias de IA', '99');

    expect(schedulerService.scheduleTask).toHaveBeenCalledWith(
      '/deepresearch noticias de IA',
      'every 6h',
      '99',
      expect.objectContaining({
        governedScheduledTask: expect.objectContaining({
          phase: 'phase-3-persisted-scheduled-task-registration',
        }),
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Relatorio governado'));
  });

  it('creates automations from natural language through the automation action service', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const execute = jest.fn(async () => ({
      ok: true,
      actionId: 'create',
      summary: 'Automacao criada com entrega no app.',
      details: ['Rotina diaria registrada.'],
      snapshot: {
        narrative: {
          operatorSummary: 'Uma automacao ativa.',
          nextAction: 'Aguardar a primeira execucao.',
        },
      },
    }));
    const controller = new TelegramSchedulerController(() => ({
      scheduleTask: jest.fn(),
    } as any));
    (controller as any).automationActionService = { execute };

    await controller.handleAutomations(ctx, 'todo dia as 9h verifique meus canais no app', '99');

    expect(execute).toHaveBeenCalledWith({
      actionId: 'create',
      intentText: 'todo dia as 9h verifique meus canais no app',
      requestedBy: '99',
      sourceSurface: 'telegram',
    });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Automacao criada com entrega no app.'));
  });

  it('runs maintenance actions through the automation action service', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
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
    } as any));
    (controller as any).automationActionService = { execute };

    await controller.handleAutomations(ctx, 'maintenance on', '99');

    expect(execute).toHaveBeenCalledWith({
      actionId: 'maintenance-on',
      requestedBy: '99',
      sourceSurface: 'telegram',
    });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Maintenance mode ativado.'));
  });
});
