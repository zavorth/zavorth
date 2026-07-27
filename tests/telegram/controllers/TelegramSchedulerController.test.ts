import { TelegramSchedulerController } from '../../../src/telegram/controllers/TelegramSchedulerController';

describe('TelegramSchedulerController', () => {
  it('guards against scheduler access before initialization', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const controller = new TelegramSchedulerController(() => undefined);

    await controller.handleSchedule(ctx, 'every 1h /wsl status');

    expect(ctx.reply).toHaveBeenCalledWith('The scheduler is still starting...');
  });

  it('creates a report schedule through the scheduler service', async () => {
    const ctx = {
      from: { id: 99 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const schedulerService = {
      scheduleTask: jest.fn().mockReturnValue({
        id: 'abcd1234-zz',
        command: '/deepresearch AI news',
        schedule: '{"kind":"interval","intervalMs":21600000}',
        created_at: '2026-05-12T10:00:00.000Z',
        last_run: null,
        next_run: '2026-05-12T16:00:00.000Z',
        created_by: '99',
        status: 'active',
        last_status: 'idle',
        last_error: null,
        delivery: 'telegram',
        delivery_target: null,
        intent_text: 'Recurring report: AI news',
        budget_json: '{}',
        guardrail_json: JSON.stringify({
          governedScheduledTask: {
            gate: 'persisted-scheduled-task-registration',
            approvalId: 'telegram-report-99',
            approvedScope: {
              intent: 'Recurring report: AI news',
              command: '/deepresearch AI news',
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

    await controller.handleReport(
      ctx,
      JSON.stringify({
        schedule: { kind: 'interval', intervalMs: 21600000 },
        topic: 'AI news',
        command: '/deepresearch AI news',
      }),
      '99',
    );

    expect(schedulerService.scheduleTask).toHaveBeenCalledWith(
      '/deepresearch AI news',
      '{"kind":"interval","intervalMs":21600000}',
      '99',
      expect.objectContaining({
        governedScheduledTask: expect.objectContaining({
          gate: 'persisted-scheduled-task-registration',
        }),
      }),
    );
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Recurring report scheduled');
  });

  it('creates automations from natural language through the automation action service', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
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
    } as any));
    (controller as any).automationActionService = { execute };

    await controller.handleAutomations(ctx, 'check my channels every morning in the app', '99');

    expect(execute).toHaveBeenCalledWith({
      actionId: 'create',
      intentText: 'check my channels every morning in the app',
      requestedBy: '99',
      sourceSurface: 'telegram',
    });
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain(
      'Automation created with in-app delivery.',
    );
  });

  it('runs maintenance actions through the automation action service', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const execute = jest.fn(async () => ({
      ok: true,
      actionId: 'maintenance-on',
      summary: 'Maintenance mode enabled.',
      details: ['Recurring routines will respect the maintenance window.'],
      snapshot: {
        narrative: {
          operatorSummary: 'Maintenance mode is enabled.',
          nextAction: 'Track the next run.',
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
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Maintenance mode enabled.');
  });
});
