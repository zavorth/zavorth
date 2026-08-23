import {
  ApprovalCoordinator,
  APPROVAL_MENU_TIMEOUT_MS,
  type ApprovalCoordinatorGatewayPort,
} from '../../src/services/approvals/ApprovalCoordinator.js';

type RecordedApproval = {
  ref: string;
  options?: { choice?: string | null; surface?: string | null; sessionId?: string | null };
};

type FakeGatewayPort = ApprovalCoordinatorGatewayPort & {
  recordedApprovals: RecordedApproval[];
  recordedRejections: string[];
};

function createFakeGateway(
  overrides: Partial<Pick<FakeGatewayPort, 'approve' | 'reject' | 'findPendingApproval'>> = {},
): FakeGatewayPort {
  const port: FakeGatewayPort = {
    recordedApprovals: [],
    recordedRejections: [],
    findPendingApproval(ref) {
      return ref ? { run: { id: 'run-1' }, approval: { id: ref } } : null;
    },
    async approve(ref, options) {
      port.recordedApprovals.push({ ref, options });
      return { ok: true };
    },
    async reject(ref) {
      port.recordedRejections.push(ref);
      return { ok: true };
    },
    ...overrides,
  };
  return port;
}

describe('ApprovalCoordinator', () => {
  describe('menu registration and fast-path resolution', () => {
    it('resolves an ordinal token against the registered menu refs', () => {
      const gateway = createFakeGateway();
      const coordinator = new ApprovalCoordinator(gateway);
      coordinator.registerPendingMenu('slack:C-ops', ['approval-a', 'approval-b']);

      const interaction = coordinator.resolveApprovalInteraction('slack:C-ops', '2');

      expect(interaction).toEqual({
        kind: 'fast-path-command',
        command: { action: 'approve', ref: 'approval-b', choice: 'once' },
      });
      expect(coordinator.hasLivePendingMenu('slack:C-ops')).toBe(false);
    });

    it('maps bare decision words to the first pending menu entry and consumes the menu', () => {
      const gateway = createFakeGateway();
      const coordinator = new ApprovalCoordinator(gateway);
      coordinator.registerPendingMenu('slack:C-ops', ['approval-a', 'approval-b']);

      expect(coordinator.resolveApprovalInteraction('slack:C-ops', 'always')).toEqual({
        kind: 'fast-path-command',
        command: { action: 'approve', ref: 'approval-a', choice: 'always' },
      });
      expect(coordinator.resolveApprovalInteraction('slack:C-ops', 'no')).toEqual({
        kind: 'free-prose',
      });
    });

    it('never resolves a fast-path decision while no live menu exists for the chat', () => {
      const gateway = createFakeGateway();
      const coordinator = new ApprovalCoordinator(gateway);

      expect(coordinator.resolveApprovalInteraction('slack:C-ops', '1')).toEqual({ kind: 'free-prose' });
      expect(coordinator.hasLivePendingMenu('slack:C-ops')).toBe(false);
    });

    it('classifies free prose as agent-owned text and clears the stale menu fail-closed', () => {
      const gateway = createFakeGateway();
      const coordinator = new ApprovalCoordinator(gateway);
      coordinator.registerPendingMenu('slack:C-ops', ['approval-a']);

      expect(coordinator.resolveApprovalInteraction('slack:C-ops', 'yes please go ahead and do it')).toEqual({
        kind: 'free-prose',
      });
      expect(coordinator.hasLivePendingMenu('slack:C-ops')).toBe(false);
    });

    it('expires menus after the timeout window so stale tokens cannot approve anything', () => {
      let nowMs = 1_000_000;
      const gateway = createFakeGateway();
      const coordinator = new ApprovalCoordinator(gateway, () => nowMs);
      coordinator.registerPendingMenu('slack:C-ops', ['approval-a']);
      nowMs += APPROVAL_MENU_TIMEOUT_MS;

      expect(coordinator.resolveApprovalInteraction('slack:C-ops', '1')).toEqual({ kind: 'free-prose' });
    });

    it('keeps menus alive right before the timeout window closes', () => {
      let nowMs = 1_000_000;
      const gateway = createFakeGateway();
      const coordinator = new ApprovalCoordinator(gateway, () => nowMs);
      coordinator.registerPendingMenu('slack:C-ops', ['approval-a']);
      nowMs += APPROVAL_MENU_TIMEOUT_MS - 1;

      expect(coordinator.resolveApprovalInteraction('slack:C-ops', '1')).toEqual({
        kind: 'fast-path-command',
        command: { action: 'approve', ref: 'approval-a', choice: 'once' },
      });
    });

    it('lets explicit slash commands resolve even without any registered menu', () => {
      const gateway = createFakeGateway();
      const coordinator = new ApprovalCoordinator(gateway);

      expect(coordinator.resolveApprovalInteraction('slack:C-ops', '/approve approval-a session')).toEqual({
        kind: 'explicit-command',
        command: { action: 'approve', ref: 'approval-a', choice: 'session' },
      });
    });
  });

  describe('decision execution and receipts', () => {
    it('executes approvals with the surface and per-chat session identifiers attached', async () => {
      const gateway = createFakeGateway();
      const coordinator = new ApprovalCoordinator(gateway);

      const receipt = await coordinator.executeApprovalDecision({
        command: { action: 'approve', ref: 'approval-a', choice: 'session' },
        surface: 'slack',
        sessionId: 'slack:C-ops',
      });

      expect(receipt).toBe('Approved approval-a (session).');
      expect(gateway.recordedApprovals).toEqual([
        {
          ref: 'approval-a',
          options: { choice: 'session', surface: 'slack', sessionId: 'slack:C-ops' },
        },
      ]);
      expect(gateway.recordedRejections).toEqual([]);
    });

    it('routes deny decisions through rejection and reports the denial receipt', async () => {
      const gateway = createFakeGateway();
      const coordinator = new ApprovalCoordinator(gateway);

      const receipt = await coordinator.executeApprovalDecision({
        command: { action: 'deny', ref: 'approval-a', choice: 'once' },
        surface: 'signal',
        sessionId: 'signal:chat-1',
      });

      expect(receipt).toBe('Denied approval approval-a.');
      expect(gateway.recordedRejections).toEqual(['approval-a']);
      expect(gateway.recordedApprovals).toEqual([]);
    });

    it('reports the not-found receipt when the gateway has no matching pending approval', async () => {
      const gateway = createFakeGateway({
        async approve() {
          return null;
        },
        async reject() {
          return null;
        },
      });
      const coordinator = new ApprovalCoordinator(gateway);

      const approvedReceipt = await coordinator.executeApprovalDecision({
        command: { action: 'approve', ref: 'missing-ref', choice: 'once' },
        surface: 'slack',
        sessionId: 'slack:C-ops',
      });
      const deniedReceipt = await coordinator.executeApprovalDecision({
        command: { action: 'deny', ref: 'missing-ref', choice: 'once' },
        surface: 'slack',
        sessionId: 'slack:C-ops',
      });

      expect(approvedReceipt).toBe('No pending approval found for missing-ref.');
      expect(deniedReceipt).toBe('No pending approval found for missing-ref.');
    });

    it('converts gateway failures into the not-found receipt instead of throwing at the channel', async () => {
      const gateway = createFakeGateway({
        async approve() {
          throw new Error('executor crashed');
        },
      });
      const coordinator = new ApprovalCoordinator(gateway);

      const receipt = await coordinator.executeApprovalDecision({
        command: { action: 'approve', ref: 'approval-a', choice: 'once' },
        surface: 'slack',
        sessionId: 'slack:C-ops',
      });

      expect(receipt).toBe('No pending approval found for approval-a.');
    });
  });
});
