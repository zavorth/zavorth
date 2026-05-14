import { AuditLogger } from '../../src/monitoring/AuditLogger.js';

describe('AuditLogger', () => {
  it('writes to the database and appends the tamper-evident audit trail', async () => {
    const run = jest.fn();
    const trailService = {
      append: jest.fn(),
      recordFailure: jest.fn(),
    } as any;
    const logger = new AuditLogger({
      secureStorage: {
        encryptString: jest.fn((value: string | null) => value),
        encryptJson: jest.fn((value: unknown) => JSON.stringify(value)),
        decryptString: jest.fn(),
        decryptJson: jest.fn(),
      } as any,
      dbProvider: {
        getInstance: jest.fn().mockResolvedValue({
          run,
          all: jest.fn(),
        }),
      } as any,
      trailService,
    });

    await logger.logApprovalDecision({
      task_id: 'task-approval-1',
      intent: 'ship',
      risk_level: 3,
      approval_status: 'pending',
      requires_approval: true,
      executor_used: 'external_executor',
      metadata: {
        operator_mode_gate: true,
      },
    } as any, 'approve', '42', {
      source: 'telegram',
    });

    expect(run).toHaveBeenCalled();
    expect(trailService.append).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'APPROVAL_DECISION',
        task_id: 'task-approval-1',
        user_id: '42',
        metadata: expect.objectContaining({
          action: 'approve',
          source: 'telegram',
        }),
      }),
    );
    expect(trailService.recordFailure).not.toHaveBeenCalled();
  });

  it('keeps the audit flow alive and records failure status when the chain append fails', async () => {
    const run = jest.fn();
    const trailService = {
      append: jest.fn(() => {
        throw new Error('append failed');
      }),
      recordFailure: jest.fn(),
    } as any;
    const logger = new AuditLogger({
      secureStorage: {
        encryptString: jest.fn((value: string | null) => value),
        encryptJson: jest.fn((value: unknown) => JSON.stringify(value)),
        decryptString: jest.fn(),
        decryptJson: jest.fn(),
      } as any,
      dbProvider: {
        getInstance: jest.fn().mockResolvedValue({
          run,
          all: jest.fn(),
        }),
      } as any,
      trailService,
    });

    await expect(logger.logEvent({
      timestamp: '2026-04-03T22:10:00.000Z',
      event_type: 'SECURITY_BLOCK',
      task_id: 'task-1',
      user_id: '42',
      user_input: '',
      intent: null,
      plan_id: null,
      risk_level: 3,
      policy_decision: 'BLOCKED',
      policy_violations: 'forbidden',
      operational_mode: 'OPERATOR',
      executor: null,
      execution_success: false,
      execution_summary: 'blocked',
      metadata: {},
    })).resolves.toBeUndefined();

    expect(run).toHaveBeenCalled();
    expect(trailService.recordFailure).toHaveBeenCalledWith(expect.any(Error));
  });
});
