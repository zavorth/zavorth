import { ZavorthEchoService } from '../../../src/services/ZavorthEchoService.js';
import { ZavorthProactivePermissionService } from '../../../src/services/ZavorthProactivePermissionService.js';
import type { EchoPendingExecutionStoreService } from '../../../src/domain/execution/infrastructure/EchoPendingExecutionStoreService.js';
import type {
  SmartDecisionAdvisor,
  SmartDecisionAdvice,
} from '../../../src/services/approvals/SmartDecisionAdvisor.js';
import type { ProfileAccessGate } from '../../../src/tool-runtime/tools/browser/ProfileAccessGateContract.js';

type GateFactory = (advisor: Pick<SmartDecisionAdvisor, 'advise'>) => ProfileAccessGate;

function stubAdvisor(
  action: SmartDecisionAdvice['action'],
  dissentingOpinions?: string[],
): Pick<SmartDecisionAdvisor, 'advise'> {
  return {
    advise: jest.fn(async (): Promise<SmartDecisionAdvice> => ({
      action,
      source: 'deterministic',
      dissentingOpinions,
    })),
  };
}

function buildGateFixture(advisor: Pick<SmartDecisionAdvisor, 'advise'>): {
  gate: ProfileAccessGate;
  permissions: ZavorthProactivePermissionService;
  pendingExecutions: EchoPendingExecutionStoreService;
} {
  const permissions = new ZavorthProactivePermissionService({ filePath: null });
  const service = new ZavorthEchoService({ permissionService: permissions });
  const gate = (service as unknown as { buildProfileAccessGate: GateFactory }).buildProfileAccessGate(advisor);
  return {
    gate,
    permissions,
    pendingExecutions: (service as unknown as { pendingExecutions: EchoPendingExecutionStoreService }).pendingExecutions,
  };
}

describe('ProfileAccessGate', () => {
  it('allows when the linked permission is already approved', async () => {
    const advisor = stubAdvisor('ask');
    const { gate, permissions } = buildGateFixture(advisor);
    const request = await permissions.request({
      action: 'playwright_browser',
      resource: JSON.stringify({ useRealProfile: true, allowedDomains: ['github.com'] }),
      reason: 'fixture request',
    });
    permissions.resolve(request.id, true);

    const result = await gate.requestProfileAccess({
      sessionId: 's1',
      allowedDomains: ['github.com'],
      approvalId: request.id,
    });

    expect(result).toEqual({ allowed: true });
    expect(advisor.advise).not.toHaveBeenCalled();
  });

  it('does not treat a pending approval id as allowed and falls through to the advisor', async () => {
    const advisor = stubAdvisor('ask');
    const { gate, permissions } = buildGateFixture(advisor);
    const request = await permissions.request({
      action: 'playwright_browser',
      resource: '{}',
      reason: 'fixture request',
    });

    const result = await gate.requestProfileAccess({
      sessionId: 's1',
      allowedDomains: ['github.com'],
      approvalId: request.id,
    });

    expect(result.allowed).toBe(false);
    expect(result.approvalRequired).toBe(true);
    expect(advisor.advise).toHaveBeenCalledWith(expect.objectContaining({
      toolName: 'playwright_browser',
      risk: 'danger',
      requiresApproval: true,
    }));
  });

  it('creates a pending permission and returns approvalRequired on ask', async () => {
    const advisor = stubAdvisor('ask');
    const { gate, permissions, pendingExecutions } = buildGateFixture(advisor);

    const result = await gate.requestProfileAccess({
      sessionId: 's1',
      allowedDomains: ['github.com'],
    });

    expect(result.allowed).toBe(false);
    expect(result.approvalRequired).toBe(true);
    expect(result.reason).toBe('Real browser profile access requires explicit operator approval.');
    const approvalId = result.approvalId;
    expect(approvalId).toBeTruthy();
    if (!approvalId) {
      throw new Error('expected an approval id');
    }
    expect(permissions.check(approvalId)?.status).toBe('pending');
    expect(permissions.check(approvalId)?.action).toBe('playwright_browser');
    expect(permissions.check(approvalId)?.resource).toBe(
      JSON.stringify({ useRealProfile: true, allowedDomains: ['github.com'] }),
    );
    expect(permissions.check(approvalId)?.metadata).toEqual(expect.objectContaining({
      kind: 'tool',
      toolName: 'playwright_browser',
      args: { useRealProfile: true, allowedDomains: ['github.com'] },
      sessionId: 's1',
    }));
    expect(pendingExecutions.get(approvalId)).not.toBeNull();
    expect(advisor.advise).toHaveBeenCalledWith(expect.objectContaining({
      toolName: 'playwright_browser',
      pattern: 'real-profile-access:github.com',
      risk: 'danger',
      sessionId: 's1',
      requiresApproval: true,
    }));
  });

  it('denies with dissenting opinions joined when the advisor vetoes', async () => {
    const advisor = stubAdvisor('deny', ['[peer-1] veto', '[peer-2] veto']);
    const { gate } = buildGateFixture(advisor);

    const result = await gate.requestProfileAccess({
      sessionId: 's1',
      allowedDomains: ['github.com'],
    });

    expect(result).toEqual({ allowed: false, reason: '[peer-1] veto; [peer-2] veto' });
  });

  it('denies with a typed default reason when deny has no dissenting opinions', async () => {
    const advisor = stubAdvisor('deny');
    const { gate } = buildGateFixture(advisor);

    const result = await gate.requestProfileAccess({
      sessionId: 's1',
      allowedDomains: ['github.com'],
    });

    expect(result).toEqual({ allowed: false, reason: 'Denied by decision policy or peer review veto.' });
  });

  it('fails closed when the advisor throws', async () => {
    const advisor: Pick<SmartDecisionAdvisor, 'advise'> = {
      advise: jest.fn(async () => {
        throw new Error('advisor offline');
      }),
    };
    const { gate, permissions } = buildGateFixture(advisor);

    const result = await gate.requestProfileAccess({
      sessionId: 's1',
      allowedDomains: ['github.com'],
    });

    expect(result).toEqual({
      allowed: false,
      reason: 'Profile access gate evaluation failed; refusing to mount the real browser profile.',
    });
    expect(permissions.listPending()).toHaveLength(0);
  });

  it('allows directly on an allow verdict without creating a permission', async () => {
    const advisor = stubAdvisor('allow');
    const { gate, permissions } = buildGateFixture(advisor);

    const result = await gate.requestProfileAccess({
      sessionId: 's1',
      allowedDomains: ['github.com'],
    });

    expect(result).toEqual({ allowed: true });
    expect(permissions.listPending()).toHaveLength(0);
  });
});
