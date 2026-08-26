import type { PermissionRequest } from '../../../src/contracts/PermissionRequest';
import {
  HeadlessPermissionDecisionService,
  INLINE_PERMISSION_REJECTION_NOTE,
  buildPermissionApprovalPatch,
  surfaceChoiceToPermissionScopeWord,
} from '../../../src/services/approvals/HeadlessPermissionDecisionService.js';

function buildPermission(overrides: Partial<PermissionRequest> = {}): PermissionRequest {
  return {
    permission_id: 'perm-headless-1',
    created_at: '2026-08-25T09:00:00.000Z',
    updated_at: '2026-08-25T10:00:00.000Z',
    task_id: null,
    executor: 'codex',
    kind: 'command_access',
    status: 'pending',
    scope: 'once',
    workspace: null,
    requested_value: 'npm test',
    resolved_value: null,
    reason: 'Operator approval required.',
    requested_by: '42',
    decided_by: null,
    decision_note: null,
    metadata: {},
    ...overrides,
  };
}

type ServiceOverrides = {
  approveRequest?: jest.Mock;
  rejectRequest?: jest.Mock;
  resolvePermissionReference?: jest.Mock;
};

function buildService(overrides: ServiceOverrides = {}) {
  const approveRequest =
    overrides.approveRequest ??
    jest.fn().mockImplementation(async (_id: string, _by: string | null, patch) => ({
      ...buildPermission({ resolved_value: patch.resolved_value ?? null }),
      status: 'approved',
    }));
  const rejectRequest = overrides.rejectRequest ?? jest.fn().mockResolvedValue(buildPermission());
  const resolvePermissionReference =
    overrides.resolvePermissionReference ?? jest.fn().mockResolvedValue(buildPermission());
  const service = new HeadlessPermissionDecisionService({
    approveRequest,
    rejectRequest,
    resolvePermissionReference,
    normalizePermissionScope: (value) => {
      const clean = String(value || '').trim().toLowerCase();
      if (clean === 'persistent') return 'persistent';
      if (clean === 'workspace') return 'workspace';
      if (clean === 'session') return 'session';
      return 'once';
    },
    buildDecisionSurfaceResponse: (permission, action) =>
      ({
        version: 'surface-response/v1',
        id: `decision-${action}`,
        intent: 'receipt',
        title: action === 'approve' ? 'Permission approved' : 'Permission rejected',
        blocks: [
          { kind: 'text', text: `${action}:${permission.permission_id}` },
        ],
        actions:
          action === 'approve'
            ? []
            : [
                {
                  id: 'a1',
                  label: 'Approve',
                  kind: 'callback' as const,
                  callbackData: `perm:approve:${permission.permission_id}:once`,
                },
              ],
      }) as never,
    externalExecutorAgentId: 'main-agent',
  });
  return { service, approveRequest, rejectRequest, resolvePermissionReference };
}

