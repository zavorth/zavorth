import {
  ApprovalCoordinator,
  APPROVAL_MENU_TIMEOUT_MS,
  type ApprovalCoordinatorGatewayPort,
  type ApprovalCoordinatorRunView,
} from '../../src/services/approvals/ApprovalCoordinator.js';
import {
  registerSurfaceProfile,
  resetSurfaceProfileRegistryForTests,
} from '../../src/domain/surface/application/surface-affordance/index.js';

type RecordedApproval = {
  ref: string;
  options?: { choice?: string | null; surface?: string | null; sessionId?: string | null };
};

type RecordedRejection = {
  ref: string;
  options?: { reason?: string | null };
};

type FakeGatewayPort = ApprovalCoordinatorGatewayPort & {
  recordedApprovals: RecordedApproval[];
  recordedRejections: RecordedRejection[];
  runs: ApprovalCoordinatorRunView[];
};

function createFakeGateway(
  overrides: Partial<Pick<FakeGatewayPort, 'approve' | 'reject' | 'findPendingApproval' | 'listRuns'>> = {},
): FakeGatewayPort {
  const port: FakeGatewayPort = {
    recordedApprovals: [],
    recordedRejections: [],
    runs: [],
    findPendingApproval(ref) {
      return ref ? { run: { id: 'run-1' }, approval: { id: ref } } : null;
    },
    async approve(ref, options) {
      port.recordedApprovals.push({ ref, options });
      return { ok: true };
    },
    async reject(ref, options) {
      port.recordedRejections.push({ ref, options });
      return { ok: true };
    },
    listRuns(limit = 20) {
      return port.runs.slice(0, limit);
    },
    ...overrides,
  };
  return port;
}

