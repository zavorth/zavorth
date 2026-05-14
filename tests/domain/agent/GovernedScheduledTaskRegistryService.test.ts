import {
  ZAVORTH_SCHEDULED_TASK_APPROVAL_TOOL,
  ZAVORTH_SCHEDULED_TASK_CONTRACT_VERSION,
} from '../../../src/contracts/ZavorthScheduledTaskContract.js';
import { ZavorthGovernedScheduledTaskRegistryService } from '../../../src/services/ZavorthGovernedScheduledTaskRegistryService.js';

describe('ZavorthGovernedScheduledTaskRegistryService', () => {
  const service = new ZavorthGovernedScheduledTaskRegistryService({
    now: () => new Date('2026-05-12T12:00:00.000Z'),
    cwd: () => 'C:/TESTES DEV/zavorth-core/Zavorth',
  });

  it('requires owner re-approval when the scope envelope is missing', () => {
    const snapshot = service.buildSnapshot();

    expect(snapshot.contractVersion).toBe(ZAVORTH_SCHEDULED_TASK_CONTRACT_VERSION);
    expect(snapshot.phase).toBe('phase-1-governed-scheduled-task-contract');
    expect(snapshot.status).toBe('needs_reapproval');
    expect(snapshot.summary.registrationReady).toBe(false);
    expect(snapshot.summary.executionPerformed).toBe(false);
    expect(snapshot.safety).toMatchObject({
      preApprovedScopeOnly: true,
      noCompoundScheduling: true,
      globalKillSwitchHonored: true,
      approvalTtlRequired: true,
      budgetBoundariesRequired: true,
      noImplicitExecution: true,
      noDashboardVisualMutation: true,
    });
  });

  it('creates an active registry handoff when the owner approves the exact scope', () => {
    const snapshot = service.buildSnapshot({
      intent: 'Enviar resumo operacional do workspace',
      schedule: 'every 15m',
      surface: 'telegram',
      allowedTools: ['web_search', 'read_file'],
      approval: {
        ownerConfirmed: true,
        approvalId: 'approval-123',
        approvedBy: 'owner',
      },
    });

    expect(snapshot.status).toBe('active');
    expect(snapshot.schedule?.normalized).toBe('every 15m');
    expect(snapshot.summary.approvalVerified).toBe(true);
    expect(snapshot.summary.registrationReady).toBe(true);
    expect(snapshot.approvalEnvelope?.toolName).toBe(ZAVORTH_SCHEDULED_TASK_APPROVAL_TOOL);
    expect(snapshot.registration).toMatchObject({
      recorded: true,
      schedulerServiceCompatible: true,
      schedulerSchedule: 'every 15m',
      schedulerUserId: 'owner',
      executionPerformed: false,
      persistedToScheduler: false,
    });
  });

  it('blocks compound scheduling attempts', () => {
    const snapshot = service.buildSnapshot({
      intent: 'Crie outro agendamento toda sexta',
      approval: {
        ownerConfirmed: true,
        approvalId: 'approval-123',
      },
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.summary.blockedByNoCompound).toBe(true);
    expect(snapshot.checks.some((check) =>
      check.kind === 'no-compound' && check.status === 'fail',
    )).toBe(true);
  });

  it('honors the global scheduled-task kill switch', () => {
    const snapshot = service.buildSnapshot({
      approval: {
        ownerConfirmed: true,
        approvalId: 'approval-123',
      },
      policy: {
        killSwitchEnabled: true,
      },
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.summary.blockedByKillSwitch).toBe(true);
    expect(snapshot.receipts.some((receipt) =>
      receipt.kind === 'policy-boundary' && receipt.status === 'blocked',
    )).toBe(true);
  });

  it('blocks invalid schedules before SchedulerService handoff', () => {
    const snapshot = service.buildSnapshot({
      schedule: 'every second',
      approval: {
        ownerConfirmed: true,
        approvalId: 'approval-123',
      },
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.schedule).toBeNull();
    expect(snapshot.registration.schedulerServiceCompatible).toBe(false);
    expect(snapshot.checks.some((check) =>
      check.kind === 'schedule-parse' && check.status === 'fail',
    )).toBe(true);
  });

  it('blocks budgets above the governed ceiling', () => {
    const snapshot = service.buildSnapshot({
      budget: {
        maxMutations: 999,
      },
      approval: {
        ownerConfirmed: true,
        approvalId: 'approval-123',
      },
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.checks.some((check) =>
      check.kind === 'budget-boundary' && check.status === 'fail',
    )).toBe(true);
  });

  it('marks an expired scope envelope as expired instead of active', () => {
    const original = new ZavorthGovernedScheduledTaskRegistryService({
      now: () => new Date('2026-05-12T12:00:00.000Z'),
      cwd: () => 'C:/TESTES DEV/zavorth-core/Zavorth',
    }).buildSnapshot({
      schedule: 'daily 09:00',
      approval: {
        ownerConfirmed: true,
        approvalId: 'short-approval',
        ttlMs: 1,
      },
    });

    const later = new ZavorthGovernedScheduledTaskRegistryService({
      now: () => new Date('2026-05-12T12:00:01.000Z'),
      cwd: () => 'C:/TESTES DEV/zavorth-core/Zavorth',
    }).buildSnapshot({
      schedule: 'daily 09:00',
      approval: {
        envelope: original.approvalEnvelope,
      },
    });

    expect(later.status).toBe('expired');
    expect(later.summary.expiredApproval).toBe(true);
    expect(later.registration.recorded).toBe(false);
  });
});