describe('buildPermissionApprovalPatch', () => {
  it('normalizes an explicit scope word onto the patch', () => {
    const patch = buildPermissionApprovalPatch({
      permission: buildPermission(),
      scopeWord: 'workspace',
      normalizeScope: (value) => (value === 'workspace' ? 'workspace' : 'once'),
      externalExecutorAgentId: null,
    });
    expect(patch).toEqual({ scope: 'workspace' });
  });

  it('keeps the patch empty when no scope word is provided', () => {
    const patch = buildPermissionApprovalPatch({
      permission: buildPermission(),
      scopeWord: null,
      normalizeScope: () => 'once',
      externalExecutorAgentId: null,
    });
    expect(patch).toEqual({});
  });

  it('defaults the resolved value for external-executor permissions through the suggested agent id', () => {
    const patch = buildPermissionApprovalPatch({
      permission: buildPermission({ executor: 'external_executor', metadata: { suggested_agent_id: 'fix-agent' } }),
      scopeWord: null,
      normalizeScope: () => 'once',
      externalExecutorAgentId: 'main-agent',
    });
    expect(patch.resolved_value).toBe('fix-agent');
  });

  it('falls back to the configured agent id and then to main', () => {
    const fromConfig = buildPermissionApprovalPatch({
      permission: buildPermission({ executor: 'external_executor', resolved_value: null }),
      scopeWord: null,
      normalizeScope: () => 'once',
      externalExecutorAgentId: 'config-agent',
    });
    expect(fromConfig.resolved_value).toBe('config-agent');

    const fallback = buildPermissionApprovalPatch({
      permission: buildPermission({ executor: 'external_executor', resolved_value: null }),
      scopeWord: null,
      normalizeScope: () => 'once',
      externalExecutorAgentId: null,
    });
    expect(fallback.resolved_value).toBe('main');
  });

  it('never touches non-executor permissions', () => {
    const patch = buildPermissionApprovalPatch({
      permission: buildPermission({ executor: 'codex' }),
      scopeWord: null,
      normalizeScope: () => 'once',
      externalExecutorAgentId: 'main-agent',
    });
    expect(patch.resolved_value).toBeUndefined();
  });
});

describe('surfaceChoiceToPermissionScopeWord', () => {
  it('maps the unified vocabulary back onto permission scope words', () => {
    expect(surfaceChoiceToPermissionScopeWord('once')).toBe('once');
    expect(surfaceChoiceToPermissionScopeWord('session')).toBe('session');
    expect(surfaceChoiceToPermissionScopeWord('always')).toBe('persistent');
    expect(surfaceChoiceToPermissionScopeWord('deny')).toBe('once');
  });
});

describe('HeadlessPermissionDecisionService', () => {
  it('approves with the pure plan and returns a transport-neutral receipt', async () => {
    const { service, approveRequest } = buildService();
    const outcome = await service.decide({
      reference: 'perm-head',
      action: 'approve',
      scopeWord: 'session',
      actorId: '42',
    });

    expect(approveRequest).toHaveBeenCalledWith(
      'perm-headless-1',
      '42',
      expect.objectContaining({ scope: 'session' }),
    );
    expect(outcome.resolved).toBe(true);
    expect(outcome.receiptText).toContain('approve:perm-headless-1');
    expect(outcome.keyboardSpec).toBeNull();
  });

  it('rejects with the shared inline rejection note and derives a keyboard spec from actions', async () => {
    const { service, rejectRequest } = buildService();
    const outcome = await service.decide({
      reference: 'perm-head',
      action: 'deny',
      scopeWord: null,
      actorId: '42',
    });

    expect(rejectRequest).toHaveBeenCalledWith('perm-headless-1', '42', INLINE_PERMISSION_REJECTION_NOTE);
    expect(outcome.resolved).toBe(true);
    expect(outcome.receiptText).toContain('reject:perm-headless-1');
    expect(outcome.keyboardSpec).toEqual([
      [{ text: 'Approve', callbackData: 'perm:approve:perm-headless-1:once' }],
    ]);
  });

  it('collapses resolution failures into an unresolved error receipt without throwing', async () => {
    const { service } = buildService({
      resolvePermissionReference: jest.fn().mockRejectedValue(new Error('Permission ghost was not found.')),
    });

    const outcome = await service.decide({
      reference: 'ghost',
      action: 'approve',
      scopeWord: null,
      actorId: '42',
    });

    expect(outcome).toEqual({ resolved: false, receiptText: 'Permission ghost was not found.', keyboardSpec: null });
  });

  it('keeps decisions intact when the store rejects the mutation', async () => {
    const { service } = buildService({
      approveRequest: jest.fn().mockRejectedValue(new Error('high-risk gate')),
    });

    const outcome = await service.decide({
      reference: 'perm-head',
      action: 'approve',
      scopeWord: null,
      actorId: '7',
    });

    expect(outcome).toEqual({ resolved: false, receiptText: 'high-risk gate', keyboardSpec: null });
  });
});
