import { ZavorthAutomationControlPlaneService } from '../../src/services/ZavorthAutomationControlPlaneService.js';

describe('ZavorthAutomationControlPlaneService', () => {
  it('summarizes scheduled runs, maintenance and recent deliveries', async () => {
    const service = new ZavorthAutomationControlPlaneService({
      runtimeProfileService: {
        getProfile: () => 'ops',
        supportsRecurringAutomation: () => true,
      } as any,
      loadSchedulerService: async () => ({
        listTasks: () => [
          {
            id: 'task-1-abc',
            command: 'check my channels',
            intent_text: 'check my channels each morning',
            schedule: '{"kind":"calendar_day","targetHour":9,"targetMinute":0}',
            created_at: '2026-04-12T10:00:00.000Z',
            last_run: '2026-04-12T09:00:00.000Z',
            next_run: '2026-04-13T09:00:00.000Z',
            created_by: 'u1',
            status: 'active',
            delivery: 'app',
            last_status: 'completed',
            budget_json: JSON.stringify({
              maxRuntimeMs: 600000,
              maxMemoryMb: 256,
              retries: 2,
              backoffMs: 30000,
              maxConcurrentRuns: 1,
              maxPerTaskConcurrentRuns: 1,
              maintenanceWindows: [
                { label: 'default-nightly-maintenance', start: '04:00', end: '06:00', timezone: 'local', heavyTasksOnly: true },
              ],
            }),
            guardrail_json: JSON.stringify({
              autoPauseAfterConsecutiveFailures: 3,
              idempotencyKeySeed: 'task:check my channels:{"kind":"calendar_day","targetHour":9,"targetMinute":0}:u1',
              outboxTtlMs: 604800000,
              outboxMaxBytes: 104857600,
              pauseCreatesInboxNotice: true,
              governedScheduledTask: {
                contractVersion: '2026-05-12.persisted-scheduled-task-registration-checkpoint-3',
                stage: 'checkpoint-3-persisted-scheduled-task-registration',
                registryStatus: 'active',
                approvalId: 'approval-ok',
                approvalExpiresAt: '2026-05-19T10:00:00.000Z',
                approvalVerificationReason: 'valid',
                approvedScopeHash: 'hash',
                approvedScope: {
                  intent: 'check my channels each morning',
                  command: 'check my channels',
                  workspace: process.cwd(),
                  surface: 'web',
                  createdBy: 'u1',
                  allowedTools: ['scheduled_task_dispatch'],
                },
                approvedBudget: {
                  maxRuntimeMs: 600000,
                  maxTokens: 6000,
                  maxToolCalls: 8,
                  maxNetworkRequests: 0,
                  maxCommands: 1,
                  maxMutations: 0,
                  maxRetries: 2,
                },
                renewalPolicy: 'require_reapproval',
                receipts: [],
                persistedAt: '2026-04-12T10:00:00.000Z',
                executionGatewayRequired: true,
                noDirectToolDispatch: true,
              },
            }),
          },
        ],
        describeSchedule: (value: string) => value,
        findTaskByPrefix: () => null,
      } as any),
      loadMaintenanceService: async () => ({
        getStatus: () => ({
          enabled: true,
          running: false,
          lastTriggeredAt: null,
          lastTriggeredDateKey: null,
          lastTriggerSource: null,
          lastPriorityReason: null,
          lastActionId: null,
          lastActionLogFile: null,
          updatedAt: '2026-04-12T10:00:00.000Z',
          updatedBy: null,
          note: null,
          nextPlannedAt: '2026-04-13T04:30:00.000Z',
        }),
      } as any),
      deliveryService: {
        readRecent: () => [
          {
            taskId: 'task-1-abc',
            delivery: 'app',
            summary: 'Tudo ok.',
            createdAt: '2026-04-12T09:00:01.000Z',
            target: null,
          },
        ],
        readOutboxStatus: () => ({
          deliveryReportFile: 'automation-deliveries.jsonl',
          webhookOutboxFile: 'automation-webhook-outbox.jsonl',
          emailOutboxDir: 'email-outbox',
          bounded: true,
          retention: {
            ttlMs: 604800000,
            maxBytes: 104857600,
            maxRotatedFiles: 5,
            maxEmailFiles: 200,
          },
          deliveryRecords: 1,
          queuedDeliveries: 1,
          webhookQueued: 0,
          emailQueued: 0,
          externalDeliveries: 0,
          idempotencyKeys: 0,
          lastQueuedAt: '2026-04-12T09:00:01.000Z',
          recommendation: 'Outbox possui entregas pendentes.',
        }),
      } as any,
    });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.summary.posture).toBe('healthy');
    expect(snapshot.summary.activeTasks).toBe(1);
    expect(snapshot.summary.budgetedTasks).toBe(1);
    expect(snapshot.policy.creationMode).toBe('approval-gated');
    expect(snapshot.budgets.maxRuntimeMs).toBe(600000);
    expect(snapshot.outbox.bounded).toBe(true);
    expect(snapshot.outbox.queuedDeliveries).toBe(1);
    expect(snapshot.deliveries).toHaveLength(1);
    expect(snapshot.tasks[0]?.guardrails.autoPauseAfterConsecutiveFailures).toBe(3);
    expect(snapshot.tasks[0]?.prompt).toContain('check my channels');
  });
});
