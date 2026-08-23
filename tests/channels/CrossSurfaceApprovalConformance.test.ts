import {
  ApprovalCoordinator,
  APPROVAL_MENU_TIMEOUT_MS,
  type ApprovalCoordinatorGatewayPort,
  type ApprovalCoordinatorRunView,
} from '../../src/services/approvals/ApprovalCoordinator.js';
import {
  renderApprovalPromptForSurface,
  resolveSurfaceCapabilityPresentation,
} from '../../src/channels/capabilities/SurfaceCapabilityGate.js';
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

type ConformanceGatewayPort = ApprovalCoordinatorGatewayPort & {
  recordedApprovals: RecordedApproval[];
  recordedRejections: RecordedRejection[];
  resolvedRefs: Set<string>;
  runs: ApprovalCoordinatorRunView[];
};

/**
 * Presenter fixtures: every surface that renders approval menus must behave
 * identically at the spine. "telegram" exercises the interactive-card
 * presenter, "signal" the numbered-text fallback, and the registered
 * "suppressed-relay" profile a channel whose feature set disables approvals.
 */
const PRESENTER_FIXTURES = [
  { fixture: 'interactive-capable', platform: 'telegram', chatId: 'tg-chat-1', expectedMode: 'interactive-cards' },
  { fixture: 'numbered-text', platform: 'signal', chatId: 'sig-chat-1', expectedMode: 'numbered-text' },
] as const;

function createGateway(sessionId: string): ConformanceGatewayPort {
  const port: ConformanceGatewayPort = {
    recordedApprovals: [],
    recordedRejections: [],
    resolvedRefs: new Set<string>(),
    runs: [],
    findPendingApproval(ref) {
      return ref && !port.resolvedRefs.has(ref) ? { run: { id: 'run-1' }, approval: { id: ref } } : null;
    },
    async approve(ref, options) {
      port.recordedApprovals.push({ ref, options });
      port.resolvedRefs.add(ref);
      return { ok: true };
    },
    async reject(ref, options) {
      port.recordedRejections.push({ ref, options });
      port.resolvedRefs.add(ref);
      return { ok: true };
    },
    listRuns(limit = 20) {
      return port.runs.slice(0, limit);
    },
  };
  void sessionId;
  return port;
}

