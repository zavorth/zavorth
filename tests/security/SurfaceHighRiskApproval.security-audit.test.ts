import { ApprovalManager } from '../../src/orchestrator/ApprovalManager.js';
import { HighRiskConfirmationService } from '../../src/services/HighRiskConfirmationService.js';
import { PermissionService } from '../../src/services/PermissionService.js';
import { ApprovalPresentationService } from '../../src/services/approval/ApprovalPresentationService.js';
import type { Task } from '../../src/contracts/TaskContract.js';

describe('Surface high-risk approval (simple permissions)', () => {
  it('never auto-approves high-risk without explicit grant', () => {
    const hr = new HighRiskConfirmationService();
    const task = {
      task_id: 't1',
      risk_level: 5,
      metadata: { requiresHighRiskPin: true },
    } as Task;
    const gate = hr.assertApprovalGate({ task, approvalGranted: false });
    expect(gate.ok).toBe(false);
    expect(gate.requiresTotp).toBe(false);
  });

  it('one-click approve works on ApprovalManager, presentation, and permission', async () => {
    const hr = new HighRiskConfirmationService();

    const task = {
      task_id: 'hr-task',
      status: 'waiting_approval',
      risk_level: 4,
      source: 'desktop',
      metadata: { requiresHighRiskPin: true, pendingPermissionId: 'p1' },
    } as Task;
    const tm = {
      getTask: () => task,
      advanceState: jest.fn((t: Task, status: string) => {
        t.status = status as Task['status'];
      }),
    };
    const manager = new ApprovalManager(tm as any, hr);
    expect(manager.processApproval('hr-task', 'approve', { surface: 'desktop' }).status).toBe(
      'approved',
    );

    const presentation = new ApprovalPresentationService();
    const card = presentation.recordDecision(
      {
        id: 'card-hr',
        title: 'Dangerous action',
        summary: 'delete',
        stage: 'decision',
        riskLevel: 'high',
        surface: 'control',
        scope: { toolName: 'shell', allowedOperations: ['exec'] },
        effectsSummary: [],
        decision: { action: null, decidedAt: null, decidedBy: null, reason: null },
        leaseId: null,
        approvalId: 'a1',
        runId: null,
        proofEventId: null,
      } as any,
      { action: 'approve', decidedBy: 'op' },
      { surface: 'control', emitProof: false },
    );
    expect(card.decision.action).toBe('approve');

    const permissions = new PermissionService(undefined, null, hr);
    jest.spyOn(permissions as any, 'ensureInit').mockResolvedValue(undefined);
    jest.spyOn(permissions as any, 'getExistingPermission').mockReturnValue({
      permission_id: 'perm-hr',
      status: 'pending',
      executor: 'local',
      kind: 'shell',
      metadata: { riskLevel: 'critical', requiresHighRiskPin: true },
    });
    jest.spyOn(permissions as any, 'buildUpdatedPermission').mockImplementation((existing: any, patch: any) => ({
      ...existing,
      ...patch,
    }));
    jest.spyOn(permissions as any, 'recordPermissionEvent').mockResolvedValue(undefined);
    (permissions as any).repo = { save: jest.fn() };
    (permissions as any).configVersioning = { snapshot: jest.fn() };

    const approved = await permissions.approveRequest('perm-hr', 'operator', {
      decision_note: 'yes',
    });
    expect(approved.status).toBe('approved');
  });

  it('reject never requires extra codes', () => {
    const task = {
      task_id: 'hr-task',
      status: 'waiting_approval',
      risk_level: 5,
      source: 'cli',
      metadata: { requiresHighRiskPin: true, pendingPermissionId: 'p2' },
    } as Task;
    const tm = {
      getTask: () => task,
      advanceState: jest.fn((t: Task, status: string) => {
        t.status = status as Task['status'];
      }),
    };
    const manager = new ApprovalManager(tm as any);
    expect(manager.processApproval('hr-task', 'reject', { surface: 'cli' }).status).toBe('rejected');
  });
});