function pendingRun(id: string, sessionId: string, approvalIds: string[]): ApprovalCoordinatorRunView {
  return {
    id,
    sessionId,
    approvals: approvalIds.map((approvalId) => ({ id: approvalId, status: 'pending' as const })),
  };
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
      expect(gateway.recordedRejections).toEqual([{ ref: 'approval-a', options: undefined }]);
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

    it('suppresses receipts for surfaces whose capability presentation resolves to none', async () => {
      registerSurfaceProfile({
        id: 'silent-relay',
        channel: 'plain',
        label: 'Silent relay',
        preset: 'chat-basic',
        overrides: {
          affordances: { text: false, slash_commands: false },
        },
      });
      const gateway = createFakeGateway();
      const coordinator = new ApprovalCoordinator(gateway);

      try {
        const receipt = await coordinator.executeApprovalDecision({
          command: { action: 'approve', ref: 'approval-a', choice: 'once' },
          surface: 'silent-relay',
          sessionId: 'silent-relay:chat-1',
        });

        expect(receipt).toBeNull();
        expect(gateway.recordedApprovals).toHaveLength(1);
      } finally {
        resetSurfaceProfileRegistryForTests();
      }
    });
  });

  describe('bulk decisions ("all" reference)', () => {
    it('approves every pending approval visible to the chat session', async () => {
      const gateway = createFakeGateway();
      gateway.runs = [
        pendingRun('run-1', 'slack:C-ops', ['approval-a']),
        pendingRun('run-2', 'slack:C-ops', ['approval-b', 'approval-c']),
        pendingRun('run-3', 'signal:other-chat', ['approval-d']),
      ];
      const coordinator = new ApprovalCoordinator(gateway);

      const receipt = await coordinator.executeApprovalDecision({
        command: { action: 'approve', ref: 'all', choice: 'once' },
        surface: 'slack',
        sessionId: 'slack:C-ops',
      });

      expect(receipt).toBe('Approved all 3 approval(s) (once).');
      expect(gateway.recordedApprovals.map((entry) => entry.ref)).toEqual([
        'approval-a',
        'approval-b',
        'approval-c',
      ]);
      expect(gateway.recordedApprovals.every((entry) => entry.options?.sessionId === 'slack:C-ops')).toBe(true);
      expect(gateway.recordedApprovals.every((entry) => entry.options?.surface === 'slack')).toBe(true);
    });

    it('applies the requested scope choice to every bulk approval', async () => {
      const gateway = createFakeGateway();
      gateway.runs = [pendingRun('run-1', 'slack:C-ops', ['approval-a'])];
      const coordinator = new ApprovalCoordinator(gateway);

      const receipt = await coordinator.executeApprovalDecision({
        command: { action: 'approve', ref: 'ALL', choice: 'session' },
        surface: 'slack',
        sessionId: 'slack:C-ops',
      });

      expect(receipt).toBe('Approved all 1 approval(s) (session).');
      expect(gateway.recordedApprovals[0]?.options?.choice).toBe('session');
    });

    it('denies every pending approval visible to the chat session', async () => {
      const gateway = createFakeGateway();
      gateway.runs = [
        pendingRun('run-1', 'slack:C-ops', ['approval-a']),
        pendingRun('run-2', 'slack:C-ops', ['approval-b']),
      ];
      const coordinator = new ApprovalCoordinator(gateway);

      const receipt = await coordinator.executeApprovalDecision({
        command: { action: 'deny', ref: 'all', choice: 'once' },
        surface: 'slack',
        sessionId: 'slack:C-ops',
      });

      expect(receipt).toBe('Denied 2 approval(s).');
      expect(gateway.recordedRejections.map((entry) => entry.ref)).toEqual(['approval-a', 'approval-b']);
    });

    it('reports partial bulk outcomes when some refs are no longer pending', async () => {
      const gateway = createFakeGateway({
        async approve(ref) {
          return ref === 'approval-a' ? { ok: true } : null;
        },
      });
      gateway.runs = [pendingRun('run-1', 'slack:C-ops', ['approval-a', 'approval-b'])];
      const coordinator = new ApprovalCoordinator(gateway);

      const receipt = await coordinator.executeApprovalDecision({
        command: { action: 'approve', ref: 'all', choice: 'once' },
        surface: 'slack',
        sessionId: 'slack:C-ops',
      });

      expect(receipt).toBe('Approved 1 of 2 approval(s) (once).');
    });

    it('reports the not-found receipt when the chat has no visible pending approvals', async () => {
      const gateway = createFakeGateway();
      const coordinator = new ApprovalCoordinator(gateway);

      const receipt = await coordinator.executeApprovalDecision({
        command: { action: 'approve', ref: 'all', choice: 'once' },
        surface: 'slack',
        sessionId: 'slack:C-empty',
      });

      expect(receipt).toBe('No pending approval found for all.');
      expect(gateway.recordedApprovals).toEqual([]);
    });
  });

  describe('"other" escape option and free-text capture', () => {
    it('arms the capture mode through the ordinal 0 escape on a live menu', () => {
      const gateway = createFakeGateway();
      const coordinator = new ApprovalCoordinator(gateway);
      coordinator.registerPendingMenu('slack:C-ops', ['approval-a']);

      const interaction = coordinator.resolveApprovalInteraction('slack:C-ops', '0');

      expect(interaction).toEqual({ kind: 'other-armed', refList: ['approval-a'] });
      expect(coordinator.hasLivePendingMenu('slack:C-ops')).toBe(false);
    });

    it('arms the capture mode through the "other" keyword on a live menu', () => {
      const gateway = createFakeGateway();
      const coordinator = new ApprovalCoordinator(gateway);
      coordinator.registerPendingMenu('slack:C-ops', ['approval-a', 'approval-b']);

      const interaction = coordinator.resolveApprovalInteraction('slack:C-ops', 'OTHER');

      expect(interaction).toEqual({ kind: 'other-armed', refList: ['approval-a', 'approval-b'] });
    });

    it('keeps the keyword as agent-owned prose while no menu exists', () => {
      const gateway = createFakeGateway();
      const coordinator = new ApprovalCoordinator(gateway);

      expect(coordinator.resolveApprovalInteraction('slack:C-ops', 'other')).toEqual({ kind: 'free-prose' });
    });

    it('captures the next free-text message as a decision-context packet', () => {
      const gateway = createFakeGateway();
      const coordinator = new ApprovalCoordinator(gateway);
      coordinator.registerPendingMenu('slack:C-ops', ['approval-a']);
      coordinator.resolveApprovalInteraction('slack:C-ops', 'other');

      const interaction = coordinator.resolveApprovalInteraction('slack:C-ops', 'not now, change the target first');

      expect(interaction).toEqual({
        kind: 'other-context',
        userText: 'not now, change the target first',
        refList: ['approval-a'],
      });
      // The capture is single-shot: the following message returns to prose.
      expect(coordinator.resolveApprovalInteraction('slack:C-ops', 'regular chat text')).toEqual({
        kind: 'free-prose',
      });
    });

    it('re-arms instead of capturing when the operator repeats the escape keyword', () => {
      const gateway = createFakeGateway();
      const coordinator = new ApprovalCoordinator(gateway);
      coordinator.registerPendingMenu('slack:C-ops', ['approval-a']);
      coordinator.resolveApprovalInteraction('slack:C-ops', 'other');

      expect(coordinator.resolveApprovalInteraction('slack:C-ops', 'other')).toEqual({
        kind: 'other-armed',
        refList: ['approval-a'],
      });
    });

    it('lets an explicit command win over an armed capture and clears it fail-closed', () => {
      const gateway = createFakeGateway();
      const coordinator = new ApprovalCoordinator(gateway);
      coordinator.registerPendingMenu('slack:C-ops', ['approval-a']);
      coordinator.resolveApprovalInteraction('slack:C-ops', 'other');

      expect(coordinator.resolveApprovalInteraction('slack:C-ops', '/reject approval-a')).toEqual({
        kind: 'explicit-command',
        command: { action: 'deny', ref: 'approval-a', choice: 'always' },
      });
      expect(
        coordinator.resolveApprovalInteraction('slack:C-ops', 'free text after explicit command'),
      ).toEqual({ kind: 'free-prose' });
    });

    it('expires an armed capture after the timeout so stale context never decides later messages', () => {
      let nowMs = 5_000_000;
      const gateway = createFakeGateway();
      const coordinator = new ApprovalCoordinator(gateway, () => nowMs);
      coordinator.registerPendingMenu('slack:C-ops', ['approval-a']);
      coordinator.resolveApprovalInteraction('slack:C-ops', 'other');
      nowMs += APPROVAL_MENU_TIMEOUT_MS;

      expect(coordinator.resolveApprovalInteraction('slack:C-ops', 'late answer')).toEqual({
        kind: 'free-prose',
      });
    });

    it('describes the capture mode with the referenced approval count', () => {
      const gateway = createFakeGateway();
      const coordinator = new ApprovalCoordinator(gateway);

      expect(coordinator.buildOtherModePrompt(2)).toBe(
        'Describe your answer for 2 pending approval(s); your next message is captured as the decision context.',
      );
    });
  });

  describe('deny-with-reason relay', () => {
    it('denies every referenced approval and forwards the operator reason', async () => {
      const gateway = createFakeGateway();
      const coordinator = new ApprovalCoordinator(gateway);

      const receipt = await coordinator.executeDenyWithReason({
        refList: ['approval-a', 'approval-b'],
        reason: 'not while production is frozen',
        surface: 'slack',
        sessionId: 'slack:C-ops',
      });

      expect(receipt).toBe('Denied 2 approval(s). Your answer was relayed to the agent.');
      expect(gateway.recordedRejections).toEqual([
        { ref: 'approval-a', options: { reason: 'not while production is frozen' } },
        { ref: 'approval-b', options: { reason: 'not while production is frozen' } },
      ]);
    });

    it('reports the not-found receipt when nothing referenced is still pending', async () => {
      const gateway = createFakeGateway({
        async reject() {
          return null;
        },
      });
      const coordinator = new ApprovalCoordinator(gateway);

      const receipt = await coordinator.executeDenyWithReason({
        refList: ['stale-ref'],
        reason: 'changed my mind',
        surface: 'slack',
        sessionId: 'slack:C-ops',
      });

      expect(receipt).toBe('No pending approval found for the referenced approvals.');
    });
  });
});