describe('cross-surface approval conformance', () => {
  beforeAll(() => {
    registerSurfaceProfile({
      id: 'suppressed-relay',
      channel: 'plain',
      label: 'Suppressed relay',
      preset: 'chat-basic',
      overrides: {
        affordances: { text: false, slash_commands: false },
      },
    });
  });

  afterAll(() => {
    resetSurfaceProfileRegistryForTests();
  });

  function createCoordinator(
    gateway: ConformanceGatewayPort,
    nowMs: () => number = () => Date.now(),
  ): ApprovalCoordinator {
    return new ApprovalCoordinator(gateway, nowMs);
  }

  describe.each(PRESENTER_FIXTURES)(
    '$fixture presenter ($platform)',
    ({ platform, chatId, expectedMode }) => {
      const sessionId = `${platform}:${chatId}`;

      it('resolves the declared capability presentation for its fixture class', () => {
        expect(resolveSurfaceCapabilityPresentation({ platform }).mode).toBe(expectedMode);
      });

      it('produces identical decisions and remembers scopes through the coordinator', async () => {
        const gateway = createGateway(sessionId);
        const coordinator = createCoordinator(gateway);
        coordinator.registerPendingMenu(sessionId, ['approval-a', 'approval-b']);

        const interaction = coordinator.resolveApprovalInteraction(sessionId, '2');
        expect(interaction).toEqual({
          kind: 'fast-path-command',
          command: { action: 'approve', ref: 'approval-b', choice: 'once' },
        });

        const receipt = await coordinator.executeApprovalDecision({
          command: interaction.command,
          surface: platform,
          sessionId,
          locale: 'en-US',
        });
        expect(receipt).toBe('Approved approval-b (once).');
        expect(gateway.recordedApprovals).toEqual([
          { ref: 'approval-b', options: { choice: 'once', surface: platform, sessionId } },
        ]);

        const scopedReceipt = await coordinator.executeApprovalDecision({
          command: { action: 'approve', ref: 'approval-a', choice: 'session' },
          surface: platform,
          sessionId,
          locale: 'en-US',
        });
        expect(scopedReceipt).toBe('Approved approval-a (session).');
        expect(gateway.recordedApprovals[1]?.options?.choice).toBe('session');
      });

      it('renders identical receipts per locale for en-US and pt-BR', async () => {
        for (const [locale, approvedReceipt, deniedReceipt] of [
          ['en-US', 'Approved approval-a (once).', 'Denied approval approval-a.'],
          ['pt-BR', 'Aprovado approval-a (once).', 'Aprovação approval-a negada.'],
        ] as const) {
          const gateway = createGateway(sessionId);
          const coordinator = createCoordinator(gateway);

          expect(
            await coordinator.executeApprovalDecision({
              command: { action: 'approve', ref: 'approval-a', choice: 'once' },
              surface: platform,
              sessionId,
              locale,
            }),
          ).toBe(approvedReceipt);

          const gatewayForDenial = createGateway(sessionId);
          const coordinatorForDenial = createCoordinator(gatewayForDenial);
          expect(
            await coordinatorForDenial.executeApprovalDecision({
              command: { action: 'deny', ref: 'approval-a', choice: 'once' },
              surface: platform,
              sessionId,
              locale,
            }),
          ).toBe(deniedReceipt);
        }
      });

      it('expires menus fail-closed after the timeout window', () => {
        let nowMs = 2_000_000;
        const gateway = createGateway(sessionId);
        const coordinator = createCoordinator(gateway, () => nowMs);
        coordinator.registerPendingMenu(sessionId, ['approval-a']);
        nowMs += APPROVAL_MENU_TIMEOUT_MS;

        expect(coordinator.resolveApprovalInteraction(sessionId, '1')).toEqual({ kind: 'free-prose' });
        expect(coordinator.hasLivePendingMenu(sessionId)).toBe(false);
      });

      it('coalesces duplicate requests and propagates denies across copies', async () => {
        const gateway = createGateway(sessionId);
        const coordinator = createCoordinator(gateway);

        const leader = coordinator.registerPendingApproval({
          sessionId,
          ref: 'approval-a',
          title: 'run npm test',
          risk: 'high',
        });
        const follower = coordinator.registerPendingApproval({
          sessionId,
          ref: 'approval-b',
          title: 'run npm test',
          risk: 'high',
        });

        expect(leader).toEqual({ leaderRef: 'approval-a', isDuplicate: false });
        expect(follower).toEqual({ leaderRef: 'approval-a', isDuplicate: true });

        const receipt = await coordinator.executeApprovalDecision({
          command: { action: 'deny', ref: 'approval-a', choice: 'once' },
          surface: platform,
          sessionId,
          locale: 'en-US',
        });

        expect(receipt).toBe('Denied approval approval-a.');
        expect(gateway.recordedRejections.map((entry) => entry.ref)).toEqual([
          'approval-a',
          'approval-b',
        ]);
      });

      it('re-prompts remaining followers of a once decision through its own presenter', async () => {
        const gateway = createGateway(sessionId);
        const coordinator = createCoordinator(gateway);
        coordinator.registerPendingApproval({
          sessionId,
          ref: 'approval-a',
          title: 'run npm test',
          risk: 'high',
        });
        coordinator.registerPendingApproval({
          sessionId,
          ref: 'approval-b',
          title: 'run npm test',
          risk: 'high',
        });

        const receipt = await coordinator.executeApprovalDecision({
          command: { action: 'approve', ref: 'approval-a', choice: 'once' },
          surface: platform,
          sessionId,
          locale: 'en-US',
        });

        expect(receipt).toBe(
          'Approved approval-a (once).\n[high] run npm test — ref approval-b\nReply 1 (or the ref) to allow once, approve / approve session / approve always, or reject (or deny) to refuse.',
        );
        expect(gateway.recordedApprovals.map((entry) => entry.ref)).toEqual(['approval-a']);
      });
    },
  );

  describe('suppressed-capability surface', () => {
    const platform = 'suppressed-relay';
    const sessionId = `${platform}:chat-1`;

    it('never renders prompts or receipts while decisions still execute', async () => {
      const presentation = resolveSurfaceCapabilityPresentation({ platform });
      expect(presentation.mode).toBe('none');
      expect(
        renderApprovalPromptForSurface(presentation, [
          { label: 'run npm test', risk: 'high', ref: 'approval-a' },
        ]),
      ).toBeNull();

      const gateway = createGateway(sessionId);
      const coordinator = new ApprovalCoordinator(gateway);
      coordinator.registerPendingMenu(sessionId, ['approval-a']);

      const approveReceipt = await coordinator.executeApprovalDecision({
        command: { action: 'approve', ref: 'approval-a', choice: 'session' },
        surface: platform,
        sessionId,
        locale: 'en-US',
      });
      expect(approveReceipt).toBeNull();
      expect(gateway.recordedApprovals).toEqual([
        { ref: 'approval-a', options: { choice: 'session', surface: platform, sessionId } },
      ]);

      const denialReceipt = await coordinator.executeDenyWithReason({
        refList: ['approval-a'],
        reason: 'production frozen',
        surface: platform,
        sessionId,
        locale: 'en-US',
      });
      expect(denialReceipt).toBeNull();
      expect(gateway.recordedRejections.map((entry) => entry.ref)).toEqual(['approval-a']);
    });

    it('keeps coalescing semantics silent but effective without any rendered prompt', async () => {
      const gateway = createGateway(sessionId);
      const coordinator = new ApprovalCoordinator(gateway);
      coordinator.registerPendingApproval({
        sessionId,
        ref: 'approval-a',
        title: 'run npm test',
        risk: 'high',
      });
      coordinator.registerPendingApproval({
        sessionId,
        ref: 'approval-b',
        title: 'run npm test',
        risk: 'high',
      });

      const receipt = await coordinator.executeApprovalDecision({
        command: { action: 'deny', ref: 'approval-a', choice: 'once' },
        surface: platform,
        sessionId,
        locale: 'en-US',
      });

      expect(receipt).toBeNull();
      expect(gateway.recordedRejections.map((entry) => entry.ref)).toEqual([
        'approval-a',
        'approval-b',
      ]);
    });
  });
});
